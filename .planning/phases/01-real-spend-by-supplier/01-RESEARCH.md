# Phase 1: Real Spend by Supplier - Research

**Researched:** 2026-10-09
**Domain:** Next.js 16 / Vercel walking skeleton: Google login with email allowlist, owner-token Google Drive access, resumable CFDI 4.0 sync, exact-decimal ledger, Spanish dashboard, JSON state in Drive behind a storage port
**Confidence:** MEDIUM-HIGH (parser, data profile, Better Auth stateless mechanics and scaffold facts are first-hand HIGH; Google-side behaviors (token longevity, `If-Match`, pointer lookup) cannot be proven without the owner's credentials and are scheduled as human-run spikes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Drive connection
- **D-01:** The owner authorizes Drive once with a **local script** (`pnpm drive:auth`, loopback consent). The script prints the refresh token, which is pasted into a Vercel env var. The token never passes through the app UI, and there is no in-app "Conectar Drive" button.
- **D-02:** The invoice folder is configured **in the app**. A "Ajustes" screen accepts a pasted Drive folder link or ID. It validates that the folder exists and is readable, shows how many XML files it sees (including year subfolders), and saves the folder ID. By default it looks for a folder named `Facturas/`. This replaces the research's `DRIVE_ROOT_FOLDER_ID` env var as the source of truth. An env var may still seed the initial default.
- **D-03:** All app state lives in **`<chosen folder>/_app/`**, where it is visible and can be backed up. Only the folder ID is stored somewhere fixed: a tiny bootstrap pointer the app can find before it knows the folder. Where that pointer lives is Claude's discretion; see below. Changing the folder means starting from the state in the new folder's `_app/`. — **Reversibility:** costly — moving state later means migrating the `_app/` files and the pointer format.
- **D-04:** **Both** allowlisted users can change the folder. No roles in v1.

### Sync
- **D-05:** Sync is **manual**. A "Sincronizar" button shows the time of the last sync. The dashboard loads instantly from the stored JSON, and nothing syncs automatically on page load.
- **D-06:** Progress shows a **bar and a counter** ("Importando 87 de 143…"). If a batch hits the function time budget, the client automatically calls the next batch until nothing remains. At the end it shows a summary: new, unchanged, with problems.
- **D-07:** A file that fails to parse is **skipped and listed** with a reason, such as "no se pudo leer", "tipo N/T omitido" or "total no cuadra". The sync never aborts because of one bad file. The full data-quality panel is Phase 4; Phase 1 only shows the list in the sync summary.
- **D-08:** If an invoice parses but its concepts don't reconcile with its `Total` (difference > $0.10), it **still counts, using the XML header `Total`**, and is flagged in the problem list.
- **D-09:** Sync **mirrors Drive**. A modified file is re-parsed, and a file deleted or trashed in Drive disappears from the dataset. The same UUID never creates a duplicate (ING-04).
- **D-10:** First run shows **guided steps** in an empty state: 1) elegir carpeta, 2) Sincronizar. The user never sees an empty dashboard full of zeros.

### Supplier view
- **D-11:** The supplier ranking is a **horizontal bar chart of the top 10**, with a **full table** below it. Columns: proveedor, gasto, % del total, número de facturas. The sample has 39 issuer RFCs, so the table matters.
- **D-12:** Suppliers are **grouped by emisor RFC** and labeled with the emisor `Nombre` from their most recent invoice. The RFC appears small and grey under the name.
- **D-13:** The page has a **total spend by month** bar chart at the top. Clicking a supplier opens its detail with **monthly bars** for that supplier. This detail is in-app navigation, not the Phase 2 invoice drill-down.
- **D-14:** The period is a simple **year selector**, defaulting to the most recent year with data. Phase 2 extends it to month, quarter and custom range and moves filters into the URL.
- **D-15:** Phase 1 amounts are the **XML `Total` (taxes included)**, with a visible "con IVA" label. This matches each invoice 1:1, and the success criterion "Telmex / Google Ads totals match their XMLs". Egresos subtract their Total and Pagos add 0. In Phase 2 the "sin IVA" default and the toggle replace this.

### Access & session
- **D-16:** The allowlist is the **`ALLOWED_EMAILS` env var**, server-side only, and cannot be edited from the app.
- **D-17:** A non-allowlisted Google account sees an **"Acceso denegado"** page in Spanish that shows their email ("tu cuenta x@gmail.com no tiene acceso"), with a button to sign out or try another account. No usable session is created.
- **D-18:** Sessions last **30 days and slide with use**, so active users never see the login again. There is also a logout button (AUTH-03).
- **D-19:** The allowlist is **checked on every request**: pages, Server Actions and Route Handlers, through a DAL helper, not just `proxy.ts`. Removing an email revokes access on that person's next request, even if their session cookie is still valid.

### Claude's Discretion
- Where the D-03 bootstrap pointer lives. Options include a small config file at My Drive root, Drive `appDataFolder` (needs the `drive.appdata` scope), or an Edge Config/env fallback. It must work with the owner's token and survive redeploys.
- The exact sync batch size and time budget, the manifest diff strategy and the JSON shard layout. The research proposes `manifest.json`, `invoices-YYYY.json` and `_app/settings.json`.
- How fixtures are anonymized for LEDG-07: replace RFCs, names and UUIDs while keeping structure, BOM, namespaces and amounts. No real fiscal file is committed.
- Visual design details: navigation, chart colors and the spacing of the Spanish copy. The defaults are shadcn and Recharts.

### Deferred Ideas (OUT OF SCOPE)
None. The discussion stayed within phase scope. Items already owned by later phases are listed under Phase Boundary:
- Period filters, the IVA toggle, drill-down, PDF pairing and the LEDG-04/05/06 chains and buckets (Phase 2).
- Categories (Phase 3).
- The review panel, upload and Excel export (Phase 4).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Sign in with Google | Better Auth 1.7.7 stateless + Google, identity scopes only (`openid email profile`); config in "Code Examples" |
| AUTH-02 | Allowlist on every page, action and API route | `requireUser()` DAL + structural test that every `page.tsx`/`route.ts`/action calls it; `proxy.ts` redirect only |
| AUTH-03 | Session persists across refresh; logout button | Stateless cookie session; **sliding needs `cookieCache.maxAge`=30d + client keep-alive** (verified in Better Auth source, see Pitfall 2) |
| AUTH-04 | Deployed on Vercel at a shared URL | Stable `*.vercel.app` production URL; Google redirect URI registration; env var list; tracer slice deploys on day 1 |
| AUTH-05 | Drive keeps working >=30 days without re-auth | Owner refresh token in env var via Desktop OAuth client; consent screen "In production" BEFORE minting; day-8 and day-30 human checks; `/api/health/drive` diagnostic |
| ING-01 | Configure Drive folder (default `Facturas/`) | Ajustes action: URL/ID parse, `files.get` validate, XML count via BFS listing; pointer file at My Drive root + env seed |
| ING-02 | Sync with progress, resumable | Stateless-resume sync: relist + diff vs manifest each call, bounded batch, client loop; budgets in "Sync design" |
| ING-04 | Same UUID never duplicates | UUID-keyed canonical record, `duplicate` manifest status, re-evaluation rule when canonical file disappears |
| LEDG-01 | Parse CFDI 4.0 tolerant of BOM, prefixes, single concept, no declaration, unknown complements | fast-xml-parser config verified on all 143 real files; DTD guard verified necessary; synthetic fixtures needed for prefix/complement cases |
| LEDG-02 | Exact decimals; reconcile within $0.10 | decimal.js 10.6.0; measured max concept-level diff 0.01 and header formula exact on 143/143 |
| LEDG-03 | I adds, E subtracts, P zero, N/T omitted and reported | Discriminated union by `TipoDeComprobante`; golden anchors from sample (Telmex, Google Ads) |
| LEDG-07 | Parser covered by anonymized fixtures | Anonymizer prototype run: 143 files, 39 issuers preserved, 0 leaks, same totals; method in "Fixture anonymization" |
| STOR-01 | All state is JSON in Drive `_app/` | Layout: pointer + `_app/manifest.json` + `_app/invoices-YYYY.json` |
| STOR-03 | Storage behind an interface; in-memory fake | Ports + `FakeDriveApi` + contract test suite run against both memory and Drive-backed adapters |
| DASH-04 | Supplier ranking and monthly evolution | Pure analytics functions over the dataset; shadcn chart (Recharts 3); `Intl` es-MX |
| DASH-09 | Spanish UI with MXN formatting | `Intl.NumberFormat("es-MX")` verified output; `<html lang="es-MX">`; copy list |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `./.claude/CLAUDE.md` (provided in session context). Treat as locked.
- Next.js + TypeScript **strict**, **pnpm** only. Node 24.x (`engines.node: "24.x"`). Pins: Next 16.4.0, React 19.3.0, **TypeScript 6.0.3** (not 7), **ESLint 9.39.5** (not 10), typescript-eslint 8.71.1 (`strictTypeChecked` + `stylisticTypeChecked`), Vitest 5.0.3, Playwright 1.64.0, `@types/node` 24.19.x.
- Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Forbidden:** `middleware.ts` (use `proxy.ts` for redirects only), `next lint` (run `eslint .`), the `googleapis` monolith (use `@googleapis/drive`), float money (strings in, `Decimal` for math, round only on output), Server Actions for file upload, sync `cookies()/headers()/params` (always `await`), `cacheComponents`/React Compiler in v1, `next-auth@4`, `@cfdi/*`, `@nodecfdi/*`, Tremor, SheetJS from npm.
- Security: tokens and API keys server-only (`import "server-only"` in every module that touches them), allowlist on every entry point, httpOnly/secure/SameSite cookies, never log tokens.
- UI: Spanish (México), `<html lang="es-MX">`, `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`; shadcn **Radix** flavor; charts get **pre-aggregated serializable data** (cents-rounded numbers, `YYYY-MM` keys) from Server Components, never raw invoices.
- Storage: no DB; storage abstracted; **no `corrections.json` single-file overwrite** (Phase 3 concern, but the Phase 1 port must not make it the only option).
- CFDI `Fecha` is local time without offset: never convert through `new Date()`/UTC; bucket by string slice.
- GSD workflow: all repo edits go through a GSD command.

## Summary

