import test from "node:test";
import assert from "node:assert/strict";
import { generateDemoCandles } from "../src/lib/demoCandles.ts";

const now = Date.parse("2026-10-27T13:45:38.000Z");

test("preview candles are deterministic and use only completed UTC minute buckets", () => {
  const rows = generateDemoCandles("BTCUSDT", now, 100);
  assert.equal(rows.length, 100);
  assert.deepEqual(rows, generateDemoCandles("BTCUSDT", now + 12_000, 100));
  assert.equal(rows.at(-1).timestamp, "2026-10-27T13:44:00.000Z");
  assert.equal(rows.at(0).timestamp, "2026-10-27T12:05:00.000Z");
  for (let i = 1; i < rows.length; i++) {
    assert.equal(Date.parse(rows[i].timestamp) - Date.parse(rows[i - 1].timestamp), 60_000);
    assert.ok(Math.abs(rows[i].open - rows[i - 1].close) < 0.00001);
  }
});

test("synthetic bars have valid OHLC values and positive volumes", () => {
  for (const symbol of ["BTCUSDT", "ETHUSDT", "SOLUSDT"]) {
    const rows = generateDemoCandles(symbol, now);
    assert.equal(rows.length, 360);
    for (const bar of rows) {
      assert.ok(bar.low > 0 && bar.volume > 0);
      assert.ok(bar.high >= Math.max(bar.open, bar.close));
      assert.ok(bar.low <= Math.min(bar.open, bar.close));
      assert.ok(Object.values(bar).every(value => typeof value === "string" || Number.isFinite(value)));
    }
  }
});

test("different symbols have different synthetic prices and invalid inputs are rejected", () => {
  assert.notEqual(generateDemoCandles("BTCUSDT", now, 1)[0].close, generateDemoCandles("ETHUSDT", now, 1)[0].close);
  assert.deepEqual(generateDemoCandles("FAKEPAIR", now), []);
  assert.deepEqual(generateDemoCandles("BTCUSDT", Number.NaN), []);
  assert.deepEqual(generateDemoCandles("BTCUSDT", now, 501), []);
  assert.deepEqual(generateDemoCandles("BTCUSDT", now, -1), []);
});
