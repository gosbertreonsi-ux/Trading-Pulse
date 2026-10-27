# Trading Pulse — black/white theme review

## Scope
Only color treatment and appearance controls have changed. The broker-style desktop/tablet/mobile layout, data connections, source selector, chart calculations and AI Studio workflow have not been restructured.

- **Dark mode:** near-black page, charcoal panels, white text and grayscale accents.
- **Light mode:** soft-white page, white panels, black text and grayscale accents.
- The old green brand, active navigation, buttons, badges, mode switch, watchlist highlights and UI chrome have been neutralized. Candle bodies, wicks, moving-average traces and BUY/SELL marker colors use clearly differentiated **grayscale** tones in both modes. The informational green/red market movement data remains semantically accessible from text and labels, not dependent on color.
- Users switch from the top bar's **Light mode / Dark mode** button, with their choice stored under `trading-pulse-color-mode` in browser localStorage.
- An early first-paint script restores the saved theme before the app hydrates and React reflects it consistently.

## Review
- [ ] Frontend lint, TypeScript, unit tests and production build pass.
- [ ] Desktop Chrome 1390×780: dark and light chart/watchlist panels match expected grayscale backgrounds, and the main heading/chart remain visible.
- [ ] Mobile Chrome 390×844: same theme tests and no horizontal overflow.
- [ ] Reload after selecting Light mode: selection persists; switching back to Dark works.
- [ ] Watchlist, 1m–1M timeframe controls, historical SMA labels and chart panning still function.
- [ ] Demo Preview remains explicitly synthetic; Connected Simulator still uses only backend-provided data.
- [ ] `/studio` stays usable with legible inputs in both themes.
- [ ] Check real desktop and mobile screenshot artifacts before merging.

Browser CI checks geometry and theme persistence; real local visual approval is still required.
