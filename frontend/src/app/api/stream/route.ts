import { NextRequest, NextResponse } from "next/server";

/**
 * Development-only same-origin SSE bridge.
 *
 * Browser -> EventSource /api/stream -> private WebSocket with tenant viewer JWT
 * -> Fastify /api/v1/stream.
 *
 * The JWT never crosses to browser JavaScript. Do not enable on a public
 * deployment without application user authentication and authorization.
 */
export async function GET(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "development" ||
    !["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "The live stream requires a local development server." },
      { status: 403 },
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Cross-site streaming is not allowed." }, { status: 403 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol || !/^[A-Z0-9]{3,10}$/.test(symbol)) {
    return NextResponse.json({ error: "A valid market symbol is required." }, { status: 400 });
  }

  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) {
    return NextResponse.json({ error: "The chart viewer JWT is not configured." }, { status: 503 });
  }

  if (typeof WebSocket === "undefined") {
    return NextResponse.json({ error: "The server runtime cannot open WebSockets." }, { status: 503 });
  }

  let backend: URL;
  try {
    backend = new URL(process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3000");
    if (backend.protocol !== "http:" && backend.protocol !== "https:") {
      throw new Error("Unsupported backend protocol");
    }
    backend.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
    backend.pathname = "/api/v1/stream";
    backend.search = "";
    backend.hash = "";
  } catch {
    return NextResponse.json({ error: "Invalid backend URL configuration." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let upstream: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  function write(message: string) {
    if (closed || !controllerRef) return;
    try {
      controllerRef.enqueue(encoder.encode(message));
    } catch {
      close();
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    request.signal.removeEventListener("abort", close);
    if (upstream && upstream.readyState !== WebSocket.CLOSED) {
      upstream.close();
    }
    try {
      controllerRef?.close();
    } catch {
      // May already have been cancelled by the browser.
    }
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) {
        close();
        return;
      }

      write("retry: 5000\n\n");
      heartbeat = setInterval(() => write(": heartbeat\n\n"), 20000);

      try {
        // The first subprotocol is safe for the server to echo in the handshake.
        // The JWT is offered only in this backend-to-backend connection.
        upstream = new WebSocket(backend.toString(), ["trading-pulse", "jwt." + token]);
      } catch {
        write("event: offline\ndata: {}\n\n");
        close();
        return;
      }

      upstream.addEventListener("open", () => {
        write("event: ready\ndata: {}\n\n");
      });

      upstream.addEventListener("message", (event) => {
        try {
          if (typeof event.data !== "string") return;
          const data: unknown = JSON.parse(event.data);
          if (!data || typeof data !== "object") return;
          const item = data as Record<string, unknown>;
          if (
            item.type !== "CANDLE" ||
            item.symbol !== symbol ||
            item.completed !== true ||
            typeof item.timestamp !== "string"
          ) return;

          // A notification, not untrusted candle values. Chart reloads the
          // authenticated historical API as its source of truth.
          write("event: candle\ndata: " + JSON.stringify({
            symbol,
            timestamp: item.timestamp,
          }) + "\n\n");
        } catch {
          // Discard invalid or unrelated upstream frames.
        }
      });

      upstream.addEventListener("error", () => {
        write("event: offline\ndata: {}\n\n");
        close();
      });
      upstream.addEventListener("close", () => {
        write("event: offline\ndata: {}\n\n");
        close();
      });
    },
    cancel() {
      close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
