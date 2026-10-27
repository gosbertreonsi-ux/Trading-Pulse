import type { FastifyInstance } from 'fastify'
import { broadcastToCharts } from '../routes/streams'

/**
 * Check one-shot price thresholds only after the simulator trade is stored.
 * The ACTIVE -> TRIGGERED transition is conditional, preventing duplicate
 * trigger broadcasts when two ticks arrive concurrently.
 */
export async function evaluatePriceAlerts(
  fastify: FastifyInstance,
  clientId: string,
  symbol: string,
  observedPrice: number
): Promise<number> {
  if (!Number.isFinite(observedPrice) || observedPrice <= 0) return 0

  const alerts = await fastify.db.priceAlert.findMany({
    where: {
      clientId,
      symbol,
      status: 'ACTIVE',
      OR: [
        { direction: 'ABOVE', targetPrice: { lte: observedPrice } },
        { direction: 'BELOW', targetPrice: { gte: observedPrice } }
      ]
    },
    orderBy: { createdAt: 'asc' },
    take: 100
  })

  let triggered = 0
  for (const alert of alerts) {
    const at = new Date()
    const result = await fastify.db.priceAlert.updateMany({
      where: { id: alert.id, clientId, status: 'ACTIVE' },
      data: { status: 'TRIGGERED', observedPrice, triggeredAt: at }
    })
    if (result.count !== 1) continue
    triggered++
    broadcastToCharts('ALERT', {
      clientId,
      alertId: alert.id,
      symbol,
      direction: alert.direction,
      targetPrice: alert.targetPrice.toString(),
      observedPrice,
      triggeredAt: at.toISOString(),
      kind: 'PRICE_THRESHOLD'
    })
  }
  return triggered
}