Phase 1 is well-bounded and buildable on the pinned stack. I resolved everything that can be resolved without the owner's Google credentials, and turned the rest into **human-run spikes with explicit pass/fail criteria**. The parser and ledger are the lowest-risk part: the STACK.md `fast-xml-parser` configuration parsed all 143 real files, and a concept-level reconciliation (sum of `Importe - Descuento` plus line taxes) matches the header `Total` within **$0.01 max** on every non-Pago file. The riskiest parts are Google-side: token longevity (AUTH-05) and Drive write concurrency. Both are mostly **Phase 3 / day-8 concerns**, so Phase 1 can proceed safely if it builds the port correctly and starts the 7-day clock on day 1.

D-01 changes the credential architecture relative to prior research: Better Auth becomes **identity-only** (scopes `openid email profile`), and Drive is reached with a plain `google-auth-library` `OAuth2Client` holding the owner's refresh token from env vars. That deletes most of "Spike 1" from STACK.md (no `account_data` cookie, no `getAccessToken`, no per-user Drive token). What remains testable offline I tested: Better Auth stateless mode boots without a database, `databaseHooks.user.create.before` fires without a database and can abort creation, and the `testUtils` plugin mints sessions (in-process only). One finding contradicts the prior plan: **in stateless mode the embedded session `expiresAt` is not extended by the refresh path**, so "30 days sliding" needs `session.cookieCache.maxAge = 30 days` (inactivity window), a long `session.expiresIn` (absolute cap), and a small client keep-alive call, because Server Components cannot set cookies.

The sync is designed as **stateless-resume**: every call relists the Drive tree (a handful of requests), diffs against `_app/manifest.json`, processes a bounded batch, persists, and returns `remaining`. Resuming after a cut-off is therefore the same code path as a normal second call. At this volume (143 XML at ~6 KB, ~4 list calls) the whole initial sync will likely finish in one or two invocations, so batch size and budget are made injectable so tests can force many resumes.

