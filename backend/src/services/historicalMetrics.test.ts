import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeHistory, type HistoryCandle } from './historicalMetrics'

const at = (minute: number, open: number, high: number, low: number,
  close: number, volume: number): HistoryCandle => ({
  timestamp: new Date(Date.UTC(2026, 9, 27, 12, minute)),
  open, high, low, close, volume
})

test('empty completed history must not fabricate any prices or statistics', () => {
  assert.deepEqual(summarizeHistory([]), {
    candleCount: 0, firstAt: null, lastAt: null,
    firstOpen: null, lastClose: null, rangeChangePercent: null,
    periodHigh: null, periodLow: null, totalVolume: null,
    averageVolume: null, bullishCount: 0, bearishCount: 0,
    unchangedCount: 0, maxCloseDrawdownPercent: null
  })
})

test('computes observed OHLCV range, volume, bullish and bearish counts', () => {
  const result = summarizeHistory([
    at(0, 100, 112, 99, 110, 2),
    at(1, 110, 111, 95, 100, 3),
    at(2, 100, 101, 98, 100, 5)
  ])
  assert.equal(result.candleCount, 3)
  assert.equal(result.firstOpen, 100)
  assert.equal(result.lastClose, 100)
  assert.equal(result.periodHigh, 112)
  assert.equal(result.periodLow, 95)
  assert.equal(result.totalVolume, 10)
  assert.equal(result.averageVolume, 10 / 3)
  assert.equal(result.rangeChangePercent, 0)
  assert.deepEqual([result.bullishCount, result.bearishCount, result.unchangedCount], [1, 1, 1])
  assert.ok(Math.abs(result.maxCloseDrawdownPercent! - 100 / 11) < 1e-10)
  assert.equal(result.firstAt, '2026-10-27T12:00:00.000Z')
  assert.equal(result.lastAt, '2026-10-27T12:02:00.000Z')
})

test('rise is measured from first open to last close and max drawdown on closes only', () => {
  const result = summarizeHistory([
    at(0, 90, 102, 88, 100, 1),
    at(1, 100, 112, 99, 110, 1),
    at(2, 110, 111, 97, 99, 1),
  ])
  assert.equal(result.rangeChangePercent, 10)
  assert.equal(result.maxCloseDrawdownPercent, 10)
})

test('rejects corrupt or out-of-order persisted OHLCV data', () => {
  assert.throws(() => summarizeHistory([at(0, 100, 95, 90, 99, 1)]), /Invalid stored/)
  assert.throws(() => summarizeHistory([at(0, 100, 101, 99, 100, -1)]), /Invalid stored/)
  assert.throws(() => summarizeHistory([at(1, 100, 101, 99, 100, 1), at(0, 100, 101, 99, 100, 1)]), /ascending/)
})
