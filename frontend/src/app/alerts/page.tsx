"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

type SymbolName = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
type AlertRow = {
  id: string;
  symbol: SymbolName;
  direction: "ABOVE" | "BELOW";
  targetPrice: string;
  status: "ACTIVE" | "TRIGGERED";
  observedPrice: string | null;
  createdAt: string;
  triggeredAt: string | null;
};
type ListResult = { success: boolean; data?: AlertRow[]; error?: string };

function price(value: string | number | null): string {
  if (value === null) return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 4
  }) : "—";
}

export default function AlertsPage() {
  const [symbol, setSymbol] = useState<SymbolName>("BTCUSDT");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [threshold, setThreshold] = useState("");
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      const payload = (await response.json()) as ListResult;
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || "Alert service unavailable");
      }
      setAlerts(payload.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 15_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [refresh]);

  async function createAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(threshold);
    if (!Number.isFinite(value) || value < 0.0001 || value > 1e12) {
      setError("Enter a positive target price.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, direction, targetPrice: value }),
      });
      const payload = (await response.json()) as ListResult;
      if (!response.ok) throw new Error(payload.error || "Unable to create alert");
      setThreshold("");
      setMessage("Alert saved. It triggers once when the simulator records a matching market tick.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create alert");
    } finally {
      setBusy(false);
    }
  }

  async function removeAlert(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/alerts?id=" + encodeURIComponent(id), { method: "DELETE" });
      const payload = (await response.json()) as ListResult;
      if (!response.ok) throw new Error(payload.error || "Unable to delete alert");
      setMessage("Alert deleted.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete alert");
    } finally {
      setBusy(false);
    }
  }

  const activeCount = alerts.filter(alert => alert.status === "ACTIVE").length;
  const triggeredCount = alerts.filter(alert => alert.status === "TRIGGERED").length;

  return (
    <AppShell>
      <div className="pa-page">
        <header className="pa-heading">
          <div>
            <span className="br-eyebrow">MARKET TOOLS / PRICE MONITORING</span>
            <h1>Price alerts<span className="pa-period">.</span></h1>
            <p>Watch simulated market thresholds. Alerts are notifications, not instructions or orders.</p>
          </div>
          <Link className="pa-back" href="/">← Back to dashboard</Link>
        </header>

        <div className="pa-banner" role="note">
          <span className="pa-sim-dot" aria-hidden="true" />
          <div><strong>CONNECTED SIMULATOR ONLY</strong><p>Requires local Fastify, PostgreSQL, Redis and a viewer JWT. Demo Preview never creates or triggers real alert records.</p></div>
        </div>

        <div className="pa-grid">
          <section className="pa-card pa-create">
            <div className="pa-card-heading">
              <span className="br-section-caption">CREATE ALERT</span>
              <h2>Monitor a price</h2>
              <p>Choose a simulated market and the level you want to watch.</p>
            </div>
            <form onSubmit={event => void createAlert(event)} className="pa-form">
              <label htmlFor="alert-symbol">Market</label>
              <select id="alert-symbol" value={symbol} onChange={event => setSymbol(event.target.value as SymbolName)}>
                <option value="BTCUSDT">BTC / USDT — Bitcoin</option>
                <option value="ETHUSDT">ETH / USDT — Ethereum</option>
                <option value="SOLUSDT">SOL / USDT — Solana</option>
              </select>

              <label htmlFor="alert-direction">Trigger condition</label>
              <select id="alert-direction" value={direction} onChange={event => setDirection(event.target.value as "ABOVE" | "BELOW")}>
                <option value="ABOVE">Price reaches or exceeds target</option>
                <option value="BELOW">Price reaches or falls below target</option>
              </select>

              <label htmlFor="alert-price">Target price (USDT)</label>
              <input id="alert-price" type="number" inputMode="decimal" min="0.0001" max="1000000000000"
                step="0.0001" placeholder="e.g. 65000.0000" required
                value={threshold} onChange={event => setThreshold(event.target.value)} />
              <button type="submit" disabled={busy} className="pa-submit">
                {busy ? "Saving…" : "Create price alert"} <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="pa-footnote">One-shot trigger on an ingested simulator tick. Maximum 30 active alerts per tenant. No email, SMS, financial advice, or real orders.</p>
          </section>

          <section className="pa-card pa-history">
            <div className="pa-history-top">
              <div><span className="br-section-caption">YOUR PRICE MONITOR</span><h2>Alert history</h2></div>
              <button type="button" disabled={busy} onClick={() => void refresh()} className="pa-refresh">Refresh ↻</button>
            </div>
            <div className="pa-summary">
              <div><span>Active</span><strong>{activeCount}</strong></div>
              <div><span>Triggered</span><strong>{triggeredCount}</strong></div>
              <div><span>Recorded</span><strong>{alerts.length}</strong></div>
            </div>
            {error && <p className="pa-feedback pa-error" role="alert">{error}. Check your local backend and viewer JWT.</p>}
            {message && <p className="pa-feedback pa-success" role="status">{message}</p>}
            {loading && <p className="pa-empty" role="status">Loading alerts…</p>}
            {!loading && alerts.length === 0 && <p className="pa-empty">No alerts yet. Create one for a connected simulated market.</p>}
            <div className="pa-list">
              {alerts.map(alert => (
                <div className="pa-item" key={alert.id}>
                  <div className="pa-item-primary">
                    <span className={"pa-direction " + (alert.direction === "ABOVE" ? "pa-up" : "pa-down")}>
                      {alert.direction === "ABOVE" ? "↑ ABOVE" : "↓ BELOW"}
                    </span>
                    <strong>{alert.symbol.slice(0, -4)} / USDT</strong>
                    <span className={"pa-status " + (alert.status === "TRIGGERED" ? "is-triggered" : "")}>
                      {alert.status}
                    </span>
                  </div>
                  <div className="pa-item-secondary">
                    <span>Target: {price(alert.targetPrice)} USDT</span>
                    {alert.status === "TRIGGERED" && <span>Observed: {price(alert.observedPrice)} USDT</span>}
                    <small>{alert.triggeredAt
                      ? "Triggered " + new Date(alert.triggeredAt).toLocaleString()
                      : "Created " + new Date(alert.createdAt).toLocaleString()}</small>
                  </div>
                  <button className="pa-remove" type="button" disabled={busy}
                    aria-label={"Delete " + alert.symbol + " alert " + alert.id}
                    onClick={() => void removeAlert(alert.id)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="pa-history-footer">Latest 100 alerts · Auto-refresh every 15 seconds</div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
