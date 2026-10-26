"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import MarketChart, { type MarketSnapshot } from "@/components/MarketChart";

const markets = [
  { symbol: "BTCUSDT", ticker: "BTC", name: "Bitcoin", mark: "₿" },
  { symbol: "ETHUSDT", ticker: "ETH", name: "Ethereum", mark: "◆" },
  { symbol: "SOLUSDT", ticker: "SOL", name: "Solana", mark: "≋" },
];

const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D", "1W", "1M"];

function formatPrice(value: number | undefined) {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 5 : 2,
  }).format(value);
}

export default function Home() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1m");
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);

  const selected = markets.find((market) => market.symbol === selectedSymbol) ?? markets[0];
  const filtered = useMemo(() => markets.filter((market) =>
    (market.ticker + " " + market.name + " " + market.symbol)
      .toLowerCase().includes(search.trim().toLowerCase())
  ), [search]);

  const updateSnapshot = useCallback((value: MarketSnapshot | null) => setSnapshot(value), []);
  const change = snapshot?.changePercent;
  const changeText = change === undefined || change === null
    ? "—"
    : (change >= 0 ? "+" : "") + change.toFixed(2) + "%";

  function chooseMarket(symbol: string) {
    if (symbol === selectedSymbol) return;
    setSelectedSymbol(symbol);
    setSnapshot(null);
  }

  return (
    <AppShell>
      <div className="tp-dashboard">
        <div className="tp-page-intro">
          <div>
            <div className="tp-eyebrow"><span className="tp-kicker-line" /> TRADING PULSE / OVERVIEW</div>
            <h1>Market command center<span className="tp-title-period">.</span></h1>
            <p>Your window into market movement. Built for exploration, not execution.</p>
          </div>
          <Link href="/studio" className="tp-primary-link"><span aria-hidden="true">✳</span> Open AI Studio <span aria-hidden="true">↗</span></Link>
        </div>

        <div className="tp-metrics">
          <div className="tp-metric tp-metric-featured">
            <div className="tp-metric-heading"><span>TRACKING</span><span className="tp-small-pulse" /></div>
            <div className="tp-metric-value">{selected.ticker}<span className="tp-metric-currency"> / USDT</span></div>
            <div className="tp-metric-foot">Selected market · {selected.name}</div>
          </div>
          <div className="tp-metric">
            <div className="tp-metric-heading"><span>LAST CANDLE CLOSE</span><span aria-hidden="true">↗</span></div>
            <div className="tp-metric-value"> {snapshot ? "$" + formatPrice(snapshot.price) : "—"}</div>
            <div className="tp-metric-foot">From stored simulated candle data</div>
          </div>
          <div className="tp-metric">
            <div className="tp-metric-heading"><span>LOADED RANGE CHANGE</span><span aria-hidden="true">⌁</span></div>
            <div className={"tp-metric-value " + (change !== undefined && change !== null ? (change >= 0 ? "tp-up" : "tp-down") : "")}>{changeText}</div>
            <div className="tp-metric-foot">First open → latest close · not 24h</div>
          </div>
          <div className="tp-metric">
            <div className="tp-metric-heading"><span>DATA STREAM</span><span className="tp-status-orb" /></div>
            <div className="tp-metric-value tp-metric-smaller">SIMULATED</div>
            <div className="tp-metric-foot">Local dev stream · 60s backup refresh</div>
          </div>
        </div>

        <div className="tp-trading-layout">
          <section className="tp-chart-card" aria-label="Market candlestick chart">
            <div className="tp-chart-card-header">
              <div className="tp-pair-title">
                <span className="tp-coin-icon" aria-hidden="true">{selected.mark}</span>
                <div><h2>{selected.ticker}<span>/USDT</span></h2><p>{selected.name} · Historical OHLC</p></div>
              </div>
              <div className="tp-market-price">
                <strong>{snapshot ? "$" + formatPrice(snapshot.price) : "Awaiting data"}</strong>
                <span className={change !== undefined && change !== null ? (change >= 0 ? "tp-up" : "tp-down") : ""}>{changeText} <span className="tp-price-sub">loaded range</span></span>
              </div>
            </div>
            <div className="tp-chart-toolbar">
              <div className="tp-timeframe-strip" role="group" aria-label="Chart timeframe">
                <span className="tp-toolbar-label">INTERVAL</span>
                {timeframes.map((period) => (
                  <button key={period} type="button" onClick={() => setTimeframe(period)}
                    className={"tp-timeframe" + (timeframe === period ? " active" : "")} aria-pressed={timeframe === period}>{period}</button>
                ))}
              </div>
              <div className="tp-chart-legend">
                <span><i className="tp-legend-buy" /> BUY candle</span>
                <span><i className="tp-legend-sell" /> SELL candle</span>
              </div>
            </div>
            <div className="tp-chart-display">
              <div className="tp-chart-watermark" aria-hidden="true">TRADING<span>PULSE</span></div>
              <MarketChart symbol={selectedSymbol} timeframe={timeframe} onSnapshot={updateSnapshot} />
              <div className="tp-chart-display-corner" aria-hidden="true"><span>MARKET</span> / ANALYTICS</div>
            </div>
            <div className="tp-chart-footer">
              <span><span className="tp-dot" /> RESEARCH MODE <span className="tp-footer-sep">·</span> {snapshot?.candleCount ?? 0} bars loaded</span>
              <span>Scroll to zoom <span className="tp-footer-sep">·</span> Drag to explore</span>
            </div>
          </section>

          <aside className="tp-market-side" aria-label="Market tools">
            <div className="tp-watchlist tp-side-card">
              <div className="tp-side-head"><div><span className="tp-eyebrow">YOUR MARKETS</span><h3>Watchlist</h3></div><span className="tp-count">03</span></div>
              <label className="tp-search-wrap">
                <span aria-hidden="true">⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets…" aria-label="Search available markets" />
                <span className="tp-search-shortcut">⌕</span>
              </label>
              <div className="tp-watchlist-items">
                {filtered.map((market) => (
                  <button type="button" className={"tp-watchlist-item" + (market.symbol === selectedSymbol ? " selected" : "")} key={market.symbol}
                    onClick={() => chooseMarket(market.symbol)} aria-pressed={market.symbol === selectedSymbol}>
                    <span className="tp-list-coin" aria-hidden="true">{market.mark}</span>
                    <span className="tp-list-name"><strong>{market.ticker}</strong><small>{market.name}</small></span>
                    <span className="tp-list-right"><strong>{market.symbol === selectedSymbol && snapshot ? "$" + formatPrice(snapshot.price) : "—"}</strong><small>{market.symbol === selectedSymbol ? "Selected" : "View chart"}</small></span>
                  </button>
                ))}
                {filtered.length === 0 && <p className="tp-list-empty">No matching markets.</p>}
              </div>
              <p className="tp-disclaimer">Prices appear only when chart data is available. No fabricated quotes.</p>
            </div>
            <div className="tp-side-card tp-insight-card">
              <div className="tp-side-head"><div><span className="tp-eyebrow">INTELLIGENCE</span><h3>Market notes</h3></div><span className="tp-spark">✳</span></div>
              <div className="tp-insight-row"><span className="tp-insight-icon">⌁</span><div><strong>Readable market movement</strong><p>Green and red candles show open-to-close direction. They are not buy or sell recommendations.</p></div></div>
              <div className="tp-insight-row"><span className="tp-insight-icon">↗</span><div><strong>Visual + engineering studio</strong><p>Describe an improvement, review generated code, then choose what to implement.</p></div></div>
              <Link className="tp-studio-cta" href="/studio">Explore AI Studio <span aria-hidden="true">↗</span></Link>
            </div>
          </aside>
        </div>
        <p className="tp-bottom-note">Trading Pulse is a development simulator. Some source prices may be market references, but generated ticks and trades are simulated.</p>
      </div>
    </AppShell>
  );
}
