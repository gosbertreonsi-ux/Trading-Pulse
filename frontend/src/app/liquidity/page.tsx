"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type SymbolCode = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
type DepthLevel = { price: number; quantity: number; cumulativeQuantity: number };
type LiquidityResponse = {
  success: boolean;
  symbol: SymbolCode;
  modelType: "EDUCATIONAL_SYNTHETIC_DEPTH";
  basedOn: "LAST_PERSISTED_SIMULATOR_TRADES";
  observedWindow: string;
  observed: {
    sampleCount: number; lastPrice: number | null; lastTradeAt: string | null;
    buyQuantity: number; sellQuantity: number;
  };
  assumptions: {
    tickSize: number; depthLevels: number; quantityModel: string; limitations: string;
  };
  bids: DepthLevel[]; asks: DepthLevel[];
  bestBid: number | null; bestAsk: number | null;
  spread: number | null; modeledBidQuantity: number | null;
  modeledAskQuantity: number | null; modeledImbalancePercent: number | null;
};
const MARKETS: SymbolCode[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function numberText(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? "—"
    : new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
}
function observedTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}
function BookSide({ levels, side }: {
  levels: DepthLevel[]; side: "bid" | "ask";
}) {
  const max = Math.max(0, ...levels.map(level => level.cumulativeQuantity));
  const displayed = side === "ask" ? [...levels].reverse() : levels;
  return (
    <div className={"lq-book-list lq-" + side} aria-label={side === "bid" ? "Modeled bid levels" : "Modeled ask levels"}>
      {displayed.map(level => (
        <div className="lq-book-row" key={level.price}>
          <div className="lq-book-fill" style={{
            width: max > 0 ? (level.cumulativeQuantity / max * 100) + "%" : "0%",
          }} aria-hidden="true"/>
          <span className="lq-book-price">{numberText(level.price, 2)}</span>
          <span>{numberText(level.quantity, 4)}</span>
          <span>{numberText(level.cumulativeQuantity, 4)}</span>
        </div>
      ))}
      {displayed.length === 0 && <div className="lq-book-empty">No price anchor yet — start the simulator.</div>}
    </div>
  );
}

