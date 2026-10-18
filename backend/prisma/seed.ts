import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// 1. Wrap the system environment URL into the JavaScript driver
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

// 2. Feed the active adapter into your client container
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding trading-pulse database...')

  // 1. Create a mock trade tick
  const trade = await prisma.trade.create({
    data: {
      symbol: 'BTCUSDT',
      price: 64250.75,
      quantity: 0.0425,
      side: 'BUY',
    },
  })

  // 2. Create a mock OHLCV candlestick bar
  const ohlcv = await prisma.oHLCV.create({
    data: {
      symbol: 'ETHUSDT',
      timestamp: new Date(),
      open: 2650.00,
      high: 2685.50,
      low: 2630.10,
      close: 2675.25,
      volume: 1450.85,
    },
  })

  console.log('✅ Seed completed successfully!')
  console.log('Inserted Trade:', trade)
  console.log('Inserted OHLCV Bar:', ohlcv)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
