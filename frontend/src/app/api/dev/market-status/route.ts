import { NextRequest, NextResponse } from "next/server";
import { checkMarketData } from "@/lib/devDiagnostics";

/** Local-only readiness check: responses never contain a JWT or backend URL. */
export async function GET(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (process.env.NODE_ENV !== "development" ||
      !["localhost", "127.0.0.1", "::1"].includes(host)) {
    return NextResponse.json({ error: "Local diagnostics are disabled." }, { status: 403 });
  }

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "none" && site !== "same-origin") {
    return NextResponse.json({ error: "Cross-site diagnostics are disabled." }, { status: 403 });
  }

  const result = await checkMarketData(
    process.env.TRADING_PULSE_VIEWER_JWT,
    process.env.TRADING_PULSE_API_URL ?? "http://127.0.0.1:3001",
  );

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
