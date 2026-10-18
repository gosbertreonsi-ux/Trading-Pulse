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
  // 1. High-Speed POST Ingestion Route
  fastify.post<{ Body: TradeRequestBody }>('/api/v1/trades', async (request, reply) => {
    const { symbol, price, quantity, side } = request.body
    try {
      const newTrade = await fastify.db.trade.create({
        data: { symbol, price, quantity, side },
      })
      return reply.code(201).send({ success: true, data: newTrade })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Database ingestion failed' })
    }
  })

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

  // 3. NEW: GET Route to fetch compiled OHLCV Candlestick Bars
  fastify.get<{ Querystring: CandlestickQueryQuerystring }>('/api/v1/charts', async (request, reply) => {
    const { symbol, limit } = request.query
    
    // Validate that the client provided a target ticker asset
    if (!symbol) {
      return reply.code(400).send({ success: false, error: 'Query parameter "symbol" is required' })
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 100

    try {
      const candles = await fastify.db.oHLCV.findMany({
        where: { symbol },
        orderBy: { timestamp: 'desc' }, // Get the newest candlesticks first
        take: parsedLimit,
      })

      // Reverse the array before sending it back so that the historical feed 
      // flows from oldest -> newest, which is the exact layout charting libraries require
      return reply.send({ success: true, symbol, data: candles.reverse() })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve chart analytics feed' })
    }
  })
}
