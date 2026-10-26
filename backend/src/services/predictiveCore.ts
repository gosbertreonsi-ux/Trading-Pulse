import { createClient } from 'redis'
import { broadcastToCharts } from '../routes/streams'

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' })
redis.on('error', (error) => console.error('[PREDICTIVE CORE REDIS ERROR]', error))
const redisReady = redis.connect()

interface TickerSnapshot {
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: string
}

export async function evaluateMarketTrend(symbol: string, clientId: string): Promise<void> {
  try {
    await redisReady
    const rawTicks = await redis.lRange(`ticks:${clientId}:${symbol}`, 0, 19)
    if (rawTicks.length < 3) return

    const ticks: TickerSnapshot[] = rawTicks.map(raw => JSON.parse(raw) as TickerSnapshot)
    const prices = ticks.map(tick => Number(tick.price))
    if (prices.some(price => !Number.isFinite(price) || price <= 0)) return

    const currentSMA = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const latestPrice = prices[0]
    const priceDeviation = ((latestPrice - currentSMA) / currentSMA) * 100
    const buyRatio = ticks.filter(tick => tick.side === 'BUY').length / ticks.length

    if (Math.abs(priceDeviation) >= 0.02) {
      const condition = priceDeviation > 0 ? 'BULLISH MOMENTUM' : 'BEARISH MOMENTUM'
      broadcastToCharts('ALERT', {
        clientId,
        symbol,
        condition,
        price: latestPrice,
        deviation: priceDeviation,
        buyPressure: buyRatio * 100,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error(`[PREDICTIVE ENGINE ERROR] Trend analysis failed for ${symbol}:`, error)
  }
}
