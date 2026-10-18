import Fastify from 'fastify'
import cors from '@fastify/cors' // Import the CORS header module
import prismaPlugin from './plugins/db'
import tradeRoutes from './routes/trades'
import { aggregateCandlestick } from './services/aggregator'

const fastify = Fastify({ logger: true })

async function start() {
  // REGISTER CORS FIRST to unblock local browser requests
  await fastify.register(cors, { 
    origin: true // Allows local files and web pages to read your routes safely
  })
  
  await fastify.register(prismaPlugin)
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
