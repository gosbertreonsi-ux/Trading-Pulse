import { createClient } from 'redis'
import { broadcastToCharts } from '../routes/streams' // Import the Phase 4 WebSocket broadcaster

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
    
    const rawTicks = await redis.lRange(redisKey, 0, 19)
    if (!rawTicks || rawTicks.length < 3) return 

    const ticks: TickerSnapshot[] = rawTicks.map((t) => JSON.parse(t))
    const prices = ticks.map((t) => parseFloat(t.price.toString()))

    const totalSum = prices.reduce((acc, p) => acc + p, 0)
    const currentSMA = totalSum / prices.length

    const latestPrice = prices[0]
    const priceDeviation = ((latestPrice - currentSMA) / currentSMA) * 100

    const buyTicks = ticks.filter(t => t.side === 'BUY').length
    const buyRatio = buyTicks / ticks.length

    console.log(`🔮 [ANALYTICS] ${symbol} Spot: ${latestPrice} | SMA: ${currentSMA.toFixed(2)} | Dev: ${priceDeviation.toFixed(4)}%`)

    if (Math.abs(priceDeviation) >= 0.02) {
      const condition = priceDeviation > 0 ? '🚀 BULLISH MOMENTUM' : '⚠️ BEARISH MOMENTUM'
      
      // Print the terminal log
      console.log(`\x1b[33m🔥 [BREAKOUT ALERT] ${symbol} | ${condition} | Deviation: ${priceDeviation.toFixed(3)}% | Buy Pressure: ${(buyRatio * 100).toFixed(1)}%\x1b[0m`)
      
      // LIVE BROADCAST: Push the alert over the WebSocket tunnel instantly to connected browsers!
      broadcastToCharts('ALERT', {
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
