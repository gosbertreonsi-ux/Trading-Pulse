"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

type Mode = "manual" | "auto";
type View = "response" | "code";

const examples = [
  "Improve the candlestick chart's empty and loading states",
  "Write tests for tenant-isolated trade ingestion",
  "Explain how Fastify, Redis and Prisma work together",
];

function extractCode(response: string) {
  const fence = String.fromCharCode(96, 96, 96);
  const segments = response.split(fence);
  const snippets = segments
    .filter((_, index) => index % 2 === 1)
    .map((segment) => {
      const newline = segment.indexOf("\n");
      return newline >= 0 ? segment.slice(newline + 1).trim() : segment.trim();
    });
  return snippets.join("\n\n");
}

export default function StudioPage() {
  const [mode, setMode] = useState<Mode>("manual");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [code, setCode] = useState("");
  const [view, setView] = useState<View>("response");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [model, setModel] = useState("");

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setReviewOpen(false);
    setError("");
    setNotice("");
    setResponse("");
    setCode("");

    try {
      const result = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode }),
        cache: "no-store",
        signal: AbortSignal.timeout(125000),
      });

      const payload: unknown = await result.json();
      if (!payload || typeof payload !== "object") throw new Error("Unexpected response");
      const message = payload as { success?: boolean; output?: string; error?: string; model?: string };
      if (!result.ok || !message.success || typeof message.output !== "string") {
        throw new Error(message.error ?? "The model could not generate a response.");
      }

      setResponse(message.output);
      setCode(extractCode(message.output));
      setModel(message.model ?? "");
      setView("response");
      setNotice("Proposal generated. No repository files were modified.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach the local AI service.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyText(value: string, what: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(what + " copied to clipboard.");
    } catch {
      setNotice("Clipboard unavailable. Select text and copy manually.");
    }
  }

  const editable = view === "code";
  const visibleText = editable ? code : response;

  return (
    <AppShell>
      <div className="tp-studio">
        <div className="tp-studio-head">
          <div>
            <div className="tp-eyebrow"><span className="tp-kicker-line" /> TRADING PULSE / AI LAB</div>
            <h1>Build with intelligence<span className="tp-title-period">.</span></h1>
            <p>Describe what you want to create, inspect the code, and decide what ships.</p>
          </div>
          <span className="tp-studio-status">LOCAL AI · OPT-IN / REVIEW FIRST</span>
        </div>

        <div className="tp-studio-grid">
          <section className="tp-studio-panel" aria-label="AI coding prompt">
            <div className="tp-studio-panel-header"><strong>✳ AI Assistant</strong><span>PROMPT WORKSPACE</span></div>
            <form className="tp-studio-form" onSubmit={generate}>
              <label className="tp-studio-label">WORKFLOW MODE <span>01 / CREATE</span></label>
              <div className="tp-studio-modes" role="group" aria-label="Generation workflow">
                <button type="button" aria-pressed={mode === "manual"} className={"tp-mode-button" + (mode === "manual" ? " active" : "")} onClick={() => setMode("manual")}>Manual guidance</button>
                <button type="button" aria-pressed={mode === "auto"} className={"tp-mode-button" + (mode === "auto" ? " active" : "")} onClick={() => setMode("auto")}>Auto draft</button>
              </div>
              <div className="tp-studio-mode-note">
                {mode === "manual"
                  ? "Ask the model for explanations, code and implementation steps. You choose what to copy or change."
                  : "The model automatically prepares a structured implementation proposal. It does NOT edit files, run code or commit to GitHub."}
              </div>
              <label htmlFor="studio-prompt" className="tp-studio-label">WHAT SHOULD WE BUILD? <span>{prompt.length}/4000</span></label>
              <textarea
                id="studio-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
                maxLength={4000} placeholder="Describe a feature, paste an error, or ask how a Trading Pulse system works…"
                className="tp-prompt-input" aria-label="Describe a coding task"
              />
              <div className="tp-studio-label">START WITH AN IDEA</div>
              <div className="tp-prompt-chips">
                {examples.map((example) => (
                  <button key={example} type="button" className="tp-prompt-chip" onClick={() => setPrompt(example)}>{example}</button>
                ))}
              </div>
              {error && <div className="tp-studio-error" role="alert">{error}</div>}
              <div className="tp-studio-actions">
                <button className="tp-primary-button" disabled={isGenerating || !prompt.trim()} type="submit">
                  {isGenerating && <span className="tp-studio-spinner" />}
                  {isGenerating ? "Generating…" : mode === "auto" ? "Generate proposal ↗" : "Ask local AI ↗"}
                </button>
                <button type="button" className="tp-secondary-button" onClick={() => { setPrompt(""); setResponse(""); setCode(""); setError(""); setNotice(""); setReviewOpen(false); }} disabled={isGenerating}>Clear</button>
              </div>
              <p className="tp-studio-footer">Powered by your own Ollama installation when enabled. Prompts are sent to your configured local model, not to GitHub. No code is executed here.</p>
            </form>
          </section>

          <section className="tp-studio-panel" aria-label="AI proposal preview">
            <div className="tp-studio-panel-header"><strong>⌘ Proposal preview</strong><span>{model || "AWAITING LOCAL MODEL"}</span></div>
            <div className="tp-code-preview">
              <div className="tp-code-tabs" role="group" aria-label="Preview content">
                <button type="button" className={"tp-code-tab" + (view === "response" ? " active" : "")} aria-pressed={view === "response"} onClick={() => setView("response")}>AI response</button>
                <button type="button" className={"tp-code-tab" + (view === "code" ? " active" : "")} aria-pressed={view === "code"} onClick={() => setView("code")}>Editable code</button>
                <button type="button" className="tp-secondary-button" disabled={!visibleText} onClick={() => void copyText(visibleText, editable ? "Code" : "Response")}>Copy ↗</button>
              </div>

              {visibleText ? (
                <textarea
                  className="tp-code-editor" value={visibleText}
                  onChange={(event) => { if (editable) setCode(event.target.value); }}
                  readOnly={!editable}
                  aria-label={editable ? "Editable generated code" : "Generated AI response"}
                  spellCheck={false}
                />
              ) : (
                <div className="tp-code-placeholder">
                  <span className="tp-code-placeholder-symbol" aria-hidden="true">⌘</span>
                  <strong>{view === "code" ? "No code blocks yet" : "Your next build begins here"}</strong>
                  <p>{view === "code"
                    ? "Generate a model response containing fenced code, then edit its extracted code here."
                    : "Choose a workflow, describe a change and generate an AI proposal. Nothing is applied to the repository automatically."}</p>
                </div>
              )}

              <div className="tp-code-status" role="status">
                {notice || (response ? "Draft only · Review, copy and apply changes through your normal development workflow." : "No files changed. This preview is isolated from the trading simulator.")}
              </div>
              <div className="tp-studio-actions">
                <button type="button" className="tp-secondary-button" onClick={() => setReviewOpen((current) => !current)} disabled={!response}>
                  {reviewOpen ? "Hide review" : "Review proposal"}
                </button>
                <Link href="/" className="tp-studio-cta" style={{ marginTop: 0, flex: 1 }}>Return to dashboard <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
          </section>
        </div>

        {reviewOpen && (
          <section className="tp-studio-review" aria-label="Implementation review">
            <h3>Human review required before implementation</h3>
            <p>The proposal has not been applied or tested. Verify every file change in a new branch, run the commands, inspect the dashboard, and request a GitHub pull-request review.</p>
            <div className="tp-review-list">
              <span className="tp-review-item"><strong>01</strong> Scope & security</span>
              <span className="tp-review-item"><strong>02</strong> Frontend preview</span>
              <span className="tp-review-item"><strong>03</strong> Backend tests</span>
              <span className="tp-review-item"><strong>04</strong> Diff & PR</span>
              <span className="tp-review-item"><strong>05</strong> Approve merge</span>
            </div>
          </section>
        )}
        <p className="tp-bottom-note">AI-generated code can be incorrect or insecure. Review every change before running it. Local AI is disabled by default.</p>
      </div>
    </AppShell>
  );
}
