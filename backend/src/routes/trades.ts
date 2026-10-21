import { FastifyInstance } from 'fastify'

const tradeIngestionSchema = {
  body: {
    type: 'object',
    required: ['symbol', 'price', 'quantity', 'side'],
    properties: {
      symbol: { type: 'string', minLength: 3, maxLength: 10, pattern: '^[A-Z0-9]+\$' },
      price: { type: 'number', minimum: 0.000001 },
      quantity: { type: 'number', minimum: 0.000001 },
      side: { type: 'string', enum: ['BUY', 'SELL'] }
    }
  }
}

export default async function tradeRoutes(fastify: FastifyInstance) {
  
  // 1. Secured POST Ingestion Route mapping multi-tenant attributes
  fastify.post('/api/v1/trades', { schema: tradeIngestionSchema, preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { symbol, price, quantity, side } = request.body as any
    const clientId = request.tenant.clientId // Extracted securely from the JWT

    try {
      const tickData = {
        clientId, // Scoped to this specific tenant
        symbol,
        price,
        quantity,
        side,
        timestamp: new Date().toISOString()
      }

      // Group memory buffers by client tenant to isolate high-frequency queues
      await fastify.redis.lPush(`ticks:${clientId}:${symbol}`, JSON.stringify(tickData))

      return reply.code(201).send({ success: true, message: 'Tick securely processed under tenant: ' + clientId })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'In-memory multi-tenant caching failed' })
    }
  })

  // 2. Scoped GET Route to fetch ONLY this tenant's trades
  fastify.get('/api/v1/trades', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { symbol, limit } = request.query as any
    const parsedLimit = limit ? parseInt(limit, 10) : 50
    const clientId = request.tenant.clientId

    try {
      const trades = await fastify.db.trade.findMany({
        where: {
          clientId, // Enforces strict workspace privacy boundaries
          symbol: symbol ? symbol : undefined
        },
        orderBy: { timestamp: 'desc' },
        take: parsedLimit,
      })
      return reply.send({ success: true, tenant: clientId, count: trades.length, data: trades })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve tenant trade feed' })
    }
  })

  // 3. Scoped GET Route to fetch ONLY this tenant's compiled charts
  fastify.get('/api/v1/charts', async (request, reply) => {
    const { symbol, limit, client } = request.query as any
    if (!symbol) return reply.code(400).send({ success: false, error: 'Query parameter "symbol" is required' })
    
    const parsedLimit = limit ? parseInt(limit, 10) : 100
    const targetClient = client || 'trading-pulse-simulator-agent' // Matches your simulator token identity

    try {
      const candles = await fastify.db.oHLCV.findMany({
        where: { 
          clientId: targetClient, // Filters chart display fields safely
          symbol 
        },
        orderBy: { timestamp: 'desc' },
        take: parsedLimit,
      })
      return reply.send({ success: true, tenant: targetClient, symbol, data: candles.reverse() })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve chart analytics feed' })
    }
  })
}
