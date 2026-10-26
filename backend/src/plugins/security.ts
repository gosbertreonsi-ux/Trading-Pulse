import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: {
      clientId: string
      role: string
    }
  }
}

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, { contentSecurityPolicy: true })

  const secret = process.env.TRADING_PULSE_API_TOKEN
  if (!secret || secret.length < 32) {
    throw new Error('TRADING_PULSE_API_TOKEN must be set to a strong JWT signing secret (at least 32 characters)')
  }

  await fastify.register(jwt, { secret })

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const decoded = await request.jwtVerify<{ client: string; role?: string }>()

        if (typeof decoded.client !== 'string' || !decoded.client.trim()) {
          reply.code(401).send({ success: false, error: 'Invalid tenant identity' })
          return
        }

        request.tenant = {
          clientId: decoded.client,
          role: typeof decoded.role === 'string' ? decoded.role : 'viewer'
        }
      } catch {
        reply.code(401).send({
          success: false,
          error: 'Invalid or missing authentication token'
        })
      }
    }
  )
}

export default fp(securityPlugin)
