import { createClient } from 'redis'

const redis = createClient()
redis.on('error', (err) => console.error('[PREDICTIVE CORE REDIS ERROR]', err))
redis.connect()

interface TickerSnapshot {
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: string
}

export async function evaluateMarketTrend(symbol: string) {
  try {
    const redisKey = `ticks:${symbol}`
    
    // Read the last 20 ticks currently accumulating inside our high-speed Redis queue
    const rawTicks = await redis.lRange(redisKey, 0, 19)
    if (!rawTicks || rawTicks.length < 3) return // Needs at least 3 ticks to calculate variance

    const ticks: TickerSnapshot[] = rawTicks.map((t) => JSON.parse(t))
    const prices = ticks.map((t) => parseFloat(t.price.toString()))

    // Calculate moving average
    const totalSum = prices.reduce((acc, p) => acc + p, 0)
    const currentSMA = totalSum / prices.length

    const latestPrice = prices[0]
    const priceDeviation = ((latestPrice - currentSMA) / currentSMA) * 100

    const buyTicks = ticks.filter(t => t.side === 'BUY').length
    const buyRatio = buyTicks / ticks.length

    // ALWAYS print a baseline dashboard tracking line so we can see the engine running
    console.log(`🔮 [ANALYTICS] ${symbol} Spot: ${latestPrice} | SMA: ${currentSMA.toFixed(2)} | Dev: ${priceDeviation.toFixed(4)}%`)

    // Lowered threshold to 0.02% to guarantee detection of simulated price movements
    if (Math.abs(priceDeviation) >= 0.02) {
      const condition = priceDeviation > 0 ? '🚀 BULLISH MOMENTUM' : '⚠️ BEARISH MOMENTUM'
      console.log(`\x1b[33m🔥 [BREAKOUT ALERT] ${symbol} | ${condition} | Deviation: ${priceDeviation.toFixed(3)}% | Buy Pressure: ${(buyRatio * 100).toFixed(1)}%\x1b[0m`)
    }

  } catch (error) {
    console.error(`[PREDICTIVE ENGINE ERROR] Trend analysis failed for ${symbol}:`, error)
  }
}
