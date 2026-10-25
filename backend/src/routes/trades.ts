
import { FastifyInstance } from 'fastify'

const tradeIngestionSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['symbol', 'price', 'quantity', 'side'],
    properties: {
      symbol: {
        type: 'string',
        minLength: 3,
        maxLength: 10,
        pattern: '^[A-Z0-9]{3,10}$'
      },
      price: { type: 'number', exclusiveMinimum: 0 },
      quantity: { type: 'number', exclusiveMinimum: 0 },
      side: { type: 'string', enum: ['BUY', 'SELL'] }
    }
  }
}

const querySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    symbol: {
      type: 'string',
      minLength: 3,
      maxLength: 10,
      pattern: '^[A-Z0-9]{3,10}$'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 500
    }
  }
}

export default async function tradeRoutes(fastify: FastifyInstance) {
  // POST: validate, authenticate, and queue a market tick.
  fastify.post(
    '/api/v1/trades',
    {
      schema: tradeIngestionSchema,
      preValidation: [fastify.authenticate]
    },
    async (request, reply) => {
      const { symbol, price, quantity, side } = request.body as {
        symbol: string
        price: number
        quantity: number
        side: 'BUY' | 'SELL'
      }

      const clientId = request.tenant.clientId

      try {
        const tickData = {
          clientId,
          symbol,
          price,
          quantity,
          side,
          timestamp: new Date().toISOString()
        }

        // Use the same key convention in ingestion and aggregation.
        await fastify.redis.lPush(
          `ticks:${clientId}:${symbol}`,
          JSON.stringify(tickData)
        )

        return reply.code(202).send({
          success: true,
          message: 'Tick accepted for processing'
        })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(503).send({
          success: false,
          error: 'Market tick could not be queued'
        })
      }
    }
  )

  // GET: retrieve only the authenticated tenant's persisted trades.
  fastify.get(
    '/api/v1/trades',
    {
      preValidation: [fastify.authenticate],
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { symbol, limit = 50 } = request.query as {
        symbol?: string
        limit?: number
      }

      const clientId = request.tenant.clientId

      try {
        const trades = await fastify.db.trade.findMany({
          where: {
            clientId,
            symbol
          },
          orderBy: { timestamp: 'desc' },
          take: limit
        })

        return reply.send({
          success: true,
          count: trades.length,
          data: trades
        })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          success: false,
          error: 'Failed to retrieve tenant trade feed'
        })
      }
    }
  )

  // GET: return candles belonging to the authenticated tenant.
  fastify.get(
    '/api/v1/charts',
    {
      preValidation: [fastify.authenticate],
      schema: { querystring: querySchema }
    },
    async (request, reply) => {
      const { symbol, limit = 100 } = request.query as {
        symbol?: string
        limit?: number
      }

      if (!symbol) {
        return reply.code(400).send({
          success: false,
          error: 'Query parameter "symbol" is required'
        })
      }

      const clientId = request.tenant.clientId

      try {
        const candles = await fastify.db.oHLCV.findMany({
          where: {
            clientId,
            symbol
          },
          orderBy: { timestamp: 'desc' },
          take: limit
        })

        return reply.send({
          success: true,
          tenant: clientId,
          symbol,
          data: candles.reverse()
        })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          success: false,
          error: 'Failed to retrieve chart analytics feed'
        })
      }
    }
  )
}
