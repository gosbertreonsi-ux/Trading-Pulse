import Fastify from 'fastify'
import prismaPlugin from './plugins/db'
import tradeRoutes from './routes/trades'

const fastify = Fastify({ logger: true })

async function start() {
  // 1. Load the database context first
  await fastify.register(prismaPlugin)

  // 2. Load your feature route maps next
  await fastify.register(tradeRoutes)

  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Trading-Pulse ingestion server running on port 3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
