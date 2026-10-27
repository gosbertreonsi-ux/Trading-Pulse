# Trading Pulse — review gate for every development step

This repository follows **inspect → plan → implement → commit → test → review → merge**.

Each pull request should include:
- **Scope:** What was changed and why, with a link to the corresponding issue or requirement.
- **Code review:** Security, tenant isolation, edge cases, maintainability, and dependencies.
- **Backend verification:** Run `cd backend && npm run typecheck && npm test`; check PostgreSQL/Redis connectivity and logs.
- **Frontend verification:** Run `cd frontend && npm run lint && npm run build`.
- **In-browser review:** Open the dashboard and verify layout (desktop and mobile), both themes, charts, each available market, timeframe controls, zoom/pan, search, loading states, errors and accessibility.
- **End-to-end verification:** Start Redis/PostgreSQL, backend and simulator; verify new ticks become persisted candles and frontend charts update. Test unexpected disconnections and reconnection.
- **Security verification:** No committed secrets, protected ingestion, valid JWT expiration, isolated tenants and WebSocket authorization.
- **Evidence:** Record tested commands and their PASS/FAIL output. Attach screenshots or a short screen recording for visible UI changes.
- **Outcome:** PASS / NEEDS FIXES / BLOCKED. Do not merge when unresolved high-priority issues remain.

## Review 1 — backend security and reliability (draft PR #1)

Static code inspection identified the following unfinished review gates:
- [ ] Audit the already-tracked `backend/.env` file **without copying credentials into tickets**, revoke any leaked secrets, and remove secrets from the repo/history where necessary.
- [ ] Verify TypeScript and frontend builds locally; this PR currently has no reported CI statuses.
- [ ] Verify the WebSocket authentication handshake, tenant-specific broadcasts, and reconnect behavior.
- [ ] Verify trade ingestion authorization and rejected request cases.
- [ ] Test Redis unavailable / available startup and proper shutdown.
- [ ] Confirm the viewer JWT delivery/renewal strategy; the current 24h development token is not a production session solution.
- [ ] Confirm the Next.js chart proxy and simulated candles render successfully in dark and light themes.

Do not assume that a mergeable GitHub branch means the app is ready for deployment.
