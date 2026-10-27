# Database and market-data review gate

## Root cause fixed

The original Prisma migration (`20261018132138_init`) created `Trade` and `OHLCV` tables without `clientId`. Later application code and `schema.prisma` require `clientId`, so deploying the committed migrations to a fresh database produced incompatible tables.

The follow-up migration (`20261027083000_tenant_isolation`) adds tenant columns to both tables and replaces old symbol/timestamp indexes with tenant-aware versions. Existing rows are explicitly assigned to legacy tenant `global`, **not silently assigned to the simulator**. The existing tenant-specific viewer JWT therefore cannot read old legacy rows until they are explicitly migrated by an operator.

## New CI integration verification

The `Market data integration` workflow starts disposable **PostgreSQL 16** and **Redis 7** services. It:
1. Installs dependencies and generates Prisma client.
2. Executes `prisma migrate deploy` against an empty disposable database, exercising both the original and follow-up migrations.
3. Builds a Fastify instance with the real DB/Redis/security/trade-route plugins.
4. Asserts anonymous access is rejected (401), viewer ingestion is forbidden (403) and invalid trades are rejected (400).
5. Sends worker-authenticated ticks via `POST /api/v1/trades` and confirms Redis cache entries.
6. Moves only those isolated fixture timestamps into a completed minute, runs the real candle aggregator, and checks exact OHLCV.
7. Confirms `GET /api/v1/charts` returns the persisted candle, retries produce no duplicate upsert, and an unrelated tenant sees no trades or candles.

The integration test refuses to execute write operations unless it targets the disposable database named `trading_pulse_test` on a local loopback address. CI uses an artificial signing secret that has **no connection** to the developer's real JWT secret.

## Review before merge

- [ ] Backend TypeScript and unit tests pass.
- [ ] Postgres/Redis integration CI completes successfully, including migrations.
- [ ] On the user's local PC, make a private backup of any existing PostgreSQL data before running migrations.
- [ ] Run `cd backend && npx prisma migrate deploy` with the correct private `DATABASE_URL`.
- [ ] Start PostgreSQL, Redis, Fastify, simulator, and Next.js; confirm the black dashboard's Data connection panel says connected (or connected-empty until a full UTC minute completes).
- [ ] Confirm `/api/charts?symbol=BTCUSDT&limit=500` becomes HTTP 200 using a valid viewer JWT.
- [ ] Inspect BTC/ETH/SOL, 1m chart, historical crossovers and stream status in the browser.
- [ ] Confirm no JWT secrets are printed in GitHub Actions or shared screen captures.

CI tests *an isolated environment*, not the user's running Windows instance. Browser testing is still necessary.
