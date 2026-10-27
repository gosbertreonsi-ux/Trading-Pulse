# Milestone 20 — disposable paper matching engine

## Scope
Trading Pulse remains a **simulated financial analytics** project, not a broker, real trading venue or exchange. This educational sandbox accepts test LIMIT BUY/SELL orders with genuine **in-memory resting state** and a price-time-priority matching algorithm. It is **completely separate** from both the earlier purely illustrative liquidity depth model and the stored simulator trade/candle feed.

## Behavior
- Supported markets: BTCUSDT (1 USDT tick), ETHUSDT (0.1), SOLUSDT (0.01). Quantities have up to four decimal places, minimum 0.0001.
- Incoming marketable paper limits match the **best priced opposite resting paper limit** first; at equal prices, earlier orders fill first. Execution price equals the **maker's resting limit**, never an exchange quote.
- Supports open, partially filled, filled and cancelled states, per-order remaining quantity and a bounded recent fill log. Cancels remove the unfilled portion; filled portions remain visible as completed paper executions.
- Conversions to 1/10,000 fixed integer units prevent floating-point drift in quantities and prices. All actions are synchronous in one Fastify process.
- Engine state is private to the Fastify plugin instance and **disappears on backend restart**. No balances, portfolios, PostgreSQL Trade/OHLCV writes, real orders or exchange connection exist.
- Bounds: maximum 100 tenants with state, 50 active orders per tenant, up to 100 archived orders and 100 fills per tenant. This is a **single-process development exercise**, not horizontally scalable durable matching.
- Tenant is derived exclusively from JWT; viewer role required, worker role rejected. A user cannot cancel another tenant's order; instruments do not cross-match.

## API
Fastify:
- `GET /api/v1/paper/book?symbol=BTCUSDT`: selected-tenant resting bid/ask orders, recent order statuses/fills
- `POST /api/v1/paper/orders`: JSON `{symbol,side,price,quantity}`, response includes new order and its matched fills
- `DELETE /api/v1/paper/orders/:id`: cancel active remainder

Next.js BFF:
- `GET /api/paper?symbol=BTCUSDT`
- `POST /api/paper`
- `DELETE /api/paper?id=<order UUID>`

Browser-side JWT is never exposed. BFF is restricted to local development, same-origin and localhost Fastify. Backend endpoints reject when `NODE_ENV=production`. Mutations are not supported on public deployments without real identity/session security.

## Visual UI
`/paper`: symbol switch, BUY/SELL test limit form, separate resting bid/ask ladders, open-order cancellations, recent paper fills, prominent test-only and ephemeral-data warnings. Existing premium monochrome fonts, dark/light theme and green/red market colors remain intact.

## Testing
- Pure price-time service tests: best price first, FIFO ties, maker-price fills, partial quantities and cancellations, invalid price increments, tenant and symbol isolation.
- Disposable Postgres/Redis integration: missing JWT 401; ingestion worker forbidden 403; different viewer cannot read/cancel; a crossing order produces a paper fill but **no PostgreSQL Trade row**.
- Browser smoke: mocked BFF, buy resting + sell partial fill + cancel, desktop and mobile responsive geometry and light-theme appearance.
- No migration is required. This learning milestone does **not** include durable ledger, settlement, account balances, a matching service cluster, slippage, market orders, live exchange book ingestion or live broker API integration.

## Local acceptance
Run Fastify and Next in PowerShell with backend viewer JWT; PostgreSQL/Redis may still be needed for other existing routes but the paper engine itself uses neither. Select the `Paper Book` sidebar at `http://localhost:3000/paper`. Choose BTC, place a BUY at 100 for 2 units; then a SELL at 99 for 1 unit. A **paper fill at 100** appears, and 1 unit remains on the bid. Cancel it. Restart Fastify and confirm book becomes empty. These prices and orders are simulated test values only.
