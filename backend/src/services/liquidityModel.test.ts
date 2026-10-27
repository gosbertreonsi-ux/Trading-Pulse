import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modeledDepth, type ObservedTrade } from './liquidityModel'

const record = (price: number, quantity: number, side: 'BUY' | 'SELL', second: number): ObservedTrade => ({
  price, quantity, side, timestamp: new Date(Date.UTC(2026, 9, 27, 12, 30, second))
})

test('empty observed trades never produce modeled liquidity or a phantom midprice', () => {
  const model = modeledDepth('BTCUSDT', [])
  assert.equal(model.modelType, 'EDUCATIONAL_SYNTHETIC_DEPTH')
  assert.equal(model.observed.sampleCount, 0)
  assert.equal(model.observed.lastPrice, null)
  assert.deepEqual(model.bids, [])
  assert.deepEqual(model.asks, [])
  assert.equal(model.spread, null)
  assert.equal(model.modeledImbalancePercent, null)
})

test('modeled depth is deterministic, sorted, and clearly not executable liquidity', () => {
  const inputs = [record(100, 1, 'BUY', 0), record(101, 2, 'SELL', 1), record(102, 3, 'BUY', 2)]
  const a = modeledDepth('BTCUSDT', inputs)
  const b = modeledDepth('BTCUSDT', inputs)
  assert.deepEqual(a, b)
  assert.equal(a.basedOn, 'LAST_PERSISTED_SIMULATOR_TRADES')
  assert.match(a.assumptions.limitations, /No exchange order book/)
  assert.equal(a.observed.lastPrice, 102)
  assert.equal(a.observed.buyQuantity, 4)
  assert.equal(a.observed.sellQuantity, 2)
  assert.equal(a.bids.length, 10)
  assert.equal(a.asks.length, 10)
  assert.equal(a.bestBid, 101)
  assert.equal(a.bestAsk, 103)
  assert.equal(a.spread, 2)
  for (let i = 1; i < 10; i++) {
    assert.ok(a.bids[i].price < a.bids[i - 1].price)
    assert.ok(a.asks[i].price > a.asks[i - 1].price)
    assert.ok(a.bids[i].cumulativeQuantity > a.bids[i - 1].cumulativeQuantity)
    assert.ok(a.asks[i].cumulativeQuantity > a.asks[i - 1].cumulativeQuantity)
  }
  assert.ok(a.bids.every(x => x.quantity > 0))
  assert.ok(a.asks.every(x => x.quantity > 0))
  assert.ok(Math.abs(a.modeledImbalancePercent!) <= 100)
})

test('tick size and price granularity are fixed per supported symbol', () => {
  const eth = modeledDepth('ETHUSDT', [record(2600.24, .3, 'BUY', 0)])
  const sol = modeledDepth('SOLUSDT', [record(150.125, .3, 'BUY', 0)])
  assert.equal(eth.assumptions.tickSize, 0.1)
  assert.equal(eth.spread, 0.2)
  assert.equal(eth.bestBid, 2600.1)
  assert.equal(eth.bestAsk, 2600.3)
  assert.equal(sol.assumptions.tickSize, 0.01)
  assert.equal(sol.spread, 0.02)
  assert.equal(sol.bestBid, 150.12)
  assert.equal(sol.bestAsk, 150.14)
})

test('invalid symbol, prices, sizes or stored sides are rejected', () => {
  assert.throws(() => modeledDepth('FAKE', []), /Unsupported/)
  assert.throws(() => modeledDepth('BTCUSDT', [record(-1, 1, 'BUY', 0)]), /Invalid persisted/)
  assert.throws(() => modeledDepth('BTCUSDT', [record(10, 0, 'SELL', 0)]), /Invalid persisted/)
  assert.throws(() => modeledDepth('BTCUSDT', [record(10, Infinity, 'SELL', 0)]), /Invalid persisted/)
})

test('modeled depth uses newest observed price even if trade array arrives unordered', () => {
  const result = modeledDepth('BTCUSDT', [
    record(201, 1, 'BUY', 3), record(199, 1, 'SELL', 1), record(200, 1, 'BUY', 2),
  ])
  assert.equal(result.observed.lastPrice, 201)
  assert.equal(result.bestBid, 200)
})
