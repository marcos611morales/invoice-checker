---
phase: 01-real-spend-by-supplier
plan: 01
subsystem: auth
tags: [nextjs-16, better-auth, google-oauth, stateless-session, allowlist, vitest, playwright, shadcn, tailwind-4, pnpm]

requires: []
provides:
  - "Pinned Next 16.4.0 / TS 6.0.3 / ESLint 9.39.5 toolchain on pnpm 11.5.2 with every Phase 1 package installed behind the Task 1 legitimacy gate"
  - "Stateless Better Auth (JWE cookie, 30d sliding, 365d cap), identity-only Google sign-in"
  - "DAL: getAccess, requireUser, requireUserApi, apiGateFor; allowlist decision recomputed on every call"
  - "Spanish /login, /acceso-denegado and signed-in shell with logout"
  - "Vitest + Playwright harness, shadcn (Radix, neutral) component baseline, all Phase 1 pnpm scripts declared"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

actuals:
  tokens: 17600
  tasks: 3
  commits: 3
plan_head_before: 67151bb4ee9d6575f797ff96a7605e48a67300cb
plan_head_after: 1422f67217527d0ba39e2fa57fe63ca9757a4f8f

tech-stack:
  added:
    - "next 16.4.0, react/react-dom 19.3.0, typescript 6.0.3, eslint 9.39.5, typescript-eslint 8.71.1"
    - "better-auth 1.7.7, @googleapis/drive 26.0.2, google-auth-library 11.2.0"
    - "fast-xml-parser 5.11.2, zod 4.6.5, decimal.js 10.6.0, @t3-oss/env-nextjs 0.13.11, server-only 0.0.1"
    - "p-limit 7.3.3, p-retry 8.0.1, recharts 3.10.1, react-is 19.3.0"
    - "tailwindcss 4.3.3 + @tailwindcss/turbopack 4.3.3, shadcn 4.21.4 (radix-ui 1.7.0, lucide-react 1.53.0, clsx 2.1.1, tailwind-merge 3.7.0, class-variance-authority 0.7.1, tw-animate-css 1.4.0, sonner 2.0.8)"
    - "vitest 5.0.3, @vitest/coverage-v8 5.0.3, @playwright/test 1.64.0, tsx 4.23.15, prettier 3.9.9, prettier-plugin-tailwindcss 0.8.1, eslint-config-prettier 10.1.8"
  patterns:
    - "Identity plane only at login (openid email profile); Drive is a separate owner credential (D-01)"
    - "Every page and layout calls requireUser(); route handlers call requireUserApi(); no middleware.ts"
    - "Pure access decision (allowlist.ts) separated from the server-only DAL (require-user.ts)"
    - "buildAuthOptions(env, extraPlugins) is the single source of Better Auth config, reused by tests with testUtils()"

key-files:
  created:
    - src/env.ts
    - src/auth/auth-config.ts
    - src/auth/auth.ts
    - src/auth/client.ts
    - src/auth/allowlist.ts
    - src/auth/require-user.ts
    - src/app/api/auth/[...all]/route.ts
    - src/app/layout.tsx
    - src/app/(app)/layout.tsx
    - src/app/(app)/page.tsx
    - src/app/(public)/login/page.tsx
    - src/app/(public)/acceso-denegado/page.tsx
    - src/components/auth/auth-buttons.tsx
    - src/components/ui/ (chart, table, card, button, select, badge, skeleton, progress, sonner, input, label, alert, separator)
    - src/lib/utils.ts
    - tests/e2e/anonymous.spec.ts
    - tests/unit/allowlist.test.ts
    - tests/unit/auth-config.test.ts
    - tests/unit/require-user.test.ts
    - tests/stubs/server-only.ts
    - vitest.config.ts
    - playwright.config.ts
    - components.json
    - .env.example
  modified:
    - .gitignore
    - package.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - next.config.ts
    - tsconfig.json
    - eslint.config.mjs
    - src/app/globals.css

