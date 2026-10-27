"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import MarketChart, { type MarketSnapshot } from "@/components/MarketChart";
import MarketConnection from "@/components/MarketConnection";
import { generateDemoCandles } from "@/lib/demoCandles";

type Market = { symbol: string; ticker: string; name: string; icon: string };
type Quote = { price: number; change: number; spark: number[] };
type Source = "demo" | "backend";

const markets: Market[] = [
  { symbol: "BTCUSDT", ticker: "BTC", name: "Bitcoin", icon: "₿" },
  { symbol: "ETHUSDT", ticker: "ETH", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOLUSDT", ticker: "SOL", name: "Solana", icon: "◎" },
];

const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D", "1W", "1M"];

function money(price: number | undefined): string {
  if (price === undefined || !Number.isFinite(price)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 1 ? 5 : 2,
  }).format(price);
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}

function demoQuotes(): Record<string, Quote> {
  const result: Record<string, Quote> = {};
  const now = Date.now();
  for (const market of markets) {
    const candles = generateDemoCandles(market.symbol, now, 60);
    if (!candles.length) continue;
    const first = candles[0];
    const last = candles[candles.length - 1];
    result[market.symbol] = {
      price: last.close,
      change: ((last.close - first.open) / first.open) * 100,
      spark: candles.slice(-24).map(bar => bar.close),
    };
  }
  return result;
}

