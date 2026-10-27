/** Deterministic analytics for completed, persisted simulator 1-minute OHLCV.
 * Rows must arrive chronologically; no incomplete open candle is included.
 */
export type HistoryCandle = {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}
export type HistoricalSummary = {
  candleCount: number
  firstAt: string | null
  lastAt: string | null
  firstOpen: number | null
  lastClose: number | null
  rangeChangePercent: number | null
  periodHigh: number | null
  periodLow: number | null
  totalVolume: number | null
  averageVolume: number | null
  bullishCount: number
  bearishCount: number
  unchangedCount: number
  maxCloseDrawdownPercent: number | null
}

export function summarizeHistory(candles: readonly HistoryCandle[]): HistoricalSummary {
  const count = candles.length
  if (count === 0) {
    return {
      candleCount: 0, firstAt: null, lastAt: null,
      firstOpen: null, lastClose: null, rangeChangePercent: null,
      periodHigh: null, periodLow: null, totalVolume: null,
      averageVolume: null, bullishCount: 0, bearishCount: 0,
      unchangedCount: 0, maxCloseDrawdownPercent: null
    }
  }

  let periodHigh = -Infinity
  let periodLow = Infinity
  let totalVolume = 0
  let bullishCount = 0
  let bearishCount = 0
  let unchangedCount = 0
  let peakClose = 0
  let maxCloseDrawdownPercent = 0
  for (let i = 0; i < count; i++) {
    const bar = candles[i]
    if (!Number.isFinite(bar.open) || !Number.isFinite(bar.high) ||
        !Number.isFinite(bar.low) || !Number.isFinite(bar.close) ||
        !Number.isFinite(bar.volume) ||
        bar.low <= 0 || bar.volume < 0 ||
        bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close, bar.high)) {
      throw new Error('Invalid stored historical candle')
    }
    if (i > 0 && bar.timestamp.getTime() <= candles[i - 1].timestamp.getTime()) {
      throw new Error('History must be in strictly ascending timestamp order')
    }
    periodHigh = Math.max(periodHigh, bar.high)
    periodLow = Math.min(periodLow, bar.low)
    totalVolume += bar.volume
    if (bar.close > bar.open) bullishCount++
    else if (bar.close < bar.open) bearishCount++
    else unchangedCount++
    peakClose = Math.max(peakClose, bar.close)
    if (peakClose > 0) {
      maxCloseDrawdownPercent = Math.max(maxCloseDrawdownPercent,
        (peakClose - bar.close) / peakClose * 100)
    }
  }
  const first = candles[0]
  const last = candles[count - 1]
  return {
    candleCount: count,
    firstAt: first.timestamp.toISOString(),
    lastAt: last.timestamp.toISOString(),
    firstOpen: first.open,
    lastClose: last.close,
    rangeChangePercent: (last.close - first.open) / first.open * 100,
    periodHigh, periodLow, totalVolume,
    averageVolume: totalVolume / count,
    bullishCount, bearishCount, unchangedCount,
    maxCloseDrawdownPercent
  }
}
