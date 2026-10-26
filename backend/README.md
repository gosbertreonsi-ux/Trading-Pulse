# Trading Pulse backend

Trading Pulse is a market-data analytics **simulator**. Its ticks may use market reference prices, but the project does not place real trades.

## Local development

1. Run PostgreSQL and Redis locally (Redis defaults to `127.0.0.1:6379`).
2. Copy `backend/.env.example` to `backend/.env`.
3. Choose a strong random value for `TRADING_PULSE_API_TOKEN` (at least 32 characters) and set `DATABASE_URL`.
4. Run `npm install`, `npx prisma generate`, and `npx prisma migrate deploy` from `backend/`.
5. Run `npx tsx src/generateToken.ts` to create a **24-hour** simulator JWT and copy it into `SIMULATOR_TOKEN`.
6. Run `npm run dev` for Fastify, and in a separate terminal run `npx tsx src/simulator.ts` for the simulated tick feed.

The API listens on port 3000. Set the Next.js server-side `TRADING_PULSE_API_TOKEN` to a **valid JWT**, not the signing secret. Both environments must be configured consistently.

### Security reminders

- Do not publish tokens or `.env` files.
- Replace the old hardcoded signing secret; older tokens should stop working.
- Trade ingestion must be restricted to authorized ingestion workers before internet deployment.
- This is development scaffolding; it is not ready for production exposure.
