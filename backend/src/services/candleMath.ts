/**
 * Pure OHLCV calculations. Timestamps are UTC and the caller must process ticks
 * in ascending (timestamp, id) order, as returned by Prisma.
 */
export interface CandleInput {
  timestamp: Date
  price: string | number | { toString(): string }
  quantity: string | number | { toString(): string }
}

export interface CandleValue {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function minuteStart(timestamp: Date): number {
  const milliseconds = timestamp.getTime()
  if (!Number.isFinite(milliseconds)) throw new Error('Invalid tick timestamp')
  return Math.floor(milliseconds / 60_000) * 60_000
}

export function addTickToCandle(
  current: CandleValue | undefined,
  tick: CandleInput
): CandleValue {
  const price = Number(tick.price)
  const quantity = Number(tick.quantity)
  if (!Number.isFinite(price) || price <= 0 ||
      !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Invalid persisted market tick')
  }
  const start = minuteStart(tick.timestamp)
  if (!current) {
    return {
      timestamp: new Date(start),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: quantity
    }
  }
  if (current.timestamp.getTime() !== start) {
    throw new Error('Cannot mix ticks from different minutes')
  }
  return {
    ...current,
    high: Math.max(current.high, price),
    low: Math.min(current.low, price),
    close: price,
    volume: current.volume + quantity
  }
}
