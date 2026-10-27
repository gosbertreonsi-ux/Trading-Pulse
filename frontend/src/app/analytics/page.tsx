"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";

type SymbolCode = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
type WindowBars = 60 | 120 | 240;
type CompletedCandle = {
  timestamp: string; open: number; high: number;
  low: number; close: number; volume: number;
};
type Summary = {
  candleCount: number; firstAt: string | null; lastAt: string | null;
  firstOpen: number | null; lastClose: number | null;
  rangeChangePercent: number | null; periodHigh: number | null;
  periodLow: number | null; totalVolume: number | null;
  averageVolume: number | null; bullishCount: number;
  bearishCount: number; unchangedCount: number;
  maxCloseDrawdownPercent: number | null;
};
type HistoryResponse = {
  success: boolean; symbol: SymbolCode; granularity: "completed-1m";
  requestedBars: WindowBars; summary: Summary; candles: CompletedCandle[];
};
const SYMBOLS: SymbolCode[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const WINDOWS: WindowBars[] = [60, 120, 240];

function format(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? "—"
    : new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
}
function signed(value: number | null): string {
  return value == null ? "—" : (value > 0 ? "+" : "") + format(value) + "%";
}
function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
}
function HistoryLine({ candles }: { candles: CompletedCandle[] }) {
  const { points, area, firstAt, lastAt } = useMemo(() => {
    const values = candles.map(item => item.close);
    if (values.length === 0) return { points: "", area: "", firstAt: "", lastAt: "" };
    const low = Math.min(...values);
    const high = Math.max(...values);
    const spread = high - low || Math.abs(high) * 0.01 || 1;
    const points = values.map((close, index) => {
      const x = 16 + (index / Math.max(1, values.length - 1)) * 768;
      const y = 192 - ((close - low) / spread) * 162;
      return [x, y];
    });
    const line = points.map(([x, y], i) => (i === 0 ? "M" : "L") +
      x.toFixed(2) + " " + y.toFixed(2)).join(" ");
    return {
      points: line,
      area: line + " L 784 216 L 16 216 Z",
      firstAt: candles[0].timestamp,
      lastAt: candles[candles.length - 1].timestamp,
    };
  }, [candles]);

  if (!candles.length) return <p className="ha-empty">No completed candles have been stored for this market.</p>;
  const rising = candles[candles.length - 1].close >= candles[0].close;
  return (
    <div className={"ha-chart " + (rising ? "ha-up" : "ha-down")}>
      <svg viewBox="0 0 800 230" role="img"
        aria-label={"Historical closing-price chart with " + candles.length + " completed candles"}>
        {[42, 96, 150, 204].map(y => <line key={y} x1="12" x2="788" y1={y} y2={y}
          stroke="currentColor" strokeOpacity=".09" strokeDasharray="3 6"/>)}
        <path d={area} fill="currentColor" opacity=".08" />
        <path d={points} fill="none" stroke="currentColor" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="ha-time-axis"><span>{timeLabel(firstAt)}</span><span>{timeLabel(lastAt)}</span></div>
    </div>
  );
}
function VolumeBars({ candles }: { candles: CompletedCandle[] }) {
  const max = Math.max(0, ...candles.map(item => item.volume));
  if (!candles.length) return <p className="ha-empty">Volume becomes available after completed candles are stored.</p>;
  return (
    <div className="ha-volume-bars" role="img"
      aria-label={"Historical base-asset trade quantity per completed minute, " + candles.length + " bars"}>
      {candles.map(bar =>
        <span key={bar.timestamp}
          className={bar.close >= bar.open ? "positive" : "negative"}
          style={{ height: (max > 0 ? Math.max(2, (bar.volume / max) * 100) : 2) + "%" }}
          title={timeLabel(bar.timestamp) + ": " + format(bar.volume, 4) + " base asset units"}/>)}
    </div>
  );
}
export default function AnalyticsPage() {
  const [symbol, setSymbol] = useState<SymbolCode>("BTCUSDT");
  const [windowBars, setWindowBars] = useState<WindowBars>(120);
  const [result, setResult] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/analytics?symbol=" + symbol + "&limit=" + windowBars, {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as HistoryResponse & { error?: string };
      if (!response.ok || !payload.success || !Array.isArray(payload.candles)) {
        throw new Error(payload.error || "Historical analytics unavailable");
      }
      if (signal?.aborted) return;
      setResult(payload);
      setLastChecked(new Date().toLocaleTimeString());
      setError("");
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Historical analytics unavailable");
      setResult(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [symbol, windowBars]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = setTimeout(() => void load(controller.signal), 0);
    const timer = setInterval(() => void load(controller.signal), 30_000);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  const summary = result?.summary;
  const candles = result?.candles ?? [];
  const statistics = [
    ["FIRST OPEN", summary?.firstOpen, "USDT"],
    ["LATEST CLOSE", summary?.lastClose, "USDT"],
    ["PERIOD HIGH", summary?.periodHigh, "USDT"],
    ["PERIOD LOW", summary?.periodLow, "USDT"],
    ["TOTAL VOLUME", summary?.totalVolume, "base units"],
    ["AVG. VOLUME / BAR", summary?.averageVolume, "base units"],
  ] as const;

  return (
    <AppShell>
      <div className="ha-page">
        <header className="ha-heading">
          <div>
            <span className="br-eyebrow">RESEARCH / PERSISTED MARKET HISTORY</span>
            <h1>Historical analytics<span>.</span></h1>
            <p>Explore completed one-minute OHLCV candles from your simulated market database.</p>
          </div>
          <Link href="/" className="ha-back">← Dashboard</Link>
        </header>

        <div className="ha-notice" role="note">
          <span className="ha-notice-indicator" aria-hidden="true"/>
          Stored simulator observations only · not a live exchange feed, price forecast, or trading recommendation.
          Time windows count <strong>completed candles</strong>, not guaranteed uninterrupted minutes.
        </div>

        <section className="ha-toolbar" aria-label="Historical analysis filters">
          <div>
            <label htmlFor="ha-symbol">Simulated market</label>
            <select id="ha-symbol" value={symbol} onChange={event => {
              setSymbol(event.target.value as SymbolCode); setResult(null); setLoading(true);
            }}>
              {SYMBOLS.map(item => <option key={item} value={item}>{item.slice(0, -4)} / USDT</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ha-window">Historical window</label>
            <select id="ha-window" value={windowBars} onChange={event => {
              setWindowBars(Number(event.target.value) as WindowBars); setResult(null); setLoading(true);
            }}>
              {WINDOWS.map(limit => <option key={limit} value={limit}>Last {limit} completed bars</option>)}
            </select>
          </div>
          <div className="ha-toolbar-status">
            <span>{lastChecked ? "Last checked " + lastChecked : "Awaiting historical data"}</span>
            <button type="button" onClick={() => { setLoading(true); void load(); }}>Refresh ↻</button>
          </div>
        </section>

        {error && <p className="ha-feedback" role="alert">{error}. Check Fastify, PostgreSQL and your viewer JWT.</p>}
        {loading && !result && !error && <p className="ha-feedback" role="status">Loading persisted candle analytics…</p>}
        {result && (
          <>
            <div className="ha-summary-top">
              <div><span>COMPLETED BARS</span><strong>{summary?.candleCount ?? 0}</strong><small>Up to {windowBars} one-minute bars</small></div>
              <div><span>OPEN → CLOSE CHANGE</span><strong className={(summary?.rangeChangePercent ?? 0) >= 0 ? "ha-positive" : "ha-negative"}>
                {signed(summary?.rangeChangePercent ?? null)}</strong><small>Loaded range, not 24h</small></div>
              <div><span>MAX CLOSE DRAWDOWN</span><strong>{summary?.maxCloseDrawdownPercent == null ? "—" : format(summary.maxCloseDrawdownPercent) + "%"}</strong><small>Peak-close to later close</small></div>
              <div><span>UP / DOWN / FLAT</span><strong>{summary?.bullishCount ?? 0} / {summary?.bearishCount ?? 0} / {summary?.unchangedCount ?? 0}</strong><small>Completed 1m bars</small></div>
            </div>

            <div className="ha-visuals">
              <section className="ha-card">
                <div className="ha-card-heading"><div><span>HISTORICAL CLOSING PRICES</span><h2>{symbol.slice(0,-4)} / USDT</h2></div><small>Completed 1m · no open candle</small></div>
                <HistoryLine candles={candles}/>
              </section>
              <section className="ha-card">
                <div className="ha-card-heading"><div><span>BASE ASSET QUANTITY</span><h2>Volume per minute</h2></div></div>
                <VolumeBars candles={candles}/>
                <p className="ha-volume-note">Trade quantity, not USDT notional or exchange-wide volume.</p>
              </section>
            </div>

            <section className="ha-statistics" aria-label="Historical statistical summary">
              {statistics.map(([label, value, unit]) => (
                <div className="ha-stat" key={label}><span>{label}</span><strong>{format(value, unit === "base units" ? 4 : 2)}</strong><small>{unit}</small></div>
              ))}
            </section>

            <section className="ha-card ha-table-card">
              <div className="ha-card-heading"><div><span>AUDITABLE PERSISTED RECORDS</span><h2>Recent completed candles</h2></div><small>Newest first · UTC timestamps</small></div>
              <div className="ha-table-scroll">
                <table className="ha-table">
                  <thead><tr><th>UTC time</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead>
                  <tbody>
                    {candles.slice(-30).reverse().map(bar =>
                      <tr key={bar.timestamp}>
                        <td>{new Date(bar.timestamp).toISOString().slice(0, 16).replace("T", " ")}</td>
                        <td>{format(bar.open)}</td><td>{format(bar.high)}</td>
                        <td>{format(bar.low)}</td>
                        <td className={bar.close >= bar.open ? "ha-positive" : "ha-negative"}>{format(bar.close)}</td>
                        <td>{format(bar.volume, 4)}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
              {candles.length === 0 && <p className="ha-empty">Start the simulator and allow a full UTC minute to finish. No historical values are fabricated.</p>}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
