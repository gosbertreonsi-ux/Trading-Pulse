import { NextResponse } from "next/server";

/** Same-origin read-only BFF. Viewer JWT is always server-side. */
export async function GET() {
  const token = process.env.TRADING_PULSE_VIEWER_JWT;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Server API credentials are not configured" },
      { status: 503 },
    );
  }

  try {
    const url = new URL("/api/v1/markets/overview",
      process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001");
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: response.status === 401 ? "Viewer authentication was rejected"
          : "Market overview backend unavailable",
      }, { status: response.status === 401 ? 401 : 502 });
    }
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[MARKET OVERVIEW API PROXY]", error);
    return NextResponse.json({
      success: false, error: "Cannot reach the market-data backend",
    }, { status: 502 });
  }
}
