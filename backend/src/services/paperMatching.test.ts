import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PaperMatchingEngine } from './paperMatching'

test('two opposite resting paper orders execute at maker price', () => {
  const engine = new PaperMatchingEngine()
  const buy = engine.place('tenantA', 'BTCUSDT', 'BUY', 100, 2)
  assert.equal(buy.order.status, 'OPEN')
  assert.equal(buy.fills.length, 0)
  const sell = engine.place('tenantA', 'BTCUSDT', 'SELL', 99, 2)
  assert.equal(sell.order.status, 'FILLED')
  assert.equal(sell.fills.length, 1)
  assert.equal(sell.fills[0].price, 100)
  assert.equal(sell.fills[0].quantity, 2)
  assert.equal(sell.fills[0].buyOrderId, buy.order.id)
  assert.equal(sell.fills[0].sellOrderId, sell.order.id)
  assert.equal(engine.snapshot('tenantA', 'BTCUSDT').bids.length, 0)
})

test('price priority beats arrival, time priority breaks ties', () => {
  const engine = new PaperMatchingEngine()
  const a = engine.place('a', 'BTCUSDT', 'SELL', 101, 1).order
  const b = engine.place('a', 'BTCUSDT', 'SELL', 100, 1).order
  const c = engine.place('a', 'BTCUSDT', 'SELL', 100, 1).order
  const taker = engine.place('a', 'BTCUSDT', 'BUY', 101, 2.5)
  assert.deepEqual(taker.fills.map(f => f.sellOrderId), [b.id, c.id, a.id])
  assert.deepEqual(taker.fills.map(f => f.price), [100, 100, 101])
  assert.deepEqual(taker.fills.map(f => f.quantity), [1, 1, .5])
  assert.equal(taker.order.status, 'FILLED')
  assert.equal(engine.snapshot('a', 'BTCUSDT').asks[0].remainingQuantity, .5)
})

test('partial fills remain resting, and cancel removes only unfilled amount', () => {
  const engine = new PaperMatchingEngine()
  const placed = engine.place('a', 'ETHUSDT', 'BUY', 2000.1, 1)
  const sold = engine.place('a', 'ETHUSDT', 'SELL', 2000.1, .3333)
  assert.equal(sold.fills[0].quantity, .3333)
  let state = engine.snapshot('a', 'ETHUSDT')
  assert.equal(state.bids.length, 1)
  assert.equal(state.bids[0].status, 'PARTIALLY_FILLED')
  assert.equal(state.bids[0].remainingQuantity, .6667)
  assert.equal(engine.cancel('a', placed.order.id)?.status, 'CANCELLED')
  assert.equal(engine.cancel('a', placed.order.id), null)
  state = engine.snapshot('a', 'ETHUSDT')
  assert.equal(state.bids.length, 0)
  assert.equal(state.fills.length, 1)
})

test('different tenants and instruments cannot match or cancel each other', () => {
  const engine = new PaperMatchingEngine()
  const order = engine.place('alpha', 'BTCUSDT', 'BUY', 100, 1).order
  assert.equal(engine.snapshot('beta', 'BTCUSDT').bids.length, 0)
  assert.equal(engine.cancel('beta', order.id), null)
  assert.equal(engine.place('alpha', 'SOLUSDT', 'SELL', 99.99, 1).fills.length, 0)
  assert.equal(engine.place('beta', 'BTCUSDT', 'SELL', 99, 1).fills.length, 0)
  assert.equal(engine.snapshot('alpha', 'BTCUSDT').bids.length, 1)
  assert.equal(engine.snapshot('alpha', 'SOLUSDT').asks.length, 1)
})

test('uncrossed orders remain resting and book respects price-time priority', () => {
  const engine = new PaperMatchingEngine()
  const first = engine.place('a', 'SOLUSDT', 'BUY', 100.02, 1).order
  const second = engine.place('a', 'SOLUSDT', 'BUY', 100.05, 1).order
  const third = engine.place('a', 'SOLUSDT', 'BUY', 100.05, 1).order
  const view = engine.snapshot('a', 'SOLUSDT')
  assert.deepEqual(view.bids.map(x => x.id), [second.id, third.id, first.id])
  assert.equal(view.fills.length, 0)
  assert.equal(view.persistent, false)
})

test('rejects tick violations, too many decimals and invalid quantities', () => {
  const e = new PaperMatchingEngine()
  assert.throws(() => e.place('x', 'BTCUSDT', 'BUY', 100.01, 1), /tick/)
  assert.throws(() => e.place('x', 'ETHUSDT', 'BUY', 101.01, 1), /tick/)
  assert.throws(() => e.place('x', 'BTCUSDT', 'BUY', 100, .12345), /four decimal/)
  assert.throws(() => e.place('x', 'BTCUSDT', 'BUY', -3, 1), /Invalid/)
  assert.throws(() => e.place('x', 'BTCUSDT', 'BUY', 3, Infinity), /Invalid/)
  assert.throws(() => e.place('x', 'SOLUSDT', 'BUY', 0.001, 1), /tick/)
  assert.throws(() => e.place('x', 'DOGEUSDT', 'BUY', 100, 1), /Unsupported/)
})
