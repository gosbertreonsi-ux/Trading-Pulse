import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { createClient } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof createClient>
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize local Redis client (defaults to localhost:6379)
  const client = createClient()

  client.on('error', (err) => fastify.log.error('Redis Client Error', err))

  await client.connect()
  fastify.log.info('⚡ Redis Cache Layer connected successfully')

  // Decorate Fastify so we can call it via fastify.redis
  fastify.decorate('redis', client as never)

  fastify.addHook('onClose', async (server) => {
    await server.redis.quit()
  })
}

export default fp(redisPlugin)
