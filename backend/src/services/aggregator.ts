import type { FastifyInstance } from 'fastify'
import { broadcastToCharts } from '../routes/streams'
import { addTickToCandle, minuteStart, type CandleValue } from './candleMath'

// Trade rows are durable in PostgreSQL. Redis is an optional hot cache
// used by the predictive engine, not the source of truth for candles.
const PAGE_SIZE = 1000

export async function aggregateCandlestick(
  fastify: FastifyInstance,
  symbol: string,
  clientId: string
): Promise<number> {
  const nowMinute = new Date(minuteStart(new Date()))

  // Revisit the latest completed candle to incorporate any late persisted ticks.
  const latest = await fastify.db.oHLCV.findFirst({
    where: { clientId, symbol },
    select: { timestamp: true },
    orderBy: { timestamp: 'desc' }
  })

  let cursorId: string | undefined
  let current: CandleValue | undefined
  let changedCount = 0

  async function persist(candle: CandleValue): Promise<void> {
    const key = {
      clientId_symbol_timestamp: { clientId, symbol, timestamp: candle.timestamp }
    }
    const previous = await fastify.db.oHLCV.findUnique({ where: key })
    const changed = !previous ||
      Number(previous.open) !== candle.open ||
      Number(previous.high) !== candle.high ||
      Number(previous.low) !== candle.low ||
      Number(previous.close) !== candle.close ||
      Number(previous.volume) !== candle.volume

    if (!changed) return

    await fastify.db.oHLCV.upsert({
      where: key,
      create: { clientId, symbol, ...candle },
      update: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }
    })

    changedCount += 1
    broadcastToCharts('CANDLE', {
      clientId,
      symbol,
      timestamp: candle.timestamp.toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      completed: true
    })
  }

  // Cursor pagination catches up after restarts without loading all
  // historical trades into memory or splitting a minute across pages.
  for (;;) {
    const page = await fastify.db.trade.findMany({
      where: {
        clientId,
        symbol,
        timestamp: {
          ...(latest ? { gte: latest.timestamp } : {}),
          lt: nowMinute
        }
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      take: PAGE_SIZE,
      ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {})
    })

    if (page.length === 0) break

    for (const trade of page) {
      const bucket = minuteStart(trade.timestamp)
      if (current && current.timestamp.getTime() !== bucket) {
        await persist(current)
        current = undefined
      }
      current = addTickToCandle(current, trade)
    }

    if (page.length < PAGE_SIZE) break
    cursorId = page[page.length - 1].id
  }

  if (current) await persist(current)
  return changedCount
}