**Primary recommendation:** Build a thin vertical tracer first (scaffold in a temp dir and copy in, minimal Better Auth login + `requireUser()`, `drive:auth` script, Ajustes page that lists the chosen folder's XML count via the owner token, deployed to Vercel), and **mint the production-status refresh token on day 1** so AUTH-05 can be checked at day 8 and day 30. Build the pure parser/ledger and fixtures in parallel (no auth dependency), then ports/fakes, then sync, then dashboard.

### Disagreements with prior research (with evidence)

| # | Prior research says | Finding | Evidence |
|---|---------------------|---------|----------|
| 1 | STACK: Better Auth carries Drive scope + `getAccessToken({useAccountCookie})`; "document the warning screen for the partner" | D-01 supersedes: Better Auth is identity-only; Drive plane is env refresh token. The partner requests only `openid email profile`, which Google documents as not triggering the unverified-app screen (screen is for sensitive/restricted scopes) | CONTEXT D-01; [CITED: support.google.com/cloud/answer/15549945] |
| 2 | STACK sample config `cookieCache.maxAge: 7 days` | Sliding 30 days is not achievable with that. Refresh path re-signs the cookie but keeps the embedded `expiresAt` | [VERIFIED: better-auth@1.7.7 dist/api/routes/session.mjs:99-111] `const refreshedSession = {` / `session: { ...session.session },` |
| 3 | STACK: "Complements beyond TFD/Pagos: terceros, ine, registrofiscal, implocal, iedu, cce20 — 1-7 each" implies real files carry them | Those namespaces are only **declared** (`xmlns:`) in 1-7 files; **no element from them exists** in the 143 files. Only `tfd:TimbreFiscalDigital` and `pago20:*` elements occur. Unknown-complement and alternate-prefix coverage must come from **synthetic fixtures** | [VERIFIED: local scan of 143 files, element census: `{'tfd:TimbreFiscalDigital': 143, 'pago20:Pagos': 7, ...}`; `grep -l 'xmlns:iedu='` = 2 files, but zero `<iedu:` elements] |
| 4 | STACK/ARCHITECTURE: leave `cacheComponents` off in v1 | `create-next-app@16.4.0` **generates it ON** (and `partialPrefetching: true`); the scaffold task must remove both | [VERIFIED: scaffold output next.config.ts:5-6] `cacheComponents: true,` / `partialPrefetching: true,` |
| 5 | STACK: Tailwind via `@tailwindcss/postcss` | The 16.4.0 scaffold wires Tailwind through `@tailwindcss/turbopack` (Turbopack rule), no `postcss.config` | [VERIFIED: scaffold next.config.ts:9-12] `loaders: ["@tailwindcss/turbopack"],`. shadcn compatibility is an open item |
| 6 | ARCHITECTURE Pattern 3: pre-write `version` check + read-back "narrows the race" | Correct but does not close it; official `files.update` reference documents **no** `If-Match`/precondition header. Recommended default for Phase 3 is per-user append-only logs unless the live probe proves 412 | [CITED: developers.google.com/workspace/drive/api/reference/rest/v3/files/update] (no headers/preconditions listed) |
| 7 | STACK/ARCHITECTURE: `removeNSPrefix` is enough; DTD guard "kills the CVE class" | Confirmed the guard is **necessary**: fast-xml-parser 5.11.2 expands internal DTD entities by default | [VERIFIED: local probe] `<!DOCTYPE x [<!ENTITY a "AAAA">]><x>&a;</x>` parsed to `{"x":"AAAA"}` |
| 8 | PITFALLS/ARCHITECTURE: `@googleapis/drive` "built-in gaxios retry" | The default retry covers only idempotent methods; `PATCH`/`POST` (our JSON writes, uploads) are **not** retried automatically | [VERIFIED: local probe, config dump] `httpMethodsToRetry: [ 'GET', 'HEAD', 'PUT', 'OPTIONS', 'DELETE' ]` |
| 9 | STATE/CONTEXT: largest supplier "~47% of net spend" | With IVA (Phase 1 basis, D-15) it is **49.5%** of net `Total`; ~47% is the sin-IVA share. Do not hard-code either in tests | [VERIFIED: local scan] net `Total` 217,880.82; top issuer 107,862.43 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Google sign-in, session cookie | Frontend Server (Next route `/api/auth/[...all]`) | Browser (sign-in button, keep-alive ping) | Cookies/secret are server-side; stateless JWE cookie |
| Allowlist enforcement | API / Backend (`requireUser()` DAL in every entry point) | Frontend Server (`proxy.ts` optimistic redirect only) | D-19; middleware-only auth is bypassable |
| Drive credential (refresh token -> access token) | API / Backend (`adapters/drive`, `server-only`) | — | Token never reaches browser or session |
| Folder setting (pointer) | API / Backend (Server Action) | Database/Storage (pointer file in Drive) | D-02/D-03 |
| Sync orchestration (list, diff, parse, persist) | API / Backend (Route Handler `POST /api/sync`) | Browser (loop driver + progress UI) | Needs `maxDuration`, Drive token; client re-invokes until `remaining=0` |
| CFDI parsing, money, ledger rules | API / Backend (pure core, isomorphic-safe) | — | Pure functions; testable without network |
| State persistence (`manifest`, `invoices-YYYY`) | Database / Storage (Drive JSON via port) | — | STOR-01/03 |
| Aggregation (supplier, month) | Frontend Server (RSC calls pure analytics) | — | Milliseconds in memory; ship only DTOs |
| Charts and tables | Browser (Client Components) | Frontend Server (data) | Recharts is client-only; receives cents-rounded numbers |
| Year selector | Frontend Server (`?anio=` search param) | Browser (select control) | Server-rendered, no client state needed |

## Standard Stack

### Core (Phase 1 subset of STACK.md; versions re-verified with `npm view` on 2026-10-09)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.0 (published 2026-10-06) | Framework | Pinned by CLAUDE.md; scaffold installs it. Conservative fallback if a 16.4.0 regression bites: 16.3.8 (2026-09-30) |
| react / react-dom | 19.3.0 | UI | Scaffold-pinned |
| typescript | ~6.0.3 | Language | `typescript-eslint@8.71.1` peer is `>=4.8.4 <6.1.0` [VERIFIED: npm view]; `latest` is 7.0.2 and breaks typed lint |
| better-auth | 1.7.7 | Google login (identity only), stateless cookie session | See Auth findings; peer `next ^16` ok [VERIFIED: npm view] |
| @googleapis/drive | 26.0.2 | Drive v3 client | 16 MB total install incl. deps in a clean dir [VERIFIED: local `du`]; single `google-auth-library@11.2.0` deduped [VERIFIED: `npm ls`] |
| google-auth-library | 11.2.0 | `OAuth2Client` with refresh token | Auto-refreshes access token |
| fast-xml-parser | 5.11.2 | CFDI XML -> object | Config verified on 143 files |
| zod | 4.6.5 | Validate parsed CFDI, Drive JSON, env | One zod major |
| decimal.js | 10.6.0 | Exact money | Never JS floats |
| @t3-oss/env-nextjs | 0.13.11 | Typed env | Fail build on missing secrets |
| server-only | 0.0.1 | Client-bundle guard | React-team package |
| p-limit / p-retry | 7.3.3 / 8.0.1 | Bounded concurrency; write retries | gaxios does not retry PATCH/POST |
| tailwindcss + shadcn (Radix) + recharts | 4.3.3 / 4.21.4 / 3.10.1 | UI + charts | shadcn `chart` is Recharts 3; add `react-is@19.3.0` if peer warnings |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @vitest/coverage-v8 | 5.0.3 | Unit/integration/contract tests | All core, adapters (with fakes), analytics |
| @playwright/test | 1.64.0 | Anonymous-redirect smoke only | Chromium already cached locally [VERIFIED: `ls ~/Library/Caches/ms-playwright`] |
| tsx | 4.23.15 | Run `scripts/*.ts` (`drive:auth`, fixture builder, spike) | Node 24 native type-stripping rejects `enum`, and needs `.ts` import extensions; project code uses extensionless imports [VERIFIED: local probe] |
| lucide-react, radix-ui, clsx, tailwind-merge, class-variance-authority, tw-animate-css, sonner | per `shadcn init` | shadcn baseline | Installed by CLI |
| prettier, prettier-plugin-tailwindcss, eslint-config-prettier | 3.9.9 / 0.8.1 / 10.1.8 | Formatting | CLAUDE.md |

**Not needed in Phase 1 (defer):** `openai`, `write-excel-file`, `@tanstack/react-table` (a 39-row ranking table is a plain shadcn `table`), `nuqs`, `fflate`, `date-fns` (month labels via `Intl`, buckets via string slicing), `fuse.js`, `msw`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth stateless | Auth.js v5 beta (`signIn` callback) | Only if Spike 1 acceptance (below) fails; beta, maintenance mode |
| `@googleapis/drive` | raw `fetch` + `OAuth2Client.getAccessToken()` | Only if Turbopack bundling fights the package; keep behind `DriveApi` port so swap is local |
| `@tailwindcss/turbopack` (scaffold default) | `@tailwindcss/postcss` (STACK) | Switch only if `shadcn init` fails to recognise the setup |
| `tsx` | `node --experimental-strip-types` | Zero deps, but forces `.ts` import extensions and bans enums across `src/` imports used by scripts |

**Installation (inside the existing repo; see Pitfall 1 for why scaffold goes to a temp dir):**
```bash
# 1. scaffold OUTSIDE the repo, then copy files in (create-next-app refuses a dir containing .planning/ and Facturas/)
pnpm dlx create-next-app@16.4.0 ../facturas-scaffold --ts --eslint --tailwind --app --src-dir --turbopack --import-alias "@/*" --use-pnpm --skip-install --yes
# 2. copy everything EXCEPT .git; MERGE .gitignore (keep the `Facturas` line, add `!.env.example`)
# 3. next.config.ts: delete `cacheComponents: true` and `partialPrefetching: true`
pnpm add -D typescript@~6.0.3 eslint@~9.39.5 @types/node@~24.19.2
pnpm add better-auth@1.7.7 @googleapis/drive@26.0.2 google-auth-library@11.2.0 \
  fast-xml-parser@5.11.2 zod@4.6.5 decimal.js@10.6.0 @t3-oss/env-nextjs@0.13.11 \
  server-only p-limit@7.3.3 p-retry@8.0.1 recharts@3.10.1 react-is@19.3.0
pnpm dlx shadcn@4.21.4 init
pnpm dlx shadcn@4.21.4 add chart table card button select badge skeleton progress sonner input
pnpm add -D vitest@5.0.3 @vitest/coverage-v8@5.0.3 @playwright/test@1.64.0 tsx typescript-eslint@8.71.1 \
  prettier@3.9.9 prettier-plugin-tailwindcss@0.8.1 eslint-config-prettier@10.1.8
```
`package.json`: `"engines": { "node": "24.x" }`; the scaffold already writes `"packageManager": "pnpm@11.5.2"` [VERIFIED: scaffold package.json]. Local pnpm is 12.10.1 [VERIFIED: `pnpm --version`]; pnpm honors the `packageManager` pin, so keep it.

**Version verification (2026-10-09, `npm view`):** next 16.4.0, better-auth 1.7.7, @googleapis/drive 26.0.2, google-auth-library 11.2.0, fast-xml-parser 5.11.2, zod 4.6.5, decimal.js 10.6.0, @t3-oss/env-nextjs 0.13.11, p-limit 7.3.3, p-retry 8.0.1, recharts 3.10.1, shadcn 4.21.4, tailwindcss 4.3.3, vitest 5.0.3, @playwright/test 1.64.0, typescript-eslint 8.71.1, eslint-config-next 16.4.0, tsx 4.23.15, react-is 19.3.0 [VERIFIED: npm registry]. `typescript@6.0.3` and `eslint@9.39.5` and `@types/node@24.19.2` exist [VERIFIED: npm view].

## Package Legitimacy Audit

Ran `gsd_run query package-legitimacy check --ecosystem npm ...` (2026-10-09). **No package returned `SLOP`.** Every `SUS` verdict carries the single reason `too-new`, which the seam derives from the *latest version's* publish date (days old), not from the package being new. Package age and download counts below show these are long-established projects; the one other flag (`server-only`: `no-repository`) is the React team's package published from the facebook/react monorepo. No package reports a `postinstall` script (`postinstall: null` in every signal block). The planner should add **one consolidated** `checkpoint:human-verify` (review the `pnpm-lock.yaml` diff after the first install, keep pnpm's default of blocking dependency build scripts) instead of one per package.

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|--------------|-------------|---------|-------------|
| next | npm | years | 65.5M | vercel/next.js | SUS (too-new: 16.4.0 is 3 days old) | Approved; covered by consolidated checkpoint |
| react, react-dom | npm | years | 186M / 176M | facebook/react | OK | Approved |
| better-auth | npm | 2.4 yrs (first publish 2024-04-22) | 11.2M | better-auth/better-auth | SUS (too-new) | Approved; consolidated checkpoint |
| @googleapis/drive | npm | 5.8 yrs | 1.06M | googleapis/google-api-nodejs-client | SUS (too-new) | Approved; consolidated checkpoint |
| google-auth-library | npm | 11.6 yrs | 100M | googleapis/google-cloud-node | SUS (too-new) | Approved; consolidated checkpoint |
| fast-xml-parser | npm | 9.7 yrs | 82.9M | NaturalIntelligence/fast-xml-parser | SUS (too-new) | Approved; must stay >=5.6 (CVE history) |
| zod | npm | years | 324M | colinhacks/zod | SUS (too-new) | Approved |
| decimal.js | npm | years | 97M | MikeMcl/decimal.js | OK | Approved |
| @t3-oss/env-nextjs | npm | years | 3.1M | t3-oss/t3-env | OK | Approved |
| server-only | npm | 3.9 yrs | 17.4M | (React monorepo; seam: no-repository) | SUS (no-repository) | Approved; official React-team package |
| p-limit / p-retry | npm | 10 yrs | 274M / 53.8M | sindresorhus | SUS (too-new) / OK | Approved |
| recharts, tailwindcss, @tailwindcss/turbopack, react-is | npm | years | 57M / 135M / 114k / 371M | official repos | OK | Approved |
| shadcn, radix-ui, tailwind-merge, tsx, vitest, @vitest/coverage-v8, @playwright/test, eslint, typescript-eslint, eslint-config-next, prettier, lucide-react, @types/node | npm | years | 11M-456M | official repos | SUS (too-new) | Approved; consolidated checkpoint |
| typescript, sonner, clsx, class-variance-authority, tw-animate-css, eslint-config-prettier, prettier-plugin-tailwindcss | npm | years | 9.7M-305M | official repos | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** all `too-new` only (see note); planner inserts a single consolidated checkpoint, not per-package.
*Package names above came from CLAUDE.md/STACK.md (project-authored, prior-session research) and were re-run through the seam today; none was discovered via open web search this session.*

## Architecture Patterns

### System Architecture Diagram

```
                       OWNER (once, local)                        Vercel env vars
  pnpm drive:auth ──consent (loopback, Desktop client)──▶ refresh token ──paste──▶ DRIVE_REFRESH_TOKEN
                                                                                   DRIVE_CLIENT_ID/SECRET
 Browser (owner/partner)                                                            ALLOWED_EMAILS, BETTER_AUTH_*
   │  GET any page / POST /api/sync / Server Action                                 GOOGLE_CLIENT_ID/SECRET
   ▼
 proxy.ts  ──no session cookie──▶ 307 /login        (optimistic only, never the gate)
   │
   ▼
 Entry points: page.tsx (RSC) | route.ts | "use server" action
   │  every one calls  requireUser()  ─ session? (Better Auth stateless cookie, 30d sliding)
   │                                   ─ email.toLowerCase() ∈ ALLOWED_EMAILS && emailVerified?
   │                                   ─ no session → /login ; session but not allowed → /acceso-denegado (shows email) ; API → 401/403
   ▼
 Services (no I/O details)
   ├─ SettingsService ── pointer ◀──▶ Drive: My Drive/facturas-app-pointer.json  {folderId}
   ├─ SyncService  POST /api/sync {cursor-less}
   │     1 list tree (BFS from folderId, skip _app, .xml only) ─▶ InvoiceSource
   │     2 diff vs manifest (new / changed md5 / removed / duplicate-orphaned / parserVersion bump)
   │     3 download batch (<=25 files, concurrency 8, budget 90 s) ─▶ parseCfdi (pure) ─▶ Invoice | Skip(reason)
   │     4 write shards then manifest (manifest = commit marker) ─▶ InvoiceRepository / SyncStateRepository
   │     5 return {processed, remaining, counts, problems}   ◀── client loops until remaining = 0
   └─ DatasetService  load shards (+ id cache) ─▶ analytics (pure, Decimal) ─▶ DTO (strings->cents numbers)
                                                                   │
 RSC pages: /  (monthly bars, top-10 bar, supplier table)  /proveedores/[rfc]  /ajustes  ◀─ DTO ─┘
   └─ Client Components: charts (Recharts), SyncButton (progress loop), YearSelect, SessionKeepAlive

 Ports ◀── implemented by ── adapters/memory (fakes)  |  adapters/drive (DriveApi → FakeDriveApi in tests)
 Drive layout:  <folder>/2025/*.xml|pdf (read-only)   <folder>/_app/manifest.json   <folder>/_app/invoices-2025.json
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (public)/login/page.tsx, acceso-denegado/page.tsx
│   ├── (app)/layout.tsx          # calls requireUser(); nav; SessionKeepAlive
│   │   ├── page.tsx              # dashboard (RSC)
│   │   ├── proveedores/[rfc]/page.tsx
│   │   └── ajustes/page.tsx      # + actions.ts ("use server": saveFolder, each calls requireUser)
│   └── api/auth/[...all]/route.ts, api/sync/route.ts, api/health/drive/route.ts
├── proxy.ts                      # optimistic redirect only
├── auth/        { auth.ts, require-user.ts, allowlist.ts, client.ts }
├── domain/      { invoice.ts, money.ts, spend.ts }          # pure
├── parsing/cfdi/{ parse.ts, schema.ts, errors.ts }          # pure, isomorphic
├── analytics/   { supplier-spend.ts, monthly.ts, dto.ts }   # pure
├── ports/       { invoice-source.ts, invoice-repository.ts, sync-state.ts, settings.ts, drive-api.ts }
├── services/    { sync-service.ts, dataset-service.ts, settings-service.ts }
├── adapters/
│   ├── drive/   { drive-api.ts, credentials.ts, json-doc-store.ts, invoice-source.ts, repositories.ts, pointer.ts }
│   └── memory/  { fake-drive-api.ts, memory-repositories.ts }
├── container.ts, env.ts          # wiring; zod env (server-only)
tests/ { fixtures/cfdi/*.xml (anonymized), fixtures/synthetic/*.xml, contract/, unit/, e2e/ }
scripts/ { drive-auth.ts, build-fixtures.ts, spike-drive-concurrency.ts }
```
`domain/`, `parsing/`, `analytics/` import nothing from `adapters/`, `services/` or `app/`. Name the fixture folder `tests/fixtures/cfdi/`: the repo's `.gitignore` ignores any path named `Facturas` [VERIFIED: .gitignore:1-4, quoted: `Facturas` / `.claude` / `.DS_Store`], so never use that name.

### Pattern 1: Identity plane vs Drive plane (D-01)
**What:** Better Auth knows only *who* the user is. A separate `DriveCredentialProvider` builds an `OAuth2Client` from `DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`; the library refreshes the access token transparently. Use a **Desktop-app OAuth client** for the Drive plane (loopback redirect on any port, nothing to register) and a **Web client** for login.
**When to use:** always; no Drive token ever enters a cookie or session.
```typescript
// adapters/drive/credentials.ts  (server-only)
import "server-only";
import { OAuth2Client } from "google-auth-library";
import { drive as makeDrive } from "@googleapis/drive";
export function makeDriveClient(env: { DRIVE_CLIENT_ID: string; DRIVE_CLIENT_SECRET: string; DRIVE_REFRESH_TOKEN: string }) {
  const auth = new OAuth2Client(env.DRIVE_CLIENT_ID, env.DRIVE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.DRIVE_REFRESH_TOKEN });
  return makeDrive({ version: "v3", auth });
}
```
Map `invalid_grant` to a Spanish operator message ("La autorización de Drive caducó. El dueño debe ejecutar `pnpm drive:auth` y actualizar DRIVE_REFRESH_TOKEN") surfaced in Ajustes and the sync error, never a stack trace.

### Pattern 2: Stateless-resume sync
**What:** No cursor state is stored between calls. Each `POST /api/sync` does: relist, diff, process a bounded slice, persist, report `remaining`. A killed call loses only its un-persisted slice; the next call recomputes the same pending set minus what was committed.
**Details (decisions):**
- Listing: BFS from `folderId`; per folder `files.list` with `q="'<id>' in parents and trashed=false"`, `fields="nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)"`, `pageSize=1000`, follow `nextPageToken`. Descend into `application/vnd.google-apps.folder`; **skip a child folder named `_app`**; keep only names ending `.xml` (case-insensitive); ignore PDFs (ING-05 is Phase 2) and `application/vnd.google-apps.shortcut` (document as unsupported). Detect change by `md5Checksum` (fallback `modifiedTime`+`size`).
- Pending = `new` ∪ `changed(md5)` ∪ (all files if `manifest.parserVersion !== PARSER_VERSION`) ∪ (`duplicate` entries whose canonical file was removed or changed). `removed` = in manifest, absent from listing: delete their invoice records and manifest entries (D-09).
- Constants (injectable for tests): `maxDuration = 300` on the route; `SYNC_CALL_BUDGET_MS = 90_000` (stop *starting* new batches after this); `BATCH_SIZE = 25`; `DOWNLOAD_CONCURRENCY = 8` (`p-limit`). Estimate: 143 files x ~200 ms / 8 = a few seconds, so a first sync is 1-2 calls; tests force `BATCH_SIZE=2` to exercise resume. [ASSUMED: latency estimate; measure in the tracer]
- Commit order per batch: write affected `invoices-YYYY.json` shards first, then `manifest.json`. A crash between them re-processes those files next call; upsert by UUID is idempotent.
- Response: `{ processed, remaining, counts:{nuevas, cambiadas, sinCambios, eliminadas}, problems:[{fileName, code, mensaje}] }`. The client stores the first call's `remaining` as the denominator and renders `Importando {done} de {total}…`; summary sums counts across calls and shows nuevas / sin cambios / con problemas (D-06). `sinCambios = listed - pending` computed on the first call.
- Two users syncing at once is harmless but wasteful: both compute the same deterministic results; the last write wins and the next call heals any lost manifest rows. Optional guard: refuse a new sync if `manifest.syncStartedAt` is < 2 min old. [ASSUMED: acceptable at 2 users]
- Problem codes (Spanish `mensaje`, stable `code`): `parse_error` "no se pudo leer", `tipo_omitido` "tipo N/T omitido", `total_no_cuadra` "total no cuadra" (flag only; invoice still counts at header `Total`, D-08), `version_no_soportada`, `uuid_duplicado`, `xml_no_permitido` (DTD), `moneda_extranjera` (counted as `Total x TipoCambio`, flagged).

### Pattern 3: Ports with in-memory fake (STOR-03) and one contract suite
**What:** Domain-shaped repositories over a thin `DriveApi` interface. Tests run the same repository contract against `MemoryRepositories` and `DriveRepositories(FakeDriveApi)`; the production `DriveApi` is a ~100-line wrapper over `@googleapis/drive`. This exercises the real Drive adapter logic (BFS, `_app` creation, read-back, shard writes) with no network.
```typescript
// ports/drive-api.ts
export interface DriveEntry { id: string; name: string; mimeType: string; md5Checksum?: string; modifiedTime: string; size?: string; parents?: string[] }
export interface DriveApi {
  list(q: string, opts?: { fields?: string }): Promise<DriveEntry[]>;           // follows pagination
  getBytes(fileId: string): Promise<Uint8Array>;                                  // alt=media, arraybuffer
  getMeta(fileId: string, fields: string): Promise<DriveEntry & { version?: string; trashed?: boolean }>;
  createFile(args: { name: string; parentId: string; mimeType: string; body: Uint8Array | string }): Promise<DriveEntry>;
  updateFile(fileId: string, body: Uint8Array | string): Promise<DriveEntry>;     // media PATCH
}
// ports/json-doc.ts   (Phase 1 uses read + write; Phase 3 decides CAS vs append-only behind the same type)
export interface JsonDocStore {
  read<T>(name: string): Promise<{ doc: T; rev: string } | null>;
  write<T>(name: string, doc: T, opts?: { ifRev?: string | null }): Promise<{ rev: string }>; // RevConflictError on mismatch
}
```
Rules: every doc carries `schemaVersion`; reads validate with zod; **never overwrite a file that fails validation** (surface the error); wrap writes in `p-retry` (3 attempts, jitter) because gaxios will not; after `createFile` for `_app/*` cache ids in memory and never re-search by name (Drive list is eventually consistent; two creators could otherwise make duplicates).

### Pattern 4: Bootstrap pointer (D-03 discretion resolved)
**Decision:** a tiny JSON file **`facturas-app-pointer.json` in My Drive root**: `{ "schemaVersion": 1, "folderId": "...", "folderName": "Facturas", "updatedBy": "<email>", "updatedAt": "<iso>" }`. Lookup: `files.list` with `q="name = 'facturas-app-pointer.json' and 'root' in parents and trashed = false"` (documented query terms: `name =`, `in parents`, `trashed =` [CITED: developers.google.com/workspace/drive/api/guides/ref-search-terms]). Resolution order: pointer file -> `DRIVE_FOLDER_ID` env seed -> in Ajustes, a name search for a folder called `Facturas` offered as a suggestion (pick the one in My Drive root; if several, list them).
**Why this and not the alternatives:**
| Option | Verdict | Reason |
|--------|---------|--------|
| Root pointer file (chosen) | Use | Needs only the `drive` scope the owner token already has; visible and backup-able (matches D-03 spirit); survives redeploys; no extra credential |
| `appDataFolder` | Reject | Official docs: needs the separate `drive.appdata` scope, and the folder "can't be accessed using the Drive user interface"; hides state the owner wants visible. [CITED: developers.google.com/workspace/drive/api/guides/appdata] |
| Edge Config / env write | Reject | Runtime writes to Vercel config need a second credential (Vercel API token) and a second system of record |
| Env var only | Seed only | D-02 makes the app the source of truth; change = redeploy otherwise |
`SettingsService.saveFolder(input)`: parse `https://drive.google.com/drive/folders/<id>[?...]` or a bare id (`/^[A-Za-z0-9_-]{10,}$/`), `getMeta` must be a non-trashed folder, count XMLs via the same BFS (show "N XML encontrados"), then write the pointer (create if absent, else update) and ensure `<folder>/_app/` exists (find by `name='_app' and '<id>' in parents and mimeType=folder`; create if absent; if >1 found use the oldest and log). Memoize ids per instance.

### Pattern 5: Data model (Drive JSON; money as decimal strings)
```
_app/manifest.json      { schemaVersion:1, parserVersion:1, syncStartedAt?, lastSyncAt, lastSummary,
                          files: { [driveFileId]: { name, md5, modifiedTime,
                                   status:"ok"|"skipped"|"duplicate", reason?:code, uuid?, year?, canonicalFileId? } } }
_app/invoices-YYYY.json { schemaVersion:1, year, invoices: Invoice[] }   // shard by Fecha year (string slice)
Invoice = { uuid /*UPPERCASE*/, fileId, fecha /*"2025-06-03T10:11:12" as written*/, tipo:"I"|"E"|"P",
            metodoPago?, moneda, tipoCambio?, subtotal, descuento?, total /*decimal strings*/,
            emisor:{rfc,nombre}, relacionados?:[{tipoRelacion, uuid}],
            conceptos:[{ claveProdServ, claveUnidad, descripcion, cantidad, valorUnitario, importe, descuento?,
                         impuestos:[{kind:"traslado"|"retencion", impuesto, tipoFactor, tasaOCuota?, base?, importe?}] }],
            flags: string[] /* e.g. "total_no_cuadra" */ }
```
Store **full normalized concepts now** (about 3 KB/invoice; ~0.4 MB for 143, ~2 MB per 700): Phase 2 drill-down and tax buckets need them, and a `PARSER_VERSION` bump already forces a cheap re-parse. Spend rule lives in `domain/spend.ts`: `I:+total`, `E:-total`, `P:0`; N/T never stored (manifest `skipped`, `tipo_omitido`). Bucket months by `fecha.slice(0,7)`; **never `new Date(fecha)`**. Dedupe: canonical record for a UUID is the file with the earliest `modifiedTime`, ties by lowest `fileId`; other files get manifest `status:"duplicate", canonicalFileId`; re-queue them when the canonical is removed/changed.

### Pattern 6: Auth (identity plane) and the DAL
- `requireUser()` returns `{ email }` or redirects/throws; separate `requireUserApi()` returns 401/403 JSON for route handlers. Compare `email.trim().toLowerCase()` against the parsed `ALLOWED_EMAILS` set and require `emailVerified === true`.
- **No sign-in-time rejection hook.** D-17 requires showing the denied user's email, which needs the session to exist. The session grants nothing: every entry point calls the DAL. `/acceso-denegado` is the only page a signed-in non-allowlisted user may reach and it reads the session only. (`databaseHooks.user.create.before` returning `false` does abort creation without a DB [VERIFIED: local probe, "Failed to create user"], but the user would then land on a generic error page without their email. Keep it as an optional defense-in-depth only if D-17 copy is relaxed.)
- Structural test (Vitest, pure `fs` globbing): every `src/app/**/page.tsx`, `route.ts` (except `api/auth/[...all]`) and every file containing `"use server"` must reference `requireUser`/`requireUserApi`; list explicit exceptions (`/login`, `/acceso-denegado`).
- Next 16.4 docs warn that Server Functions are POSTs to the page route, so a `proxy.ts` matcher that excludes a path also skips them; verify auth **inside** each action [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy, "Execution order" note].
- `POST /api/sync`: besides `requireUserApi()`, reject when `Sec-Fetch-Site` is present and not `same-origin`, and require `Content-Type: application/json` (route handlers have no built-in Origin check like Server Actions).

### Anti-Patterns to Avoid
- **Server Component cookie refresh.** Server Components cannot set cookies; a keep-alive must hit `/api/auth/get-session` from the browser (Pitfall 2).
- **Syncing on page load** (violates D-05) or caching the dataset in `use cache` (serverless entries do not persist; `cacheComponents` is forbidden in v1).
- **Parsing money through `number`**, truncating 6-decimal `ValorUnitario`, or recomputing `Importe` from `Cantidad x ValorUnitario`.
- **Whole-file overwrite of a doc that failed zod validation** (would destroy state on a schema drift).
- **Generic key-value `store.save(name, json)` as the only port** for domain data: keep repositories domain-shaped so a Postgres adapter is a swap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth login, cookie sessions, CSRF state | Custom OIDC/JWT cookie code | Better Auth stateless | Session crypto, state cookie, callback handling |
| Access-token refresh for Drive | Manual `fetch` to `oauth2.googleapis.com/token` + expiry bookkeeping | `google-auth-library` `OAuth2Client` | Handles expiry, concurrency, `invalid_grant` errors |
| XML parsing | Regex over CFDI | `fast-xml-parser` (+ DTD guard) | Entities, namespaces, attribute order |
| Money arithmetic | Integer-centavo juggling with 6-decimal prices | `decimal.js` | Unit prices carry 6 decimals; need exact `Importe - Descuento` + taxes |
| Concurrency and retry | Home-made pools/backoff | `p-limit`, `p-retry` | Edge cases (jitter, abort) |
| Charts | SVG bars | shadcn `chart` (Recharts 3) | Theming, tooltips, a11y |
| Currency/percent/month formatting | Manual string building | `Intl.NumberFormat/DateTimeFormat("es-MX")` | Verified: `-$1,234,567.50`, `jun`, `octubre de 2025`, `49.5%` [VERIFIED: node 24.14 probe] |
| Env validation | `process.env.X!` | `@t3-oss/env-nextjs` + zod | Fails the build on missing secrets |
| Loopback OAuth listener in `drive:auth` | Hand-built PKCE/state | `OAuth2Client.generateAuthUrl({ access_type:"offline", prompt:"consent", scope, code_challenge })` + `getToken` + a 20-line `node:http` listener on 127.0.0.1 | PKCE/state are library features |

**Key insight:** the only things worth writing are the CFDI mapper, the spend rules, the sync diff, and the ports. Everything else has a verified library path.

## Common Pitfalls

### Pitfall 1: Scaffolding in place fails and the scaffold enables forbidden flags
**What goes wrong:** `create-next-app .` aborts in the repo root, and the scaffold output turns on `cacheComponents`.
**Why:** [VERIFIED: local run] "The directory scaffold contains files that could conflict: .planning/ Facturas/". [VERIFIED: scaffold next.config.ts:5-6] `cacheComponents: true,` and `partialPrefetching: true,`. It also writes `AGENTS.md` telling agents to read `node_modules/next/dist/docs/` before coding, and installs `typescript ^5`, `@types/node ^20`, `eslint ^9`.
**How to avoid:** scaffold to a sibling temp dir, copy files in (not `.git`), merge `.gitignore` keeping `Facturas` (and add `!.env.example`, since the scaffold ignores `.env*`), delete the two flags, then pin `typescript@~6.0.3`, `@types/node@~24.19.2`, `eslint@~9.39.5`. Keep `AGENTS.md`; executors should consult the bundled Next docs.
**Warning signs:** "Uncached data was accessed outside of <Suspense>" errors on first dynamic page.

### Pitfall 2: "30 days sliding" silently becomes "7 days" or "fixed 30 days"
**What goes wrong:** With STACK's sample (`cookieCache.maxAge: 7*24*60*60`) users are logged out after 7 days idle; even with `expiresIn` 30d the embedded session never slides.
**Why:** In stateless mode the cookie cache is the only session store. [VERIFIED: dist/api/routes/session.mjs:99-111] the refresh branch copies the embedded session unchanged: `const refreshedSession = {` `session: { ...session.session },`, re-signs `session_data` with a new cookie TTL, and re-sets `session_token` with `maxAge: sessionTokenMaxAge`. Elsewhere the code expires the cache when `cachedSessionExpiresAt < now`. With no DB there is nothing to fall back to.
**How to avoid:** `session.expiresIn = 365 days` (absolute cap per sign-in), `session.cookieCache = { enabled:true, strategy:"jwe", maxAge: 30 days, refreshCache: { updateAge: 29 days } }` (refresh when more than ~1 day old), plus a `<SessionKeepAlive/>` client component in the app layout that calls `authClient.getSession()` on mount (route handlers can set cookies; Server Components cannot). **Acceptance (spike):** after sign-in, inspect `Set-Cookie` Max-Age of `better-auth.session_data`; a second request >1 day later (or temporarily lowered `updateAge` of a few seconds in a test deployment) re-issues it. [MEDIUM: derived from source, not yet observed end to end]
**Warning signs:** Partner reports login prompts after a week of not opening the app.

### Pitfall 3: Minting the Drive token while the consent screen is still "Testing"
**What goes wrong:** Refresh token dies after 7 days; the app "works" through the whole spike and fails on day 8.
**Why:** [CITED: developers.google.com/identity/protocols/oauth2] "Testing" + external user type issues refresh tokens that expire in 7 days (exception: only `openid/email/profile`). The Drive scope is not an exception.
**How to avoid:** publish the consent screen ("Publish app") **before** running `pnpm drive:auth`. Record the mint date. Schedule human checks at day 8 and day 30 using `/api/health/drive`. Google does not document what happens to tokens minted earlier when status changes, so re-mint after publishing. [CITED: support.google.com/cloud/answer/15549945 states the page "doesn't say"]
**Other invalidation causes to document in the runbook:** user revokes access; token unused for six months; per-client cap of 100 live refresh tokens per account (minting repeatedly eventually kills the oldest); admin restriction; GCP session-length control. [CITED: oauth2 doc]

### Pitfall 4: Unverified-app warning and the 100-user lifetime cap
**What goes wrong:** Confusion at consent time; running out of the cap by repeatedly testing with other accounts.
**Why:** [CITED: support.google.com/cloud/answer/15549945] "Apps that show the unverified app screen can add 100 new users in total ... lifetime ... can't be reset"; no path to use restricted scopes in production without verification. Only the **owner** requests `drive`; the **partner** requests only identity scopes, so she should not see the warning (confirm in the human spike).
**How to avoid:** never test the `drive` scope with extra accounts. Keep the owner as the only Drive consenter.

### Pitfall 5: gaxios does not retry the calls that matter
**What goes wrong:** A transient 5xx/429 on `files.update` or `files.create` fails the whole batch.
**Why:** [VERIFIED: local probe] `httpMethodsToRetry: [ 'GET', 'HEAD', 'PUT', 'OPTIONS', 'DELETE' ]`; JSON writes are PATCH/POST.
**How to avoid:** wrap writes in `p-retry` with jittered backoff; treat 403 `rateLimitExceeded`/`userRateLimitExceeded`, 429, 5xx as retryable; reads rely on the built-in retry.

### Pitfall 6: Drive list is eventually consistent; no uniqueness by name
**What goes wrong:** Two concurrent first-time setups create two `_app/` folders or two pointer files; a just-created file is missing from the next list.
**How to avoid:** cache ids after create; for duplicates choose the oldest `createdTime` deterministically; only the Ajustes save path creates the pointer/`_app` (rare, human-triggered); never create them from the dashboard read path.

### Pitfall 7: XML entity expansion and namespace-blind matching
**What goes wrong:** A hostile or odd XML expands entities; `removeNSPrefix` hides which namespace an element belongs to.
**Why:** [VERIFIED: local probe] internal entity expanded; also `removeNSPrefix` drops `xmlns:*` attributes from the parsed object (only `schemaLocation` remained on the root), so you cannot check the CFDI namespace URI from the parsed object.
**How to avoid:** keep the `/<!DOCTYPE|<!ENTITY/i` rejection on the decoded text; validate `Version === "4.0"` and the root being `Comprobante`; for a stricter namespace check, regex the raw text for `xmlns(:\w+)?="http://www.sat.gob.mx/cfd/4"` once. Match elements by local name at known paths only (`Comprobante.Complemento.TimbreFiscalDigital`, `...Pagos`). Treat `pago20` namespace *declaration* as meaningless (declared in 9 files, real Pagos in 7).

### Pitfall 8: Dashboard numbers drift from the XML
**What goes wrong:** Sums pass through `number`; percentages computed from rounded values; negative supplier net breaks percent.
**How to avoid:** sum `Decimal`s, round to 2 only at the DTO boundary; compute `% del total` from unrounded `Decimal` and format via `Intl` percent; define behavior for net-negative suppliers (show the percent, allow negatives). Count `facturas` as Ingreso documents only (E subtracts but is not an "invoice"; P is not shown). [ASSUMED: counting rule, see Open Question 3]

### Pitfall 9: Anonymizer that collapses suppliers
**What goes wrong:** A non-injective RFC mapping makes 39 issuers look like 2, silently gutting the ranking tests.
**Evidence:** my first prototype did exactly this (issuers 39 -> 2) before the fix.
**How to avoid:** the builder asserts `new Set(mappedRfcs).size === new Set(realRfcs).size`, preserves per-supplier net totals (compare sorted multiset before/after), and runs the leak scan (see below).

### Pitfall 10: Vercel preview deployments cannot log in
**What goes wrong:** Google rejects `redirect_uri_mismatch` on per-branch preview URLs.
**How to avoid:** register exactly: `http://localhost:3000/api/auth/callback/google` and `https://<project>.vercel.app/api/auth/callback/google` [CITED: better-auth.com/docs/authentication/google, redirect URI format]. Test auth only on production/local; set `BETTER_AUTH_URL` per environment. Hobby plan is for non-commercial personal use [CITED: vercel.com/docs/limits/fair-use-guidelines]; see Open Question 5.

## Code Examples

### CFDI parser entry (verified against all 143 files)
```typescript
// parsing/cfdi/parse.ts  (config reproduced from STACK.md; verified: 143/143 parsed, concept-level recon within 0.01)
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true,
  parseAttributeValue: false, parseTagValue: false, trimValues: true,
  isArray: (name) => ["Concepto","Traslado","Retencion","CfdiRelacionado","Pago","DoctoRelacionado"].includes(name),
});
export function decodeCfdi(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, ""); // default decoder already strips BOM [VERIFIED]; keep replace as belt and braces
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new CfdiError("xml_no_permitido");
  return text;
}
// then: parser.parse(text).Comprobante -> zod -> Invoice. Use Decimal on every amount string.
```
Reconciliation (both must be computed; flag only the concept-level one for D-08):
```typescript
// header formula held exactly on 143/143 per PITFALLS scan; concept-level max diff measured 0.01 today
// header:  SubTotal - Descuento + TotalImpuestosTrasladados - TotalImpuestosRetenidos (+ ImpuestosLocales net) == Total
// concept: sum(Importe - Descuento) + sum(line Traslado.Importe) - sum(line Retencion.Importe) (+ local) vs Total
const diff = conceptTotal.minus(total).abs();
if (diff.gt("0.10")) flags.push("total_no_cuadra"); // still counts at header Total (D-08)
```

### Better Auth stateless + Google (identity only)
```typescript
// auth/auth.ts (server-only). Config is verified to boot DB-less on better-auth 1.7.7 (local probe).
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
const DAY = 60 * 60 * 24;
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET,           // no `database` => stateless
  session: {
    expiresIn: 365 * DAY,                                                    // absolute cap (embedded expiresAt is not slid)
    cookieCache: { enabled: true, strategy: "jwe", maxAge: 30 * DAY, refreshCache: { updateAge: 29 * DAY } },
  },
  account: { storeStateStrategy: "cookie", storeAccountCookie: true },
  socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" } },
  plugins: [nextCookies()],                                                   // must be last
});
// route: export const { GET, POST } = toNextJsHandler(auth)  (from "better-auth/next-js")
// proxy.ts: getSessionCookie(request) from "better-auth/cookies" -> redirect to /login (optimistic only)
```
Import paths confirmed in the installed package: `better-auth/next-js` exports `nextCookies, toNextJsHandler`; `better-auth/cookies` exports `getSessionCookie`; `better-auth/plugins` exports `testUtils`; `better-auth/react` exists [VERIFIED: dist package.json exports + d.mts]. Google redirect URI format: `https://<host>/api/auth/callback/google` [CITED: better-auth.com/docs/authentication/google].

### `requireUser()` and session test seam
```typescript
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!isAllowed(session.user.email, session.user.emailVerified)) redirect("/acceso-denegado");
  return { email: session.user.email.toLowerCase() };
}
// Vitest: integration test against a real in-process auth instance:
//   const A = betterAuth({ ...sameConfig, plugins:[testUtils()] }); const t = (await A.$context).test;
//   const u = t.createUser({ email, emailVerified:true }); await t.saveUser(u); const { headers } = await t.login({ userId: u.id });
//   await A.api.getSession({ headers })  // works IN-PROCESS only
```
[VERIFIED: local probe] `login` returned `better-auth.session_token` and `getSession` succeeded in the same instance, but a **second instance with the same secret returned null**: the minted cookie is not self-contained in stateless mode. Consequence: use `testUtils` for in-process DAL tests; **do not** plan Playwright authenticated flows by minting cookies. Inject a `SessionProvider` port instead for unit tests, and limit Playwright to anonymous behavior (redirect to `/login`, `/api/sync` returns 401).

### `drive:auth` script outline (PKCE, loopback)
```typescript
// scripts/drive-auth.ts  (run: pnpm drive:auth). Desktop OAuth client id/secret from env.
const client = new OAuth2Client(id, secret, `http://127.0.0.1:${port}/oauth2callback`);
const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
const url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"],
  code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256 });
