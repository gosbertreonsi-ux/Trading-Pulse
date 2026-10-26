import type { FastifyInstance } from 'fastify'
import { broadcastToCharts } from '../routes/streams'

interface TickerSnapshot {
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: string
}

export async function evaluateMarketTrend(
  fastify: FastifyInstance,
  symbol: string,
  clientId: string
): Promise<void> {
  const redisKey = `ticks:${clientId}:${symbol}`
  const rawTicks = await fastify.redis.lRange(redisKey, 0, 19)
  if (rawTicks.length < 3) return

  const ticks: TickerSnapshot[] = rawTicks.map(raw => JSON.parse(raw) as TickerSnapshot)
  const prices = ticks.map(tick => Number(tick.price))
  if (prices.some(price => !Number.isFinite(price) || price <= 0)) return

  const currentSMA = prices.reduce((total, price) => total + price, 0) / prices.length
  const latestPrice = prices[0]
  const deviation = ((latestPrice - currentSMA) / currentSMA) * 100
  const buyRatio = ticks.filter(tick => tick.side === 'BUY').length / ticks.length

  if (Math.abs(deviation) < 0.02) return

  broadcastToCharts('ALERT', {
    clientId,
    symbol,
    condition: deviation > 0 ? 'BULLISH MOMENTUM' : 'BEARISH MOMENTUM',
    price: latestPrice,
    deviation,
    buyPressure: buyRatio * 100,
    timestamp: new Date().toISOString()
  })
}
