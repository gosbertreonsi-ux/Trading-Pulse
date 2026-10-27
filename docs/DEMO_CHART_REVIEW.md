# Trading Pulse — explicit chart preview review

## User goal
Allow the locally running **black cinematic Trading Pulse dashboard** to display inspectable candles and historical moving-average markers even before PostgreSQL/Redis/Fastify/JWT are configured.

## Behaviors
- The local development dashboard opens with **Demo Preview** selected and a prominent **DEMO PREVIEW** label.
- Demo data is generated deterministically in browser memory by `frontend/src/lib/demoCandles.ts`. It is NOT a live market feed and is not sent to Redis, PostgreSQL, Binance, or the simulator.
- Each row is a completed UTC-minute OHLCV example. Historical bars are stable across refreshes in the same minute.
- The app supports BTC/USDT, ETH/USDT and SOL/USDT, timeframe selection, zoom/pan and optional SMA 5/12 crossover markers computed from displayed historical demo candles.
- Demo mode makes no requests to `/api/charts`, `/api/stream` or `/api/dev/market-status`.
- **Connected data** restores the real protected API, local WebSocket/SSE bridge and dashboard connection diagnostics. It must NOT fall back silently to demo values when APIs fail.
- Production defaults to Connected data and does not render the dev-only source switch.

## Review gate
- [ ] CI passes ESLint, TypeScript, crossover tests, synthetic OHLC tests and Next.js build.
- [ ] Local browser without backend or JWT: demo candles render in the near-black world-map chart without `503` network errors.
- [ ] Preview badges, prices and disclaimer clearly say **synthetic / demo**, with no claims of real prices.
- [ ] Candlestick view shows bright green/red bars, optional BUY/SELL historical crossover annotations and visible time/price axes.
- [ ] Switching markets or timeframe changes preview bars without leaking previous prices.
- [ ] Switching to Connected data with backend unavailable displays the actual failure, not preview candles.
- [ ] With valid backend/JWT, Connected data shows persisted simulated candles and local stream/fallback status.
- [ ] Mobile and desktop layout remain clear; `/studio` remains black.
- [ ] No changes to orders, persistent market database schema, secrets or simulator.
- [ ] Merge only after reviewing the running app; automated checks alone do not verify design similarity.

## Local review
```powershell
cd "C:\Users\H P\trading-pulse"
git fetch origin
git switch feat/explicit-demo-chart-preview
cd frontend
npm ci
npm run dev
```
Visit the local Next.js URL. Demo Preview requires **no** backend or viewer token. Switch to Connected data only when you want to inspect actual Fastify/simulator connectivity. Never confuse the displayed preview prices for market quotes.
