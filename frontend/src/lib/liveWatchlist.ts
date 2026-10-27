/**
 * Connected watchlist quotes are persisted simulator observations, not
 * exchange prices. Percentage moves cover the most recent 24 ticks (or
 * fewer at startup), never a fabricated 24-hour period.
 */
export type WatchQuote = {
  symbol: string;
  price: number;
  change: number | null;
  spark: number[];
  lastUpdated: string;
};

export type WatchTick = {
  symbol: string;
  price: number;
  timestamp: string;
};

export type WatchSnapshotItem = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  spark: number[];
  lastUpdated: string | null;
};

export const WATCH_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
const ALLOWED = new Set<string>(WATCH_SYMBOLS);
const LIMIT = 24;

export function fromMarketSnapshot(item: WatchSnapshotItem): WatchQuote | null {
  if (!ALLOWED.has(item.symbol) || item.price === null || !item.lastUpdated) return null;
  const lastAt = Date.parse(item.lastUpdated);
  if (!Number.isFinite(lastAt) || !Number.isFinite(item.price) || item.price <= 0 ||
      !Array.isArray(item.spark) || !item.spark.length ||
      item.spark.length > LIMIT || item.spark.some(value => !Number.isFinite(value) || value <= 0)) {
    return null;
  }
  const spark = [...item.spark];
  if (spark[spark.length - 1] !== item.price) return null;
  return {
    symbol: item.symbol,
    price: item.price,
    spark,
    change: spark.length >= 2 ? ((item.price - spark[0]) / spark[0]) * 100 : null,
    lastUpdated: item.lastUpdated,
  };
}

export function applyWatchTick(
  current: WatchQuote | undefined,
  tick: WatchTick,
): WatchQuote | undefined {
  const time = Date.parse(tick.timestamp);
  if (!ALLOWED.has(tick.symbol) || !Number.isFinite(time) ||
      !Number.isFinite(tick.price) || tick.price <= 0) return current;
  if (current && (current.symbol !== tick.symbol || time <= Date.parse(current.lastUpdated))) return current;

  const spark = [...(current?.spark ?? []), tick.price].slice(-LIMIT);
  return {
    symbol: tick.symbol,
    price: tick.price,
    change: spark.length > 1 ? ((tick.price - spark[0]) / spark[0]) * 100 : null,
    spark,
    lastUpdated: tick.timestamp,
  };
}

/** Do not overwrite WebSocket data with a slower in-flight REST response. */
export function reconcileSnapshot(
  current: Record<string, WatchQuote>,
  items: readonly WatchSnapshotItem[],
): Record<string, WatchQuote> {
  const result = { ...current };
  for (const item of items) {
    if (!ALLOWED.has(item.symbol)) continue;
    const incoming = fromMarketSnapshot(item);
    if (!incoming) continue;
    const existing = result[item.symbol];
    if (!existing || Date.parse(incoming.lastUpdated) >= Date.parse(existing.lastUpdated)) {
      result[item.symbol] = incoming;
    }
  }
  return result;
}
