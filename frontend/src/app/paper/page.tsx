"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

type SymbolCode = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
type Side = "BUY" | "SELL";
type Order = {
  id: string; symbol: string; side: Side; price: number; quantity: number;
  remainingQuantity: number; status: string; createdAt: string;
};
type Fill = {
  id: string; price: number; quantity: number; executedAt: string;
  buyOrderId: string; sellOrderId: string;
};
type Book = {
  success: boolean; mode: "PAPER_IN_MEMORY"; persistent: false;
  symbol: SymbolCode; bids: Order[]; asks: Order[];
  recentOrders: Order[]; fills: Fill[];
};
const MARKETS: SymbolCode[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const STEP: Record<SymbolCode, string> = {
  BTCUSDT: "1", ETHUSDT: "0.1", SOLUSDT: "0.01",
};
function priceText(value: number, digits = 2): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function PaperOrdersPage() {
  const [symbol, setSymbol] = useState<SymbolCode>("BTCUSDT");
  const [side, setSide] = useState<Side>("BUY");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/paper?symbol=" + symbol, { cache: "no-store", signal });
      const data = (await response.json()) as Book & { error?: string };
      if (!response.ok || !data.success || data.mode !== "PAPER_IN_MEMORY" ||
          data.symbol !== symbol) throw new Error(data.error || "Paper matching sandbox unavailable");
      if (signal?.aborted) return;
      setBook(data);
      setError("");
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not read the paper order book");
    }
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    const start = setTimeout(() => void refresh(controller.signal), 0);
    const interval = setInterval(() => void refresh(controller.signal), 3000);
    return () => { controller.abort(); clearTimeout(start); clearInterval(interval); };
  }, [refresh]);

  async function place(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/paper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, price: Number(price), quantity: Number(quantity) }),
      });
      const result = (await response.json()) as {
        success: boolean; error?: string; order?: Order; fills?: Fill[];
      };
      if (!response.ok || !result.success) throw new Error(result.error || "Paper order rejected");
      setMessage((result.fills?.length
        ? result.fills.length + " simulated fill(s) recorded. "
        : "Test limit order is resting. ") + "No real trade was placed.");
      setQuantity("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paper order rejected");
    } finally {
      setWorking(false);
    }
  }

  async function cancel(id: string) {
    setWorking(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/paper?id=" + encodeURIComponent(id), { method: "DELETE" });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || "Could not cancel the order");
      setMessage("Unfilled portion cancelled inside this paper sandbox.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cancellation failed");
    } finally {
      setWorking(false);
    }
  }
  const openOrders = book?.recentOrders.filter(order =>
    order.status === "OPEN" || order.status === "PARTIALLY_FILLED") ?? [];
  return (
    <AppShell>
      <div className="po-page">
        <header className="po-heading">
          <div>
            <span className="br-eyebrow">RESEARCH / PAPER MATCHING ENGINE</span>
            <h1>Paper order book<span>.</span></h1>
            <p>Learn price-time matching using disposable simulated limit orders.</p>
          </div>
          <Link href="/liquidity" className="ha-back">← Liquidity model</Link>
        </header>
        <div className="po-warning" role="note">
          <strong>TEST ORDERS ONLY · NOT CONNECTED TO THE REAL MARKET</strong>
          <p>Separate from your simulated market feed, and from the earlier illustrative liquidity model.
            Orders and fills exist in Fastify memory only; restarting the backend clears them.
            No real money, exchange, broker, balance, or portfolio is involved.</p>
        </div>

        <div className="po-grid">
          <section className="po-card">
            <div className="po-head"><span>PLACE A TEST LIMIT ORDER</span><h2>Order entry</h2></div>
            <form className="po-form" onSubmit={event => void place(event)}>
              <label htmlFor="po-symbol">Simulated pair</label>
              <select id="po-symbol" value={symbol} onChange={event => {
                setSymbol(event.target.value as SymbolCode);
                setBook(null); setPrice(""); setError(""); setMessage("");
              }}>
                {MARKETS.map(item => <option key={item} value={item}>{item.slice(0, -4)} / USDT</option>)}
              </select>
              <div className="po-side-switch" role="group" aria-label="Test order direction">
                <button type="button" className={side === "BUY" ? "active buy" : ""}
                  aria-pressed={side === "BUY"} onClick={() => setSide("BUY")}>BUY</button>
                <button type="button" className={side === "SELL" ? "active sell" : ""}
                  aria-pressed={side === "SELL"} onClick={() => setSide("SELL")}>SELL</button>
              </div>
              <label htmlFor="po-price">Limit price (USDT)</label>
              <input id="po-price" type="number" required min={STEP[symbol]} max="1000000000"
                step={STEP[symbol]} value={price} onChange={event => setPrice(event.target.value)}
                placeholder={"Multiples of " + STEP[symbol]} />
              <label htmlFor="po-quantity">Quantity (base asset)</label>
              <input id="po-quantity" type="number" required min="0.0001" max="1000000"
                step="0.0001" value={quantity} onChange={event => setQuantity(event.target.value)}
                placeholder="e.g. 0.5000"/>
              <button className={"po-submit " + (side === "BUY" ? "buy" : "sell")}
                type="submit" disabled={working}>{working ? "Processing…" : "Place simulated " + side + " order"}</button>
              <p>Opposite limits cross at the resting order’s price. Partial fills remain open until matched or cancelled.</p>
            </form>
            {error && <p role="alert" className="po-error">{error}</p>}
            {message && <p role="status" className="po-message">{message}</p>}
          </section>
          <section className="po-card">
            <div className="po-head"><span>ACTUAL RESTING PAPER ORDERS</span><h2>Price-time priority</h2></div>
            <div className="po-market-info">
              <span>{symbol.slice(0, -4)} / USDT</span>
              <span>{book ? "IN-MEMORY SANDBOX" : "LOADING"}</span>
            </div>
            <div className="po-book-grid">
              {(["BUY", "SELL"] as const).map(direction => {
                const rows = direction === "BUY" ? book?.bids : book?.asks;
                return <div className="po-book-side" key={direction}>
                  <h3 className={direction === "BUY" ? "po-up" : "po-down"}>
                    {direction === "BUY" ? "BIDS · BUY" : "ASKS · SELL"}
                  </h3>
                  <div className="po-row po-column"><span>PRICE</span><span>REMAINING</span></div>
                  {rows?.length ? rows.map(order =>
                    <div className="po-row" key={order.id}>
                      <span className={direction === "BUY" ? "po-up" : "po-down"}>{priceText(order.price)}</span>
                      <span>{priceText(order.remainingQuantity, 4)}</span>
                    </div>
                  ) : <p className="po-empty">No resting {direction.toLowerCase()} orders</p>}
                </div>;
              })}
            </div>
            <p className="po-note">The ladder shows real resting <em>test orders within this process</em>,
              not an exchange order book. Levels are ordered by price then arrival time.</p>
          </section>
        </div>

        <div className="po-bottom-grid">
          <section className="po-card">
            <div className="po-head"><span>MANUAL PAPER ORDERS</span><h2>Open orders <small>{openOrders.length}</small></h2></div>
            {openOrders.length ? <div className="po-order-list">{openOrders.map(order =>
              <div className="po-order" key={order.id}>
                <div><strong className={order.side === "BUY" ? "po-up" : "po-down"}>{order.side}</strong>
                  <span>{priceText(order.price)} USDT</span><small>{priceText(order.remainingQuantity, 4)} remaining · {order.status}</small></div>
                <button type="button" disabled={working} onClick={() => void cancel(order.id)}>Cancel</button>
              </div>
            )}</div> : <p className="po-empty">No active paper orders.</p>}
          </section>
          <section className="po-card">
            <div className="po-head"><span>SIMULATED EXECUTIONS</span><h2>Recent fills</h2></div>
            {book?.fills.length ? <div className="po-fill-list">{book.fills.map(fill =>
              <div className="po-fill" key={fill.id}>
                <span>{priceText(fill.price)} USDT</span>
                <strong>{priceText(fill.quantity, 4)} units</strong>
                <small>{new Date(fill.executedAt).toLocaleTimeString()}</small>
              </div>
            )}</div> : <p className="po-empty">No paper orders have matched yet.</p>}
          </section>
        </div>
        <footer className="po-footer">PAPER MATCHING LAB · LOCAL ONLY · NO DATABASE PERSISTENCE · NO EXECUTABLE ORDERS</footer>
      </div>
    </AppShell>
  );
}
