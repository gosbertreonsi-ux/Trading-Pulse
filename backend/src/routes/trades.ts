import { FastifyInstance } from 'fastify'

interface TradeRequestBody {
  symbol: string
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
}

interface TradeQueryQuerystring {
  symbol?: string
  limit?: string
}

interface CandlestickQueryQuerystring {
  symbol: string
  limit?: string
}

// Phase 2 Input Mitigation Layer: Strict Ajv Validation Schema
// This prevents cross-site-scripting and hostile manipulation text from hitting internal memories
const tradeIngestionSchema = {
  body: {
    type: 'object',
    required: ['symbol', 'price', 'quantity', 'side'],
    properties: {
      symbol: { 
        type: 'string', 
        minLength: 3, 
        maxLength: 10, 
        pattern: '^[A-Z0-9]+\$' // Enforces pure alphanumeric tickers; drops SQL/XSS injections instantly
      },
      price: { type: 'number', minimum: 0.000001 },
      quantity: { type: 'number', minimum: 0.000001 },
      side: { type: 'string', enum: ['BUY', 'SELL'] }
    }
  }
}

export default async function tradeRoutes(fastify: FastifyInstance) {
  
  // 1. High-Speed POST Ingestion Route with Gateway Security Interceptors
  fastify.post<{ Body: TradeRequestBody }>(
    '/api/v1/trades', 
    { 
      schema: tradeIngestionSchema,
      preValidation: [fastify.authenticate] // Enforces Cryptographic Token Validation before parsing inputs
    }, 
    async (request, reply) => {
      const { symbol, price, quantity, side } = request.body

      try {
        const tickData = {
          symbol,
          price,
          quantity,
          side,
          timestamp: new Date().toISOString()
        }

        // Append the verified tick into the high-speed Redis list key
        await fastify.redis.lPush(`ticks:${symbol}`, JSON.stringify(tickData))

        return reply.code(201).send({ success: true, message: 'Tick verified, authenticated, and cached' })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({ success: false, error: 'In-memory caching gateway error' })
      }
    }
  )

  // 2. GET Route to fetch historical tick streams
  fastify.get<{ Querystring: TradeQueryQuerystring }>('/api/v1/trades', async (request, reply) => {
    const { symbol, limit } = request.query
    const parsedLimit = limit ? parseInt(limit, 10) : 50
    try {
      const trades = await fastify.db.trade.findMany({
        where: symbol ? { symbol } : undefined,
        orderBy: { timestamp: 'desc' },
        take: parsedLimit,
      })
      return reply.send({ success: true, count: trades.length, data: trades })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve trade feed' })
    }
  })

  // 3. GET Route to fetch compiled OHLCV Candlestick Bars for Charts
  fastify.get<{ Querystring: CandlestickQueryQuerystring }>('/api/v1/charts', async (request, reply) => {
    const { symbol, limit } = request.query
    if (!symbol) {
      return reply.code(400).send({ success: false, error: 'Query parameter "symbol" is required' })
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 100
    try {
      const candles = await fastify.db.oHLCV.findMany({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
        take: parsedLimit,
      })
      return reply.send({ success: true, symbol, data: candles.reverse() })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve chart analytics feed' })
    }
  })
}
