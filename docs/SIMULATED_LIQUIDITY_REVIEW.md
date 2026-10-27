# Milestone 19 — educational liquidity and modeled order depth

## Purpose
Trading Pulse ingests **simulated executed trades**, not real exchange limit orders. Executed trades cannot prove the quantity available at any bid/ask level. To teach order-book mechanics without pretending the data is real, this milestone separates:

1. **Observed simulator trade flow** — saved and tenant-scoped BUY/SELL executed quantities from up to the 48 latest PostgreSQL Trade records.
2. **EDUCATIONAL_SYNTHETIC_DEPTH** — deterministic, artificial price and quantity levels anchored at the latest saved simulated trade price.

No real exchange book, actual liquidity, quote, fill price, executable order, or slippage estimate is provided.

## Read model and API
- `GET /api/v1/liquidity/model?symbol=BTCUSDT` requires Fastify JWT. Supported symbols BTCUSDT, ETHUSDT, SOLUSDT.
- The query explicitly filters by `request.tenant.clientId`, sorts descending timestamp / ID, takes 48 records, then reverses for chronological calculation.
- Deterministic model: BTC 1.00, ETH 0.10, SOL 0.01 USDT tick steps. Ten ask and bid levels surround the last observed reference price; assumed spread is two ticks.
- Sizes depend on observed mean trade quantity, level number, and a deterministic FNV-inspired hash of symbol/price/side/level. Hash variation is **not** an inference about actual quote supply. Display labels state *modeled imbalance* instead of measured depth imbalance.
- A symbol with **zero trades** returns `observed.lastPrice=null`, `bestBid=null`, `bestAsk=null`, `spread=null`, `bids=[]`, `asks=[]`. No fabricated price anchor.
- Server-side `GET /api/liquidity` forwards the private viewer JWT. Browsers never receive or store JWTs.
- Browser loads REST on mount/market selection, polls every 10 seconds, and re-fetches on the already tenant-scoped local-development WebSocket→SSE tick stream. This is *not* a public authenticated streaming solution.

## Definitions
- **Observed BUY/SELL quantity**: sum of executed simulator base-asset quantities for the last at most 48 trades; never a measure of resting order interest.
- **Modeled cumulative depth**: sum of artificial level sizes from best price outward. **Modeled imbalance** = (sum artificial bids − sum artificial asks) / (sum both) × 100. It is neither predictive nor executable.
- **Modeled spread**: best artificial ask minus best artificial bid; exactly two configured ticks for the supported modeled markets.
- Last observed trade may differ from modeled bid/ask due to fixed price-grid rounding. Trade records are observations from a simulator; not a live exchange order book.

## Verification and review
- Pure service tests check empty market, determinism, 10 ordered levels, price ticks, positive quantities, cumulative depth, observed flow, invalid input and no price anchor.
- PostgreSQL/Redis integration checks JWT-required 401, invalid symbol 400, tenant boundary, persisted reference trade price and no fabricated depth for an empty tenant.
- Chrome desktop/mobile visual smoke tests check labeled synthetic provenance, depth levels, observed quantities, empty symbol, responsive layout and light/dark.
- No database schema/migration change required.
- On Windows, run Fastify on 3001, worker simulator with matching tenant worker JWT, Next on 3000 with viewer JWT and PostgreSQL + Redis; visit `http://localhost:3000/liquidity`. Switch BTC/ETH/SOL and check model refreshes after simulator accepts ticks with HTTP 202.

## Potential future true order book
A *real* exchange/order book would require authenticated source adapters (or a purpose-built matching engine with resting simulated orders), sequence numbers/snapshots, order lifecycle, crossed-book invariants, reconciliation, and separate labeling. Nothing in this release should be described as actual market liquidity.
