# Trading Pulse backend

Trading Pulse is a market-data analytics **simulator**. Its ticks may use market reference prices, but the project does not place real trades.

## Local development

1. Run PostgreSQL and Redis locally (Redis defaults to `127.0.0.1:6379`).
2. Copy `backend/.env.example` to `backend/.env`.
3. Choose a strong random value for `TRADING_PULSE_API_TOKEN` (at least 32 characters) and set `DATABASE_URL`.
4. Run `npm install`, `npx prisma generate`, and `npx prisma migrate deploy` from `backend/`.
5. Run `npx tsx src/generateToken.ts worker` to create a **24-hour** simulator JWT and copy it into `SIMULATOR_TOKEN`. Run `npx tsx src/generateToken.ts viewer` to create a separate read-only JWT for the Next.js `TRADING_PULSE_VIEWER_JWT` server variable.
6. Run `npm run dev` for Fastify, and in a separate terminal run `npx tsx src/simulator.ts` for the simulated tick feed.
7. Run `npm run typecheck` and `npm test` to review code quality and candle calculations.

The API listens on port 3001 by default. Keep Next.js on port 3000; set `PORT=3001` and `TRADING_PULSE_API_URL=http://127.0.0.1:3001` in the backend environment. Set the Next.js server-side `TRADING_PULSE_VIEWER_JWT` to a **valid JWT** with the same tenant client claim as the simulator, not the signing secret. Keep the backend signing secret only on trusted servers. In production use a dedicated read-only viewer token and short-lived authentication.

### Security reminders

- Do not publish tokens or `.env` files.
- Replace the old hardcoded signing secret; older tokens should stop working.
- Trade ingestion must be restricted to authorized ingestion workers before internet deployment.
- This is development scaffolding; it is not ready for production exposure.

### Durable analytics pipeline

- Ingested simulated trades are first saved in PostgreSQL. Redis holds a **bounded** 2,000-tick list per tenant/symbol for the predictive engine.
- The candle worker reads the durable `Trade` rows in timestamp order, computes closed UTC minute buckets, and upserts OHLCV rows.
- The worker uses cursor pagination to catch up after restarts, and rebroadcasts `CANDLE` events only when stored candle values change.
- Workers do not overlap on the same server process and timers are cleared at shutdown.
- Browser charts on `main` still refresh through the existing HTTP endpoint. Real-time WebSocket subscriptions from the browser require authenticated client sessions and are a **separate** milestone.
- A PostgreSQL/Redis disconnect and multi-process deployment still require an end-to-end review. This is not an investment or order execution system.

#### Verify the full data path

Start PostgreSQL, Redis, Fastify and the simulator. Wait until the current UTC minute has finished and watch the backend log for completed candle changes. Then make an authenticated request to `GET /api/v1/charts?symbol=BTCUSDT` using your generated viewer JWT. Confirm candle timestamps, OHLC values and the simulator tenant. Use the same token with `GET /api/v1/trades?symbol=BTCUSDT` and confirm persisted ticks are visible.

The automated tests cover UTC minute buckets, open/high/low/close/volume, invalid inputs, one persist, and unchanged candle idempotency. Browser visual checks, WebSocket handshake checks, and Redis outage simulations must also be run locally before merging.

### Local chart readiness after a 503 error

If the Next.js dashboard loads but `GET /api/charts` returns **503**, it usually means `TRADING_PULSE_VIEWER_JWT` is missing in `frontend/.env.local`. The black dashboard now includes a local data-connection check that categorizes missing/expired JWTs, unreachable Fastify, wrong ports, and an empty candle history. It never sends JWT values to the browser.

In **Command Prompt** or **PowerShell**:
1. Start PostgreSQL and Redis.
2. Under `backend/`, set your **private** signing secret in `.env`. Set `PORT=3001` and `TRADING_PULSE_API_URL=http://127.0.0.1:3001`.
3. Run `npx tsx src/generateToken.ts worker` and store the generated worker JWT as `SIMULATOR_TOKEN` in backend `.env`.
4. Run `npx tsx src/generateToken.ts viewer` and store the **different** viewer JWT as `TRADING_PULSE_VIEWER_JWT` in `frontend/.env.local`.
5. In `frontend/.env.local`, also set `TRADING_PULSE_API_URL=http://127.0.0.1:3001`.
6. Start Fastify in one terminal with `npm run dev` from `backend/`, and the simulator in another with `npx tsx src/simulator.ts`.
7. Start Next.js in another terminal with `npm run dev` from `frontend/`, then open its local URL (typically port 3000).
8. Review the dashboard's **Data connection** panel. A `connected-empty` response is healthy but requires a completed UTC candle minute. Use **Check again** after the simulator starts.

JWTs expire after 24 hours. Generate new ones as needed and **do not** paste them into issues, screenshots, or conversation logs. Existing `.env` files are *not* automatically overwritten by updating `.env.example`; change your local settings explicitly.
