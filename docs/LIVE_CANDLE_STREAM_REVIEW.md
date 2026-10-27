# Trading Pulse — live forming candles (simulated)

## Scope
Connected Simulator gains incremental candles: each authenticated simulated trade is persisted in PostgreSQL and triggers a tenant-scoped WebSocket TICK. The local-only Next.js SSE bridge forwards the selected symbol's sanitized price/quantity/timestamp without exposing the viewer JWT in the browser. React folds ticks into a forming one-minute OHLCV candle and overlays it on completed historical candles for the current timeframe.

The product remains a **simulated analytics application**, not an exchange or trading execution platform.

## Data contracts
- GET /api/v1/charts returns `data`: completed, tenant-authorized OHLCV, plus `openCandle`: tenant-authorized and **unfinished** current-minute OHLCV or null.
- TICK event: `{type:"TICK",clientId,symbol,price,quantity,timestamp}` after successful trade persistence. WebSocket subscribers are authenticated and only receive the same tenant's ticks.
- SSE `tick` event: selected `symbol`, numeric `price` and `quantity`, ISO `timestamp` only. No JWT or tenant identifier is forwarded into browser JavaScript.
- SSE `candle`: notification after the aggregator saves a completed candle. The frontend reloads stored history, rather than trusting a pushed candle body.
- Live pending previews do not enter the historical moving-average crossover signal calculations.

## Reconnection, boundaries and integrity
- On first load and each REST refresh, openCandle is recovered from ordered PostgreSQL trades in the current UTC minute; the service bounds reads to 5,000 trades per minute.
- Browser tracks up to three not-yet-committed one-minute previews across a minute rollover. When the corresponding completed candle arrives via REST, it replaces the preview.
- Incoming out-of-order or invalid ticks are discarded; REST snapshots do not overwrite a newer in-memory streamed snapshot.
- The stream is local-development-only using the existing loopback/same-origin Next.js bridge, **not** a production per-user authenticated public stream.
- If the simulator stops, the current candle remains unchanged; if WebSocket drops, REST refreshes once per minute. Historical data is not invented.
- A simulated trade is broadcast only after durable persistence, and the broadcast uses PostgreSQL's stored DECIMAL precision.

## Verification
- Backend unit and TypeScript CI.
- PostgreSQL/Redis integration: current-minute snapshot, isolation across tenants, authenticated live WS tick delivered to correct viewer only.
- Frontend unit tests: OHLC fold, minute turnover, invalid/stale input, recovery, completed history priority, 5m and 1W/1M timeframe buckets.
- Frontend lint/typecheck/build and real Chrome layout/theme smoke tests.
- Manual operator check in Windows: run backend, worker simulator and frontend; select Connected, watch live forming candle and quote; change timeframe/symbol, restart frontend, disconnect/reconnect; verify Light/Dark and chart red/green.
- Ensure backend migrations are applied, both viewer and simulator worker JWTs use the same strong signing secret and simulator tenant. No real exchange feed is involved.
