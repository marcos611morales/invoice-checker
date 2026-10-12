---
phase: "01"
slug: "real-spend-by-supplier"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-12"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Regenerated 2026-10-12 for the browser-upload re-scope (replaces the 2026-10-09 Drive version). Source: 01-RESEARCH.md "Validation Architecture"; decisions D-20..D-37 in 01-CONTEXT.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.3 (node env) for unit, contract and pipeline tests; Playwright 1.64.0 (Chromium) for anonymous and authenticated (minted-session) browser flows |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (exist; Playwright `webServer.env` needs a test secret and `ALLOWED_EMAILS` for authenticated specs — Wave 0) |
| **Quick run command** | `pnpm vitest run tests/unit tests/contract` |
| **Full suite command** | `pnpm vitest run && pnpm lint && pnpm typecheck && pnpm build && pnpm exec playwright test` |
| **Estimated runtime** | ~30 seconds quick; ~3 minutes full |

---

## Sampling Rate

- **After every task commit:** `pnpm vitest run <touched area>` (parser-adjacent tasks also run `tests/unit/fixtures-clean.test.ts`)
- **After every plan wave:** `pnpm vitest run && pnpm lint && pnpm typecheck`; waves touching routes, CSP, auth or the client provider also run `pnpm build && pnpm exec playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green, then the manual list below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Requirement-level map seeded from research and bound to task IDs by the planner on 2026-10-12, then re-bound the same day when Plans 01-11, 01-12, 01-13, 01-15 and 01-16 were split into 01-18..01-22 (`01-NN-Tk` = plan 01-NN, task k). Every ❌ W0 entry names the task that creates the missing file; execution fills Status. Authenticated e2e specs run only against the local production server that Playwright starts on port 3100 (minted sessions, Plan 01-11); with `E2E_BASE_URL` set they skip themselves and only `anonymous.spec.ts` runs.

| Requirement | Behavior | Test Type | Automated Command | Task IDs | File Exists | Status |
|-------------|----------|-----------|-------------------|----------|-------------|--------|
| AUTH-01 | Identity-only Google sign-in (no `drive` scope); sign-in still hydrates under the nonce CSP | unit + e2e anonymous | `pnpm vitest run tests/unit/auth-config.test.ts && pnpm exec playwright test tests/e2e/anonymous.spec.ts` | 01-01, 01-11-T1, 01-17-T3 (real accounts) | ✅ auth-config (01-01); anonymous.spec exists (01-01), extended by 01-11-T1 | ⬜ pending |
| AUTH-02 | Non-allowlisted denied on every page and route; no server-function directive, only the auth `route.ts` | unit + structural + e2e (minted non-allowlisted session, anonymous 307) | `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/require-user.test.ts tests/unit/entrypoints-guarded.test.ts && pnpm exec playwright test tests/e2e/session.spec.ts tests/e2e/anonymous.spec.ts` | 01-11-T2, 01-18-T2, 01-16-T1, 01-16-T2 | ✅ allowlist, require-user (01-01); ❌ W0 → `session.spec.ts` created by 01-11-T2, `entrypoints-guarded.test.ts` by 01-18-T2 | ⬜ pending |
| AUTH-03 | Session survives reload; logout returns to `/login`; keep-alive slides the cookie | unit (config, canary, sign-out route) + e2e | `pnpm vitest run tests/unit/auth-config.test.ts tests/unit/mint-session.test.ts tests/unit/auth-route.test.ts && pnpm exec playwright test tests/e2e/session.spec.ts` | 01-11-T2, 01-18-T1, 01-18-T2, 01-14-T1 | ❌ W0 → `mint-session.test.ts` and `session.spec.ts` created by 01-11-T2, `auth-route.test.ts` by 01-18-T1 | ⬜ pending |
| AUTH-04 | Reachable at the shared URL; CSP and `clear-site-data` headers present | e2e anonymous against production | `E2E_BASE_URL=<prod> pnpm exec playwright test tests/e2e/anonymous.spec.ts` | 01-17-T2 | ✅ anonymous.spec (01-01), extended by 01-11-T1, 01-18-T1, 01-16-T2, 01-22-T2 (seven cases) | ⬜ pending |
| ING-04 | Same UUID never duplicates: stored wins (D-26), in-batch first wins | contract + unit pipeline + e2e | `pnpm vitest run tests/contract tests/unit/ingest.test.ts && pnpm exec playwright test tests/e2e/browser-upload.spec.ts` | 01-19-T2, 01-19-T3, 01-12-T2, 01-13-T1, 01-13-T2 | ❌ W0 → `tests/contract/*` created by 01-19-T2 (completed in 01-19-T3), `browser-upload.spec.ts` by 01-12-T1, `ingest.test.ts` by 01-13-T2 | ⬜ pending |
| ING-06 | Pick/drop XML only, non-XML listed, size cap, 1,000-file cap (D-35), progress, summary counts (D-36); nothing sent to the server | unit + e2e (request sniff, synthetic drop) | `pnpm vitest run tests/unit/ingest.test.ts tests/unit/no-network.test.ts && pnpm exec playwright test tests/e2e/browser-upload.spec.ts` | 01-12-T1, 01-12-T2, 01-13-T1, 01-13-T2, 01-20-T1, 01-22-T1 | ❌ W0 → `browser-upload.spec.ts` created by 01-12-T1, `ingest.test.ts` and `no-network.test.ts` by 01-13-T2 | ⬜ pending |
| LEDG-01 | Parse tolerance and isomorphic (browser-safe) imports | unit (01-04) + import guard | `pnpm vitest run tests/unit/cfdi-parse.test.ts tests/unit/isomorphic-imports.test.ts` | 01-04-T1, 01-04-T2, 01-13-T2 | ❌ W0 → `cfdi-parse.test.ts` created by 01-04-T1, `isomorphic-imports.test.ts` by 01-13-T2 | ⬜ pending |
| LEDG-02 | Exact decimals; 0.10 not flagged, 0.11 flagged; `toCents` the only number boundary | unit (01-04) + analytics | `pnpm vitest run tests/unit/money-recon.test.ts tests/unit/analytics.test.ts` | 01-04-T3, 01-15-T1 | ❌ W0 → `money-recon.test.ts` created by 01-04-T3, `analytics.test.ts` by 01-15-T1 | ⬜ pending |
| LEDG-03 | I +, E −, P 0; goldens 217,880.82 / 16,053.07 / 13,679.30 | unit + analytics + local real-XML cross-check | `pnpm vitest run tests/unit/spend-rules.test.ts tests/unit/analytics.test.ts tests/unit/supplier-detail.test.ts` | 01-04-T3, 01-15-T1, 01-21-T1, 01-16-T1, 01-17-T3 | ❌ W0 → `spend-rules.test.ts` created by 01-04-T3, `analytics.test.ts` by 01-15-T1 (supplier anchors added by 01-21-T1), `supplier-detail.test.ts` by 01-16-T1 | ⬜ pending |
| LEDG-07 | Anonymized fixtures only; fixture tests read-only | unit (leak guard) | `pnpm vitest run tests/unit/fixtures-clean.test.ts` | 01-03 (done), 01-13-T2 | ✅ | ⬜ pending |
| STOR-03 | Memory fake and IndexedDB adapter pass one contract suite | contract (`describe.each`) + idb tests | `pnpm vitest run tests/contract tests/unit/idb-adapter.test.ts` | 01-19-T2, 01-19-T3 | ❌ W0 → `tests/contract/*` created by 01-19-T2 (IndexedDB row) and completed with the memory row by 01-19-T3, `idb-adapter.test.ts` by 01-19-T3 | ⬜ pending |
| STOR-04 | Survives reload; wiped on sign-out, delete button, other account (D-24); IndexedDB unavailable → error (D-33) | unit + e2e | `pnpm vitest run tests/unit/browser-data.test.ts tests/unit/auth-route.test.ts && pnpm exec playwright test tests/e2e/browser-upload.spec.ts tests/e2e/browser-wipe.spec.ts` | 01-18-T1, 01-19-T3, 01-12-T1, 01-12-T2, 01-20-T2, 01-14-T1, 01-14-T2, 01-14-T3, 01-17-T3 (Safari/Firefox) | ❌ W0 → `auth-route.test.ts` created by 01-18-T1, `browser-upload.spec.ts` by 01-12-T1, `browser-wipe.spec.ts` by 01-14-T1, `browser-data.test.ts` by 01-14-T2 | ⬜ pending |
| DASH-04 | Ranking, top 10, monthly evolution, supplier detail, "Facturas" = I + E (D-37) | unit + e2e | `pnpm vitest run tests/unit/analytics.test.ts tests/unit/supplier-detail.test.ts && pnpm exec playwright test tests/e2e/dashboard.spec.ts` | 01-15-T1, 01-15-T2, 01-21-T1, 01-21-T2, 01-16-T1, 01-16-T2 | ❌ W0 → `analytics.test.ts` and `dashboard.spec.ts` created by 01-15-T1, `supplier-detail.test.ts` by 01-16-T1 | ⬜ pending |
| DASH-09 | es-MX formatting and Spanish copy | unit + e2e text | `pnpm vitest run tests/unit/format.test.ts` | 01-18-T1, 01-13-T1, 01-20-T1, 01-15-T1, 01-21-T2, 01-16-T2, 01-22-T2 | ❌ W0 → `format.test.ts` created by 01-21-T2 (the formatters land in 01-13-T1 and 01-15-T1; until then copy is gated by the string checks in each task's verify) | ⬜ pending |
| Security | DTD/oversize rejected; hostile name as text; nonce CSP (D-31) with no violations; no network from the browser core | unit + e2e console | `pnpm vitest run tests/unit/csp.test.ts tests/unit/no-network.test.ts` | 01-04-T2, 01-11-T1, 01-13-T2, 01-21-T1, 01-22-T2 | ❌ W0 → `csp.test.ts` created by 01-11-T1, `no-network.test.ts` by 01-13-T2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `idb` 8.0.4 and `fake-indexeddb` 6.2.5 installed, exact-pinned, after the package legitimacy checkpoint (D-30) — 01-19-T1 (checkpoint), 01-19-T2 (install)
- [ ] `tests/contract/invoice-store.contract.ts` and `tests/contract/invoice-store.contract.test.ts` — 01-19-T2 (IndexedDB round trip), completed with the memory row in 01-19-T3; `tests/unit/idb-adapter.test.ts` and the memory fake — 01-19-T3
- [ ] `tests/unit/csp.test.ts` — 01-11-T1; `tests/unit/mint-session.test.ts` — 01-11-T2; `tests/unit/auth-route.test.ts` — 01-18-T1; `tests/unit/entrypoints-guarded.test.ts` — 01-18-T2; `tests/unit/cfdi-parse.test.ts` — 01-04-T1; `tests/unit/{money-recon,spend-rules}.test.ts` — 01-04-T3; `tests/unit/{ingest,no-network,isomorphic-imports}.test.ts` — 01-13-T2; `tests/unit/browser-data.test.ts` — 01-14-T2; `tests/unit/analytics.test.ts` — 01-15-T1; `tests/unit/format.test.ts` — 01-21-T2; `tests/unit/supplier-detail.test.ts` — 01-16-T1
- [ ] `tests/helpers/{e2e-env,mint-session}.ts` + canary test; Playwright `webServer.env` on port 3100; `tests/e2e/session.spec.ts` — 01-11-T2; `tests/e2e/browser-upload.spec.ts` — 01-12-T1; `tests/e2e/browser-wipe.spec.ts` — 01-14-T1; `tests/e2e/dashboard.spec.ts` — 01-15-T1
- [ ] Plan 01-04 (parser) executes before 01-19 and 01-12 — dependency of the contract fixtures and of every pipeline and analytics test (01-11 runs first because it does not need the parser; 01-18 follows 01-04 only so two plans never share the working tree at once)
- Execution order, one plan per wave because every plan that builds or runs Playwright uses the same `.next` and port 3100: 01-11 → 01-04 → 01-18 → 01-19 → 01-12 → 01-13 → 01-20 → 01-14 → 01-15 → 01-21 → 01-16 → 01-22 → 01-17

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Google sign-in for owner and partner at the production URL; a third account sees "Acceso denegado" with its email (consent screen "In production", D-34) | AUTH-01, AUTH-02, AUTH-04 | Google blocks automated consent | Sign in with both allowlisted accounts and one other |
| Sliding session renewal on the deployed URL | AUTH-03 | Needs real time | Inspect `Set-Cookie` Max-Age after a second visit past the update age |
| Safari and Firefox: upload, reload persistence, logout wipe, `Clear-Site-Data` effect | STOR-04 | WebKit/Gecko not automated | Checklist run by the user on the owner's and partner's own browsers (01-17-T3 item 6; RESEARCH Open Question 10) |
| Telmex / Google Ads totals against the real XMLs | LEDG-03, DASH-04 | Fiscal files never leave the machine | Upload `Facturas/2025/*.xml` in the deployed app; Telmex row $16,053.07 (7 facturas), Google Ads row $13,679.30 (11 facturas: 8 I + 3 E, per D-37) |
| Populated dashboard at 1280 px and 390 px; bar contrast | DASH-04, DASH-09 | Visual result | Visual check |
| CSP on the production dashboard with real charts | Security | Depends on the real build | DevTools console after an upload |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every `auto`/`tracer` task in the live plans carries `<automated>` with `<fails_when>`; the two blocking-human checkpoints, 01-19-T1 and 01-17-T1, are gates with their own verification)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each ❌ W0 entry above names its creating task)
- [x] No watch-mode flags (every Vitest call is `pnpm vitest run`)
- [ ] Feedback latency < 30s (the per-commit quick run is about 30 s, but task gates that run `pnpm build` and Playwright take about 1-3 minutes; confirmed during execution)
- [ ] `nyquist_compliant: true` set in frontmatter (set during execution / validate-phase)

**Approval:** pending
