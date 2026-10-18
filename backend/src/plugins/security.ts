import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Register Helmet to append zero-trust HTTP security frames globally
  await fastify.register(helmet, { contentSecurityPolicy: true })

  // 2. Register JSON Web Token parsing layer with a secure environment signature string
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'SUPER_SECURE_COMPLIANCE_GATEWAY_TOKEN_SECRET_KEY_123!'
  })

  // 3. Decorate Fastify instance with a global validation middleware interceptor hook
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      // Automatically parses Authorization headers ('Bearer <token>') and validates integrity
      await request.jwtVerify()
    } catch (err) {
      return reply.code(401).send({ 
        success: false, 
        error: 'Compliance Violation: Invalid or missing API key signature tokens.' 
      })
    }
  })
}

export default fp(securityPlugin)
