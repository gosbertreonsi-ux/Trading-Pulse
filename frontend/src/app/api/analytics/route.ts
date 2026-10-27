import { NextRequest, NextResponse } from "next/server";

/**
 * Read-only Next BFF for simulator historical candles.
 * Keep the viewer JWT server-side, never in browser JavaScript.
 */
export async function GET(request: NextRequest) {
  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) {
    return NextResponse.json({
      success: false, error: "Server API credentials are not configured",
    }, { status: 503 });
  }
  const symbol = request.nextUrl.searchParams.get("symbol");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "120");
  if (!["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(symbol ?? "") ||
      ![60, 120, 240].includes(limit)) {
    return NextResponse.json({ success: false, error: "Invalid symbol or history window" },
      { status: 400 });
  }
  try {
    const url = new URL("/api/v1/analytics/history",
      process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001");
    url.searchParams.set("symbol", symbol!);
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: response.status === 401 ? "Viewer credentials rejected or expired"
          : "Historical analytics backend unavailable",
      }, { status: response.status === 401 ? 401 : 502 });
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[HISTORICAL ANALYTICS API]", error);
    return NextResponse.json({
      success: false, error: "Cannot reach the market-data backend",
    }, { status: 502 });
  }
}
