# Trading Pulse — Live candle stream review

Branch: \`feat/live-candle-stream\`. This milestone keeps the existing dashboard, simulator, market authentication and AI Studio unchanged.

## Technical flow

1. The simulator POSTs authenticated ticks to Fastify; PostgreSQL stores them.
2. The aggregator upserts completed one-minute OHLCV candles and broadcasts tenant-filtered \`CANDLE\` WebSocket events.
3. Next.js \`/api/stream?symbol=BTCUSDT\` establishes a **server-to-server** WebSocket connection to Fastify, offering a read-only viewer JWT as a subprotocol.
4. Next.js forwards **only a validated candle-change notification** as Server-Sent Events (SSE). The browser never receives the JWT or direct backend WebSocket URL.
5. MarketChart listens using same-origin \`EventSource\` and reloads the authenticated \`/api/charts\` endpoint when a candle-change event arrives.
6. If the event stream is unavailable, MarketChart fetches candles every 60 seconds as a fallback. The chart shows LIVE, CONNECTING or REST FALLBACK; this is *transport* status, not market-data accuracy or trade-execution status.

## Important security boundary

- The SSE bridge is **local-development-only**. It rejects production mode, requests not addressed to a loopback hostname, and cross-site fetch metadata.
- It relies on a single server-side configured \`TRADING_PULSE_VIEWER_JWT\` belonging to the simulator's tenant.
- This is **not** an authenticated multi-user stream or a secure remote deployment interface. For public deployment, build per-user sessions, authorization, short-lived subscriptions, origin enforcement, and rate/concurrency limits before enabling the stream.
- Upstream JWTs should never be exposed in client-side environment variables, URLs, response bodies, or browser WebSocket subprotocols.
- If no viewer JWT is configured or the upstream is unavailable, the frontend must not invent candle data.

## Windows local review

1. Run PostgreSQL and Redis, then start the Fastify backend and simulator following \`backend/README.md\`.
2. In \`frontend/.env.local\`, configure \`TRADING_PULSE_API_URL=http://127.0.0.1:3000\` and a **viewer** JWT in \`TRADING_PULSE_VIEWER_JWT\`.
3. \`cd frontend\`, \`npm ci\`, \`npm run lint\`, \`npx tsc --noEmit\`, \`npm run build\`, \`npm run dev\`.
4. Visit the Next.js localhost development URL. Select BTC/USDT and the 1m interval. When the upstream handshake is ready, the status says **LIVE CANDLE UPDATES**. Until data exists, the empty chart is expected.
5. After a minute closes and the aggregator has run, confirm the chart refreshes without waiting for the 60-second backup poll.
6. Change BTC → ETH → SOL and confirm events only update the selected chart. Switch timeframes while live. Change light/dark theme and review desktop/mobile sizes.
7. Stop Fastify. Confirm the indicator switches to REST FALLBACK, the chart doesn't show fabricated data, and the dashboard remains navigable. Restart Fastify and confirm the event stream reconnects.
8. Test invalid JWT, missing JWT, and accessing the SSE endpoint from a non-loopback host; it must not send market updates.
9. Inspect the browser Network tab and verify that the JWT never appears in browser-visible requests or responses.

## Pending

- Actual in-browser visual testing and end-to-end Fastify/Redis/PostgreSQL testing by the application operator.
- Load tests, reconnect monitoring, stream concurrency quotas and production-grade user authentication.
- The app remains a market analytics simulator: no real trade execution.
