/**
 * Trading-data colors are intentionally separate from the black/white UI.
 * Bullish candles and changes are green; bearish candles and changes are red.
 */
export const MARKET_COLORS = {
  dark: { up: "#18c67a", down: "#e05b52" },
  light: { up: "#0f8f57", down: "#c84b45" },
} as const;

export type MarketTheme = keyof typeof MARKET_COLORS;

export function marketColors(theme: MarketTheme) {
  return MARKET_COLORS[theme];
}
