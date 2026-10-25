
import 'fastify'
import type { RedisClientType } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>

    redis: RedisClientType
  }

  interface FastifyRequest {
    tenant: {
      clientId: string
    }
  }
}
