import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from 'redis'
import 'dotenv/config'

// 1. Re-instantiate standard internal worker clients
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const redis = createClient()

redis.on('error', (err) => console.error('[AGGREGATOR REDIS ERROR]', err))

// Connect to Redis immediately upon worker import
redis.connect()

export async function aggregateCandlestick(symbol: string) {
  const redisKey = `ticks:${symbol}`

  try {
    // 2. Atomically fetch and clear ALL waiting trade logs from the Redis list array
    // This drains the high-speed cache memory space instantly
    const rawTicks = await redis.lRange(redisKey, 0, -1)
    if (!rawTicks || rawTicks.length === 0) return

    // Clear the processed chunk from memory so fresh incoming ticks can accumulate safely
    await redis.lTrim(redisKey, rawTicks.length, -1)

    // 3. Parse JSON string maps back into object fragments
    const ticks = rawTicks.map((t) => JSON.parse(t))

    // Sort chronologically (oldest to newest) since lPush pushes to the head
    ticks.reverse()

    // 4. Extract the standard financial OHLCV metric dimensions mathematically
    const open = parseFloat(ticks[0].price)
    const close = parseFloat(ticks[ticks.length - 1].price)
    
    let high = open
    let low = open
    let totalVolume = 0

    for (const tick of ticks) {
      const price = parseFloat(tick.price)
      const quantity = parseFloat(tick.quantity)
      
      if (price > high) high = price
      if (price < low) low = price
      totalVolume += quantity
    }

    // 5. Commit the highly compressed historical bar to persistent PostgreSQL storage [MIGRATION.PLANNING_FAILED]
    const candle = await prisma.oHLCV.create({
      data: {
        symbol,
        timestamp: new Date(),
        open,
        high,
        low,
        close,
        volume: totalVolume,
      },
    })

    console.log(`📊 [ENGINE] Compacted ${ticks.length} memory ticks into 1m bar for ${symbol} | Close: ${close} | Vol: ${totalVolume.toFixed(2)}`)

  } catch (error) {
    console.error(`❌ [AGGREGATOR ERROR] Failed to compress data for ${symbol}:`, error)
  }
}
