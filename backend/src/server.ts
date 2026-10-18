import Fastify from 'fastify'
import cors from '@fastify/cors'
import fws from '@fastify/websocket' // Import the fastify websocket module
import prismaPlugin from './plugins/db'
import redisPlugin from './plugins/redis'
import securityPlugin from './plugins/security'
import tradeRoutes from './routes/trades'
import streamingRoutes from './routes/streams' // Import our stream routes
import { aggregateCandlestick } from './services/aggregator'
import { evaluateMarketTrend } from './services/predictiveCore'

const fastify = Fastify({ logger: true })

async function start() {
  await fastify.register(cors, { origin: true })
  await fastify.register(fws) // Register WebSocket protocol support
  await fastify.register(prismaPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(securityPlugin)
  
  // Register routes
  await fastify.register(tradeRoutes)
  await fastify.register(streamingRoutes)

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Trading-Pulse ingestion server running on port 3000')

    setInterval(async () => {
      await aggregateCandlestick('BTCUSDT')
      await aggregateCandlestick('ETHUSDT')
      await aggregateCandlestick('SOLUSDT')
    }, 10000)

    setInterval(async () => {
      await evaluateMarketTrend('BTCUSDT')
      await evaluateMarketTrend('ETHUSDT')
      await evaluateMarketTrend('SOLUSDT')
    }, 2000)

  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
