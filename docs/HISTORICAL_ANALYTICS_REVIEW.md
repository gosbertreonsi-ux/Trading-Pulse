# Milestone 18 — historical market analytics

Trading Pulse remains a **simulated** financial analytics application. Historical statistics describe the simulator's persisted completed candles only; they are neither market forecasts nor order advice.

## Data flow
- The existing Fastify aggregation worker persists **completed UTC 1-minute OHLCV** records in PostgreSQL, keyed by authenticated tenant, symbol and minute timestamp.
- A new authenticated read-only `GET /api/v1/analytics/history?symbol=BTCUSDT&limit=120` returns the **latest 60, 120 or 240 stored bars**, in chronological order, with derived historical metrics. This intentionally excludes the currently forming candle.
- All database queries filter by `request.tenant.clientId`; the user cannot specify another tenant. Supported symbols are BTCUSDT, ETHUSDT, SOLUSDT. Invalid windows and symbols return HTTP 400.
- The server-side-only JWT is forwarded through `GET /api/analytics` on Next.js; no signing secret or raw JWT reaches browser JavaScript.
- `/analytics` is a dedicated responsive page: symbol/window filters, completed closing-price chart, base-asset volume bars, open/close change, high/low, mean and total quantity, bullish/bearish/unchanged counts, maximum close-to-close drawdown, and an auditable table of up to 30 recent completed candles.

## Math definitions
- Loaded-range change (%) = (last completed close − first loaded open) / first loaded open × 100. This is **not** a 24-hour change.
- High/low are extrema of the loaded completed bars. Total volume is the sum of base-asset trade **quantity**, not USDT notional.
- Max close drawdown (%) is the largest percentage fall from a running peak **closing price** to a later closing price. It is not an intrabar stop-loss metric.
- A window of 120 completed 1-minute bars is not necessarily exactly 120 wall-clock minutes: empty market minutes may have no saved bar.
- No bars means `null` for unknown numeric values and zero counts. Browser never manufactures missing history.

## Verification and review
- Backend pure `historicalMetrics.test.ts`: empty history, OHLCV statistics, return/drawdown math, malformed or unordered data.
- PostgreSQL/Redis integration: unauthenticated 401; wrong limit 400; actual saved OHLCV yields correct summary; other tenant receives empty candles and null unknown metrics.
- Browser smoke tests stub the authenticated HTTP response (no JWT) and check desktop/mobile layout, statistics, table, empty SOL history, and persistent Light/Dark theme.
- Backend and frontend TypeScript/unit/lint/build and GitHub Actions pass before merging.
- Manual Windows verification: run Postgres, Redis, backend, worker simulator with matching tenant tokens, frontend. Accumulate completed minute bars, visit `/analytics`, switch symbols and windows, check timestamps/quantities against `/api/charts`.
- Not implemented: tick-accurate historical replay, exchange-wide volume, order book depth, or real exchange execution.
