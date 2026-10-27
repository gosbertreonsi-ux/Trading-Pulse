# Milestone 17 — authenticated multi-market watchlist

## What changed
In Connected mode the **BTC/USDT, ETH/USDT, SOL/USDT** rows now show independent last persisted simulated trade prices and live mini-sparklines. Unlike Demo Preview, none of the numbers are generated in the browser.

- Fastify **GET /api/v1/markets/overview** uses the authenticated JWT tenant identity, reads at most **24 persisted trades per supported symbol**, and returns bounded recent-tick price history, latest timestamp and signed percentage change. Every symbol is returned even if no trades exist; missing prices, change and timestamps are `null`, with an empty sparkline.
- Same-origin Next.js **GET /api/markets** holds the viewer JWT on the server, forwarding it to Fastify; the browser never sees signing secrets or tokens.
- Existing **GET /api/stream?symbol=ALL** is now a dedicated local-development SSE subscription for BTC, ETH and SOL only; invalid or unrelated symbols are discarded. The authenticated backend WebSocket already scopes events to the viewer tenant.
- Browser fetches the current watchlist when connected, after stream readiness, and every 30 seconds. Each authorized tick updates its own row's price and rolling 24-tick spark immediately; a late REST response cannot rewind a newer stream event.
- Distinct data-source switching clears prior quotes. Existing selected-market chart and its independent forming-candle SSE subscription remain unchanged.
- UI labels explicitly state **recent 24 ticks, not 24-hour change**. Percentage remains unavailable until at least two genuine trades for that symbol are stored.

## QA and safety checks
- Backed by disposable-PostgreSQL/Redis integration cases for required auth, correct ticker order, persisted price, empty markets and tenant isolation.
- Pure client tests reject invalid timestamps/prices/unknown symbols, bound history to 24 ticks, preserve latest streamed price against slower REST, check signed movements.
- CI validates TypeScript, lint, production build and Chrome desktop/mobile layout and the current Light/Dark styles.
- The new endpoint reads persisted trades only. No exchange order execution or real price data is implied.
- Live tick stream is still **local-development-only**. A public release needs real per-user authentication/authorization for all same-origin API routes before enabling streaming.
- If the simulator's worker JWT is expired, the backend rejects new trades with 401 and the watchlist will stay at last stored values; regenerate the worker token using the same signing secret as Fastify and keep it private.

## Local review
Use branch `feat/live-multi-market-watchlist`, with PostgreSQL and Redis available. Run Fastify on 3001, simulator with valid `SIMULATOR_TOKEN`, Next.js on 3000 with the matching-tenant viewer JWT. Select Connected. Each supported row should update independently about every two seconds during accepted simulator ticks; switching BTC/ETH/SOL or timeframe must not hide other rows. Verify a blank tenant displays dashes, not fabricated quotes. Confirm tabs, light/dark, and alerts continue working.
