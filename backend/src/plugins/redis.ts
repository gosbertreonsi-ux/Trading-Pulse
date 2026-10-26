import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { createClient } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof createClient>
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const client = createClient({ url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' })
  client.on('error', (error) => fastify.log.error({ err: error }, 'Redis client error'))

  await client.connect()
  fastify.log.info('Redis cache connected')
  fastify.decorate('redis', client as never)

  fastify.addHook('onClose', async (server) => {
    await server.redis.quit()
  })
}

export default fp(redisPlugin)
