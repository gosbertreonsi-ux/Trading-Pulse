import Fastify from 'fastify'
import prismaPlugin from './plugins/db'
import tradeRoutes from './routes/trades'
import { aggregateCandlestick } from './services/aggregator' // Import our new aggregator

const fastify = Fastify({ logger: true })

async function start() {
  await fastify.register(prismaPlugin)
  await fastify.register(tradeRoutes)

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Trading-Pulse ingestion server running on port 3000')

    // START THE AUTOMATED AGGREGATOR LOOP
    // This runs every 10 seconds to generate data bars from the active simulator feed
    setInterval(async () => {
      await aggregateCandlestick('BTCUSDT')
      await aggregateCandlestick('ETHUSDT')
      await aggregateCandlestick('SOLUSDT')
    }, 10000)

  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
