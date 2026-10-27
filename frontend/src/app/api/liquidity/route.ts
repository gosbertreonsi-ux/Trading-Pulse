import { NextRequest, NextResponse } from "next/server";

/**
 * JWT-protected server-to-server proxy. Educational modeled depth only.
 * Browser JavaScript never receives the viewer JWT or signing secret.
 */
export async function GET(request: NextRequest) {
  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) {
    return NextResponse.json({
      success: false, error: "Server API credentials are not configured",
    }, { status: 503 });
  }
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(symbol ?? "")) {
    return NextResponse.json({
      success: false, error: "Supported BTC, ETH or SOL market required",
    }, { status: 400 });
  }
  try {
    const url = new URL("/api/v1/liquidity/model",
      process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001");
    url.searchParams.set("symbol", symbol!);
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({
        success: false, error: response.status === 401
          ? "Viewer authentication rejected or expired" : "Liquidity model backend unavailable",
      }, { status: response.status === 401 ? 401 : 502 });
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[MODELED LIQUIDITY API]", error);
    return NextResponse.json({
      success: false, error: "Cannot reach the simulated market backend",
    }, { status: 502 });
  }
}
