
"use client";

import { useEffect, useRef, useState } from "react";
import type { CandlestickData, Time } from "lightweight-charts";

type MarketChartProps = {
  symbol: string;
  timeframe: string;
};

type ApiCandle = {
  timestamp: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume: string | number;
};

type ChartResponse = {
  success: boolean;
  data?: ApiCandle[];
  error?: string;
};

const intervalSeconds: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "1W": 604800,
  "1M": 2592000,
};

export default function MarketChart({
  symbol,
  timeframe,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading market data…");

  useEffect(() => {
    let cancelled = false;
    let chart:
      | ReturnType<
          typeof import("lightweight-charts")["createChart"]
        >
      | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;

    async function initializeChart() {
      const container = containerRef.current;
      if (!container) return;

      try {
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
            vertLines: {
              color: "rgba(151,169,196,0.07)",
            },
            horzLines: {
              color: "rgba(151,169,196,0.07)",
            },
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

        let hasLoadedData = false;
        let requestInProgress = false;

        async function loadCandles() {
          if (requestInProgress || cancelled) return;
          requestInProgress = true;

          try {
            const response = await fetch(
              `/api/charts?symbol=${encodeURIComponent(symbol)}&limit=500`,
              { cache: "no-store" }
            );

            const result = (await response.json()) as ChartResponse;

            if (!response.ok || !result.success) {
              throw new Error(result.error ?? "Unable to load candles");
            }

            const raw = result.data ?? [];

            const valid = raw
              .map((candle) => ({
                seconds: Math.floor(
                  new Date(candle.timestamp).getTime() / 1000
                ),
                open: Number(candle.open),
                high: Number(candle.high),
                low: Number(candle.low),
                close: Number(candle.close),
              }))
              .filter(
                (candle) =>
                  Number.isFinite(candle.seconds) &&
                  [candle.open, candle.high, candle.low, candle.close]
                    .every(Number.isFinite) &&
                  candle.open > 0 &&
                  candle.high > 0 &&
                  candle.low > 0 &&
                  candle.close > 0 &&
                  candle.high >= Math.max(candle.open, candle.close) &&
                  candle.low <= Math.min(candle.open, candle.close)
              )
              .sort((a, b) => a.seconds - b.seconds);

            const bucketSize = intervalSeconds[timeframe] ?? 60;
            const grouped = new Map<
              number,
              { time: number; open: number; high: number; low: number; close: number }
            >();

            for (const candle of valid) {
              const bucketTime =
                Math.floor(candle.seconds / bucketSize) * bucketSize;
              const existing = grouped.get(bucketTime);

              if (!existing) {
                grouped.set(bucketTime, {
                  time: bucketTime,
                  open: candle.open,
                  high: candle.high,
                  low: candle.low,
                  close: candle.close,
                });
              } else {
                existing.high = Math.max(existing.high, candle.high);
                existing.low = Math.min(existing.low, candle.low);
                existing.close = candle.close;
              }
            }

            const candles: CandlestickData<Time>[] = Array.from(
              grouped.values()
            ).map((candle) => ({
              time: candle.time as Time,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }));

            if (cancelled) return;

            if (candles.length > 0) {
              series.setData(candles);

              if (!hasLoadedData) {
                chart?.timeScale().fitContent();
                hasLoadedData = true;
              }

              setStatus(
                `${symbol} · ${timeframe} · ${candles.length} candles from backend`
              );
            } else {
              setStatus(
                `No stored candles for ${symbol} yet. Waiting for backend data…`
              );
            }
          } catch (error) {
            if (!cancelled) {
              console.error("[Trading Pulse] Candle request failed:", error);
              setStatus(
                error instanceof Error
                  ? error.message
                  : "Unable to load market data"
              );
            }
          } finally {
            requestInProgress = false;
          }
        }

        await loadCandles();

        if (cancelled) return;

        refreshTimer = setInterval(() => {
          void loadCandles();
        }, 10000);

        resizeObserver = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.applyOptions({
              width: containerRef.current.clientWidth,
            });
          }
        });

        resizeObserver.observe(container);
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Trading Pulse chart initialization failed:",
            error
          );
          setStatus("Chart initialization failed");
        }
      }
    }

    void initializeChart();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [symbol, timeframe]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        style={{ minHeight: 320 }}
        aria-label={`${symbol} interactive candlestick chart`}
      />
      <p
        className="mt-2 px-1 text-xs text-slate-400"
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
    </div>
  );
}
