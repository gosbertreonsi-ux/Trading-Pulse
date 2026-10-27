import type { FastifyInstance } from 'fastify'

const SUPPORTED = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

const createSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['symbol', 'direction', 'targetPrice'],
    properties: {
      symbol: { type: 'string', enum: SUPPORTED },
      direction: { type: 'string', enum: ['ABOVE', 'BELOW'] },
      targetPrice: { type: 'number', minimum: 0.0001, maximum: 1000000000000 }
    }
  }
}
const idSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^[a-fA-F0-9-]{36}$' }
    }
  }
}
const listSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      symbol: { type: 'string', enum: SUPPORTED }
    }
  }
}

/** Viewer can manage their own market alerts but cannot post simulator trades. */
export default async function alertRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/alerts', {
    preValidation: [fastify.authenticate],
    schema: listSchema
  }, async (request, reply) => {
    if (request.tenant.role !== 'viewer') {
      return reply.code(403).send({ success: false, error: 'Viewer role required' })
    }
    const { symbol } = request.query as { symbol?: string }
    try {
      const data = await fastify.db.priceAlert.findMany({
        where: { clientId: request.tenant.clientId, ...(symbol ? { symbol } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100
      })
      return reply.send({ success: true, data })
    } catch (err) {
      fastify.log.error({ err }, 'Unable to list price alerts')
      return reply.code(503).send({ success: false, error: 'Alert storage unavailable' })
    }
  })

  fastify.post('/api/v1/alerts', {
    preValidation: [fastify.authenticate],
    schema: createSchema
  }, async (request, reply) => {
    if (request.tenant.role !== 'viewer') {
      return reply.code(403).send({ success: false, error: 'Viewer role required' })
    }
    const { symbol, direction, targetPrice } = request.body as {
      symbol: string
      direction: 'ABOVE' | 'BELOW'
      targetPrice: number
    }
    const clientId = request.tenant.clientId
    try {
      const active = await fastify.db.priceAlert.count({
        where: { clientId, status: 'ACTIVE' }
      })
      if (active >= 30) {
        return reply.code(429).send({ success: false, error: 'Maximum of 30 active alerts per tenant' })
      }

      const data = await fastify.db.priceAlert.create({
        data: {
          clientId,
          symbol,
          direction,
          targetPrice: Number(targetPrice.toFixed(4))
        }
      })
      return reply.code(201).send({ success: true, data })
    } catch (err) {
      fastify.log.error({ err }, 'Unable to create price alert')
      return reply.code(503).send({ success: false, error: 'Alert storage unavailable' })
    }
  })

  fastify.delete('/api/v1/alerts/:id', {
    preValidation: [fastify.authenticate],
    schema: idSchema
  }, async (request, reply) => {
    if (request.tenant.role !== 'viewer') {
      return reply.code(403).send({ success: false, error: 'Viewer role required' })
    }
    const { id } = request.params as { id: string }
    try {
      const removed = await fastify.db.priceAlert.deleteMany({
        where: { id, clientId: request.tenant.clientId }
      })
      if (removed.count === 0) return reply.code(404).send({ success: false, error: 'Alert not found' })
      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error({ err }, 'Unable to remove price alert')
      return reply.code(503).send({ success: false, error: 'Alert storage unavailable' })
    }
  })
}
