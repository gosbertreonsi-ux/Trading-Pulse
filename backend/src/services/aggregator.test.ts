import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { aggregateCandlestick } from './aggregator'

const base = Math.floor((Date.now() - 180_000) / 60_000) * 60_000
const timestamp = new Date(base)
const sampleTrades = [
  { id: '01', timestamp: new Date(base + 1_000), price: '100.00', quantity: '1.00' },
  { id: '02', timestamp: new Date(base + 12_000), price: '105.00', quantity: '2.00' },
  { id: '03', timestamp: new Date(base + 55_000), price: '99.00', quantity: '3.00' }
]

// A small in-memory DB fake tests the real aggregator's persistence path
// without requiring local PostgreSQL/Redis in CI.
function fakeBackend(existing: boolean) {
  const written: Array<Record<string, unknown>> = []
  const db = {
    oHLCV: {
      findFirst: async () => existing ? { timestamp } : null,
      findUnique: async () => existing
        ? { timestamp, open: 100, high: 105, low: 99, close: 99, volume: 6 }
        : null,
      upsert: async (input: { create: Record<string, unknown> }) => {
        written.push(input.create)
        return input.create
      }
    },
    trade: {
      findMany: async () => sampleTrades
    }
  }

  return { server: { db } as unknown as FastifyInstance, written }
}

test('persisted trades produce a completed OHLCV candle', async () => {
  const { server, written } = fakeBackend(false)
  const changes = await aggregateCandlestick(server, 'BTCUSDT', 'test-tenant')
  assert.equal(changes, 1)
  assert.equal(written.length, 1)
  assert.deepEqual(
    { open: written[0].open, high: written[0].high, low: written[0].low,
      close: written[0].close, volume: written[0].volume },
    { open: 100, high: 105, low: 99, close: 99, volume: 6 }
  )
  assert.equal((written[0].timestamp as Date).toISOString(), timestamp.toISOString())
  assert.equal(written[0].clientId, 'test-tenant')
})

test('unchanged candles are not written or rebroadcast', async () => {
  const { server, written } = fakeBackend(true)
  const changes = await aggregateCandlestick(server, 'BTCUSDT', 'test-tenant')
  assert.equal(changes, 0)
  assert.equal(written.length, 0)
})
