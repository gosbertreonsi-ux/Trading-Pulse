import { NextRequest, NextResponse } from "next/server";

type StudioMode = "manual" | "auto";

export async function POST(request: NextRequest) {
  // There is intentionally no public Studio endpoint until authenticated sessions are implemented.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "AI Studio is limited to local development until access control is configured." },
      { status: 403 },
    );
  }

  if (process.env.TRADING_PULSE_STUDIO_ENABLED !== "true") {
    return NextResponse.json(
      { success: false, error: "Local AI is disabled. Set TRADING_PULSE_STUDIO_ENABLED=true in frontend/.env.local and start Ollama." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ success: false, error: "A prompt is required." }, { status: 400 });
  }

  const input = payload as Record<string, unknown>;
  const prompt = input.prompt;
  const mode = input.mode;

  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
    return NextResponse.json(
      { success: false, error: "Prompt must contain between 1 and 4000 characters." },
      { status: 400 },
    );
  }

  if (mode !== "manual" && mode !== "auto") {
    return NextResponse.json({ success: false, error: "Invalid Studio mode." }, { status: 400 });
  }

  const selectedMode: StudioMode = mode;
  const model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
  const configuredUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

  let endpoint: URL;
  try {
    const base = new URL(configuredUrl);
    if (!["localhost", "127.0.0.1", "::1"].includes(base.hostname) || base.protocol !== "http:") {
      throw new Error("Ollama must run locally");
    }
    endpoint = new URL("/api/chat", base);
  } catch {
    return NextResponse.json(
      { success: false, error: "OLLAMA_BASE_URL must be a local HTTP address." },
      { status: 503 },
    );
  }

  const instruction = [
    "You are Trading Pulse's local software engineering assistant.",
    "Trading Pulse is a simulated market analytics app, not a real trading platform.",
    "Stack: Next.js, React, TypeScript, Fastify, PostgreSQL, Prisma, Redis.",
    "Do not claim code was applied, committed, tested or deployed.",
    "When writing code, provide concrete file paths and fenced code blocks.",
    "Flag any security, financial, or data-integrity risks; give a manual test plan.",
    selectedMode === "auto"
      ? "Prepare an implementation proposal, naming affected files, suggested changes, and review checks. The system does not run or apply your proposal."
      : "Explain the solution step by step and provide an editable code suggestion the developer can choose to apply.",
  ].join("\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: instruction },
          { role: "user", content: prompt.trim() },
        ],
        options: { temperature: 0.2, num_predict: 1600 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Ollama returned an error. Confirm the configured model is downloaded and running." },
        { status: 502 },
      );
    }

    const result: unknown = await response.json();
    const message = result && typeof result === "object"
      ? (result as { message?: { content?: unknown } }).message?.content
      : null;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "The model returned an empty response." }, { status: 502 });
    }

    return NextResponse.json(
      { success: true, output: message, model, mode: selectedMode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[STUDIO OLLAMA ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Cannot reach local Ollama or the request timed out. Check that Ollama is running." },
      { status: 502 },
    );
  }
}