export default function LiquidityPage() {
  const [symbol, setSymbol] = useState<SymbolCode>("BTCUSDT");
  const [result, setResult] = useState<LiquidityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [streamState, setStreamState] = useState<"connecting" | "live" | "fallback">("connecting");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/liquidity?symbol=" + encodeURIComponent(symbol), {
        cache: "no-store", signal,
      });
      const payload = (await response.json()) as LiquidityResponse & { error?: string };
      if (!response.ok || !payload.success || payload.modelType !== "EDUCATIONAL_SYNTHETIC_DEPTH" ||
          payload.symbol !== symbol || !Array.isArray(payload.bids) || !Array.isArray(payload.asks)) {
        throw new Error(payload.error || "Simulated liquidity model unavailable");
      }
      if (signal?.aborted) return;
      setResult(payload);
      setError("");
      setCheckedAt(new Date().toLocaleTimeString());
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Failed to load model");
      setResult(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    let lastStreamRefresh = 0;
    const startup = setTimeout(() => void load(controller.signal), 0);
    const poll = setInterval(() => void load(controller.signal), 10_000);
    const stream = process.env.NODE_ENV === "development"
      ? new EventSource("/api/stream?symbol=" + encodeURIComponent(symbol)) : null;

    stream?.addEventListener("ready", () => {
      if (controller.signal.aborted) return;
      setStreamState("live");
      void load(controller.signal);
    });
    stream?.addEventListener("tick", () => {
      if (controller.signal.aborted) return;
      const now = Date.now();
      if (now - lastStreamRefresh < 1500) return;
      lastStreamRefresh = now;
      void load(controller.signal);
    });
    stream?.addEventListener("offline", () => setStreamState("fallback"));
    if (stream) stream.onerror = () => {
      if (!controller.signal.aborted) setStreamState("fallback");
    };
    if (!stream) {
      const markFallback = setTimeout(() => {
        if (!controller.signal.aborted) setStreamState("fallback");
      }, 0);
      return () => {
        controller.abort();
        clearTimeout(startup); clearInterval(poll); clearTimeout(markFallback);
      };
    }
    return () => {
      controller.abort(); stream.close();
      clearTimeout(startup); clearInterval(poll);
    };
  }, [symbol, load]);

  const hasTrades = (result?.observed.sampleCount ?? 0) > 0;
  const flowTotal = (result?.observed.buyQuantity ?? 0) + (result?.observed.sellQuantity ?? 0);
  const buyShare = flowTotal > 0 ? (result!.observed.buyQuantity / flowTotal) * 100 : 0;

  return (
    <AppShell>
      <div className="lq-page">
        <header className="lq-heading">
          <div>
            <span className="br-eyebrow">RESEARCH / MARKET MICROSTRUCTURE LAB</span>
            <h1>Liquidity model<span>.</span></h1>
            <p>Explore illustrative order-book depth beside genuinely observed simulated trade flow.</p>
          </div>
          <Link className="ha-back" href="/">← Dashboard</Link>
        </header>

        <div className="lq-disclaimer" role="note">
          <span className="lq-disclaimer-mark" aria-hidden="true">!</span>
          <div>
            <strong>EDUCATIONAL MODEL — NOT REAL ORDER-BOOK LIQUIDITY</strong>
            <p>Bids, asks, spread and modeled imbalance are generated for learning, not observed exchange orders.
              Only the recent simulator trades and their BUY/SELL quantities are stored observations.</p>
          </div>
        </div>

        <div className="lq-controls">
          <div>
            <label htmlFor="lq-market">Simulated market</label>
            <select id="lq-market" value={symbol} onChange={event => {
              setSymbol(event.target.value as SymbolCode);
              setResult(null); setError(""); setLoading(true); setStreamState("connecting");
            }}>
              {MARKETS.map(item => (
                <option key={item} value={item}>{item.slice(0, -4)} / USDT</option>
              ))}
            </select>
          </div>
          <span className="lq-source"><span className={"lq-led" + (streamState === "live" ? " live" : "")}/>
            {streamState === "live" ? "SIMULATOR STREAM CONNECTED"
              : streamState === "fallback" ? "REST FALLBACK · 10S" : "CONNECTING"}
          </span>
          <button type="button" onClick={() => { setLoading(true); void load(); }}>Refresh ↻</button>
        </div>

        {error && <p role="alert" className="lq-feedback">{error}. Check local Fastify, PostgreSQL and the viewer JWT.</p>}
        {loading && !result && !error && <p className="lq-feedback" role="status">Loading modeled market depth…</p>}
        {result && (
          <>
            <div className="lq-summary">
              <div><span>OBSERVED LAST TRADE</span><strong>{numberText(result.observed.lastPrice)}</strong><small>USDT · {result.observed.sampleCount} recent ticks</small></div>
              <div><span>MODELED BID / ASK</span><strong>{numberText(result.bestBid)} / {numberText(result.bestAsk)}</strong><small>USDT · synthetic ladder</small></div>
              <div><span>MODELED SPREAD</span><strong>{numberText(result.spread)}</strong><small>USDT · 2 price ticks by assumption</small></div>
              <div><span>MODELED DEPTH IMBALANCE</span><strong className={(result.modeledImbalancePercent ?? 0) >= 0 ? "lq-up" : "lq-down"}>
                {result.modeledImbalancePercent == null ? "—" :
                  (result.modeledImbalancePercent > 0 ? "+" : "") + numberText(result.modeledImbalancePercent) + "%"}
                </strong><small>Invented bid vs ask quantities</small></div>
            </div>

            <div className="lq-panels">
              <section className="lq-card lq-depth">
                <div className="lq-card-head">
                  <div><span>SIMULATED / NOT EXECUTABLE</span><h2>Modeled order depth</h2></div>
                  <small>10 levels each side · units: base asset</small>
                </div>
                <div className="lq-column-head"><span>PRICE (USDT)</span><span>SIZE</span><span>CUMULATIVE</span></div>
                <BookSide levels={result.asks} side="ask"/>
                <div className="lq-mid">
                  <span>OBSERVED REFERENCE PRICE</span>
                  <strong>{numberText(result.observed.lastPrice)}</strong>
                </div>
                <BookSide levels={result.bids} side="bid"/>
                <p className="lq-card-note">Illustrative prices sit around the last saved trade using a fixed
                  tick size of {result.assumptions.tickSize} USDT. These are not placeable orders.</p>
              </section>
              <div className="lq-side-stack">
                <section className="lq-card">
                  <div className="lq-card-head"><div><span>ACTUAL SIMULATOR RECORDS</span><h2>Recent trade flow</h2></div></div>
                  <div className="lq-flow-stats">
                    <div><span>BUY QUANTITY</span><strong className="lq-up">{numberText(result.observed.buyQuantity, 4)}</strong></div>
                    <div><span>SELL QUANTITY</span><strong className="lq-down">{numberText(result.observed.sellQuantity, 4)}</strong></div>
                  </div>
                  <div className="lq-flow-bar" role="img"
                    aria-label={"Observed buy volume share " + numberText(flowTotal ? buyShare : null) + " percent"}>
                    <div style={{ width: buyShare + "%" }}/>
                  </div>
                  <div className="lq-flow-legend"><span>BUY {numberText(flowTotal ? buyShare : null)}%</span><span>SELL {numberText(flowTotal ? 100 - buyShare : null)}%</span></div>
                  <p className="lq-card-note">These BUY/SELL quantities come from at most 48 persisted
                    simulator trades. They do not measure resting liquidity, slippage, or an exchange order book.</p>
                </section>
                <section className="lq-card">
                  <div className="lq-card-head"><div><span>ASSUMPTIONS & PROVENANCE</span><h2>How this model works</h2></div></div>
                  <dl className="lq-assumptions">
                    <dt>Last persisted trade</dt><dd>{observedTimestamp(result.observed.lastTradeAt)}</dd>
                    <dt>Observed sample</dt><dd>{result.observed.sampleCount} / 48 trades</dd>
                    <dt>Price tick</dt><dd>{result.assumptions.tickSize} USDT</dd>
                    <dt>Model type</dt><dd>Deterministic / synthetic</dd>
                    <dt>Refresh</dt><dd>Tick events and 10-second REST</dd>
                    <dt>Last checked</dt><dd>{checkedAt || "—"}</dd>
                  </dl>
                  <p className="lq-card-note">{result.assumptions.quantityModel}</p>
                  <p className="lq-card-note">{result.assumptions.limitations}</p>
                </section>
              </div>
            </div>
            {!hasTrades && <p className="lq-feedback">No stored simulator trades for this market and tenant.
              Start the simulator. No modeled order book is produced without an observed price anchor.</p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
