import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from 'redis'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })
const redis = createClient()

redis.on('error', (err) => console.error('[AGGREGATOR REDIS ERROR]', err))
redis.connect()

export async function aggregateCandlestick(
  symbol: string,
  clientId: string
) {
  const redisKey = `ticks:${clientId}:${symbol}`

  try {
    // 1. Fetch all elements currently in the high-speed Redis queue
    const rawTicks = await redis.lRange(redisKey, 0, -1)
    if (!rawTicks || rawTicks.length === 0) return

    const ticks = rawTicks.map((t) => JSON.parse(t))
    ticks.reverse() // Keep chronological order

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

    // 2. Commit the highly compressed historical bar to persistent PostgreSQL storage
    await prisma.oHLCV.create({
      data: {
        clientId,
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

    // 3. Instead of wiping the entire list, we only clean up ticks older than 1 minute,
    // leaving fresh recent ticks in place for the Predictive Engine to read!
    const clearBeforeTime = Date.now() - 60 * 1000
    const rawRemaining = await redis.lRange(redisKey, 0, -1)
    
    // Reverse find how many items to keep
    let keepCount = 0
    for (const raw of rawRemaining) {
      if (new Date(JSON.parse(raw).timestamp).getTime() > clearBeforeTime) {
        keepCount++
      }
    }
    
    // Trim the list to only keep the newest unexpired ticks
    await redis.lTrim(redisKey, 0, keepCount - 1)

  } catch (error) {
    console.error(`❌ [AGGREGATOR ERROR] Failed to compress data for ${symbol}:`, error)
  }
}
