import type { FastifyInstance } from 'fastify'

type StreamEvent = 'ALERT' | 'CANDLE' | 'TICK'
type ClientSocket = {
  socket: { readyState: number; send(message: string): void }
  clientId: string
}

const activeSockets = new Set<ClientSocket>()

export function broadcastToCharts(
  type: StreamEvent,
  payload: Record<string, unknown> & { clientId: string }
): void {
  const messageString = JSON.stringify({ type, ...payload })

  for (const client of activeSockets) {
    if (client.clientId !== payload.clientId) continue
    if (client.socket.readyState !== 1) {
      activeSockets.delete(client)
      continue
    }

    try {
      client.socket.send(messageString)
    } catch {
      activeSockets.delete(client)
    }
  }
}

export default async function streamingRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/stream', { websocket: true }, (socket, request) => {
    // Browser WebSocket clients cannot attach arbitrary Authorization headers.
    // For now require a JWT through Sec-WebSocket-Protocol instead of URL parameters.
    const protocol = request.headers['sec-websocket-protocol']
    const offered = typeof protocol === 'string' ? protocol.split(',').map(p => p.trim()) : []
    const token = offered.find(p => p.startsWith('jwt.'))?.slice(4)

    if (!token) {
      socket.close(1008, 'Authentication required')
      return
    }

    let clientId: string
    try {
      const claims = fastify.jwt.verify<{ client: string }>(token)
      if (typeof claims.client !== 'string' || !claims.client.trim()) throw new Error('Invalid tenant')
      clientId = claims.client
    } catch {
      socket.close(1008, 'Invalid authentication')
      return
    }

    const client: ClientSocket = { socket, clientId }
    activeSockets.add(client)
    socket.on('close', () => activeSockets.delete(client))
    socket.on('error', () => activeSockets.delete(client))
  })
}
