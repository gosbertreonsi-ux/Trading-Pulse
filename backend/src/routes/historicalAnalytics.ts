import type { FastifyInstance } from 'fastify'
import { summarizeHistory, type HistoryCandle } from '../services/historicalMetrics'

const SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
const WINDOWS = new Set([60, 120, 240])

export default async function historicalAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/analytics/history', {
    preValidation: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object', additionalProperties: false, required: ['symbol'],
        properties: {
          symbol: { type: 'string', enum: [...SYMBOLS] },
          limit: { type: 'integer', enum: [...WINDOWS] }
        }
      }
    }
  }, async (request, reply) => {
    const { symbol, limit = 120 } = request.query as {
      symbol: string; limit?: number
    }
    if (!SYMBOLS.has(symbol) || !WINDOWS.has(limit)) {
      return reply.code(400).send({ success: false, error: 'Invalid symbol or history window' })
    }
    try {
      const rows = await fastify.db.oHLCV.findMany({
        where: { clientId: request.tenant.clientId, symbol },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          timestamp: true, open: true, high: true, low: true,
          close: true, volume: true
        }
      })

      const candles: HistoryCandle[] = rows.reverse().map(row => ({
        timestamp: row.timestamp,
        open: Number(row.open), high: Number(row.high),
        low: Number(row.low), close: Number(row.close),
        volume: Number(row.volume)
      }))
      return reply.header('Cache-Control', 'no-store').send({
        success: true, symbol, granularity: 'completed-1m',
        requestedBars: limit,
        // These numbers reflect the returned bars, not a promise about
        // continuous wall-clock minutes, which may contain no simulated trades.
        summary: summarizeHistory(candles),
        candles: candles.map(({ timestamp, ...bar }) => ({
          timestamp: timestamp.toISOString(), ...bar
        }))
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Historical market analytics unavailable')
      return reply.code(500).send({
        success: false, error: 'Historical analytics could not be loaded'
      })
    }
  })
}
