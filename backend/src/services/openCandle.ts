import type { FastifyInstance } from 'fastify'
import { addTickToCandle, minuteStart, type CandleValue } from './candleMath'

export type InProgressMinute = CandleValue & { lastTickAt: string }

/**
 * Recover the current unfinished one-minute candle from durable PostgreSQL.
 * A WebSocket reconnect or browser refresh does not have to wait for a new
 * tick to render the current bar. Old completed minutes remain in OHLCV.
 */
export async function loadOpenMinute(
  fastify: FastifyInstance,
  clientId: string,
  symbol: string,
  now = new Date()
): Promise<InProgressMinute | null> {
  const start = minuteStart(now)
  const trades = await fastify.db.trade.findMany({
    where: {
      clientId,
      symbol,
      timestamp: { gte: new Date(start), lt: new Date(start + 60_000) }
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    take: 5000,
    select: { timestamp: true, price: true, quantity: true }
  })

  let candle: CandleValue | undefined
  for (const trade of trades) candle = addTickToCandle(candle, trade)

  return candle && trades.length
    ? { ...candle, lastTickAt: trades[trades.length - 1].timestamp.toISOString() }
    : null
}
