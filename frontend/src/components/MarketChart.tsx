
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { movingAverageLine, movingAverageMarkers } from "@/lib/chartSignals";
import { generateDemoCandles } from "@/lib/demoCandles";
import { marketColors } from "@/lib/marketColors";

export type MarketSnapshot = {
  price: number;
  changePercent: number | null;
  candleCount: number;
  lastUpdated: string;
};

type MarketChartProps = {
  symbol: string;
  timeframe: string;
  source: "demo" | "backend";
  onSnapshot?: (snapshot: MarketSnapshot | null) => void;
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
  // Calendar months are handled separately in groupCandles.
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
    const bucket = timeframe === "1M"
      ? Date.UTC(new Date(candle.seconds * 1000).getUTCFullYear(), new Date(candle.seconds * 1000).getUTCMonth(), 1) / 1000
      : timeframe === "1W"
        ? Math.floor((candle.seconds + 3 * 86400) / 604800) * 604800 - 3 * 86400
        : Math.floor(candle.seconds / interval) * interval;
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
  source,
  onSnapshot,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "fallback" | "demo">("connecting");
  const [showSignals, setShowSignals] = useState(true);
  const signalsEnabled = useRef(true);
  const overlayUpdate = useRef<((enabled: boolean) => void) | null>(null);

  useEffect(() => {
    signalsEnabled.current = showSignals;
    overlayUpdate.current?.(showSignals);
  }, [showSignals]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let hasLoadedData = false;
    let fetching = false;
    let reloadPending = false;
    setStatus("loading");
    setStreamStatus(source === "demo" ? "demo" : process.env.NODE_ENV === "development" ? "connecting" : "fallback");
    onSnapshot?.(null);
    const variable = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 600,
      layout: {
        background: { color: "rgba(0, 0, 0, 0)" },
        textColor: variable("--muted", "#9aaac0"),
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
          top: 0.20,
          bottom: 0.16,
        },
      },
      timeScale: {
        borderColor: "rgba(151,169,196,0.14)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 9,
        barSpacing: 9,
        minBarSpacing: 3,
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
      upColor: marketColors("dark").up,
      downColor: marketColors("dark").down,
      borderVisible: false,
      wickUpColor: marketColors("dark").up,
      wickDownColor: marketColors("dark").down,
      wickVisible: true,
      priceLineVisible: true,
    });

    // All overlays are derived from historical completed candles, never
    // generated prices. BUY/SELL labels mark past SMA crossovers only.
    const fastLine = chart.addSeries(LineSeries, {
      color: "#ededed",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const slowLine = chart.addSeries(LineSeries, {
      color: "#909090",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const markerPlugin = createSeriesMarkers(series, []);
    let latestCandles: CandlestickData<Time>[] = [];

    const updateOverlay = (enabled: boolean) => {
      const colors = marketColors(document.documentElement.dataset.theme === "light" ? "light" : "dark");
      markerPlugin.setMarkers(enabled
        ? movingAverageMarkers(latestCandles).map(marker => ({
            ...marker,
            color: marker.text === "BUY" ? colors.up : colors.down,
          }))
        : []);
      fastLine.setData(enabled ? movingAverageLine(latestCandles, 5) : []);
      slowLine.setData(enabled ? movingAverageLine(latestCandles, 12) : []);
    };
    overlayUpdate.current = updateOverlay;

    const applyTheme = () => {
      const light = document.documentElement.dataset.theme === "light";
      const colors = marketColors(light ? "light" : "dark");
      chart.applyOptions({
        layout: {
          background: { color: "rgba(0, 0, 0, 0)" },
          textColor: variable("--muted", "#9aaac0"),
        },
        grid: {
          vertLines: { color: variable("--chart-grid", "rgba(151,169,196,0.08)") },
          horzLines: { color: variable("--chart-grid", "rgba(151,169,196,0.08)") },
        },
      });
      series.applyOptions({
        upColor: colors.up,
        wickUpColor: colors.up,
        downColor: colors.down,
        wickDownColor: colors.down,
      });
      fastLine.applyOptions({ color: light ? "#333333" : "#ededed" });
      slowLine.applyOptions({ color: light ? "#888888" : "#909090" });
      updateOverlay(signalsEnabled.current);
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const loadCandles = async () => {
      if (fetching) {
        reloadPending = true;
        return;
      }
      fetching = true;
      try {
        const previousRange = hasLoadedData
          ? chart.timeScale().getVisibleLogicalRange()
          : null;


        let rawCandles: ApiCandle[];
        if (source === "demo") {
          // The explicit demo view makes NO backend/API calls.
          rawCandles = generateDemoCandles(symbol);
        } else {
          const response = await fetch(
            `/api/charts?symbol=${encodeURIComponent(symbol)}&limit=500`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            throw new Error(`Chart request failed: ${response.status}`);
          }

          const payload = (await response.json()) as ChartResponse;
          rawCandles = Array.isArray(payload.candles)
            ? payload.candles
            : Array.isArray(payload.data)
              ? payload.data
              : Array.isArray(payload.data?.candles)
                ? payload.data.candles
                : [];
        }

        if (cancelled) return;

        const candles = groupCandles(rawCandles, timeframe);

        if (candles.length === 0) {
          latestCandles = [];
          updateOverlay(false);
          series.setData([]);
          setStatus("empty");
          onSnapshot?.(null);
          return;
        }

        series.setData(candles);
        latestCandles = candles;
        updateOverlay(signalsEnabled.current);
        setStatus("ready");
        const first = candles[0];
        const last = candles[candles.length - 1];
        onSnapshot?.({
          price: last.close,
          changePercent: first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null,
          candleCount: candles.length,
          lastUpdated: new Date(Number(last.time) * 1000).toISOString(),
        });

        if (!hasLoadedData) {
          if (source === "demo") {
            // Show a readable, cinematic sample of recent bars initially;
            // older demo candles remain accessible by panning left.
            chart.timeScale().setVisibleLogicalRange({
              from: Math.max(0, candles.length - 85),
              to: candles.length + 5,
            });
          } else {
            chart.timeScale().fitContent();
          }
          hasLoadedData = true;
        } else if (previousRange) {
          chart.timeScale().setVisibleLogicalRange(previousRange);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          onSnapshot?.(null);
        }
        console.error("Unable to load market candles:", error);
      } finally {
        fetching = false;
        if (reloadPending && !cancelled) {
          reloadPending = false;
          void loadCandles();
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!cancelled && container.clientWidth > 0) {
        chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 600,
        });
      }
    });

    resizeObserver.observe(container);

    void loadCandles();

    // EventSource is connected only to Next.js, never directly to the backend.
    // The Next route keeps the viewer JWT private and forwards only a notification.
    // Fall back to occasional REST refreshes if the stream is not available.
    let stream: EventSource | undefined;
    if (source === "backend" && process.env.NODE_ENV === "development") {
      stream = new EventSource("/api/stream?symbol=" + encodeURIComponent(symbol));
      stream.addEventListener("ready", () => {
        if (!cancelled) {
          setStreamStatus("live");
          void loadCandles(); // Catch events missed between initial fetch and handshake.
        }
      });
      stream.addEventListener("candle", () => {
        if (!cancelled) void loadCandles();
      });
      stream.addEventListener("offline", () => {
        if (!cancelled) setStreamStatus("fallback");
      });
      stream.onerror = () => {
        if (!cancelled) setStreamStatus("fallback");
      };
    }

    const timer = setInterval(() => {
      void loadCandles();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.close();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      overlayUpdate.current = null;
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, timeframe, source, onSnapshot]);

  return (
    <div className="tp-chart-stage">
      <div ref={containerRef} className="market-chart" aria-label={symbol + " " + timeframe + " candlestick chart"} />
      <div className="tp-signal-controls">
        <span className="tp-signal-method">SMA 5 / 12 · HISTORICAL</span>
        <button
          type="button"
          className={"tp-signal-toggle" + (showSignals ? " active" : "")}
          aria-pressed={showSignals}
          aria-label="Toggle illustrative moving average crossover markers"
          onClick={() => setShowSignals((enabled) => !enabled)}
        >
          {showSignals ? "Signals on" : "Signals off"}
        </button>
      </div>
      <div className={"tp-stream-state tp-stream-state-" + streamStatus} role="status" aria-live="polite">
        <span className="tp-stream-led" aria-hidden="true" />
        {streamStatus === "demo" ? "SYNTHETIC DEMO · NO BACKEND" : streamStatus === "live" ? "LIVE CANDLE UPDATES" : streamStatus === "connecting" ? "CONNECTING TO STREAM" : "REST FALLBACK · 60S"}
      </div>
      {status !== "ready" && (
        <div className="tp-chart-state" role="status" aria-live="polite">
          <span className="tp-chart-state-glyph" aria-hidden="true">⌁</span>
          <strong>{status === "loading" ? (source === "demo" ? "Preparing chart preview…" : "Connecting to market data…") : status === "empty" ? "Waiting for candles" : "Chart data unavailable"}</strong>
          <span>{status === "loading" ? (source === "demo" ? "Loading locally generated synthetic candles" : "Retrieving stored market candles") : status === "empty" ? "Start the simulator and wait for a completed one-minute candle." : "Check the backend, Redis, database and chart API."}</span>
        </div>
      )}
    </div>
  );
}
