# Trading Pulse — one-shot simulated market price alerts

## Purpose
Notify a local development viewer when a persisted simulated tick for BTCUSDT, ETHUSDT or SOLUSDT reaches a configured threshold. **No real trade execution, payment, exchange orders, or email/SMS delivery.**

## Data flow
1. Viewer creates a PriceAlert on /alerts. Next.js forwards locally to Fastify using a server-side viewer JWT; the browser never receives this token.
2. Fastify validates market, ABOVE/BELOW direction and positive target, then inserts a tenant-specific ACTIVE record into PostgreSQL.
3. Simulator posts authenticated trades; Fastify first persists the tick.
4. The threshold service queries matching ACTIVE alerts for the tick's tenant and symbol, then conditionally marks each TRIGGERED, saving the observed price and time. The conditional update prevents duplicate state transitions when concurrent ticks race.
5. A tenant-specific ALERT event is broadcast over the existing WebSocket. This version's Alerts page polls persisted history every 15 seconds; no browser push, email, SMS or guaranteed notification delivery.
6. Viewer can list and delete only their tenant's alerts. Workers cannot create/view/delete viewer alert records. No other tenant's tick may trigger these alerts.

## Alert semantics
- ABOVE triggers when an observed tick price is greater than or equal to the target; BELOW triggers when less than or equal to the target.
- One-shot threshold checks, not necessarily crossings from the opposite side. Only new ticks count; historical candles do not trigger an alert created afterward.
- Ingestion is durable before alert evaluation. If evaluation fails after a persisted tick, subsequent ticks may still trigger the alert. No guaranteed recovery/delivery during outage.
- Maximum 30 ACTIVE alerts per tenant and latest 100 visible in history.
- A server-wide simulator viewer JWT is **not** a public per-user session; the Next.js alert proxy is loopback and local-development-only.

## Test and operator review
- Backend CI: typecheck, unit tests, fresh Prisma migration on a disposable database.
- Integration CI: PostgreSQL + Redis create/view/delete, role validation, threshold trigger at 106 after target 105, one-shot status and other-tenant isolation.
- Frontend CI: lint, TypeScript, production build and Chromium /alerts rendering under both modes.
- Operator backs up local DB before running Prisma migrate deploy, then starts Postgres, Redis, Fastify, simulator, and Next.js with valid JWTs. Visit /alerts and create an achievable target.
- Inspect trigger history, deletion, dark/light UI and mobile layout. Never include tokens in screenshots.
- Synthetic Demo Preview never creates or triggers persisted alerts.

No real orders, production user accounts, guaranteed notifications, or public deployment are included.
