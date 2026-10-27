/**
 * Explicit UI preview fixtures. Values are deterministic, synthetic and NEVER
 * sent to the authenticated market backend or saved to PostgreSQL.
 *
 * Every candle refers to a completed UTC minute. Same symbol + time -> same
 * value across refreshes, so chart interaction won't randomly change history.
 */
export type PreviewCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const MARKETS: Record<string, { basis: number; phase: number }> = {
  BTCUSDT: { basis: 65000, phase: 1.1 },
  ETHUSDT: { basis: 2600, phase: 2.7 },
  SOLUSDT: { basis: 150, phase: 4.3 },
};

function fraction(value: number): number {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function syntheticPrice(minute: number, basis: number, phase: number): number {
  const trend = Math.sin(minute / 97 + phase) * 0.013;
  const swell = Math.sin(minute / 19 + phase / 3) * 0.010;
  const fast = Math.sin(minute / 5.3 + phase * 1.7) * 0.003;
  const micro = (fraction(minute + phase) - 0.5) * 0.0028;
  return basis * (1 + trend + swell + fast + micro);
}

export function generateDemoCandles(
  symbol: string,
  nowMs: number = Date.now(),
  count = 360,
): PreviewCandle[] {
  const market = MARKETS[symbol];
  if (!market || !Number.isFinite(nowMs) || !Number.isInteger(count) || count < 1 || count > 500) {
    return [];
  }

  const currentMinute = Math.floor(nowMs / 60_000);
  const output: PreviewCandle[] = [];

  for (let index = count; index >= 1; index--) {
    const minute = currentMinute - index;
    const open = syntheticPrice(minute - 1, market.basis, market.phase);
    const close = syntheticPrice(minute, market.basis, market.phase);
    const wick = market.basis * (0.0005 + fraction(minute + 33.7 + market.phase) * 0.001);
    const upper = wick * (0.5 + fraction(minute + 12 + market.phase));
    const lower = wick * (0.5 + fraction(minute + 99 + market.phase));
    output.push({
      timestamp: new Date(minute * 60_000).toISOString(),
      open,
      close,
      high: Math.max(open, close) + upper,
      low: Math.min(open, close) - lower,
      volume: 0.2 + fraction(minute * 7 + market.phase) * 2.3,
    });
  }
  return output;
}
