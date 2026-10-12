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

Requirement-level map seeded from research; the planner binds each row to task IDs (01-11 onward) and execution fills Status.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AUTH-01 | Identity-only Google sign-in (no `drive` scope) | unit + e2e anonymous | `pnpm vitest run tests/unit/auth-config.test.ts` | ✅ | ⬜ pending |
| AUTH-02 | Non-allowlisted denied on every page and route; no `"use server"`, only the auth `route.ts` | unit + structural + e2e (minted non-allowlisted session) | `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/require-user.test.ts tests/unit/entrypoints-guarded.test.ts` | partly ❌ W0 | ⬜ pending |
| AUTH-03 | Session survives reload; logout returns to `/login` | unit (config) + e2e | `pnpm exec playwright test tests/e2e/browser-upload.spec.ts -g "sesión"` | ❌ W0 | ⬜ pending |
| AUTH-04 | Reachable at the shared URL; CSP and `clear-site-data` headers present | e2e anonymous against production | `E2E_BASE_URL=<prod> pnpm exec playwright test tests/e2e/anonymous.spec.ts` | extend ✅ | ⬜ pending |
| ING-04 | Same UUID never duplicates: stored wins (D-26), in-batch first wins | unit pipeline + contract | `pnpm vitest run tests/unit/ingest.test.ts tests/contract` | ❌ W0 | ⬜ pending |
| ING-06 | Pick/drop XML only, non-XML listed, size cap, 1,000-file cap (D-35), progress, summary counts (D-36); nothing sent to the server | unit + e2e (request sniff) | `pnpm vitest run tests/unit/ingest.test.ts tests/unit/no-network.test.ts` | ❌ W0 | ⬜ pending |
| LEDG-01 | Parse tolerance and isomorphic (browser-safe) imports | unit (01-04) + import guard | `pnpm vitest run tests/unit/cfdi-parse.test.ts tests/unit/isomorphic-imports.test.ts` | 01-04 / ❌ W0 | ⬜ pending |
| LEDG-02 | Exact decimals; 0.10 not flagged, 0.11 flagged | unit (01-04) | `pnpm vitest run tests/unit/money-recon.test.ts` | 01-04 | ⬜ pending |
| LEDG-03 | I +, E −, P 0; goldens 217,880.82 / 16,053.07 / 13,679.30 | unit + analytics | `pnpm vitest run tests/unit/spend-rules.test.ts tests/unit/analytics.test.ts` | 01-04 / ❌ W0 | ⬜ pending |
| LEDG-07 | Anonymized fixtures only | unit (leak guard) | `pnpm vitest run tests/unit/fixtures-clean.test.ts` | ✅ | ⬜ pending |
| STOR-03 | Memory fake and IndexedDB adapter pass one contract suite | contract (`describe.each`) + idb tests | `pnpm vitest run tests/contract tests/unit/idb-adapter.test.ts` | ❌ W0 | ⬜ pending |
| STOR-04 | Survives reload; wiped on sign-out, delete button, other account (D-24); IndexedDB unavailable → error (D-33) | unit + e2e | `pnpm vitest run tests/unit/browser-data.test.ts tests/unit/auth-route.test.ts` | ❌ W0 | ⬜ pending |
| DASH-04 | Ranking, top 10, monthly evolution, supplier detail, "Facturas" = I + E (D-37) | unit + e2e | `pnpm vitest run tests/unit/analytics.test.ts tests/unit/supplier-detail.test.ts` | ❌ W0 | ⬜ pending |
| DASH-09 | es-MX formatting and Spanish copy | unit + e2e text | `pnpm vitest run tests/unit/format.test.ts` | ❌ W0 | ⬜ pending |
| Security | DTD/oversize rejected; hostile name as text; nonce CSP (D-31) with no violations | unit + e2e console | `pnpm vitest run tests/unit/csp.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `idb` 8.0.4 and `fake-indexeddb` 6.2.5 installed, exact-pinned, after the package legitimacy checkpoint (D-30)
- [ ] `tests/contract/invoice-store.contract.test.ts`, `tests/unit/idb-adapter.test.ts`, memory fake
- [ ] `tests/unit/{ingest,no-network,isomorphic-imports,browser-data,auth-route,csp,entrypoints-guarded,analytics,supplier-detail,format}.test.ts`
- [ ] `tests/helpers/mint-session.ts` + canary test; Playwright `webServer.env`; `tests/e2e/browser-upload.spec.ts`
- [ ] Plan 01-04 (parser) executes first — dependency of every pipeline and analytics test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Google sign-in for owner and partner at the production URL; a third account sees "Acceso denegado" with its email (consent screen "In production", D-34) | AUTH-01, AUTH-02, AUTH-04 | Google blocks automated consent | Sign in with both allowlisted accounts and one other |
| Sliding session renewal on the deployed URL | AUTH-03 | Needs real time | Inspect `Set-Cookie` Max-Age after a second visit past the update age |
| Safari and Firefox: upload, reload persistence, logout wipe, `Clear-Site-Data` effect | STOR-04 | WebKit/Gecko not automated | Checklist on the owner's and partner's real browsers |
| Telmex / Google Ads totals against the real XMLs | LEDG-03, DASH-04 | Fiscal files never leave the machine | Upload `Facturas/2025/*.xml` in the deployed app; Telmex row $16,053.07 (7 facturas), Google Ads row $13,679.30 (11 facturas: 8 I + 3 E, per D-37) |
| Populated dashboard at 1280 px and 390 px; bar contrast | DASH-04, DASH-09 | Visual result | Visual check |
| CSP on the production dashboard with real charts | Security | Depends on the real build | DevTools console after an upload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
