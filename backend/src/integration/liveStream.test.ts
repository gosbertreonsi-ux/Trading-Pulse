import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import websocketPlugin from '@fastify/websocket'
import prismaPlugin from '../plugins/db'
import redisPlugin from '../plugins/redis'
import securityPlugin from '../plugins/security'
import streamingRoutes from '../routes/streams'
import tradeRoutes from '../routes/trades'

test('tenant scoped persisted ticks stream immediately over authenticated WebSocket', {
  skip: process.env.RUN_TRADING_PULSE_INTEGRATION !== '1'
}, async () => {
  const database = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/invalid')
  if (!['127.0.0.1', 'localhost', '::1'].includes(database.hostname) ||
      database.pathname !== '/trading_pulse_test') {
    throw new Error('WebSocket test requires the disposable local trading_pulse_test database')
  }

  const fastify = Fastify({ logger: false })
  let target: WebSocket | undefined
  let unrelated: WebSocket | undefined
  try {
    await fastify.register(websocketPlugin)
    await fastify.register(prismaPlugin)
    await fastify.register(redisPlugin)
    await fastify.register(securityPlugin)
    await fastify.register(streamingRoutes)
    await fastify.register(tradeRoutes)
    const address = await fastify.listen({ host: '127.0.0.1', port: 0 })
    const wsUrl = address.replace(/^http/, 'ws') + '/api/v1/stream'
    const mainTenant = 'stream-test-primary'
    const otherTenant = 'stream-test-other'
    const viewer = fastify.jwt.sign({ client: mainTenant, role: 'viewer' }, { expiresIn: '1h' })
    const otherViewer = fastify.jwt.sign({ client: otherTenant, role: 'viewer' }, { expiresIn: '1h' })
    const worker = fastify.jwt.sign({
      client: mainTenant, role: 'high_frequency_ingestion_worker'
    }, { expiresIn: '1h' })

    target = new WebSocket(wsUrl, ['trading-pulse', 'jwt.' + viewer])
    unrelated = new WebSocket(wsUrl, ['trading-pulse', 'jwt.' + otherViewer])

    const opened = (socket: WebSocket) => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000)
      socket.addEventListener('open', () => { clearTimeout(timeout); resolve() }, { once: true })
      socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket rejected')) }, { once: true })
    })
    await Promise.all([opened(target), opened(unrelated)])

    let leaked = false
    unrelated.addEventListener('message', () => { leaked = true })
    const receiving = new Promise<{
      type: string; symbol: string; clientId: string;
      price: number; quantity: number; timestamp: string
    }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('No authenticated tick event')), 5000)
      target!.addEventListener('message', event => {
        try {
          const message = JSON.parse(String(event.data))
          if (message.type === 'TICK') {
            clearTimeout(timeout)
            resolve(message)
          }
        } catch {
          // Ignore non-JSON frame, timeout still applies.
        }
      })
    })

    const posted = await fastify.inject({
      method: 'POST', url: '/api/v1/trades',
      headers: { authorization: 'Bearer ' + worker },
      payload: { symbol: 'BTCUSDT', price: 12345.67, quantity: 0.5, side: 'BUY' }
    })
    assert.equal(posted.statusCode, 202, posted.body)
    const tick = await receiving
    assert.equal(tick.type, 'TICK')
    assert.equal(tick.symbol, 'BTCUSDT')
    assert.equal(tick.clientId, mainTenant)
    assert.equal(tick.price, 12345.67)
    assert.equal(tick.quantity, 0.5)
    assert.ok(Date.parse(tick.timestamp) > 0)
    await new Promise(resolve => setTimeout(resolve, 80))
    assert.equal(leaked, false, 'An unrelated tenant must never receive this tick')
  } finally {
    target?.close()
    unrelated?.close()
    await fastify.close()
  }
})
