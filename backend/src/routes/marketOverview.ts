import type { FastifyInstance } from 'fastify'

// The simulator currently ingests only these three supported symbols.
// A fixed, bounded watchlist prevents arbitrary tenant-wide database scans.
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const
const WINDOW_SIZE = 24

export default async function marketOverviewRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/markets/overview', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const clientId = request.tenant.clientId
    try {
      const quotes = await Promise.all(SYMBOLS.map(async symbol => {
        const rows = await fastify.db.trade.findMany({
          where: { clientId, symbol },
          orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
          take: WINDOW_SIZE,
          select: { price: true, timestamp: true }
        })
        const samples = rows.reverse()
        const spark = samples.map(row => Number(row.price))
        const first = spark[0]
        const last = spark[spark.length - 1]
        const lastUpdated = samples.length
          ? samples[samples.length - 1].timestamp.toISOString() : null

        return {
          symbol,
          price: last ?? null,
          // This is the relative change over the most recent 24 trades,
          // NOT a 24-hour market change. Keep null until two ticks exist.
          changePercent: spark.length >= 2 && first > 0
            ? ((last - first) / first) * 100 : null,
          spark,
          lastUpdated,
          sampleCount: spark.length
        }
      }))

      return reply.header('Cache-Control', 'no-store').send({
        success: true,
        window: 'last-24-ticks',
        quotes
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Could not read tenant-scoped market overview')
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve simulated market overview'
      })
    }
  })
}
