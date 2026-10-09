---
phase: "01"
slug: "real-spend-by-supplier"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.3 (environment `node`); Playwright 1.64.0 for anonymous smoke |
| **Config file** | none — Wave 0 installs `vitest.config.ts` (explicit alias `@` -> `src`) |
| **Quick run command** | `pnpm vitest run tests/unit` |
| **Full suite command** | `pnpm vitest run && pnpm eslint . && pnpm tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <touched area>` (falls back to `pnpm vitest run tests/unit`)
- **After every plan wave:** Run `pnpm vitest run && pnpm eslint . && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green, plus manual UAT checklist (login, denied account, sync, dashboard) and the day-8 Drive check recorded
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs are filled in by the planner/executor; the requirement-level map below is the contract.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | AUTH-01 | — | Google login configured identity-only | unit + manual UAT | `pnpm vitest run tests/unit/auth-config.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-02 | T-01 (auth bypass) | Non-allowlisted denied on every page, action, route | unit + integration + structural | `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/entrypoints-guarded.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-03 | — | 30-day sliding session; logout clears cookie | unit + manual UAT | `pnpm vitest run tests/unit/auth-config.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-04 | — | Anonymous request redirected to /login | e2e smoke | `pnpm exec playwright test tests/e2e/anonymous.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-05 | T-01 (token theft) | `invalid_grant` maps to Spanish operator message; token never logged | unit + manual day-8/day-30 | `pnpm vitest run tests/unit/drive-errors.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ING-01 | — | Folder input parsed/validated via zod | unit | `pnpm vitest run tests/unit/settings-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ING-02 | — | Sync resumes and converges | unit | `pnpm vitest run tests/unit/sync-service.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ING-04 | — | Same UUID never duplicated | unit | `pnpm vitest run tests/unit/sync-dedupe.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LEDG-01 | T-01 (XML DoS) | DTD/ENTITY rejected; 143 fixtures + synthetic parse | unit | `pnpm vitest run tests/unit/cfdi-parse.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LEDG-02 | — | Exact decimals; recon within 0.10 | unit | `pnpm vitest run tests/unit/money-recon.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LEDG-03 | — | I +, E −, P 0; goldens 16,053.07 / 13,679.30 / 217,880.82 | unit | `pnpm vitest run tests/unit/spend-rules.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LEDG-07 | T-01 (secrets in git) | No real RFC/UUID/name in fixtures; count == 143 | unit | `pnpm vitest run tests/unit/fixtures-clean.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STOR-01 | T-01 (tampering) | State only under `_app/`, zod-validated before write | contract | `pnpm vitest run tests/contract` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STOR-03 | — | Same behavior on memory fake and Drive-backed repo | contract | `pnpm vitest run tests/contract` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASH-04 | T-01 (XSS) | Ranking/monthly evolution goldens; names rendered escaped | unit + manual UAT | `pnpm vitest run tests/unit/analytics.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DASH-09 | — | es-MX MXN formatting; `lang="es-MX"` | unit | `pnpm vitest run tests/unit/format.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts`, `tests/` tree, `package.json` scripts (`test`, `lint`, `typecheck`, `drive:auth`, `fixtures:build`, `spike:drive`)
- [ ] `scripts/build-fixtures.ts` + committed `tests/fixtures/cfdi/*.xml` (143 anonymized) + `tests/fixtures/synthetic/*.xml`
- [ ] `FakeDriveApi` in-memory adapter (folders, md5, modifiedTime, trashed, pagination, injected failures/latency)
- [ ] Contract suite shared by memory and Drive-backed repositories
- [ ] Playwright config + anonymous smoke spec (baseURL from env)
- [ ] Framework install: `pnpm add -D vitest@5.0.3 @vitest/coverage-v8@5.0.3 @playwright/test@1.64.0 tsx`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Google sign-in for owner and partner | AUTH-01, AUTH-04 | Google blocks automated consent | Sign in at the Vercel URL with both allowlisted accounts; confirm no unverified-app warning for the partner |
| Denied account sees "Acceso denegado" with its email | AUTH-02 | Needs a real non-allowlisted Google account | Sign in with a third account; every page and `/api/*` route denies |
| Session survives refresh; logout works | AUTH-03 | Real cookie lifecycle in browser | Refresh, close/reopen browser, click logout |
| Drive keeps working after 7 and 30 days | AUTH-05 | Only provable by waiting | Run a sync on day 8 and day 30 after minting the token; record in STATE.md |
| Dashboard renders ranking + monthly evolution | DASH-04 | RSC render not unit-testable | Sync the 2025 sample; compare Telmex and Google Ads to goldens |
| Drive `If-Match` probe outcome | — (spike) | Needs owner credentials | Run `pnpm spike:drive`; record outcome in PROJECT.md Key Decisions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
