import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'

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

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      // Decode the token payload
      const decoded: any = await request.jwtVerify()
      
      // Extract client information and link it straight to the request lifecycle context
      request.tenant = {
        clientId: decoded.client || 'global',
        role: decoded.role || 'viewer'
      }
    } catch (err) {
      return reply.code(401).send({ 
        success: false, 
        error: 'Compliance Violation: Invalid or missing API key signature tokens.' 
      })
    }
  })
}

export default fp(securityPlugin)
