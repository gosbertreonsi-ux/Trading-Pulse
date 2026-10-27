import { NextRequest, NextResponse } from "next/server";

/** Development-only BFF for a disposable paper order sandbox. */
function reject(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}
async function proxy(request: NextRequest, method: "GET" | "POST" | "DELETE") {
  if (process.env.NODE_ENV !== "development" ||
      !["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) {
    return reject("Paper matching requires a local development server", 403);
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) return reject("Cross-site requests forbidden", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reject("Cross-origin requests forbidden", 403);
  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) return reject("Viewer token missing from frontend .env.local", 503);

  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  let backend: URL;
  try {
    const base = new URL(process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001");
    if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(base.hostname)) {
      throw new Error("Loopback backend required");
    }
    backend = new URL("/api/v1/paper/book", base);
  } catch { return reject("Configure a local Fastify URL", 503); }

  let body: string | undefined;
  if (method === "GET") {
    const symbol = request.nextUrl.searchParams.get("symbol");
    if (!symbol || !symbols.includes(symbol)) return reject("Supported symbol required", 400);
    backend.searchParams.set("symbol", symbol);
  } else if (method === "POST") {
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return reject("JSON body required", 415);
    }
    if (Number(request.headers.get("content-length") ?? 0) > 1024) return reject("Request too large", 413);
    try {
      const obj: unknown = await request.json();
      if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
      const input = obj as Record<string, unknown>;
      if (!symbols.includes(String(input.symbol)) ||
          !["BUY", "SELL"].includes(String(input.side)) ||
          typeof input.price !== "number" || !Number.isFinite(input.price) ||
          typeof input.quantity !== "number" || !Number.isFinite(input.quantity)) {
        return reject("Invalid paper order fields", 400);
      }
      body = JSON.stringify({
        symbol: input.symbol, side: input.side, price: input.price, quantity: input.quantity,
      });
      backend.pathname = "/api/v1/paper/orders";
    } catch { return reject("Invalid JSON body", 400); }
  } else {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^[a-fA-F0-9-]{36}$/.test(id)) return reject("Valid order ID required", 400);
    backend.pathname = "/api/v1/paper/orders/" + encodeURIComponent(id);
  }

  try {
    const response = await fetch(backend, {
      method, cache: "no-store",
      headers: {
        Authorization: "Bearer " + token, Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const result: unknown = await response.json();
    if (!result || typeof result !== "object") return reject("Malformed backend response", 502);
    return NextResponse.json(result, {
      status: [200, 201, 400, 401, 403, 404, 429].includes(response.status)
        ? response.status : 502,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return reject("Paper matching backend unreachable", 502);
  }
}
export async function GET(request: NextRequest) { return proxy(request, "GET"); }
export async function POST(request: NextRequest) { return proxy(request, "POST"); }
export async function DELETE(request: NextRequest) { return proxy(request, "DELETE"); }
