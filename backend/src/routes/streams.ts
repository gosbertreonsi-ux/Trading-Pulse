import { FastifyInstance } from 'fastify'

// Keep track of all active browser/client WebSocket channels
export const activeSockets = new Set<any>()

/**
 * Broadcasts financial analytics metrics to all connected frontend interfaces instantly
 */
export function broadcastToCharts(type: 'ALERT' | 'CANDLE', payload: any) {
  const messageString = JSON.stringify({ type, ...payload })
  for (const socket of activeSockets) {
    try {
      socket.send(messageString)
    } catch {
      activeSockets.delete(socket) // Safely drop stale or closed tabs
    }
  }
}

export default async function streamingRoutes(fastify: FastifyInstance) {
  // Establish a persistent duplex WebSocket channel path
  fastify.get('/api/v1/stream', { websocket: true }, (connection, req) => {
    fastify.log.info('🔌 [WEBSOCKET] New frontend dashboard client linked to live stream')
    activeSockets.add(connection.socket)

    connection.socket.on('close', () => {
      fastify.log.info('🔌 [WEBSOCKET] Frontend dashboard client disconnected')
      activeSockets.delete(connection.socket)
    })
  })
}
