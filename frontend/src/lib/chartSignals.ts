import type { CandlestickData, LineData, SeriesMarker, Time } from "lightweight-charts";

/**
 * Educational-only 5/12 close-price SMA crossovers.
 *
 * Read only completed historical candles. An event is added at the
 * close of the crossover candle; nothing predicts future prices or
 * initiates a real trade. Empty/short histories produce no markers.
 */
export function movingAverageMarkers(
  candles: readonly CandlestickData<Time>[],
): SeriesMarker<Time>[] {
  const FAST = 5;
  const SLOW = 12;
  const markers: SeriesMarker<Time>[] = [];

  function average(end: number, length: number): number {
    let total = 0;
    for (let i = end - length + 1; i <= end; i++) {
      total += candles[i].close;
    }
    return total / length;
  }

  for (let i = SLOW; i < candles.length; i++) {
    const previous = average(i - 1, FAST) - average(i - 1, SLOW);
    const current = average(i, FAST) - average(i, SLOW);

    if (previous <= 0 && current > 0) {
      markers.push({
        time: candles[i].time,
        position: "belowBar",
        color: "#14efad",
        shape: "arrowUp",
        text: "BUY",
        size: 1.4,
      });
    } else if (previous >= 0 && current < 0) {
      markers.push({
        time: candles[i].time,
        position: "aboveBar",
        color: "#ff5771",
        shape: "arrowDown",
        text: "SELL",
        size: 1.4,
      });
    }
  }

  return markers;
}

/** SMA line from observed candle closes. No extrapolated points are drawn. */
export function movingAverageLine(
  candles: readonly CandlestickData<Time>[],
  period: number,
): LineData<Time>[] {
  if (!Number.isInteger(period) || period < 1) return [];
  const result: LineData<Time>[] = [];
  let sum = 0;
  for (let index = 0; index < candles.length; index++) {
    sum += candles[index].close;
    if (index >= period) sum -= candles[index - period].close;
    if (index >= period - 1) {
      result.push({ time: candles[index].time, value: sum / period });
    }
  }
  return result;
}
