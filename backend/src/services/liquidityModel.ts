/**
 * Deterministic EDUCATIONAL depth model built from observed simulator trades.
 * Trade records do NOT contain resting bid/ask orders. These levels are never
 * exchange order-book data and cannot be used as executable liquidity.
 */
export type ObservedTrade = {
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: Date
}
export type ModelLevel = {
  price: number
  quantity: number
  cumulativeQuantity: number
}
export type LiquidityModel = {
  modelType: 'EDUCATIONAL_SYNTHETIC_DEPTH'
  basedOn: 'LAST_PERSISTED_SIMULATOR_TRADES'
  symbol: string
  observed: {
    sampleCount: number
    lastPrice: number | null
    lastTradeAt: string | null
    buyQuantity: number
    sellQuantity: number
  }
  assumptions: {
    tickSize: number
    depthLevels: number
    quantityModel: string
    limitations: string
  }
  bids: ModelLevel[]
  asks: ModelLevel[]
  bestBid: number | null
  bestAsk: number | null
  spread: number | null
  modeledBidQuantity: number | null
  modeledAskQuantity: number | null
  modeledImbalancePercent: number | null
}
const TICKS: Record<string, number> = {
  BTCUSDT: 1, ETHUSDT: 0.1, SOLUSDT: 0.01
}
const LEVELS = 10
const QUANTITY_DESCRIPTION = 'Deterministic illustrative sizes scaled from recent trade quantities, not actual resting orders.'
const LIMITATIONS = 'No exchange order book, executable bids/asks, slippage estimates, or real liquidity is observed.'

function rounded(value: number, places: number): number {
  return Number(value.toFixed(places))
}
function hashNoise(symbol: string, ticks: number, level: number, side: string): number {
  // Price-conditioned deterministic variation. Never Math.random().
  let state = 2166136261
  const input = symbol + ':' + ticks + ':' + level + ':' + side
  for (let i = 0; i < input.length; i++) {
    state ^= input.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }
  return (state >>> 0) / 4294967295
}
export function modeledDepth(symbol: string, input: readonly ObservedTrade[]): LiquidityModel {
  const tickSize = TICKS[symbol]
  if (!tickSize) throw new Error('Unsupported market')
  const assumptions = {
    tickSize, depthLevels: LEVELS,
    quantityModel: QUANTITY_DESCRIPTION,
    limitations: LIMITATIONS
  }
  const empty = {
    modelType: 'EDUCATIONAL_SYNTHETIC_DEPTH' as const,
    basedOn: 'LAST_PERSISTED_SIMULATOR_TRADES' as const,
    symbol, assumptions,
    observed: {
      sampleCount: 0, lastPrice: null, lastTradeAt: null,
      buyQuantity: 0, sellQuantity: 0
    },
    bids: [] as ModelLevel[], asks: [] as ModelLevel[],
    bestBid: null as number | null, bestAsk: null as number | null,
    spread: null as number | null,
    modeledBidQuantity: null as number | null,
    modeledAskQuantity: null as number | null,
    modeledImbalancePercent: null as number | null
  }
  if (!input.length) return empty

  for (const trade of input) {
    if (!Number.isFinite(trade.price) || trade.price <= 0 ||
        !Number.isFinite(trade.quantity) || trade.quantity <= 0 ||
        !['BUY', 'SELL'].includes(trade.side) ||
        !Number.isFinite(trade.timestamp.getTime())) {
      throw new Error('Invalid persisted simulator trade')
    }
  }

  // Caller retrieves newest-first for a bounded DB scan; normalize here
  // to avoid assuming a JS runtime sort is stable for duplicate timestamps.
  const trades = [...input].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const newest = trades[trades.length - 1]
  const observedBuy = trades.filter(x => x.side === 'BUY').reduce((sum, x) => sum + x.quantity, 0)
  const observedSell = trades.filter(x => x.side === 'SELL').reduce((sum, x) => sum + x.quantity, 0)
  const meanQuantity = trades.reduce((sum, x) => sum + x.quantity, 0) / trades.length

  // Round observed mid to the nearest permitted price tick; the best
  // bid/ask are exactly one tick either side, so the modeled spread is 2 ticks.
  const tickPrecision = tickSize === 1 ? 0 : tickSize === 0.1 ? 1 : 2
  const midTicks = Math.max(2, Math.round(newest.price / tickSize))
  const bids: ModelLevel[] = []
  const asks: ModelLevel[] = []
  let bidSum = 0
  let askSum = 0
  for (let level = 1; level <= LEVELS; level++) {
    const bidTicks = midTicks - level
    const askTicks = midTicks + level
    const bidQuantity = rounded(Math.max(0.0001,
      meanQuantity * (0.65 + level * 0.085 + hashNoise(symbol, midTicks, level, 'B') * 0.5)), 4)
    const askQuantity = rounded(Math.max(0.0001,
      meanQuantity * (0.65 + level * 0.085 + hashNoise(symbol, midTicks, level, 'A') * 0.5)), 4)
    if (bidTicks > 0) {
      bidSum += bidQuantity
      bids.push({
        price: rounded(bidTicks * tickSize, tickPrecision),
        quantity: bidQuantity, cumulativeQuantity: rounded(bidSum, 4)
      })
    }
    askSum += askQuantity
    asks.push({
      price: rounded(askTicks * tickSize, tickPrecision),
      quantity: askQuantity, cumulativeQuantity: rounded(askSum, 4)
    })
  }
  const total = bidSum + askSum
  return {
    ...empty,
    observed: {
      sampleCount: trades.length,
      lastPrice: newest.price,
      lastTradeAt: newest.timestamp.toISOString(),
      buyQuantity: rounded(observedBuy, 4),
      sellQuantity: rounded(observedSell, 4)
    },
    bids, asks,
    bestBid: bids[0]?.price ?? null,
    bestAsk: asks[0]?.price ?? null,
    spread: bids.length && asks.length ? rounded(asks[0].price - bids[0].price, tickPrecision) : null,
    modeledBidQuantity: bids.length ? rounded(bidSum, 4) : null,
    modeledAskQuantity: asks.length ? rounded(askSum, 4) : null,
    modeledImbalancePercent: total > 0 ? rounded(((bidSum - askSum) / total) * 100, 2) : null
  }
}