// open url; node:http server on 127.0.0.1:port waits for ?code ; verify `state`; then:
const { tokens } = await client.getToken({ code, codeVerifier });
if (!tokens.refresh_token) throw new Error("No refresh_token: revoke prior grant at myaccount.google.com/permissions and rerun");
console.log("DRIVE_REFRESH_TOKEN=" + tokens.refresh_token);   // only stdout; never write to disk or logs
```

### Drive concurrency probe (spike script design)
```typescript
// scripts/spike-drive-concurrency.ts  against a THROWAWAY folder, using the real token. Report all, decide by rule below.
// 1 create probe.json; capture response ETag header from files.get (raw gaxios response headers) + version + md5Checksum
// 2 PATCH media with correct If-Match  -> expect 200
// 3 PATCH media with a STALE If-Match   -> 412 means preconditions work; 200 means header ignored
// 4 race: 5 parallel read-modify-write increments of a counter; count lost updates
// 5 requesting fields=etag -> record the error (third-party reports "Invalid field selection")
```
Decision rule: **412 on step 3** -> implement CAS in `JsonDocStore.write(ifRev)` and keep key-level patch with read-back. **200 on step 3** (expected) -> Phase 3 uses **per-user append-only edit logs** (`_app/edits/<userKey>.json`, single writer per file, merged on read with last-writer-wins per key by timestamp), because user-authored data is the irreplaceable class and read-back only narrows the race. Phase 1 needs neither: sync is single-logical-writer and idempotent; the pointer is rarely written.

## Fixture anonymization (LEDG-07)

Method (prototype run today on all 143 files, output never committed): a Python/`tsx` builder performs **string-level attribute replacement** (not parse-and-rebuild, which would lose the BOM, declaration, prefixes and `schemaLocation`), keyed by element + attribute, with deterministic injective maps.

| Real data | Replace with | Notes |
|-----------|--------------|-------|
| `Emisor@Rfc` | `EMI`/`EMIX` + `010101` + base-36 index | length-preserving (12 vs 13), **injective** (assert counts) |
| `Emisor@Nombre` | `PROVEEDOR 001 SA DE CV` (indexed) | stable per real name |
| `Receptor@Rfc/Nombre/DomicilioFiscalReceptor` | fixed `RCP010101AA1` / `RECEPTOR DE PRUEBA SA DE CV` / `00000` | |
| UUIDs everywhere: `TimbreFiscalDigital@UUID`, `CfdiRelacionado@UUID`, `DoctoRelacionado@IdDocumento` | `AAAAAAAA-0000-4000-8000-%012d` via one global map | keeps E->I and P->I links; 144 distinct UUIDs seen = 143 + **1 dangling reference** to a CFDI outside the sample (keep it: tests the unresolved-relation path) |
| `Sello`, `Certificado`, `NoCertificado`, `SelloCFD`, `SelloSAT`, `NoCertificadoSAT`, `RfcProvCertif`, `LugarExpedicion`, `Serie`, `Folio` (incl. on `DoctoRelacionado`) | fixed dummy strings | |
| `Concepto@Descripcion`, `NoIdentificacion`, `Unidad` | `CONCEPTO n`, `SKU`, `Pieza` | recommended; amounts, `ClaveProdServ`, `ClaveUnidad`, taxes, `Fecha`, `Moneda`, `TipoCambio` untouched. Description-edge cases (leading `-`, accents, double spaces) move to a few synthetic files for Phase 4 |

Keep as-is: BOM bytes, XML declaration (and its absence in 1 file), `xmlns:*` declarations, `xsi:schemaLocation`, element order. **Prototype result:** 143 files, 144 UUIDs, 39 RFCs, 39 names mapped; 0 leaks; the profile script on the output reports identical type counts (I 133 / E 3 / P 7), 89 single-concept, 142 BOM, 1 no-declaration, 39 issuers, same months, identical net `Total` 217,880.82, 0 reconciliation failures; 636 KB total (commit all 143 as `tests/fixtures/cfdi/001.xml`... with neutral names, not the original `YYYY-MM-DD_RFC_UUID` names, which embed RFC+UUID).

Guards to commit with it: (1) a Vitest test asserting every `Rfc="..."`, `UUID`/`IdDocumento` and name in `tests/fixtures/**` matches the placeholder patterns (fails if a real value sneaks in); (2) the builder (`scripts/build-fixtures.ts`) runs only locally against the git-ignored `Facturas/` folder and is the only code that ever reads it; (3) the leak scan compares against the set of real tokens in memory and never prints them.

**Synthetic fixtures required** (hand-written, tiny, committed): default namespace (no prefix); alternate prefix (e.g. `ns0:`); an unknown complement element present (`iedu:`/`implocal:` style) with non-empty children; `ImpuestosLocales` that shifts `Total`; Retenciones; IVA Exento; `Moneda="USD"` + `TipoCambio`; `TipoDeComprobante` N and T; Version 3.3; truncated/garbage XML; DOCTYPE with entity; no BOM + no declaration; CRLF line endings; huge `Descuento` edge (Total 0 penny invoice); two files with the same UUID; Pago referencing an absent invoice.

## Sample-data facts the tests must lock (first-hand, aggregated, no personal data)

| Fact | Value | Test use |
|------|-------|----------|
| Files / pairs | 143 XML, 143 PDF (286 entries) | fixture count assertion |
| `TipoDeComprobante` | I 133, E 3, P 7; no N/T | ledger |
| Version, prefix | 4.0 x143; root prefix `cfdi:` x143 | alt-prefix needs synthetic |
| BOM / no declaration | 142 with BOM; 1 with no `<?xml` declaration | parser |
| Single-concept files | 89 of 143 | forced arrays |
| Namespaces with elements | `cfd/4`, `TimbreFiscalDigital`, `Pagos20` only | complements |
| Relations | `04` x1, `07` x4 (single), `07,07` x1; 14 relation references, 1 dangling | ING-04/Phase 2 |
| Issuers | 39 RFCs | ranking |
| Net `Total` (I minus E) | 217,880.82 | dashboard grand total |
| Telmex | 7 I = 16,053.07; 7 P = 0 | SC3 anchor |
| Google Ads | 8 I = 18,879.30; 3 E = 5,200.00; net 13,679.30 | SC3 anchor |
| Months with data (by `Fecha`) | 2025-01..04: 1 each (penny invoices); 05: 9; 06: 25; 07: 13; 08: 23; 09: 17; 10: 18; 11: 20; 12: 14 | monthly chart |
| `Moneda` / `TipoCambio` | MXN x136 (`TipoCambio` "1" x65, absent x71); XXX x7 (Pagos) | no FX in sample |
| Concept-level reconciliation | max abs diff 0.01 across the 136 non-Pago files | D-08 threshold has headroom |
| Sizes | XML 4.6-10.1 KB, mean 5.8 KB | per-request limits irrelevant |

Phase 1 caveat to record: a single `04` (substitution) relation exists, so Phase 1 `I - E` may overcount that one substituted invoice until Phase 2's LEDG-04. The Google Ads net already comes out right with plain `I - E` because its anticipo chain is Ingreso + Egreso.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (Node runtime default) | Next 16.0 | Optimistic redirects only; auth in DAL [CITED: nextjs.org proxy docs, version history] |
| Auth.js v5 beta | Better Auth stateless | 2025-26 | DB-less cookie sessions built in |
| `googleapis` monolith | `@googleapis/drive` | — | Small bundle |
| `next lint` | `eslint .` | Next 16 | Add to CI/pre-commit |
| Tailwind via PostCSS | `@tailwindcss/turbopack` in 16.4 scaffold | 16.4 | Check shadcn init |
| Hobby 10-60 s functions | 300 s default and max on Hobby/Pro default (Fluid) | 2025-26 | Sync fits easily [CITED: vercel.com/docs/functions/configuring-functions/duration, table: Hobby 300s/300s, Pro 300s/800s] |

**Deprecated/outdated:** `deepseek-chat`/`deepseek-reasoner` (irrelevant this phase); sync `cookies()`/`headers()` (always await).

## Spike plan and tracer-slice guidance (for Walking Skeleton ordering)

**What the first tracer slice must prove (end to end, deployed):** scaffold builds on Vercel with the pinned toolchain; Google login works at the real URL; `requireUser()` denies a non-allowlisted account and shows their email; the server, using only env credentials, lists the chosen folder through the owner token and **writes** a file (the pointer) into My Drive; one real UI interaction (Ajustes: paste folder -> "N XML encontrados" -> Guardar). That single slice retires: stateless Better Auth, Drive scope/quota/ownership on a personal Gmail, bundle size with `@googleapis/drive` under Turbopack, `serverExternalPackages` need, env wiring, and starts the AUTH-05 clock.

**Settle before building on them (ordered):**
1. **Human prerequisites (day 0, blocks AUTH-05):** GCP project; OAuth consent screen "External", app published ("In production"); scope list includes `drive` (restricted) — owner consents past the unverified-app screen; Web client (login redirect URIs above) and Desktop client (Drive plane); Drive API enabled. Then run `pnpm drive:auth` **after** publishing; store the 3 Drive env vars in Vercel; record mint date.
2. **Spike 1 (credential path)** acceptance: (a) token mints and `files.list` on the existing `Facturas/` folder returns pre-existing children; (b) creating `facturas-app-pointer.json` and `_app/` succeeds with no `storageQuotaExceeded`; (c) partner login shows no unverified-app screen; (d) non-allowlisted Google account reaches `/acceso-denegado` with their email and cannot load any data route; (e) session cookie Max-Age renews with the keep-alive (Pitfall 2); (f) `pnpm build` function size is sane and `@googleapis/drive` bundles without `serverExternalPackages` (add only if needed); (g) day 8 and day 30 `/api/health/drive` returns OK with no re-auth. Fallback if (d)/(e) fail irreparably: Auth.js v5 beta JWT strategy with `signIn` callback (identity only).
3. **Spike 2 (Drive concurrency)**: run the probe script once with the real token; record 412/200 and lost-update count. Phase 1 code is unaffected either way.
4. **Record both outcomes in PROJECT.md Key Decisions** (ROADMAP requirement). Draft rows: "Drive plane = owner refresh token (Desktop client, scope `drive`) in env; login plane = Better Auth stateless identity only" and "Drive JSON concurrency = <result>; Phase 3 policy = <CAS | per-user append-only logs>" plus "Bootstrap pointer = `facturas-app-pointer.json` at My Drive root".

**Suggested decomposition (hints, not a plan):** W0 parallelizable: (A) tracer slice [auth + Drive + deploy]; (B) pure core: domain/money/spend + CFDI parser + fixtures builder + synthetic fixtures + golden tests. W1: ports + `FakeDriveApi` + memory repos + Drive repos + contract suite + pointer/Ajustes. W2: sync service + route + progress UI. W3: analytics + dashboard + supplier detail + es-MX polish. W4: hardening (structural auth test, anonymous Playwright smoke, runbook, day-8/30 checks). Waves A and B have no dependency on each other.

## Runtime State Inventory

Not applicable: greenfield phase (no rename, refactor or migration).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drive `files.update` ignores `If-Match` (no 412) | Disagreement 6, Concurrency probe | Low: Phase 1 unaffected; if 412 works Phase 3 gets simpler CAS |
| A2 | Partner will not see the unverified-app screen when requesting only `openid email profile` | Pitfall 4, Spike 1(c) | Low-Med: UX friction + a second account counted toward the 100-user cap |
| A3 | `files.list` with `name = '...' and 'root' in parents` finds a pointer file in My Drive root with the `drive` scope | Pattern 4 | Med: change pointer lookup to `appProperties has {...}` or a fixed-name search anywhere; spike verifies |
| A4 | A Desktop-app OAuth client's refresh token refreshes from a server using only client id/secret | Pattern 1 | Low-Med: fall back to the Web client with a registered loopback redirect |
| A5 | "In production" + unverified + restricted `drive` scope yields refresh tokens that do not expire in 7 days | Pitfall 3, AUTH-05 | HIGH impact, only provable at day 8 / day 30; Google's page is silent on this exact combination |
| A6 | Initial sync of 143 files completes in 1-2 calls (~200 ms/download at concurrency 8) | Pattern 2 | Low: design already resumable |
| A7 | `@tailwindcss/turbopack` scaffold setup works with `shadcn init` | Standard Stack | Low: switch to `@tailwindcss/postcss` |
| A8 | Counting `facturas` per supplier as Ingreso documents only | Pitfall 8 | Low: display-only; confirm with owner |
| A9 | Foreign-currency invoices count as `Total x TipoCambio` with a flag (no such file in sample) | Pattern 2 problem codes | Low: none exist; confirm when one appears |
| A10 | Scrubbing `Descripcion`/`NoIdentificacion` in fixtures is acceptable | Fixture anonymization | Low: CONTEXT only mandates RFCs, names, UUIDs; descriptions are retained-by-choice otherwise |
| A11 | `emailVerified` is true for all personal Gmail accounts returned by Google | Pattern 6 | Low: DAL would deny; verify at first login |
| A12 | 365-day `expiresIn` is acceptable as the absolute session cap | Pitfall 2 | Low: owner can shorten; revocation = bump `cookieCache.version` and redeploy |

## Open Questions

1. **Does Google keep the production-status Drive refresh token alive past day 7/30?** What we know: documented rule is Testing => 7 days; In production is silent but standard practice says no expiry. Unclear: behavior for unverified + restricted scope. Recommendation: mint after publishing on day 0; verify day 8 and day 30; keep `pnpm drive:auth` runbook ready.
2. **Does `facturas-app-pointer.json` lookup by name in root work reliably?** Recommendation: verify in the tracer; fallback `appProperties`.
3. **What does "número de facturas" count?** Recommendation: Ingreso documents only; confirm with owner.
4. **Should the pointer folder be validated as owned by the owner's Drive?** Both users share the owner's credential, so "readable" is enough for Phase 1.
5. **Vercel Hobby vs Pro.** Hobby is restricted to non-commercial personal use [CITED: fair-use guidelines]; this is a business tool. Not blocking for Phase 1 (limits fit), but the owner should decide before relying on it.
6. **PDF listing in sync.** Phase 1 ignores PDFs entirely; ING-05 (Phase 2) will pair them. Confirm no Phase 1 UI needs PDF counts (D-02 counts XML only).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | 24.14.0 | — |
| pnpm | package manager | yes | 12.10.1 local; project pins 11.5.2 via `packageManager` | — |
| git + remote | Vercel deploy via Git integration | yes | 2.54.0; `origin` = github.com/marcos611morales/invoice-checker (reachable) | — |
| Vercel CLI | optional manual deploy | no | — | Git integration, or `pnpm dlx vercel` |
| gh CLI | optional | no | — | web UI |
| Playwright Chromium | e2e smoke | yes (cached chromium-1228) | — | `pnpm exec playwright install chromium` |
| Network to Google APIs | spikes, sync | yes (HTTP 401 from `googleapis.com/drive/v3/about` unauthenticated = reachable) | — | — |
| Google Cloud project, OAuth clients, consent screen "In production" | AUTH-01/05 | **unknown, human task** | — | none (blocking, day 0) |
| Vercel project linked to the repo + env vars | AUTH-04 | **unknown, human task** | — | none (blocking for deploy slice) |
| python3 | none in product (used only for my research scripts) | yes | 3.14.4 | — |

**Missing dependencies with no fallback:** GCP/OAuth setup and Vercel project (human). **With fallback:** Vercel/gh CLIs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.3 (environment `node`); Playwright 1.64.0 for anonymous smoke |
| Config file | none yet — Wave 0 creates `vitest.config.ts` with explicit alias `@` -> `src` (do not rely on tsconfig-paths plugin) |
| Quick run command | `pnpm vitest run tests/unit` |
| Full suite command | `pnpm vitest run && pnpm eslint . && pnpm tsc --noEmit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google login works | manual UAT on deployed URL (real Google) + config unit test | `pnpm vitest run tests/unit/auth-config.test.ts` | Wave 0 |
| AUTH-02 | Non-allowlisted denied everywhere | unit (`allowlist`), integration (DAL with `testUtils`), **structural** (all entry points call DAL), Playwright anonymous 307/401 | `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/entrypoints-guarded.test.ts` | Wave 0 |
| AUTH-03 | Session persists; logout | manual UAT + unit asserting `expiresIn`/`cookieCache.maxAge`/`updateAge` values | `pnpm vitest run tests/unit/auth-config.test.ts` | Wave 0 |
| AUTH-04 | Reachable at shared URL | smoke: `curl -sI https://<app>.vercel.app/` -> 307 to `/login` | `pnpm exec playwright test tests/e2e/anonymous.spec.ts` | Wave 0 |
| AUTH-05 | Drive works >7 and >=30 days | manual day-8/day-30 check; unit for `invalid_grant` -> Spanish message | `pnpm vitest run tests/unit/drive-errors.test.ts` | Wave 0 |
| ING-01 | Folder URL/ID parse, validate, XML count | unit with `FakeDriveApi` (nested year folders, trashed, `_app`, shortcut) | `pnpm vitest run tests/unit/settings-service.test.ts` | Wave 0 |
| ING-02 | Sync progress and resume | unit: `BATCH_SIZE=2`, kill after N calls, assert converge; budget exhaustion | `pnpm vitest run tests/unit/sync-service.test.ts` | Wave 0 |
| ING-04 | Same UUID never duplicates | unit: same file re-import, same UUID in two files, edit, delete canonical | `pnpm vitest run tests/unit/sync-dedupe.test.ts` | Wave 0 |
| LEDG-01 | BOM, prefixes, single concept, no declaration, unknown complements, DTD | unit over 143 fixtures + synthetic | `pnpm vitest run tests/unit/cfdi-parse.test.ts` | Wave 0 |
| LEDG-02 | Exact decimals; recon within 0.10 | unit: every fixture recon; `Decimal` type guard (no `number` money fields) | `pnpm vitest run tests/unit/money-recon.test.ts` | Wave 0 |
| LEDG-03 | I +, E -, P 0, N/T omitted+reported | unit golden: Telmex 16,053.07; Google 13,679.30; net 217,880.82 | `pnpm vitest run tests/unit/spend-rules.test.ts` | Wave 0 |
| LEDG-07 | Anonymized fixtures, no real data | unit: placeholder-pattern scan; count == 143 | `pnpm vitest run tests/unit/fixtures-clean.test.ts` | Wave 0 |
| STOR-01 | State lives under `_app/` as JSON | contract test inspects `FakeDriveApi` tree | `pnpm vitest run tests/contract` | Wave 0 |
| STOR-03 | Same behavior behind port with fake | contract suite `describe.each([memory, driveFake])` | `pnpm vitest run tests/contract` | Wave 0 |
| DASH-04 | Ranking and monthly evolution | unit on analytics with golden values; RSC render covered by manual UAT | `pnpm vitest run tests/unit/analytics.test.ts` | Wave 0 |
| DASH-09 | es-MX formatting | unit: formatter outputs (`$1,234.50`, `jun`, `49.5%`), `lang="es-MX"` in layout source | `pnpm vitest run tests/unit/format.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched area>`
- **Per wave merge:** `pnpm vitest run && pnpm eslint . && pnpm tsc --noEmit`
- **Phase gate:** full suite green + manual UAT checklist (login, denied account, sync, dashboard) + day-8 Drive check recorded; day-30 check tracked as post-phase

### Wave 0 Gaps
- [ ] `vitest.config.ts`, `tests/` tree, `package.json` scripts (`test`, `lint`, `typecheck`, `drive:auth`, `fixtures:build`, `spike:drive`)
- [ ] `scripts/build-fixtures.ts` + committed `tests/fixtures/cfdi/*.xml` (143) + `tests/fixtures/synthetic/*.xml`
- [ ] `adapters/memory/fake-drive-api.ts` (tree with folders, md5, modifiedTime, trashed, pagination, injected failures/latency)
- [ ] contract suite shared by memory and Drive-backed repositories
- [ ] Playwright config + anonymous smoke spec (baseURL from env)
- Framework install: `pnpm add -D vitest@5.0.3 @vitest/coverage-v8@5.0.3 @playwright/test@1.64.0 tsx`

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) [VERIFIED: .planning/config.json read this session: `"security_enforcement": true`, `"security_asvs_level": 1`, `"security_block_on": "high"`].

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Google OIDC via Better Auth; no passwords; account picker `prompt: select_account` |
| V3 Session Management | yes | Encrypted (JWE) httpOnly secure SameSite cookies; 30-day inactivity, 365-day cap; revoke-all by bumping `cookieCache.version` + redeploy; logout button |
| V4 Access Control | yes | `requireUser()` DAL on every page, action, route; allowlist re-evaluated per request (D-19); structural test prevents unguarded entry points |
| V5 Input Validation | yes | zod for env, Drive JSON, parsed CFDI, folder input; DTD rejection; `Sec-Fetch-Site` + JSON content-type check on `/api/sync` |
| V6 Cryptography | yes | No custom crypto; `BETTER_AUTH_SECRET` high-entropy (library warns on low entropy [VERIFIED: local run warning]); refresh token only in env var, `server-only`, never logged |
| V7/V8 Error handling, data protection | partial | Spanish operator errors without stack traces or tokens; fiscal data never sent to third parties in this phase (no AI) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auth bypass via middleware-only checks (CVE-2025-29927 class) | Elevation | DAL in every entry point; `proxy.ts` optimistic only; Server Function POSTs verified inside actions |
| Email allowlist evasion (case, unverified email, alias) | Spoofing | lowercase exact match + `emailVerified`; env-only list (D-16) |
| Owner Drive token theft (full-Drive scope) | Info disclosure | env var only, `server-only` modules, no logging, no cookie copy; rotate by re-running script and revoking at myaccount.google.com/permissions |
| XML entity expansion / DTD | DoS | reject `<!DOCTYPE|<!ENTITY`; fast-xml-parser >= 5.6 (5.11.2 pinned) |
| Malformed/huge Drive JSON overwriting state | Tampering | zod validate before write; refuse overwrite on invalid; `schemaVersion` |
| CSRF on `POST /api/sync` | Tampering | SameSite=Lax cookies + `Sec-Fetch-Site: same-origin` check + JSON content type |
| Cross-site scripting via supplier names/descriptions | Tampering | React escaping; no `dangerouslySetInnerHTML`; fixtures include hostile names |
| Secrets in git | Info disclosure | `.env*` ignored, `.env.example` only; `Facturas/` ignored; fixtures guarded by placeholder-pattern test |

## Sources

### Primary (HIGH confidence)
- Local first-hand analysis of `Facturas/2025/*.xml` (143 files): type/namespace census, reconciliation, supplier/Telmex/Google totals, relations, sizes (aggregated; no personal data reproduced).
- Local probes on installed packages (scratch dirs): better-auth@1.7.7 stateless boot, `databaseHooks` without DB, `testUtils`, session refresh source (`dist/api/routes/session.mjs`), exports; fast-xml-parser@5.11.2 behavior; `@googleapis/drive@26.0.2` request/retry config; `create-next-app@16.4.0` scaffold output; Node 24.14 type stripping and `Intl` es-MX.
- npm registry via `npm view` (versions, dates, peers) and `gsd_run query package-legitimacy check`.
- https://nextjs.org/docs/app/api-reference/file-conventions/proxy (v16.4.0, 2026-09-04): proxy convention, Node runtime default, Server Function matcher caveat.
- https://vercel.com/docs/functions/configuring-functions/duration (2026-08-24): `maxDuration` export, Hobby 300 s, Pro 800 s.
- https://vercel.com/docs/limits/fair-use-guidelines (2026-09-14): Hobby non-commercial.
- https://developers.google.com/identity/protocols/oauth2: refresh-token invalidation conditions.
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update: no conditional headers documented; scopes.
- https://developers.google.com/workspace/drive/api/guides/appdata: `drive.appdata` requirement, hidden folder.

### Secondary (MEDIUM confidence)
- https://www.better-auth.com/docs/concepts/session-management and /docs/authentication/google (stateless mode, cookieCache options, Google redirect URI, `prompt`/`accessType`).
- https://support.google.com/cloud/answer/15549945 (publishing status, unverified cap; silent on token handling at status change).
- https://developers.google.com/workspace/drive/api/guides/ref-search-terms and /guides/properties (query terms; `appProperties` private to the app; limits).
- Prior project research: `.planning/research/{STACK,ARCHITECTURE,PITFALLS,FEATURES,SUMMARY}.md` (cited where relied on).

### Tertiary (LOW confidence)
- Web-search summary that third-party Drive projects report `etag` field selection errors and ignored `If-Match`; unconfirmed against Google docs. Treated as hypothesis A1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and peers re-verified today; legitimacy audit run; scaffold actually generated.
- Architecture: MEDIUM-HIGH — ports/sync design is conventional; Google-side lookups (A3, A4) unproven until the tracer.
- Parser/ledger/fixtures: HIGH — verified on all 143 files with a working anonymizer prototype.
- Auth: MEDIUM-HIGH — stateless mechanics verified in source and by probes; end-to-end Google flow and sliding renewal are spike items.
- Pitfalls: HIGH for data/library behavior; MEDIUM for Google token longevity (A5).

**Research date:** 2026-10-09
**Valid until:** 2026-10-23 (Next 16.4.0 is days old and Better Auth/Playwright release weekly; re-check pins at plan time)
