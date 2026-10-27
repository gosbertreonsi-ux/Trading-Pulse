import type { FastifyInstance } from 'fastify'
import { PaperMatchingEngine } from '../services/paperMatching'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
const querySchema = {
  querystring: {
    type: 'object', additionalProperties: false, required: ['symbol'],
    properties: { symbol: { type: 'string', enum: SYMBOLS } }
  }
}
const placeSchema = {
  body: {
    type: 'object', additionalProperties: false,
    required: ['symbol', 'side', 'price', 'quantity'],
    properties: {
      symbol: { type: 'string', enum: SYMBOLS },
      side: { type: 'string', enum: ['BUY', 'SELL'] },
      price: { type: 'number', exclusiveMinimum: 0, maximum: 1000000000 },
      quantity: { type: 'number', minimum: 0.0001, maximum: 1000000 }
    }
  }
}
const idSchema = {
  params: {
    type: 'object', required: ['id'], additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^[a-fA-F0-9-]{36}$' }
    }
  }
}

/**
 * Separate educational paper matching sandbox. It never writes to Trade,
 * OHLCV, balances, broker endpoints, or any real exchange. The book is
 * in-memory and disappears when Fastify restarts.
 */
export default async function paperOrderRoutes(fastify: FastifyInstance) {
  const engine = new PaperMatchingEngine()
  function viewerOnly(role: string): boolean { return role === 'viewer' }
  function allowed(): boolean { return process.env.NODE_ENV !== 'production' }

  fastify.get('/api/v1/paper/book', {
    preValidation: [fastify.authenticate], schema: querySchema
  }, async (request, reply) => {
    if (!allowed()) return reply.code(403).send({ success: false, error: 'Paper sandbox is local-development only' })
    if (!viewerOnly(request.tenant.role)) return reply.code(403).send({ success: false, error: 'Viewer role required' })
    const { symbol } = request.query as { symbol: string }
    return reply.header('Cache-Control', 'no-store')
      .send({ success: true, ...engine.snapshot(request.tenant.clientId, symbol) })
  })

  fastify.post('/api/v1/paper/orders', {
    preValidation: [fastify.authenticate], schema: placeSchema
  }, async (request, reply) => {
    if (!allowed()) return reply.code(403).send({ success: false, error: 'Paper sandbox is local-development only' })
    if (!viewerOnly(request.tenant.role)) return reply.code(403).send({ success: false, error: 'Viewer role required' })
    const { symbol, side, price, quantity } = request.body as {
      symbol: string; side: 'BUY' | 'SELL'; price: number; quantity: number
    }
    try {
      const result = engine.place(request.tenant.clientId, symbol, side, price, quantity)
      return reply.code(201).send({ success: true, ...result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Paper order rejected'
      return reply.code(/capacity|Maximum/.test(message) ? 429 : 400)
        .send({ success: false, error: message })
    }
  })

  fastify.delete('/api/v1/paper/orders/:id', {
    preValidation: [fastify.authenticate], schema: idSchema
  }, async (request, reply) => {
    if (!allowed()) return reply.code(403).send({ success: false, error: 'Paper sandbox is local-development only' })
    if (!viewerOnly(request.tenant.role)) return reply.code(403).send({ success: false, error: 'Viewer role required' })
    const { id } = request.params as { id: string }
    const order = engine.cancel(request.tenant.clientId, id)
    if (!order) return reply.code(404).send({ success: false, error: 'Active paper order not found' })
    return reply.send({ success: true, order })
  })
}
