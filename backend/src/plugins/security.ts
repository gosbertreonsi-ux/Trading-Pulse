import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Inject custom properties into Fastify's native request object type definitions
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

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'SUPER_SECURE_COMPLIANCE_GATEWAY_TOKEN_SECRET_KEY_123!'
  })

fastify.decorate(
  'authenticate',
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const decoded: any = await request.jwtVerify()

      if (
        typeof decoded.client !== 'string' ||
        decoded.client.length === 0
      ) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid tenant identity'
        })
      }

      request.tenant = {
        clientId: decoded.client,
        role: decoded.role || 'viewer'
      }
    } catch {
      return reply.code(401).send({
        success: false,
        error: 'Invalid or missing authentication token'
      })
    }
  }
)

}

export default fp(securityPlugin)
