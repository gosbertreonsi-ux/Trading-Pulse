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

export default async function tradeRoutes(fastify: FastifyInstance) {
  // 1. UPDATED: High-Speed POST Ingestion Route utilizing Redis Caching Array
  fastify.post<{ Body: TradeRequestBody }>('/api/v1/trades', async (request, reply) => {
    const { symbol, price, quantity, side } = request.body

    try {
      const tickData = {
        symbol,
        price,
        quantity,
        side,
        timestamp: new Date().toISOString()
      }

      // Append the incoming tick into a high-speed Redis memory list key unique to its symbol
      // This absorbs high-frequency loads instantly without touching your persistent storage disk
      await fastify.redis.lPush(`ticks:${symbol}`, JSON.stringify(tickData))

      return reply.code(201).send({ success: true, message: 'Tick cached in Redis' })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'In-memory caching failed' })
    }
  })

  // 2. GET Route to fetch historical tick streams (Kept for testing compatibility)
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

  // 3. GET Route to fetch compiled OHLCV Candlestick Bars
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
