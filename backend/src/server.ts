import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fws from '@fastify/websocket'
import prismaPlugin from './plugins/db'
import redisPlugin from './plugins/redis'
import securityPlugin from './plugins/security'
import tradeRoutes from './routes/trades'
import alertRoutes from './routes/alerts'
import streamingRoutes from './routes/streams'
import marketOverviewRoutes from './routes/marketOverview'
import historicalAnalyticsRoutes from './routes/historicalAnalytics'
import liquidityModelRoutes from './routes/liquidity'
import paperOrderRoutes from './routes/paperOrders'
import { aggregateCandlestick } from './services/aggregator'
import { evaluateMarketTrend } from './services/predictiveCore'

const fastify = Fastify({ logger: true })
const SIMULATOR_CLIENT_ID = 'trading-pulse-simulator-agent'
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const

async function start(): Promise<void> {
  await fastify.register(cors, { origin: true })
  await fastify.register(fws)
  await fastify.register(prismaPlugin)
  await fastify.register(redisPlugin)
  await fastify.register(securityPlugin)
  await fastify.register(tradeRoutes)
  await fastify.register(alertRoutes)
  await fastify.register(streamingRoutes)
  await fastify.register(marketOverviewRoutes)
  await fastify.register(historicalAnalyticsRoutes)
  await fastify.register(liquidityModelRoutes)
  await fastify.register(paperOrderRoutes)

  let aggregating = false
  let predicting = false

  const aggregateMarkets = async () => {
    if (aggregating) return
    aggregating = true
    try {
      for (const symbol of SYMBOLS) {
        try {
          const count = await aggregateCandlestick(fastify, symbol, SIMULATOR_CLIENT_ID)
          if (count > 0) fastify.log.info({ symbol, count }, 'Completed candle changes')
        } catch (error) {
          fastify.log.error({ err: error, symbol }, 'Candle aggregation failed')
        }
      }
    } finally {
      aggregating = false
    }
  }

  const predictMarkets = async () => {
    if (predicting) return
    predicting = true
    try {
      for (const symbol of SYMBOLS) {
        try {
          await evaluateMarketTrend(fastify, symbol, SIMULATOR_CLIENT_ID)
        } catch (error) {
          fastify.log.warn({ err: error, symbol }, 'Predictive cache unavailable')
        }
      }
    } finally {
      predicting = false
    }
  }

  let candleTimer: ReturnType<typeof setInterval> | undefined
  let predictionTimer: ReturnType<typeof setInterval> | undefined
  fastify.addHook('onClose', async () => {
    if (candleTimer) clearInterval(candleTimer)
    if (predictionTimer) clearInterval(predictionTimer)
  })

  await fastify.listen({
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '127.0.0.1'
  })

  candleTimer = setInterval(() => { void aggregateMarkets() }, 10_000)
  predictionTimer = setInterval(() => { void predictMarkets() }, 2_000)

  // Do not wait for the first interval to check for previously completed candles.
  void aggregateMarkets()
  fastify.log.info('Trading Pulse market analytics backend is running')
}

start().catch(error => {
  fastify.log.error(error)
  process.exitCode = 1
})
