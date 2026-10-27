
import { FastifyInstance } from 'fastify'
import { evaluatePriceAlerts } from '../services/priceAlerts'

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
      if (request.tenant.role !== 'high_frequency_ingestion_worker') {
        return reply.code(403).send({ success: false, error: 'Ingestion role required' })
      }

      try {
        const tickData = {
          clientId,
          symbol,
          price,
          quantity,
          side,
          timestamp: new Date().toISOString()
        }

        // Persist the tick first: PostgreSQL is the durable market-data source.
        // Aggregation can recover these trades after a Redis interruption.
        const saved = await fastify.db.trade.create({ data: tickData })

        // Alert evaluation is best-effort and follows durable trade storage.
        // An alert-service outage must not imply the trade was rejected.
        try {
          await evaluatePriceAlerts(fastify, clientId, symbol, price)
        } catch (alertError) {
          fastify.log.warn({ err: alertError, symbol }, 'Trade persisted; price alert evaluation delayed')
        }

        // Redis is a bounded, best-effort hot cache for predictive analytics.
        // A cache outage must not erase an already committed trade.
        let cached = false
        try {
          const key = `ticks:${clientId}:${symbol}`
          await fastify.redis.multi()
            .lPush(key, JSON.stringify(tickData))
            .lTrim(key, 0, 1999)
            .expire(key, 86_400)
            .exec()
          cached = true
        } catch (cacheError) {
          fastify.log.warn({ err: cacheError, symbol }, 'Tick persisted, Redis cache unavailable')
        }

        return reply.code(202).send({
          success: true,
          id: saved.id,
          cached,
          message: cached ? 'Tick persisted and cached' : 'Tick persisted; predictive cache delayed'
        })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(503).send({
          success: false,
          error: 'Market tick could not be persisted'
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