key-decisions:
  - "Tailwind wiring actually used: the scaffold's @tailwindcss/turbopack loader rule in next.config.ts. shadcn init 4.21.4 recognised it ('Validating Tailwind CSS. Found v4'), so assumption A7 held and the @tailwindcss/postcss fallback was NOT needed"
  - "apiGateFor lives in src/auth/require-user.ts (not moved to allowlist.ts). Importing that module under Vitest works because the test replaces its four edges (@/auth/auth, @/env, next/headers, next/navigation) with vi.mock"
  - "shadcn 4.21.4 generates @/lib/utils from the new `cn` npm package and sonner from `next-themes`; neither is on the approved list, so utils.ts uses the approved clsx + tailwind-merge pair and sonner.tsx drops next-themes"
  - "pnpm 11.5.2 (packageManager) is auto-selected by the global pnpm 12.10.1 when run directly in the repo; corepack was not needed"
  - "esbuild's postinstall is left blocked (allowBuilds esbuild: false) because tsx, Vitest and Playwright all run without it"
  - "Allowlist and session policy are config values proven by unit tests; sliding renewal and real Google sign-in are observed on the deployed URL in Plan 01-05"

patterns-established:
  - "Exact pins only (no ^) for every dependency; re-pin after any shadcn command because it rewrites ranges and can bump recharts"
  - "tsconfig has types:['node'] (TypeScript 6 no longer auto-includes @types); LayoutProps globals are avoided so typecheck works before the first build"
  - "Tests that need Better Auth sessions use testUtils() in-process only; never mint cookies for Playwright"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, DASH-09]

coverage:
  - id: D1
    description: "Anonymous visitor to / is redirected (307) to /login"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/anonymous.spec.ts#anonymous GET / is redirected (307) to /login"
        status: pass
    human_judgment: false
  - id: D2
    description: "/login shows 'Iniciar sesión con Google' inside <html lang=es-MX>"
    requirement: "DASH-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/anonymous.spec.ts#/login shows the Spanish Google button under lang es-MX"
        status: pass
    human_judgment: false
  - id: D3
    description: "Google consent URL requests identity scopes only (no drive scope)"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/anonymous.spec.ts#Google sign-in asks for identity scopes only (no drive)"
        status: pass
      - kind: unit
        ref: "tests/unit/auth-config.test.ts#asks Google for identity only: account picker and no extra scopes"
        status: pass
    human_judgment: false
  - id: D4
    description: "Allowlist matching is lowercase/trim exact and requires emailVerified; alias a+1@x.com never matches a@x.com"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "tests/unit/allowlist.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Allowlist decision is recomputed on every request: the same valid session is denied on the next call after its email leaves ALLOWED_EMAILS; concurrent evaluations are independent"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "tests/unit/require-user.test.ts#denies the SAME valid session on the next call once the email leaves the allowlist"
        status: pass
      - kind: integration
        ref: "tests/unit/require-user.test.ts#evaluates concurrent requests independently"
        status: pass
    human_judgment: false
  - id: D6
    description: "Route handler gate: requireUserApi/apiGateFor returns 401 no_autenticado or 403 acceso_denegado JSON with Spanish mensaje"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "tests/unit/require-user.test.ts#apiGateFor (route handler gate)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Session is a stateless JWE cookie, 30-day sliding window, 365-day cap"
    requirement: "AUTH-03"
    verification:
      - kind: unit
        ref: "tests/unit/auth-config.test.ts#slides a 30-day JWE cookie cache, refreshing after 1 day (29-day updateAge)"
        status: pass
    human_judgment: true
    rationale: "Config values are asserted, but real renewal (Set-Cookie Max-Age after a second request) needs the deployed URL; observed in Plan 01-05"
  - id: D8
    description: "/acceso-denegado page renders 'Acceso denegado', 'Tu cuenta {email} no tiene acceso', 'Cerrar sesión' and 'Usar otra cuenta' for a signed-in non-allowlisted account, and imports no data module"
    requirement: "AUTH-02"
    verification: []
    human_judgment: true
    rationale: "Real Google sign-in cannot be automated and minted cookies are not portable in stateless mode, so the rendered denied page is only checked by source greps here; confirmed by the end-of-phase UAT in Plan 01-05"
  - id: D9
    description: "Real Google sign-in for an allowlisted account lands on / and shows its email; 'Cerrar sesión' ends the session and returns to /login"
    requirement: "AUTH-01"
    verification: []
    human_judgment: true
    rationale: "Needs real Google credentials (Plan 01-02) and a browser; covered by the end-of-phase UAT human check in Plan 01-05"
  - id: D10
    description: "Toolchain typechecks, lints and builds on the pinned versions with the two forbidden scaffold flags removed"
    verification:
      - kind: other
        ref: "pnpm typecheck && pnpm lint && pnpm build"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-09
