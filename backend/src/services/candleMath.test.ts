import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addTickToCandle, minuteStart } from './candleMath'

test('groups UTC timestamps into exact minute boundaries', () => {
  assert.equal(minuteStart(new Date('2026-10-27T12:34:59.999Z')),
    Date.parse('2026-10-27T12:34:00.000Z'))
  assert.equal(minuteStart(new Date('2026-10-27T12:35:00.000Z')),
    Date.parse('2026-10-27T12:35:00.000Z'))
})

test('computes open, high, low, close and volume from ordered ticks', () => {
  const a = addTickToCandle(undefined, {
    timestamp: new Date('2026-10-27T12:34:01Z'), price: '100.25', quantity: '2.5'
  })
  const b = addTickToCandle(a, {
    timestamp: new Date('2026-10-27T12:34:03Z'), price: '103.00', quantity: '1.25'
  })
  const c = addTickToCandle(b, {
    timestamp: new Date('2026-10-27T12:34:59Z'), price: '99.75', quantity: '3'
  })
  assert.deepEqual(
    { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume },
    { open: 100.25, high: 103, low: 99.75, close: 99.75, volume: 6.75 }
  )
})

test('does not mix separate candle minutes', () => {
  const first = addTickToCandle(undefined, {
    timestamp: new Date('2026-10-27T12:34:59Z'), price: 1, quantity: 1
  })
  assert.throws(() => addTickToCandle(first, {
    timestamp: new Date('2026-10-27T12:35:00Z'), price: 2, quantity: 1
  }), /different minutes/)
})

test('rejects invalid prices, quantities and timestamps', () => {
  assert.throws(() => addTickToCandle(undefined, {
    timestamp: new Date('2026-10-27T12:34:00Z'), price: Infinity, quantity: 1
  }), /Invalid persisted/)
  assert.throws(() => addTickToCandle(undefined, {
    timestamp: new Date('2026-10-27T12:34:00Z'), price: 2, quantity: 0
  }), /Invalid persisted/)
  assert.throws(() => minuteStart(new Date('invalid')), /timestamp/)
})
