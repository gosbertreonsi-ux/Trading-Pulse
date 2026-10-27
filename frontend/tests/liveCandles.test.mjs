import test from "node:test";
import assert from "node:assert/strict";
import {
  foldTick, parseOpenMinute, candleBucket, overlayLiveMinutes,
} from "../src/lib/liveCandles.ts";

const time = (iso) => Math.floor(Date.parse(iso) / 1000);

test("forming one-minute candle changes close/high/low as valid ticks arrive", () => {
  const first = foldTick(null, { timestamp: "2026-10-27T12:34:05Z", price: 100, quantity: 2 });
  const second = foldTick(first, { timestamp: "2026-10-27T12:34:12Z", price: 105, quantity: 1 });
  const third = foldTick(second, { timestamp: "2026-10-27T12:34:40Z", price: 98, quantity: 3 });
  assert.deepEqual(
    [third.time, third.open, third.high, third.low, third.close, third.volume],
    [time("2026-10-27T12:34:00Z"), 100, 105, 98, 98, 6],
  );
});

test("invalid and stale/out-of-order prices cannot corrupt a forming candle", () => {
  const first = foldTick(null, { timestamp: "2026-10-27T12:34:12Z", price: 100, quantity: 1 });
  assert.deepEqual(foldTick(first, { timestamp: "bad", price: 120, quantity: 1 }), first);
  assert.deepEqual(foldTick(first, { timestamp: "2026-10-27T12:34:20Z", price: -1, quantity: 1 }), first);
  assert.deepEqual(foldTick(first, { timestamp: "2026-10-27T12:34:01Z", price: 200, quantity: 1 }), first);
  assert.deepEqual(foldTick(first, { timestamp: "2026-10-27T12:33:59Z", price: 200, quantity: 1 }), first);
});

test("new minute starts a fresh open/high/low/close instead of rewriting earlier minute", () => {
  const first = foldTick(null, { timestamp: "2026-10-27T12:34:59.500Z", price: 100, quantity: 2 });
  const next = foldTick(first, { timestamp: "2026-10-27T12:35:00Z", price: 108, quantity: 1 });
  assert.deepEqual(
    [next.time, next.open, next.high, next.low, next.close, next.volume],
    [time("2026-10-27T12:35:00Z"), 108, 108, 108, 108, 1],
  );
});

test("an unfinished minute is recovered from authenticated REST payloads", () => {
  const minute = parseOpenMinute({
    timestamp: "2026-10-27T12:34:00.000Z",
    open: "100", high: "111", low: "99", close: "110",
    volume: "3.5", lastTickAt: "2026-10-27T12:34:42.123Z",
  });
  assert.deepEqual(
    [minute.time, minute.open, minute.high, minute.low, minute.close, minute.volume],
    [time("2026-10-27T12:34:00Z"), 100, 111, 99, 110, 3.5],
  );
  assert.equal(parseOpenMinute(null), null);
  assert.equal(parseOpenMinute({
    timestamp: "2026-10-27T12:34:00Z", lastTickAt: "2026-10-27T12:35:00Z",
    open: 100, high: 110, low: 90, close: 100, volume: 1,
  }), null);
});

test("1m overlay appends current candle but keeps completed source bars authoritative", () => {
  const completed = [{ time: time("2026-10-27T12:33:00Z"), open: 95, high: 100, low: 94, close: 99 }];
  const forming = foldTick(null, { timestamp: "2026-10-27T12:34:15Z", price: 101, quantity: 2 });
  const shown = overlayLiveMinutes(completed, [forming], "1m", Number(completed[0].time));
  assert.equal(shown.length, 2);
  assert.equal(shown[1].close, 101);
  assert.equal(completed.length, 1, "Historical array was not mutated");
  assert.deepEqual(overlayLiveMinutes(completed, [forming], "1m", forming.time), completed,
    "Completed stored bar takes priority once persisted");
});

test("5m overlay updates the latest grouped bar, including wicks", () => {
  const start = time("2026-10-27T12:30:00Z");
  const completed = [{ time: start, open: 90, high: 104, low: 87, close: 100 }];
  const forming = foldTick(null, { timestamp: "2026-10-27T12:34:35Z", price: 108, quantity: 2 });
  const shown = overlayLiveMinutes(completed, [forming], "5m", time("2026-10-27T12:33:00Z"));
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0], { time: start, open: 90, high: 108, low: 87, close: 108 });
});

test("UTC week/month timeframe buckets match historic aggregation", () => {
  assert.equal(candleBucket(time("2026-10-27T12:34:00Z"), "1W"), time("2026-10-26T00:00:00Z"));
  assert.equal(candleBucket(time("2026-10-27T12:34:00Z"), "1M"), time("2026-10-01T00:00:00Z"));
  assert.equal(candleBucket(time("2026-10-27T12:34:00Z"), "15m"), time("2026-10-27T12:30:00Z"));
});

test("temporary unfinalized prior minute remains visible across minute rollover", () => {
  const first = foldTick(null, { timestamp: "2026-10-27T12:34:45Z", price: 105, quantity: 1 });
  const second = foldTick(null, { timestamp: "2026-10-27T12:35:01Z", price: 107, quantity: 1 });
  const bars = overlayLiveMinutes([], [second, first], "1m", -Infinity);
  assert.deepEqual(bars.map(bar => bar.close), [105, 107]);
});
