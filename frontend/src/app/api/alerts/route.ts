import { NextRequest, NextResponse } from "next/server";

function reject(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function forward(request: NextRequest, method: "GET" | "POST" | "DELETE") {
  // Existing frontend uses one local viewer token, not user sessions.
  // Restrict mutating alert actions to local development until an
  // authenticated public multi-user session layer exists.
  if (process.env.NODE_ENV !== "development" ||
      !["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) {
    return reject("Alerts API requires a local development session", 403);
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "none"].includes(site)) {
    return reject("Cross-site requests are disabled", 403);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return reject("Cross-origin writes are disabled", 403);
  }
  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) return reject("Viewer token is missing from frontend/.env.local", 503);

  let backend: URL;
  try {
    const base = new URL(process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001");
    if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(base.hostname)) {
      throw new Error("Not a loopback API");
    }
    backend = new URL("/api/v1/alerts", base);
  } catch {
    return reject("Configure a local Fastify backend URL", 503);
  }

  let body: string | undefined;
  if (method === "POST") {
    const type = request.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) return reject("JSON body required", 415);
    if (Number(request.headers.get("content-length") ?? 0) > 1024) return reject("Request too large", 413);
    try {
      const input: unknown = await request.json();
      if (!input || typeof input !== "object") throw new Error("Invalid input");
      const value = input as Record<string, unknown>;
      if (!["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(String(value.symbol)) ||
          !["ABOVE", "BELOW"].includes(String(value.direction)) ||
          typeof value.targetPrice !== "number" ||
          !Number.isFinite(value.targetPrice) ||
          value.targetPrice < 0.0001 || value.targetPrice > 1e12) {
        return reject("Enter a valid symbol, direction, and positive target", 400);
      }
      body = JSON.stringify({
        symbol: value.symbol,
        direction: value.direction,
        targetPrice: value.targetPrice
      });
    } catch {
      return reject("Invalid JSON request", 400);
    }
  } else if (method === "DELETE") {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^[a-fA-F0-9-]{36}$/.test(id)) return reject("Valid alert ID required", 400);
    backend.pathname += "/" + encodeURIComponent(id);
  }

  try {
    const response = await fetch(backend, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const raw: unknown = await response.json();
    // Never forward headers or URL/token information to the browser.
    if (!raw || typeof raw !== "object") return reject("Unexpected alert service response", 502);
    const safeStatus = [200, 201, 400, 401, 403, 404, 429].includes(response.status)
      ? response.status : 502;
    return NextResponse.json(raw, {
      status: safeStatus,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return reject("Cannot reach the price alert service", 502);
  }
}

export async function GET(request: NextRequest) { return forward(request, "GET"); }
export async function POST(request: NextRequest) { return forward(request, "POST"); }
export async function DELETE(request: NextRequest) { return forward(request, "DELETE"); }
