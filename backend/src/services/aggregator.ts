
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from 'redis'
import 'dotenv/config'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })
const redis = createClient()

redis.on('error', (error) => {
  console.error('[AGGREGATOR REDIS ERROR]', error)
})

const redisReady = redis.connect()

interface MarketTick {
  clientId: string
  symbol: string
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: string
}

export async function aggregateCandlestick(
  symbol: string,
  clientId: string
): Promise<void> {
  const redisKey = `ticks:${clientId}:${symbol}`

  try {
    await redisReady

    // LPUSH puts the newest tick first.
    const rawTicks = await redis.lRange(redisKey, 0, -1)
    if (rawTicks.length === 0) return

    const now = Date.now()
    const retentionMs = 120_000
    const cutoff = now - retentionMs

    const ticks: MarketTick[] = rawTicks
      .map((raw) => JSON.parse(raw) as MarketTick)
      .filter((tick) => {
        const timestamp = new Date(tick.timestamp).getTime()

        return (
          tick.clientId === clientId &&
          tick.symbol === symbol &&
          Number.isFinite(timestamp) &&
          Number.isFinite(Number(tick.price)) &&
          Number(tick.price) > 0 &&
          Number.isFinite(Number(tick.quantity)) &&
          Number(tick.quantity) > 0
        )
      })

    // Sort oldest to newest before calculating candle values.
    ticks.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    )

    // Group ticks by the start of their UTC minute.
    const buckets = new Map<number, MarketTick[]>()

    for (const tick of ticks) {
      const tickTime = new Date(tick.timestamp).getTime()
      const bucketStart =
        Math.floor(tickTime / 60_000) * 60_000

      // Wait until the minute has ended before saving its candle.
      if (bucketStart + 60_000 > now) continue

      const bucket = buckets.get(bucketStart) ?? []
      bucket.push(tick)
      buckets.set(bucketStart, bucket)
    }

    for (const [bucketStart, bucketTicks] of buckets) {
      if (bucketTicks.length === 0) continue

      const prices = bucketTicks.map((tick) => Number(tick.price))
      const quantities = bucketTicks.map((tick) => Number(tick.quantity))

      const open = prices[0]
      const close = prices[prices.length - 1]
      const high = Math.max(...prices)
      const low = Math.min(...prices)
      const volume = quantities.reduce(
        (total, quantity) => total + quantity,
        0
      )

      // A stable minute timestamp plus upsert prevents duplicate rows
      // when this service runs repeatedly for the same minute.
      await prisma.oHLCV.upsert({
        where: {
          clientId_symbol_timestamp: {
            clientId,
            symbol,
            timestamp: new Date(bucketStart),
          },
        },
        create: {
          clientId,
          symbol,
          timestamp: new Date(bucketStart),
          open,
          high,
          low,
          close,
          volume,
        },
        update: {
          open,
          high,
          low,
          close,
          volume,
        },
      })

      console.log(
        `[AGGREGATOR] Saved ${symbol} candle at ${new Date(bucketStart).toISOString()} | ` +
        `ticks=${bucketTicks.length} close=${close} volume=${volume.toFixed(4)}`
      )
    }

    // Preserve recent ticks for the predictive engine.
    // Since LPUSH stores newest ticks first, keep the recent prefix.
    let keepCount = 0

    for (const raw of rawTicks) {
      let tick: MarketTick

      try {
        tick = JSON.parse(raw) as MarketTick
      } catch {
        keepCount++
        continue
      }

      const timestamp = new Date(tick.timestamp).getTime()

      if (Number.isFinite(timestamp) && timestamp >= cutoff) {
        keepCount++
      } else {
        break
      }
    }

    if (keepCount < rawTicks.length) {
      await redis.lTrim(redisKey, 0, keepCount - 1)
    }
  } catch (error) {
    console.error(
      `[AGGREGATOR ERROR] Failed to aggregate ${symbol} for tenant ${clientId}:`,
      error
    )
  }
}
