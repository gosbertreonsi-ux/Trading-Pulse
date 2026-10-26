import type { CandlestickData, SeriesMarker, Time } from "lightweight-charts";

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
