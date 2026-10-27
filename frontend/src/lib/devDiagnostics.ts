/**
 * Server-side development diagnostics. Nothing in this module returns credentials,
 * the raw backend URL, or any response bodies that could contain sensitive data.
 */
export type ConnectionCode =
  | "missing-token"
  | "invalid-config"
  | "backend-offline"
  | "unauthorized"
  | "backend-error"
  | "connected-empty"
  | "connected";

export type ConnectionDiagnostic = {
  code: ConnectionCode;
  title: string;
  detail: string;
  candleCount?: number;
};

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export async function checkMarketData(
  viewerJwt: string | undefined,
  backendUrl: string,
  requester: Requester = fetch,
): Promise<ConnectionDiagnostic> {
  if (!viewerJwt?.trim()) {
    return {
      code: "missing-token",
      title: "Viewer token missing",
      detail: "Generate a viewer JWT in backend, add TRADING_PULSE_VIEWER_JWT to frontend/.env.local, then restart Next.js.",
    };
  }

  let url: URL;
  try {
    const base = new URL(backendUrl);
    // Diagnostics are development-only. Never send a private JWT to an
    // unexpected host because of a typo or malicious environment setting.
    if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(base.hostname)) {
      throw new Error("Backend must be local HTTP");
    }
    url = new URL("/api/v1/charts", base);
    url.searchParams.set("symbol", "BTCUSDT");
    url.searchParams.set("limit", "1");
  } catch {
    return {
      code: "invalid-config",
      title: "Backend address invalid",
      detail: "Set TRADING_PULSE_API_URL=http://127.0.0.1:3001 in frontend/.env.local. Restart the frontend.",
    };
  }

  try {
    const response = await requester(url.toString(), {
      headers: { Authorization: `Bearer ${viewerJwt}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        code: "unauthorized",
        title: "Viewer token rejected",
        detail: "Generate a fresh viewer JWT with the backend signing secret. Check that Fastify and Next.js use the same simulator tenant.",
      };
    }
    if (response.status === 404) {
      return {
        code: "invalid-config",
        title: "Wrong backend port",
        detail: "The configured address did not expose /api/v1/charts. Run Fastify on port 3001, update TRADING_PULSE_API_URL, and restart Next.js.",
      };
    }
    if (!response.ok) {
      return {
        code: "backend-error",
        title: "Backend returned an error",
        detail: "Check the Fastify terminal, PostgreSQL and Redis connections. The authenticated chart API is not responding successfully.",
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return {
        code: "invalid-config",
        title: "Wrong server responded",
        detail: "The backend URL returned a non-JSON response. Check that it points to Fastify rather than the Next.js frontend.",
      };
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Unexpected chart response");
    const record = payload as { data?: unknown; candles?: unknown };
    const list = Array.isArray(record.data) ? record.data : record.candles;
    if (!Array.isArray(list)) throw new Error("Missing chart data array");

    if (list.length === 0) {
      return {
        code: "connected-empty",
        title: "Connected · waiting for candles",
        detail: "The API works, but there are no completed BTC/USDT candles yet. Start the simulator and wait for a UTC minute to finish.",
        candleCount: 0,
      };
    }

    return {
      code: "connected",
      title: "Market data connected",
      detail: "Fastify accepted the viewer token and returned stored candle data.",
      candleCount: list.length,
    };
  } catch {
    return {
      code: "backend-offline",
      title: "Cannot reach the market backend",
      detail: "Start PostgreSQL and Redis, then run Fastify on port 3001. Check the backend terminal for startup errors.",
    };
  }
}
