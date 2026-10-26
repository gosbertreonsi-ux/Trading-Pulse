import test from "node:test";
import assert from "node:assert/strict";
import { movingAverageMarkers, movingAverageLine } from "../src/lib/chartSignals.ts";

function candles(prices) {
  return prices.map((close, index) => ({
    time: 1700000000 + 60 * index,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
  }));
}

test("an empty or short candle set does not create BUY/SELL labels", () => {
  assert.deepEqual(movingAverageMarkers([]), []);
  assert.deepEqual(movingAverageMarkers(candles(Array(12).fill(100))), []);
});

test("only observed close-price crossovers receive markers", () => {
  const input = candles([...Array(12).fill(100), 120, 80, 80, ...Array(4).fill(80)]);
  const markers = movingAverageMarkers(input);
  assert.deepEqual(markers.map((marker) => marker.text), ["BUY", "SELL"]);
  assert.equal(markers[0].time, input[12].time);
  assert.equal(markers[1].time, input[14].time);
  assert.equal(markers[0].position, "belowBar");
  assert.equal(markers[1].position, "aboveBar");
});

test("moving average points use only preceding closed candles", () => {
  const input = candles([10, 20, 30, 40, 50, 60]);
  assert.deepEqual(movingAverageLine(input, 3).map((row) => row.value), [20, 30, 40, 50]);
  assert.equal(movingAverageLine(input, 3)[0].time, input[2].time);
  assert.deepEqual(movingAverageLine(input, 10), []);
  assert.deepEqual(movingAverageLine(input, 0), []);
});
