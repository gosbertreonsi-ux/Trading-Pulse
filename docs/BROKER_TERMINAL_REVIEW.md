# Trading Pulse — broker terminal redesign review

## Visual direction
Based on the user's two references: a compact dark broker watchlist/mobile trading screen, and an uncluttered charcoal candlestick chart with restrained grid lines.

## Changed
- Desktop workspace uses a compact navigation rail, **left watchlist / dominant center chart / right market-details column**.
- Mobile uses a chart-first layout, stacked watchlist/insight panels, and fixed bottom navigation to reach Dashboard / AI Studio.
- Watchlist shows only BTCUSDT, ETHUSDT, SOLUSDT, which Trading Pulse supports today. In Demo Preview it shows deterministic synthetic quotes and mini-trend graphics, always marked as Demo. In Connected mode, unselected markets show no fabricated quotes.
- Chart loses the busy world map, adopts a flat charcoal presentation and retains historical SMA annotations, timeframe controls, zoom and panning.
- Right panel shows only stored or synthetic **selected market** data, depending on the explicitly selected source; it never places an order.
- Demo Preview and Connected Simulator are visually distinct. The connected-only readiness card appears only in Connected mode.
- The overall UI remains dark-only and AI Studio is preserved.

## Required browser review
- [ ] Desktop at 1440px+: readable watchlist / chart / right-side summary, no horizontal overflow.
- [ ] Tablet around 1024px: chart and watchlist remain usable, details move below.
- [ ] Mobile around 390px: chart first, watchlist second, bottom nav remains usable.
- [ ] Demo BTC/ETH/SOL switching updates chart and synthetic watchlist mini-graphs; no demo API calls.
- [ ] Connected mode **never** fills missing market data with synthetic prices.
- [ ] Timeframe, zoom/pan, SMA toggle, stream state and AI Studio links still work.
- [ ] Text contrast, subtle chart grid, candle red/green and price axis match reference in a running browser.
- [ ] If the user's JWT/DB configuration is incomplete, Connected mode still reports the real error without leaking secrets.
- [ ] No actual order execution or fake trading account balances appear.

CI lint/typecheck/build are necessary but **not** visual/browser approval. Keep the PR unmerged until the user can review the running black terminal.