function Sparkline({ points, rising }: { points?: number[]; rising: boolean }) {
  if (!points || points.length < 2) return <span className="br-spark-placeholder" aria-hidden="true">—</span>;
  const min = Math.min(...points);
  const range = Math.max(...points) - min || 1;
  const path = points.map((value, index) => {
    const x = (index / (points.length - 1)) * 78;
    const y = 28 - ((value - min) / range) * 22;
    return (index ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
  return (
    <svg className={"br-spark" + (rising ? " up" : " down")} viewBox="0 0 78 34" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [source, setSource] = useState<Source>(process.env.NODE_ENV === "development" ? "demo" : "backend");
  const [timeframe, setTimeframe] = useState("1m");
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  useEffect(() => {
    if (source !== "demo") return;
    // Keep browser-only synthetic quotes off the server render and never
    // confuse them with the authenticated simulator's prices.
    const first = setTimeout(() => setQuotes(demoQuotes()), 0);
    const timer = setInterval(() => setQuotes(demoQuotes()), 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [source]);

  const selected = markets.find(market => market.symbol === selectedSymbol) ?? markets[0];
  const filtered = useMemo(
    () => markets.filter(market =>
      (market.symbol + " " + market.name).toLowerCase().includes(search.trim().toLowerCase()),
    ),
    [search],
  );
  const updateSnapshot = useCallback((value: MarketSnapshot | null) => setSnapshot(value), []);

  function selectMarket(symbol: string) {
    if (symbol === selectedSymbol) return;
    setSelectedSymbol(symbol);
    setSnapshot(null);
  }

  function changeSource(next: Source) {
    if (next === source) return;
    setSource(next);
    setSnapshot(null);
  }

  const latestPrice = snapshot?.price;
  const change = snapshot?.changePercent;
  const up = (change ?? 0) >= 0;

  return (
    <AppShell>
      <div className="br-terminal">
        <header className="br-head">
          <div className="br-head-title">
            <span className="br-eyebrow"><span className="br-live-dot"/> THE WORKSPACE / MARKET OVERVIEW</span>
            <h1>Markets <span>at a glance.</span></h1>
            <p>A precise view of movement, patterns and simulated market data.</p>
          </div>
          <div className="br-head-actions">
            <span className="br-environment"><span className="br-environment-dot"/> RESEARCH ENVIRONMENT</span>
            <Link href="/studio" className="br-studio-button"><span aria-hidden="true">✳</span> AI Studio <span aria-hidden="true">↗</span></Link>
          </div>
        </header>

        <div className="br-mode-bar">
          <div className="br-mode-label">
            <span className={"br-mode-tag " + (source === "demo" ? "is-demo" : "is-connected")}>
              {source === "demo" ? "DEMO PREVIEW" : "CONNECTED SIMULATOR"}
            </span>
            <span>{source === "demo"
              ? "Synthetic chart data for UI review — not live prices."
              : "Authenticated, stored simulator candles — no real trades."}</span>
          </div>
          {process.env.NODE_ENV === "development" && (
            <div className="br-mode-switch" role="group" aria-label="Market data source">
              <button type="button" aria-pressed={source === "demo"} className={source === "demo" ? "active" : ""} onClick={() => changeSource("demo")}>Demo</button>
              <button type="button" aria-pressed={source === "backend"} className={source === "backend" ? "active" : ""} onClick={() => changeSource("backend")}>Connected</button>
            </div>
          )}
        </div>

        <div className="br-workspace">
          <aside className="br-watchlist" aria-label="Watchlist">
            <div className="br-panel-heading">
              <div><span className="br-section-caption">MARKET WATCH</span><h2>Watchlist <span className="br-count">03</span></h2></div>
              <span className="br-header-symbol" aria-hidden="true">↗</span>
            </div>
            <label className="br-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search markets" aria-label="Search watchlist"/>
              <kbd>/</kbd>
            </label>
            <div className="br-watchlist-header" aria-hidden="true"><span>ASSET</span><span>LAST / RANGE CHANGE</span></div>
            <div className="br-assets">
              {filtered.map(market => {
                const selectedRow = market.symbol === selectedSymbol;
                const demo = source === "demo" ? quotes[market.symbol] : undefined;
                const price = source === "demo" ? demo?.price : selectedRow ? latestPrice : undefined;
                const movement = source === "demo" ? demo?.change : selectedRow ? change : null;
                const rise = (movement ?? 0) >= 0;
                return (
                  <button className={"br-asset" + (selectedRow ? " selected" : "")} type="button" key={market.symbol}
                    onClick={() => selectMarket(market.symbol)} aria-pressed={selectedRow}>
                    <span className={"br-asset-icon " + market.ticker.toLowerCase()} aria-hidden="true">{market.icon}</span>
                    <span className="br-asset-info"><strong>{market.ticker}<em>/USDT</em></strong><small>{market.name}</small></span>
                    <Sparkline points={demo?.spark} rising={rise}/>
                    <span className="br-asset-value"><strong>{money(price)}</strong><small className={movement == null ? "" : rise ? "br-up" : "br-down"}>{percent(movement)}</small></span>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="br-no-match">No matching markets</p>}
            </div>
            <div className="br-watchlist-note"><span className="br-note-icon">ⓘ</span> {source === "demo"
              ? "All preview quotes are synthetic."
              : "Only selected-market quotes are loaded. No invented watchlist prices."}</div>
            <div className="br-watchlist-footer"><span className="br-status-circle"/> {markets.length} SIMULATED ASSETS <span>TRADING PULSE</span></div>
          </aside>

          <section className="br-center" aria-label="Market chart and overview">
            <div className="br-chart-card">
              <div className="br-chart-topline">
                <div className="br-pair">
                  <span className={"br-pair-icon " + selected.ticker.toLowerCase()} aria-hidden="true">{selected.icon}</span>
                  <div>
                    <div className="br-pair-heading"><h2>{selected.name} <span>/ USDT</span></h2><span className="br-pair-type">CRYPTO</span></div>
                    <span className="br-pair-sub">{selected.symbol} <span>·</span> {source === "demo" ? "Synthetic chart preview" : "Stored simulator OHLCV"}</span>
                  </div>
                </div>
                <div className="br-quote">
                  <strong>{latestPrice === undefined ? "—" : "$" + money(latestPrice)}</strong>
                  <span className={change === null || change === undefined ? "br-quote-neutral" : up ? "br-up" : "br-down"}>
                    {percent(change)} <small>loaded range</small>
                  </span>
                </div>
              </div>
              <div className="br-chart-toolbar">
                <div className="br-intervals" role="group" aria-label="Chart timeframe">
                  {timeframes.map(period => (
                    <button key={period} type="button" aria-pressed={timeframe === period}
                      className={timeframe === period ? "active" : ""} onClick={() => setTimeframe(period)}>{period}</button>
                  ))}
                </div>
                <div className="br-chart-key"><span><i className="positive"/> Bullish</span><span><i className="negative"/> Bearish</span></div>
              </div>
              <div className="br-chart-canvas">
                <MarketChart symbol={selectedSymbol} timeframe={timeframe} source={source} onSnapshot={updateSnapshot}/>
              </div>
              <div className="br-chart-bottom">
                <span><span className="br-status-circle"/> {source === "demo" ? "SYNTHETIC PREVIEW" : "SIMULATED MARKET"} <b>·</b> {snapshot?.candleCount ?? 0} bars</span>
                <span>Scroll to zoom <b>·</b> Drag to pan <b>·</b> Historical SMA crossovers</span>
              </div>
            </div>
            <div className="br-bottom-panels">
              <div className="br-mini-card">
                <div className="br-mini-header"><span>SELECTED MARKET</span><span aria-hidden="true">↗</span></div>
                <strong>{selected.ticker} <span>/ USDT</span></strong>
                <p>{selected.name} · {timeframe} interval</p>
              </div>
              <div className="br-mini-card">
                <div className="br-mini-header"><span>LAST CANDLE CLOSE</span><span aria-hidden="true">◉</span></div>
                <strong>{latestPrice === undefined ? "—" : "$" + money(latestPrice)}</strong>
                <p>{source === "demo" ? "Synthetic preview candle" : "Authenticated stored candle"}</p>
              </div>
              <div className="br-mini-card">
                <div className="br-mini-header"><span>LOADED RANGE</span><span aria-hidden="true">⌁</span></div>
                <strong className={change === null || change === undefined ? "" : up ? "br-up" : "br-down"}>{percent(change)}</strong>
                <p>First open → latest close · not 24h</p>
              </div>
            </div>
          </section>

          <aside className="br-right" aria-label="Market intelligence and tools">
            <div className="br-details-card">
              <div className="br-panel-heading"><div><span className="br-section-caption">MARKET INSIGHT</span><h2>Overview</h2></div><span className="br-details-icon">⌁</span></div>
              <div className="br-detail-top">
                <span>Current market</span><strong>{selected.ticker} / USDT</strong>
                <small>{source === "demo" ? "Synthetic UI preview" : "Simulated market feed"}</small>
              </div>
              <div className="br-detail-rows">
                <div><span>Last candle close</span><strong>{latestPrice === undefined ? "—" : "$" + money(latestPrice)}</strong></div>
                <div><span>Loaded range</span><strong className={change === null || change === undefined ? "" : up ? "br-up" : "br-down"}>{percent(change)}</strong></div>
                <div><span>Candles loaded</span><strong>{snapshot?.candleCount ?? 0}</strong></div>
                <div><span>Timeframe</span><strong>{timeframe}</strong></div>
              </div>
              <div className="br-detail-tag"><span className="br-status-circle"/> {source === "demo" ? "DEMO — NO REAL PRICES" : "SIMULATION — NO EXECUTION"}</div>
            </div>
            {source === "backend" ? <MarketConnection/> : (
              <div className="br-preview-card">
                <span className="br-section-caption">PREVIEW STATUS</span>
                <h3>Explore without setup.</h3>
                <p>The chart is using illustrative prices. Connect Fastify when you want to inspect stored simulator candles.</p>
                <button type="button" onClick={() => changeSource("backend")}>Inspect connected data <span aria-hidden="true">↗</span></button>
              </div>
            )}
            <div className="br-intelligence">
              <div className="br-intelligence-title"><span className="br-section-caption">WORKSPACE TOOLS</span><span aria-hidden="true">✳</span></div>
              <h3>Research, not execution.</h3>
              <p>BUY/SELL annotations mark historical SMA 5/12 crossovers. They are not trade orders or forecasts.</p>
              <Link href="/studio">Open AI Studio <span aria-hidden="true">↗</span></Link>
            </div>
          </aside>
        </div>
        <footer className="br-page-footer"><span>TRADING PULSE <b>·</b> MARKET ANALYTICS SIMULATOR</span><span>No real orders are placed. Demo prices are synthetic.</span></footer>
      </div>
    </AppShell>
  );
}
