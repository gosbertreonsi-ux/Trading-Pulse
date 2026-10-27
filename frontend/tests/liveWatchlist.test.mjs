import test from "node:test";
import assert from "node:assert/strict";
import {
  applyWatchTick, reconcileSnapshot, fromMarketSnapshot,
} from "../src/lib/liveWatchlist.ts";

const incoming = (symbol, prices, time = "2026-10-27T12:30:05Z") => ({
  symbol, price: prices.at(-1) ?? null,
  changePercent: prices.length > 1 ? ((prices.at(-1) - prices[0]) / prices[0]) * 100 : null,
  spark: prices, lastUpdated: prices.length ? time : null,
});

test("empty tenant market has no price or percentage until real trades arrive", () => {
  assert.equal(fromMarketSnapshot(incoming("BTCUSDT", [])), null);
  const first = fromMarketSnapshot(incoming("BTCUSDT", [100]));
  assert.equal(first.price, 100);
  assert.equal(first.change, null);
  assert.deepEqual(first.spark, [100]);
});

test("snapshot validates saved prices and ignores forged symbols", () => {
  assert.equal(fromMarketSnapshot(incoming("FAKE", [100, 101])), null);
  assert.equal(fromMarketSnapshot({ ...incoming("BTCUSDT", [100, 101]), price: 900 }), null);
  assert.equal(fromMarketSnapshot(incoming("ETHUSDT", [-1, 100])), null);
  assert.equal(fromMarketSnapshot({
    ...incoming("BTCUSDT", [100]), lastUpdated: "bad-date",
  }), null);
});

test("stream updates each symbol independently, with green/red signed recent change", () => {
  const btc = applyWatchTick(undefined, {
    symbol: "BTCUSDT", price: 100, timestamp: "2026-10-27T12:30:00Z",
  });
  assert.equal(btc.change, null);
  const rising = applyWatchTick(btc, {
    symbol: "BTCUSDT", price: 106, timestamp: "2026-10-27T12:30:02Z",
  });
  const falling = applyWatchTick(rising, {
    symbol: "BTCUSDT", price: 95, timestamp: "2026-10-27T12:30:04Z",
  });
  assert.equal(rising.change, 6);
  assert.equal(falling.change, -5);
  assert.deepEqual(falling.spark, [100, 106, 95]);
  assert.equal(applyWatchTick(falling, {
    symbol: "SOLUSDT", price: 10, timestamp: "2026-10-27T12:30:06Z",
  }), falling);
});

test("24-tick rolling window does not invent a 24-hour change", () => {
  let quote;
  for (let n = 0; n < 30; n++) {
    quote = applyWatchTick(quote, {
      symbol: "BTCUSDT", price: 100 + n,
      timestamp: new Date(Date.parse("2026-10-27T12:30:00Z") + n * 2000).toISOString(),
    });
  }
  assert.equal(quote.spark.length, 24);
  assert.equal(quote.spark[0], 106);
  assert.equal(quote.price, 129);
  assert.ok(Math.abs(quote.change - ((129 - 106) / 106) * 100) < 1e-9);
});

test("late REST response cannot overwrite a newer WebSocket quote", () => {
  const streamed = applyWatchTick(undefined, {
    symbol: "BTCUSDT", price: 110, timestamp: "2026-10-27T12:31:02Z",
  });
  const result = reconcileSnapshot({ BTCUSDT: streamed }, [
    incoming("BTCUSDT", [100, 104], "2026-10-27T12:31:00Z"),
    incoming("ETHUSDT", [200, 198], "2026-10-27T12:31:00Z"),
    incoming("SOLUSDT", []),
  ]);
  assert.equal(result.BTCUSDT.price, 110);
  assert.equal(result.ETHUSDT.price, 198);
  assert.equal(result.ETHUSDT.change, -1);
  assert.equal(result.SOLUSDT, undefined);
});

test("invalid, duplicated, out-of-order tick frames cannot corrupt observed price", () => {
  const current = applyWatchTick(undefined, {
    symbol: "BTCUSDT", price: 100, timestamp: "2026-10-27T12:30:10Z",
  });
  for (const tick of [
    { symbol: "BTCUSDT", price: -100, timestamp: "2026-10-27T12:30:11Z" },
    { symbol: "BTCUSDT", price: 500, timestamp: "2026-10-27T12:30:09Z" },
    { symbol: "BTCUSDT", price: 500, timestamp: "2026-10-27T12:30:10Z" },
    { symbol: "BADCOIN", price: 500, timestamp: "2026-10-27T12:30:15Z" },
  ]) assert.equal(applyWatchTick(current, tick), current);
});
