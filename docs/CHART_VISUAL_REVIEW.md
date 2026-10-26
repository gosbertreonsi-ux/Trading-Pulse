# Trading Pulse — Visual chart reference review

Reference: user-provided dark global candlestick chart with luminous green/red candles, BUY/SELL labels, dotted paths, and a subdued world-map atmosphere.

## Implemented in this branch

- Larger bright teal-green / coral-red candlesticks with generous chart breathing room.
- Faint abstract geographic SVG beneath a transparent Lightweight Charts v5 canvas.
- Historical dotted 5-period and 12-period simple moving average overlays.
- Optional **BUY** and **SELL** markers when the 5-period average crosses above/below the 12-period average, computed using only completed candles returned by the authenticated chart API.
- A user-accessible **Signals on / Signals off** toggle. No markers are drawn with less than 13 candles; all overlay data disappears when the API reports no candles.
- Dark/light chart contrast preserved. No new package, external image service, trading execution, or made-up price series is added.
- Both indicators and labels are **educational visualizations, not predictions or trading advice**.

### Calculation details

For candle index `i`, calculate the mean closing price over the previous 5 and 12 bars. A BUY marker is emitted if the 5-bar SMA was at or below the 12-bar SMA at `i-1`, and is above it at `i`. SELL is the inverse. No marker is drawn before both current and prior long-window values exist. For aggregated 5m/1H/etc chart timeframes, the 5 and 12 periods refer to *displayed bars*, not minutes. The algorithm never changes persisted market data.

## Review gate

- [ ] GitHub Actions: frontend `npm ci`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Verify a valid read-only viewer JWT and Fastify on a distinct port before expecting real candles; previous local logs returned 503 when viewer credentials were absent.
- [ ] Browser: BTC/ETH/SOL historical candles render correctly in both themes.
- [ ] On a series with 13+ candles, markers match actual crossover timestamps and never appear on bars without a cross.
- [ ] Toggle hides/shows markers and both lines without clearing price history, restarting streams, or breaking zoom/pan.
- [ ] Desktop and mobile review: chart contrast, marker legibility, world silhouette subtlety, responsive toolbar, and time-axis visibility.
- [ ] Empty/503 states remain honest and never display fabricated chart data or markers.
- [ ] Switching symbol/timeframe refreshes markers from the selected market only.
- [ ] Verify that a completed new candle triggers streaming or REST fallback and updates derived markers.

This feature is a code/design implementation awaiting in-browser screenshot and data-path review. It is not a verified deployment.
