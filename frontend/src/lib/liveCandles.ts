import type { CandlestickData, Time } from "lightweight-charts";

/** One current-minute preview, reconstructed from persisted simulated ticks. */
export type LiveMinute = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastTickAt: number;
};

export type LiveTick = {
  price: number;
  quantity: number;
  timestamp: string;
};

export type StoredOpenMinute = {
  timestamp: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
  lastTickAt: string;
};

export function parseOpenMinute(value: StoredOpenMinute | null | undefined): LiveMinute | null {
  if (!value) return null;
  const timeMs = Date.parse(value.timestamp);
  const lastTickAt = Date.parse(value.lastTickAt);
  const [open, high, low, close, volume] = [
    value.open, value.high, value.low, value.close, value.volume,
  ].map(Number);
  if (!Number.isFinite(timeMs) || !Number.isFinite(lastTickAt) ||
      ![open, high, low, close, volume].every(Number.isFinite) ||
      open <= 0 || close <= 0 || low <= 0 || volume <= 0 ||
      high < Math.max(open, close, low) || low > Math.min(open, close, high)) {
    return null;
  }
  const time = Math.floor(timeMs / 60_000) * 60;
  if (Math.floor(lastTickAt / 60_000) * 60 !== time) return null;
  return { time, open, high, low, close, volume, lastTickAt };
}

/** Incremental OHLCV values, only from trusted tenant-scoped tick events. */
export function foldTick(
  existing: LiveMinute | null,
  tick: LiveTick,
): LiveMinute | null {
  const milliseconds = Date.parse(tick.timestamp);
  if (!Number.isFinite(milliseconds) ||
      !Number.isFinite(tick.price) || tick.price <= 0 ||
      !Number.isFinite(tick.quantity) || tick.quantity <= 0) return existing;
  const time = Math.floor(milliseconds / 60_000) * 60;
  if (existing && (time < existing.time || milliseconds < existing.lastTickAt)) return existing;
  if (!existing || time > existing.time) {
    return {
      time, open: tick.price, high: tick.price, low: tick.price,
      close: tick.price, volume: tick.quantity, lastTickAt: milliseconds,
    };
  }
  return {
    ...existing,
    high: Math.max(existing.high, tick.price),
    low: Math.min(existing.low, tick.price),
    close: tick.price,
    volume: existing.volume + tick.quantity,
    lastTickAt: milliseconds,
  };
}

/** Same UTC bucketing as MarketChart's historical aggregation. */
export function candleBucket(seconds: number, timeframe: string): number {
  if (timeframe === "1M") {
    const date = new Date(seconds * 1000);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  }
  if (timeframe === "1W") {
    return Math.floor((seconds + 3 * 86400) / 604800) * 604800 - 3 * 86400;
  }
  const intervals: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900,
    "1H": 3600, "4H": 14400, "1D": 86400,
  };
  const interval = intervals[timeframe] ?? 60;
  return Math.floor(seconds / interval) * interval;
}

/**
 * Combine completed OHLCV bars with a few still-unpersisted minute previews.
 * Recovered/streamed minutes must be newer than the newest completed 1m bar;
 * the database always wins when an old minute has been finalized.
 */
export function overlayLiveMinutes(
  completed: readonly CandlestickData<Time>[],
  minutes: readonly LiveMinute[],
  timeframe: string,
  lastCompletedMinute: number,
): CandlestickData<Time>[] {
  const result: CandlestickData<Time>[] = completed.map(bar => ({ ...bar }));
  const pending = [...minutes].filter(item => item.time > lastCompletedMinute)
    .sort((a, b) => a.time - b.time);
  for (const minute of pending) {
    const bucket = candleBucket(minute.time, timeframe);
    const previous = result[result.length - 1];
    if (!previous || bucket > Number(previous.time)) {
      result.push({
        time: bucket as Time, open: minute.open, high: minute.high,
        low: minute.low, close: minute.close,
      });
    } else if (bucket === Number(previous.time)) {
      result[result.length - 1] = {
        ...previous,
        high: Math.max(previous.high, minute.high),
        low: Math.min(previous.low, minute.low),
        close: minute.close,
      };
    }
  }
  return result;
}
