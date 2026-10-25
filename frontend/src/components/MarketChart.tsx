
"use client";

import { useEffect, useRef } from "react";
import type { CandlestickData, Time } from "lightweight-charts";

type MarketChartProps = {
  symbol: string;
  timeframe: string;
};

function createCandles(count: number, seed: number): CandlestickData<Time>[] {
  const candles: CandlestickData<Time>[] = [];
  let previousClose = seed;

  const now = Math.floor(Date.now() / 1000);
  const interval = 60;

  for (let i = count - 1; i >= 0; i--) {
    const time = (now - i * interval) as Time;
    const change = (Math.random() - 0.48) * seed * 0.003;
    const open = previousClose;
    const close = Math.max(0.01, open + change);
    const high = Math.max(open, close) + Math.random() * seed * 0.001;
    const low = Math.max(0.01, Math.min(open, close) - Math.random() * seed * 0.001);

    candles.push({ time, open, high, low, close });
    previousClose = close;
  }

  return candles;
}

export default function MarketChart({
  symbol,
  timeframe,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let chart: ReturnType<
      typeof import("lightweight-charts")["createChart"]
    > | undefined;
    let resizeObserver: ResizeObserver | undefined;

    async function initializeChart() {
      const container = containerRef.current;
      if (!container) return;

      const {
        createChart,
        CandlestickSeries,
        ColorType,
      } = await import("lightweight-charts");

      if (cancelled || !containerRef.current) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: 420,
        layout: {
          background: {
            type: ColorType.Solid,
            color: "#0d121c",
          },
          textColor: "#8793a7",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(151,169,196,0.07)" },
          horzLines: { color: "rgba(151,169,196,0.07)" },
        },
        rightPriceScale: {
          borderColor: "rgba(151,169,196,0.14)",
        },
        timeScale: {
          borderColor: "rgba(151,169,196,0.14)",
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: {
            color: "rgba(71,227,208,0.45)",
            labelBackgroundColor: "#168f85",
          },
          horzLine: {
            color: "rgba(71,227,208,0.45)",
            labelBackgroundColor: "#168f85",
          },
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#36d6a0",
        downColor: "#ff687d",
        borderVisible: false,
        wickUpColor: "#36d6a0",
        wickDownColor: "#ff687d",
      });

      const seeds: Record<string, number> = {
        BTCUSDT: 67420,
        ETHUSDT: 2510,
        SOLUSDT: 154,
      };

      const intervalSeconds: Record<string, number> = {
        "1m": 60,
        "5m": 300,
        "15m": 900,
        "1H": 3600,
        "4H": 14400,
        "1D": 86400,
      };

      const interval = intervalSeconds[timeframe] ?? 60;
      const candles: CandlestickData<Time>[] = [];
      let previousClose = seeds[symbol] ?? 100;

      for (let i = 99; i >= 0; i--) {
        const time = (Math.floor(Date.now() / interval) * interval -
          i * interval) as Time;
        const open = previousClose;
        const change = (Math.random() - 0.49) * previousClose * 0.004;
        const close = Math.max(0.01, open + change);
        const high = Math.max(open, close) + Math.random() * previousClose * 0.0015;
        const low = Math.max(
          0.01,
          Math.min(open, close) - Math.random() * previousClose * 0.0015
        );

        candles.push({ time, open, high, low, close });
        previousClose = close;
      }

      series.setData(candles);
      chart.timeScale().fitContent();

      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
          });
        }
      });

      resizeObserver.observe(container);
    }

    void initializeChart();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{ minHeight: 320 }}
      aria-label={`${symbol} interactive candlestick chart`}
    />
  );
}
