import type { FastifyInstance } from 'fastify'
import { modeledDepth, type ObservedTrade } from '../services/liquidityModel'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
const WINDOW = 48

/** Read-only educational depth. Trade records never represent resting orders. */
export default async function liquidityModelRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/liquidity/model', {
    preValidation: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        required: ['symbol'],
        properties: { symbol: { type: 'string', enum: SYMBOLS } }
      }
    }
  }, async (request, reply) => {
    const { symbol } = request.query as { symbol: string }
    try {
      const rows = await fastify.db.trade.findMany({
        where: { clientId: request.tenant.clientId, symbol },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: WINDOW,
        select: { price: true, quantity: true, side: true, timestamp: true }
      })
      const trades: ObservedTrade[] = rows.reverse().map(row => ({
        price: Number(row.price),
        quantity: Number(row.quantity),
        side: row.side as ObservedTrade['side'],
        timestamp: row.timestamp
      }))
      const model = modeledDepth(symbol, trades)
      return reply.header('Cache-Control', 'no-store').send({
        success: true, ...model,
        observedWindow: 'last-48-simulator-trades'
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Modeled liquidity unavailable')
      return reply.code(500).send({
        success: false, error: 'Modeled liquidity could not be calculated'
      })
    }
  })
}