status: complete
---

# Phase 1 Plan 01: Pinned toolchain and allowlisted Google sign-in Summary

**Next 16.4 app on the pinned stack with stateless Better Auth Google login (identity scopes only, 30-day sliding JWE session), a per-request email-allowlist DAL, Spanish login/access-denied pages and tested 401/403 API gates**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-09T22:48:00Z (approximate; start time was not captured at spawn)
- **Completed:** 2026-10-09T22:59:35Z
- **Tasks:** 3 (Task 1 was the legitimacy gate, resolved by the user before this run; Tasks 2 and 3 executed here)
- **Files modified:** 52 (55 including this summary)

## Accomplishments

- Scaffolded the app on the pinned toolchain after the human package-legitimacy approval, with `cacheComponents` and `partialPrefetching` removed, no `middleware.ts`, `lang="es-MX"` and every Phase 1 script declared once in `package.json`.
- Tracer slice proven end to end on a production build: anonymous `/` gives 307 to `/login`, the login page is Spanish, and the Google consent URL carries `email` but never `drive` (3 Playwright tests pass).
- Access control: `ALLOWED_EMAILS` is server-only, matched lowercase/trim and exact, requires `emailVerified`, and is recomputed on every call. 23 Vitest tests pass, including an in-process Better Auth test where the same session flips from allowed to denied when the allowlist changes.
- Added the `/acceso-denegado` page (shows only the account's own email, with "Cerrar sesión" and "Usar otra cuenta") and the 401/403 `apiGateFor` JSON gate for route handlers.

## Task Commits

1. **Task 1: Package legitimacy gate** - no commit (checkpoint resolved by the user: "aprobado", full list kept)
2. **Task 2: Tracer (sign-in slice on the pinned toolchain)** - `e04a618` (feat)
3. **Task 3: Deny path and DAL contract** (TDD)
   - tests: `14f3be5` (test)
   - page: `1422f67` (feat)

**Plan metadata:** committed separately as `docs(01-01): complete ... plan` (SUMMARY only; STATE.md and ROADMAP.md are owned by the orchestrator).

## Tracer feedback gate

Task 2's `<verify>` carries only `<automated>` checks and no `<human-check>`. It was re-run end to end (typecheck, lint, build, Playwright 3 passed, structural greps) after the last change in the task and again after Task 3. Verified end-to-end, expansion continued. Real Google sign-in is deliberately deferred to Plan 01-02/01-05.

## Files Created/Modified

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` - exact pins, Phase 1 scripts, `engines.node: 24.x`, `packageManager: pnpm@11.5.2`
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` - toolchain config (strict TS flags, type-aware ESLint, `server-only` alias for tests, production-build Playwright server)
- `src/env.ts` - server-only zod env (no client variables)
- `src/auth/auth-config.ts`, `auth.ts`, `client.ts`, `route.ts` - stateless Better Auth setup
- `src/auth/allowlist.ts` - pure `parseAllowlist` and `evaluateAccess`
- `src/auth/require-user.ts` - `getAccess`, `requireUser`, `requireUserApi`, `apiGateFor`
- `src/app/layout.tsx`, `(app)/layout.tsx`, `(app)/page.tsx`, `(public)/login/page.tsx`, `(public)/acceso-denegado/page.tsx` - Spanish pages
- `src/components/auth/auth-buttons.tsx` - `SignInButton`, `SignOutButton`, `SwitchAccountButton`
- `src/components/ui/*`, `src/lib/utils.ts`, `components.json`, `src/app/globals.css` - shadcn baseline
- `tests/unit/*.test.ts`, `tests/e2e/anonymous.spec.ts`, `tests/stubs/server-only.ts` - test suite
- `.env.example` (committed), `.env.local` (git-ignored, never committed)

## Decisions Made

- Tailwind wiring used: the scaffold's `@tailwindcss/turbopack` loader rule (no `postcss.config.mjs`). shadcn init accepted it, so the plan's pre-authorized `@tailwindcss/postcss` fallback was not used.
- `apiGateFor` stays in `src/auth/require-user.ts`; the unit test mocks the module's four runtime edges instead of relocating the function.
- Replaced shadcn-generated `cn` and `next-themes` usage with the approved `clsx` + `tailwind-merge` pair (see Deviations).
- TypeScript 6 needs `types: ["node"]`; `LayoutProps` (a build-generated global) is avoided so `pnpm typecheck` works on a fresh clone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] packageManager pinned to pnpm@11.5.2 instead of keeping the scaffold value**
- **Found during:** Task 2 (scaffold)
- **Issue:** The plan says to keep `pnpm@11.5.2` "from the scaffold", but create-next-app wrote `pnpm@12.10.1` (the global version).
- **Fix:** Set `"packageManager": "pnpm@11.5.2"` (CLAUDE.md pin). The global pnpm 12 switches to 11.5.2 automatically when run in the repo, so corepack was not needed.
- **Files modified:** package.json
- **Committed in:** e04a618

