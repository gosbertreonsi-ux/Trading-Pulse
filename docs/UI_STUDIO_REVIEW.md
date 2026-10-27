# Trading Pulse — Dashboard + AI Studio milestone review

Branch: feat/cinematic-dashboard-ai-studio
Scope: a premium chart-centered market monitor inspired by the provided reference image, plus an explicitly opt-in local coding assistant.

## What is implemented

- Shared navigation between / and /studio, with persisted light/dark preference.
- Candles retain the actual PostgreSQL → REST chart feed; chart displays loading/empty/error states and responds to theme changes.
- Dashboard prices are derived from the most recent loaded candle, **never hardcoded market quotes**.
- The displayed change is the first-to-last candle change for the loaded sample, **not a 24-hour percentage**.
- The watchlist contains BTC, ETH and SOL, the three simulator symbols.
- Fixed UTC month/week grouping to avoid treating months as exactly 30 days.
- Studio has Manual guidance and Auto draft modes, response preview, editable extracted code, copy, prompt examples and human review reminders.
- Opt-in Ollama API route for local development only. No file edits, shell execution, automated commits, code evaluation or fake build results. AI integration is disabled in production until authentication/sandboxing is built.

## Local setup (Windows PowerShell)

1. Start PostgreSQL and Redis, and follow backend/README.md for the authenticated simulator and backend.
2. Inside frontend/ run: Copy-Item .env.example .env.local
3. Put a valid viewer JWT in TRADING_PULSE_VIEWER_JWT and confirm the backend API URL.
4. To enable local AI (optional), install Ollama, run: ollama pull qwen2.5-coder:7b
5. Start Ollama (normally by launching the desktop app, or with ollama serve where appropriate).
6. Set TRADING_PULSE_STUDIO_ENABLED=true in frontend/.env.local.
7. Run npm ci, npm run lint, npm run build, npm run dev inside frontend/.
8. Visit http://localhost:3001 if port 3000 is occupied by Fastify. Next.js may automatically choose an unused port; verify the actual terminal URL.

## Review checklist

- [ ] Source inspection: routes and React components have correct types, do not expose JWT secrets.
- [ ] npm run lint — output attached to PR.
- [ ] npm run build — output attached to PR.
- [ ] Desktop: dashboard, 1m candles, timeframe selection, zoom, watchlist and theme work.
- [ ] Mobile: chart resizes, watchlist works, sidebar/navigation remains usable, no unexpected horizontal overflow.
- [ ] Error state: stop backend and verify chart displays failure, not fake data.
- [ ] Browser Studio: disabled-by-default error explains setup; with Ollama enabled generate a real proposal.
- [ ] Manual mode: prompt, code extraction, editing and copying behave correctly.
- [ ] Auto draft mode: produces a proposal but cannot modify files until an authenticated change-review system is built.
- [ ] Backend flow: simulator posts ticks; Redis and PostgreSQL produce completed-minute candles.
- [ ] No regression to tenant isolation or auth checks.
- [ ] Merge only after tests and a visual review.

## Open limitations

- Chart data uses 10-second REST polling, not live socket subscriptions.
- Latest watchlist price is only shown for the active symbol; other prices are intentionally unknown.
- Monthly/weekly timeframes need more historical data to become meaningful.
- AI Studio generates proposals; it is not a repository editor or autonomous agent yet.
- A developer must review generated code and apply it through a dedicated pull request.
