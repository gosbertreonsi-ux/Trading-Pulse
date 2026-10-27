import { randomUUID } from 'node:crypto'

/**
 * Development-only IN-MEMORY paper matching engine.
 * Its orders/fills are not real exchange orders or Postgres Trade rows.
 * Strict synchronous price/time matching, limited tenant and order counts.
 * State disappears on backend process restart.
 */
export type PaperSide = 'BUY' | 'SELL'
export type PaperStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED'
export type PaperOrder = {
  id: string; symbol: string; side: PaperSide; price: number;
  quantity: number; remainingQuantity: number; status: PaperStatus;
  createdAt: string
}
export type PaperFill = {
  id: string; symbol: string; buyOrderId: string; sellOrderId: string;
  price: number; quantity: number; executedAt: string
}
type InternalOrder = Omit<PaperOrder, 'price' | 'quantity' | 'remainingQuantity'> & {
  priceUnits: number; quantityUnits: number; remainingUnits: number; sequence: number
}
type TenantBook = { orders: InternalOrder[]; fills: PaperFill[] }

const SCALE = 10_000
const TICKS: Record<string, number> = { BTCUSDT: 1, ETHUSDT: 0.1, SOLUSDT: 0.01 }
const MAX_TENANTS = 100
const MAX_OPEN = 50
const MAX_ARCHIVE = 100
const MAX_FILLS = 100
function amount(units: number): number { return units / SCALE }
function safeUnits(value: number): number {
  const units = Math.round(value * SCALE)
  if (!Number.isSafeInteger(units) || Math.abs(units / SCALE - value) > 1e-8) {
    throw new Error('Value must have at most four decimal places')
  }
  return units
}
function external(order: InternalOrder): PaperOrder {
  return {
    id: order.id, symbol: order.symbol, side: order.side,
    price: amount(order.priceUnits),
    quantity: amount(order.quantityUnits),
    remainingQuantity: amount(order.remainingUnits),
    status: order.status, createdAt: order.createdAt
  }
}
export class PaperMatchingEngine {
  private tenants = new Map<string, TenantBook>()
  private nextSequence = 1

  private forTenant(tenant: string): TenantBook {
    if (!tenant.trim()) throw new Error('Tenant required')
    const existing = this.tenants.get(tenant)
    if (existing) return existing
    if (this.tenants.size >= MAX_TENANTS) throw new Error('Paper trading tenant capacity reached')
    const created: TenantBook = { orders: [], fills: [] }
    this.tenants.set(tenant, created)
    return created
  }

  place(tenant: string, symbol: string, side: PaperSide,
    price: number, quantity: number): { order: PaperOrder; fills: PaperFill[] } {
    const tick = TICKS[symbol]
    if (!tick || !['BUY', 'SELL'].includes(side)) throw new Error('Unsupported paper order')
    if (!Number.isFinite(price) || !Number.isFinite(quantity) ||
      price <= 0 || price > 1_000_000_000 ||
      quantity < 0.0001 || quantity > 1_000_000) {
      throw new Error('Invalid paper order price or quantity')
    }
    const priceUnits = safeUnits(price)
    const quantityUnits = safeUnits(quantity)
    if (priceUnits % safeUnits(tick) !== 0 || quantityUnits <= 0) {
      throw new Error('Order must respect price tick and positive size')
    }
    const book = this.forTenant(tenant)
    const active = book.orders.filter(order => order.remainingUnits > 0 &&
      order.status !== 'CANCELLED').length
    if (active >= MAX_OPEN) throw new Error('Maximum open paper orders reached')

    const order: InternalOrder = {
      id: randomUUID(), symbol, side, priceUnits, quantityUnits,
      remainingUnits: quantityUnits, status: 'OPEN',
      createdAt: new Date().toISOString(), sequence: this.nextSequence++
    }
    // Match best opposite price first, then earliest arrival. Maker price is
    // the execution price. No funds, portfolio or real market connections.
    const opposite = book.orders.filter(resting => resting.symbol === symbol &&
      resting.side !== side && resting.remainingUnits > 0 &&
      resting.status !== 'CANCELLED' &&
      (side === 'BUY' ? resting.priceUnits <= priceUnits : resting.priceUnits >= priceUnits))
      .sort((a, b) => side === 'BUY'
        ? a.priceUnits - b.priceUnits || a.sequence - b.sequence
        : b.priceUnits - a.priceUnits || a.sequence - b.sequence)

    const fills: PaperFill[] = []
    for (const maker of opposite) {
      if (order.remainingUnits === 0) break
      const fillUnits = Math.min(order.remainingUnits, maker.remainingUnits)
      order.remainingUnits -= fillUnits
      maker.remainingUnits -= fillUnits
      maker.status = maker.remainingUnits === 0 ? 'FILLED' : 'PARTIALLY_FILLED'
      const fill: PaperFill = {
        id: randomUUID(), symbol,
        buyOrderId: side === 'BUY' ? order.id : maker.id,
        sellOrderId: side === 'SELL' ? order.id : maker.id,
        price: amount(maker.priceUnits),
        quantity: amount(fillUnits), executedAt: new Date().toISOString()
      }
      fills.push(fill)
      book.fills.unshift(fill)
    }
    order.status = order.remainingUnits === 0 ? 'FILLED'
      : order.remainingUnits < order.quantityUnits ? 'PARTIALLY_FILLED' : 'OPEN'
    book.orders.push(order)
    book.fills = book.fills.slice(0, MAX_FILLS)
    // Keep all resting orders plus a small bounded audit of terminal states.
    const activeOrders = book.orders.filter(row =>
      row.status === 'OPEN' || row.status === 'PARTIALLY_FILLED')
    const oldOrders = book.orders.filter(row =>
      row.status === 'FILLED' || row.status === 'CANCELLED')
      .slice(-MAX_ARCHIVE)
    book.orders = [...activeOrders, ...oldOrders]
    return { order: external(order), fills: fills.map(fill => ({ ...fill })) }
  }

  cancel(tenant: string, orderId: string): PaperOrder | null {
    const book = this.tenants.get(tenant)
    const order = book?.orders.find(item => item.id === orderId)
    if (!order || order.remainingUnits <= 0 || order.status === 'CANCELLED') return null
    order.status = 'CANCELLED'
    order.remainingUnits = 0
    return external(order)
  }

  snapshot(tenant: string, symbol: string) {
    if (!TICKS[symbol]) throw new Error('Unsupported paper symbol')
    const book = this.tenants.get(tenant)
    const orders = (book?.orders ?? []).filter(item => item.symbol === symbol)
    const active = orders.filter(item => item.remainingUnits > 0 &&
      item.status !== 'CANCELLED')
    const sortLevels = (side: PaperSide) => active.filter(item => item.side === side)
      .sort((a, b) => side === 'BUY'
        ? b.priceUnits - a.priceUnits || a.sequence - b.sequence
        : a.priceUnits - b.priceUnits || a.sequence - b.sequence)
      .map(external)
    return {
      mode: 'PAPER_IN_MEMORY' as const, persistent: false, symbol,
      bids: sortLevels('BUY'), asks: sortLevels('SELL'),
      recentOrders: orders.slice(-25).reverse().map(external),
      fills: (book?.fills ?? []).filter(fill => fill.symbol === symbol).slice(0, 25)
        .map(fill => ({ ...fill }))
    }
  }
}
