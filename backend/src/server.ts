import Fastify from 'fastify'
import cors from '@fastify/cors'
import prismaPlugin from './plugins/db'
import redisPlugin from './plugins/redis'
import securityPlugin from './plugins/security' // Import the Phase 2 gateway plugin
import tradeRoutes from './routes/trades'
import { aggregateCandlestick } from './services/aggregator'

const fastify = Fastify({ logger: true })

async function start() {
  await fastify.register(cors, { origin: true })
  await fastify.register(prismaPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(securityPlugin) // Register your security barrier module
  await fastify.register(tradeRoutes)

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Trading-Pulse ingestion server running on port 3000')

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
