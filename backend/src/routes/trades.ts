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

export default async function tradeRoutes(fastify: FastifyInstance) {
  // 1. High-Speed POST Ingestion Route (The one that works!)
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

  // 2. NEW: GET Route to fetch historical tick streams
  fastify.get<{ Querystring: TradeQueryQuerystring }>('/api/v1/trades', async (request, reply) => {
    const { symbol, limit } = request.query
    
    // Parse our limits safely or default to the last 50 updates [ORM.ARGUMENT_INVALID]
    const parsedLimit = limit ? parseInt(limit, 10) : 50

    try {
      const trades = await fastify.db.trade.findMany({
        where: symbol ? { symbol } : undefined,
        orderBy: { timestamp: 'desc' }, // Get newest records first
        take: parsedLimit,
      })

      return reply.send({ success: true, count: trades.length, data: trades })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Failed to retrieve trade feed' })
    }
  })
}
