"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConnectionDiagnostic } from "@/lib/devDiagnostics";

type LoadState =
  | { stage: "loading" }
  | { stage: "failed" }
  | { stage: "done"; result: ConnectionDiagnostic };

export default function MarketConnection() {
  const [state, setState] = useState<LoadState>({ stage: "loading" });
  const [lastChecked, setLastChecked] = useState("");

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/dev/market-status", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        setState({ stage: "failed" });
        return;
      }
      const result = (await response.json()) as ConnectionDiagnostic;
      setState({ stage: "done", result });
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setState({ stage: "failed" });
    }
  }, []);

  useEffect(() => {
    // No stored credentials or token value ever touches this component.
    void check();
    const timer = setInterval(() => void check(), 30_000);
    return () => clearInterval(timer);
  }, [check]);

  const code = state.stage === "done" ? state.result.code : "checking";
  const ok = code === "connected" || code === "connected-empty";

  return (
    <section className="tp-side-card tp-connection" aria-label="Local market connection">
      <div className="tp-side-head">
        <div>
          <span className="tp-eyebrow">LOCAL SYSTEM CHECK</span>
          <h3>Data connection</h3>
        </div>
        <span className={"tp-connection-lamp" + (ok ? " online" : "")} aria-hidden="true" />
      </div>
      {state.stage === "loading" ? (
        <p className="tp-connection-main" role="status">Checking the market backend…</p>
      ) : state.stage === "failed" ? (
        <p className="tp-connection-main" role="status">Connection check unavailable. Run Next.js locally to inspect the backend.</p>
      ) : (
        <div role="status" aria-live="polite">
          <strong className="tp-connection-main">{state.result.title}</strong>
          <p className="tp-connection-description">{state.result.detail}</p>
          {state.result.code === "connected-empty" && (
            <span className="tp-connection-help">A 200 API response can be empty until the first full minute closes.</span>
          )}
        </div>
      )}
      <div className="tp-connection-bottom">
        <span>{lastChecked ? "Checked " + lastChecked : "Local diagnostic"}</span>
        <button className="tp-connection-refresh" type="button" onClick={() => void check()}>Check again</button>
      </div>
    </section>
  );
}
