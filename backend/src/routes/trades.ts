import { FastifyInstance } from 'fastify'

interface TradeRequestBody {
  symbol: string
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
}

export default async function tradeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: TradeRequestBody }>('/api/v1/trades', async (request, reply) => {
    const { symbol, price, quantity, side } = request.body

    try {
      // Stream the tick directly into PostgreSQL using the global plugin decorator
      const newTrade = await fastify.db.trade.create({
        data: {
          symbol,
          price,
          quantity,
          side,
        },
      })

      return reply.code(201).send({ success: true, data: newTrade })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ success: false, error: 'Database ingestion failed' })
    }
  })
}
