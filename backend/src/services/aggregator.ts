import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

export async function aggregateCandlestick(symbol: string) {
  try {
    // 1. Calculate the time window for the last 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

    // 2. Fetch all raw ticks for this symbol created in the last minute [ORM.ARGUMENT_INVALID]
    const ticks = await prisma.trade.findMany({
      where: {
        symbol,
        timestamp: { gte: oneMinuteAgo },
      },
      orderBy: { timestamp: 'asc' },
    })

    if (ticks.length === 0) return // No trades to aggregate

    // 3. Extract the OHLCV metric properties mathematically
    const open = parseFloat(ticks[0].price.toString())
    const close = parseFloat(ticks[ticks.length - 1].price.toString())
    
    let high = open
    let low = open
    let totalVolume = 0

    for (const tick of ticks) {
      const price = parseFloat(tick.price.toString())
      const quantity = parseFloat(tick.quantity.toString())
      
      if (price > high) high = price
      if (price < low) low = price
      totalVolume += quantity
    }

    // 4. Save the compiled candlestick block into your OHLCV table [MIGRATION.PLANNING_FAILED]
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

    console.log(`📊 [AGGREGATOR] Compiled 1m bar for ${symbol} | Close: ${close} | Vol: ${totalVolume.toFixed(2)}`)
    
    // 5. Optional: Delete old raw trades to keep your database fast and lightweight
    await prisma.trade.deleteMany({
      where: {
        symbol,
        timestamp: { lt: oneMinuteAgo },
      },
    })

  } catch (error) {
    console.error('❌ Aggregator error:', error)
  }
}
