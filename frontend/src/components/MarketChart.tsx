
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";

type MarketChartProps = {
  symbol: string;
  timeframe: string;
};

type ApiCandle = {
  timestamp?: string | number;
  time?: string | number;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string;
};

type ChartResponse = {
  candles?: ApiCandle[];
  data?: ApiCandle[] | { candles?: ApiCandle[] };
};

type ValidCandle = {
  seconds: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "1W": 604800,
  "1M": 2592000,
};

function parseTimestamp(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;

  let milliseconds: number;

  if (typeof value === "number") {
    milliseconds = value < 1e12 ? value * 1000 : value;
  } else {
    const numeric = Number(value);

    if (value.trim() !== "" && Number.isFinite(numeric)) {
      milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    } else {
      milliseconds = Date.parse(value);
    }
  }

  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return null;
  }

  return Math.floor(milliseconds / 1000);
}

function toValidCandle(candle: ApiCandle): ValidCandle | null {
  const seconds = parseTimestamp(candle.timestamp ?? candle.time);
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);

  if (
    seconds === null ||
    ![open, high, low, close].every(Number.isFinite) ||
    Math.min(open, high, low, close) <= 0 ||
    high < Math.max(open, close, low) ||
    low > Math.min(open, close, high)
  ) {
    return null;
  }

  return { seconds, open, high, low, close };
}

function groupCandles(
  input: ApiCandle[],
  timeframe: string,
): CandlestickData<Time>[] {
  const interval = INTERVAL_SECONDS[timeframe] ?? 60;

  const valid = input
    .map(toValidCandle)
    .filter((candle): candle is ValidCandle => candle !== null)
    .sort((a, b) => a.seconds - b.seconds);

  const grouped = new Map<number, ValidCandle>();

  for (const candle of valid) {
    const bucket = Math.floor(candle.seconds / interval) * interval;
    const existing = grouped.get(bucket);

    if (!existing) {
      grouped.set(bucket, { ...candle, seconds: bucket });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    }
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([seconds, candle]) => ({
      time: seconds as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
}

export default function MarketChart({
  symbol,
  timeframe,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let hasLoadedData = false;
    let resizeObserver: ResizeObserver | undefined;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 600,
      layout: {
        background: { color: "#0d121c" },
        textColor: "#9aaac0",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(151,169,196,0.07)" },
        horzLines: { color: "rgba(151,169,196,0.09)" },
      },
      rightPriceScale: {
        borderColor: "rgba(151,169,196,0.14)",
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
      timeScale: {
        borderColor: "rgba(151,169,196,0.14)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 5,
        minBarSpacing: 2,
      },
      crosshair: {
        vertLine: {
          color: "rgba(151,169,196,0.45)",
          labelBackgroundColor: "#27364b",
        },
        horzLine: {
          color: "rgba(151,169,196,0.45)",
          labelBackgroundColor: "#27364b",
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#36d6a0",
      downColor: "#ff687d",
      borderVisible: false,
      wickUpColor: "#36d6a0",
      wickDownColor: "#ff687d",
      wickVisible: true,
      priceLineVisible: true,
    });

    const loadCandles = async () => {
      try {
        const previousRange = hasLoadedData
          ? chart.timeScale().getVisibleLogicalRange()
          : null;

        const wasFollowingLatest =
          previousRange !== null &&
          previousRange !== undefined &&
          chart.timeScale().getVisibleLogicalRange() !== null;

        const response = await fetch(
          `/api/charts?symbol=${encodeURIComponent(symbol)}&limit=500`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Chart request failed: ${response.status}`);
        }

        const payload = (await response.json()) as ChartResponse;

        if (cancelled) return;

        const rawCandles = Array.isArray(payload.candles)
          ? payload.candles
          : Array.isArray(payload.data)
            ? payload.data
            : Array.isArray(payload.data?.candles)
              ? payload.data.candles
              : [];

        const candles = groupCandles(rawCandles, timeframe);

        if (candles.length === 0) return;

        series.setData(candles);

        if (!hasLoadedData) {
          chart.timeScale().fitContent();
          hasLoadedData = true;
        } else if (
          previousRange &&
          !wasFollowingLatest
        ) {
          chart.timeScale().setVisibleLogicalRange(previousRange);
        }
      } catch (error) {
        console.error("Unable to load market candles:", error);
      }
    };

    resizeObserver = new ResizeObserver(() => {
      if (!cancelled && container.clientWidth > 0) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 600,
        });
      }
    });

    resizeObserver.observe(container);

    void loadCandles();
    timer = setInterval(() => {
      void loadCandles();
    }, 10000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, timeframe]);

  return (
    <div
      ref={containerRef}
      className="market-chart"
      aria-label={`${symbol} ${timeframe} candlestick chart`}
    />
  );
}