**2. [Rule 3 - Blocking] `--save-exact` did not produce exact pins**
- **Found during:** Task 2 (install)
- **Issue:** pnpm 11 wrote `^` ranges for the packages added with `--save-exact`, and shadcn commands also wrote `^` ranges.
- **Fix:** Rewrote every range to the exact resolved version and ran `pnpm install` to refresh the lockfile. `package.json` has no `^` left.
- **Files modified:** package.json, pnpm-lock.yaml
- **Committed in:** e04a618

**3. [Rule 2 - Missing Critical] Two unapproved packages pulled in by shadcn were removed**
- **Found during:** Task 2 (`shadcn init` and `shadcn add`)
- **Issue:** shadcn 4.21.4 added `cn@0.4.0` (npm package from shadcn-ui/cn, generated `export { cn } from "cn"` and all component imports) and `next-themes@0.4.6` (used by `sonner.tsx`). Neither is on the Task 1 list the user approved.
- **Fix:** Removed both with `pnpm remove`; `src/lib/utils.ts` now implements `cn` with the approved `clsx` + `tailwind-merge`; all `from "cn"` imports point to `@/lib/utils`; `sonner.tsx` uses `theme="system"` without `useTheme`. Pinned `clsx@2.1.1`, `tailwind-merge@3.7.0`, `class-variance-authority@0.7.1`, `sonner@2.0.8` (the stack table versions).
- **Files modified:** package.json, src/lib/utils.ts, src/components/ui/*.tsx
- **Committed in:** e04a618
- **Note for the user:** if you prefer shadcn's `cn` package or `next-themes` (dark-mode toggle later), say so; both are official shadcn-ecosystem packages but were outside the approved list.

**4. [Rule 1 - Bug] `shadcn add chart` downgraded recharts to 3.8.0**
- **Found during:** Task 2 (`pnpm list --depth 0` check)
- **Issue:** The approved and pinned version is 3.10.1; the chart registry item installed 3.8.0.
- **Fix:** `pnpm add --save-exact recharts@3.10.1`; later plans must re-check this after any `shadcn add`.
- **Committed in:** e04a618

**5. [Rule 3 - Blocking] pnpm 11 treats an ignored build script as an error**
- **Found during:** Task 2 (installing tsx/vitest)
- **Issue:** `ERR_PNPM_IGNORED_BUILDS: esbuild@0.28.2` made every `pnpm` command fail until a decision was recorded. This is the situation the continuation instruction covers.
- **Fix:** Checked whether it is REQUIRED: `tsx`, Vitest and Playwright all run with esbuild's postinstall blocked (it only verifies/optimizes the platform binary, which ships as `@esbuild/darwin-arm64`). So no checkpoint was needed. Recorded `esbuild: false` (blocked, not allow-listed) in `pnpm-workspace.yaml`, next to the scaffold's `sharp: false` and `unrs-resolver: false`. pnpm also added `@types/node@24.19.2` to `minimumReleaseAgeExclude` there.
- **Files modified:** pnpm-workspace.yaml
- **Committed in:** e04a618

**6. [Rule 3 - Blocking] TypeScript 6 and the build-generated `LayoutProps` global**
- **Found during:** Task 2 (`pnpm typecheck`)
- **Issue:** `LayoutProps<"/">` from the scaffold only exists after a build, so `pnpm typecheck` failed on a fresh checkout; TS 6 also no longer auto-includes `@types/node`.
- **Fix:** Root layout uses `{ children: React.ReactNode }`; `tsconfig.json` sets `"types": ["node"]`. The tsconfig `target` was also raised from the scaffold's ES2017 to ES2022 (Node 24 runtime, no downlevel needed).
- **Files modified:** src/app/layout.tsx, tsconfig.json
- **Committed in:** e04a618

**7. [Rule 3 - Blocking] Playwright browser revision**
- **Found during:** Task 2 (first e2e run)
- **Issue:** @playwright/test 1.64.0 wants chromium headless shell revision 1248, not the cached 1228.
- **Fix:** Ran the pre-authorized `pnpm exec playwright install chromium`.

**8. [Rule 1 - Bug] testUtils typing under `exactOptionalPropertyTypes`**
- **Found during:** Task 3 (typecheck of the integration test)
- **Issue:** `testUtils()` is not assignable to `BetterAuthPlugin` with `exactOptionalPropertyTypes: true`, and `buildAuthOptions` returns plain `BetterAuthOptions`, so `$context.test` has no static type.
- **Fix:** Two documented `as unknown as` casts confined to `tests/unit/require-user.test.ts` (plugin widening and `{ test: TestHelpers }`). No production code was loosened.
- **Committed in:** 14f3be5

**9. [Rule 1 - Bug] Comment tripped the "no database key" acceptance grep**
- **Found during:** Task 2 acceptance check
- **Issue:** A doc comment in `auth-config.ts` contained the word `database`, so `grep database` matched.
- **Fix:** Reworded the comment ("no persistence adapter configured"). The options object has no `database` key (also asserted by a unit test).
- **Committed in:** e04a618

### TDD gate note (Task 3, `tdd="true"`)

`parseAllowlist`, `evaluateAccess`, `buildAuthOptions` and `apiGateFor` were delivered by the Task 2 tracer (the plan assigns them there), so the Task 3 tests were green on first run: there is no genuine RED state to record, and the "must fail first" rule could not be followed literally. The plan itself is `type: execute`, not `type: tdd`, so no plan-level gate applies. To keep the intent (each test discriminates), every rule was mutated in the production code, the suite was run, and the code was restored (source was byte-identical afterwards):

| Mutation | Tests that failed |
|----------|-------------------|
| drop `emailVerified` check | unit "denies a listed email that is not verified" and integration "denies an unverified user..." |
| remove `.toLowerCase()` | "allows ... regardless of case" and "denies an unlisted email and carries its lowercase form" |
| strip `+tag` aliases before matching | "matches exactly: an alias a+1@x.com is not a@x.com" |
| memoize allowed emails across calls | 5 tests incl. "denies the SAME valid session on the next call..." and "evaluates concurrent requests independently" |
| `cookieCache.maxAge` 30d to 7d | "slides a 30-day JWE cookie cache..." |
| add a `drive` scope to the Google provider | "asks Google for identity only..." |
| return 403 instead of 401 for anonymous | "answers 401 no_autenticado..." |

### Minor notes

- `SwitchAccountButton` ("Usar otra cuenta") was added to `auth-buttons.tsx` in Task 2 rather than Task 3, since the file was written once.
- `README.md` and `AGENTS.md` from the scaffold are committed (AGENTS.md was requested; README is the stock scaffold text).
- `vitest.config.ts` prints a Vite notice that it is loaded as CommonJS because `package.json` has no `"type": "module"`. Cosmetic; not changed because adding `"type": "module"` affects the whole toolchain.
- `lucide-react` resolved to 1.53.0 (shadcn's dependency range); the CLAUDE.md table lists 1.54.0. It was not in the approved explicit pin list.

---

**Total deviations:** 9 auto-fixed (1 Rule 2, 4 Rule 1, 4 Rule 3 style blocking fixes) plus the TDD note
**Impact on plan:** No scope creep. Items 3 and 5 are supply-chain related and are surfaced for the user; everything else is toolchain friction with the newer pnpm 11 / TypeScript 6 / shadcn 4 releases.

## Issues Encountered

- A Bash PreToolUse hook blocks any command that names `.env.local`, so `git check-ignore -q .env.local` could not be run. Instead `git status --short` shows `.env.local` is not listed (ignored) and `.env.example` is committed (`git check-ignore -q .env.example` exits 1).
- The throwaway `BETTER_AUTH_SECRET` for local runs was generated with `openssl rand -base64 32` and printed once to the tool output so it could be written with the Write tool; it is a local-only test value in a git-ignored file and Plan 01-02 replaces it.

## Authentication Gates

None encountered. The Google credentials in `.env.local` are fake test values (`test-client-id...`); real sign-in is Plan 01-02/01-05.

## User Setup Required

None for this plan. Plan 01-02 collects the real Google OAuth client and the owner Drive token.

## Known Stubs

None. `src/app/(app)/page.tsx` renders a fixed Spanish hint ("Siguiente paso: elegir la carpeta de facturas en Ajustes.") as specified by the plan; the Ajustes screen arrives in a later plan.

## Threat Flags

None beyond the plan's threat register (T-01-01..T-01-05, T-01-SC). T-01-01 is implemented by `requireUser()` in every page and layout and by `requireUserApi()`; the structural test that enforces it for every future route is Plan 01-09.

## Next Phase Readiness

- Ready for Plan 01-02: `package.json` is single-owner with all scripts declared, `buildAuthOptions`, the DAL and the env schema (with optional `DRIVE_*` keys) are in place.
- Carry-forward: re-pin after any `shadcn` command (it rewrites ranges and can change `recharts`), keep `@/lib/utils` as the `cn` source, and the real Google sign-in, logout and sliding renewal still need the Plan 01-05 deployed UAT.

## Verification Results (plan-level)

- `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm build` exit 0 (routes: `/`, `/login`, `/acceso-denegado`, `/api/auth/[...all]`).
- `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/auth-config.test.ts tests/unit/require-user.test.ts`: 3 files, 23 tests passed.
- `pnpm exec playwright test tests/e2e/anonymous.spec.ts`: 3 passed against `pnpm start`.
- Task 2 structural greps: no `cacheComponents`/`partialPrefetching`, no `src/middleware.ts`, `.gitignore` contains `Facturas` and `!.env.example`, `lang="es-MX"`, `import "server-only"` in `src/env.ts`, `src/auth/auth.ts`, `src/auth/require-user.ts`.
- Manual curl on the production server: `/` and `/acceso-denegado` give 307 to `/login` for anonymous visitors.

## Self-Check: PASSED

- Files exist: `src/auth/auth-config.ts`, `src/auth/allowlist.ts`, `src/auth/require-user.ts`, `src/env.ts`, `src/app/(public)/acceso-denegado/page.tsx`, `tests/e2e/anonymous.spec.ts`, `tests/unit/*.test.ts` (verified before commit).
- Commits reachable from HEAD: `e04a618`, `14f3be5`, `1422f67`.

---
*Phase: 01-real-spend-by-supplier*
*Completed: 2026-10-09*
