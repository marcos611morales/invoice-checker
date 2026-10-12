# Phase 1: Real Spend by Supplier - Research

**Researched:** 2026-10-09 (Drive-based scope); **re-researched 2026-10-12** for the browser-upload re-scope
**Domain:** Next.js 16.4 / Vercel walking skeleton: Google login with email allowlist, CFDI XML files uploaded and parsed in the browser, invoices kept only in the browser (IndexedDB) behind a storage port, exact-decimal ledger, Spanish dashboard computed in the browser
**Confidence:** MEDIUM-HIGH. Parser, data profile, Better Auth stateless mechanics and the IndexedDB semantics are first-hand HIGH (local probes). Real-browser behaviors (Safari eviction, `Clear-Site-Data` on a `fetch` response, `navigator.storage.persist()`, Turbopack bundling of the parser) are MEDIUM/LOW until a human or Playwright run proves them; each one is listed in "Assumptions Log" and "Validation Architecture".

> **Provenance note for this revision.** Sections marked *(carried 2026-10-09)* were verified in the earlier session and were not re-run today unless a tag says "re-verified 2026-10-12". New browser-path findings were verified today with local probes (extracted npm tarballs run from a scratch directory, no install), `esbuild` bundle measurements, the Next 16.4 docs bundled in `node_modules/next/dist/docs/`, and MDN/WebKit pages.

## Re-scope 2026-10-12 (what changed in this document)

The user re-scoped Phase 1 (CONTEXT D-20..D-29): **no Drive in Phase 1.** Invoices enter by selecting or dragging CFDI XML files in the browser; they are parsed in the browser with the unchanged Plan 01-04 parser, stored only in that browser (IndexedDB) behind a storage port, and the dashboard is computed in the browser. Drive moved to the new Phase 6.

| Area | Before (2026-10-09) | Now (2026-10-12) |
|------|---------------------|------------------|
| Ingestion | Owner refresh token, Drive folder, resumable server sync | File picker / drag-and-drop, client-side parse, no server involvement |
| Storage | JSON in `<folder>/_app/` via `DriveApi` port | `InvoiceStore` port: IndexedDB adapter + in-memory fake, one contract suite |
| Dashboard | Server Components read Drive, ship DTOs | Server renders the shell behind `requireUser()`; client computes DTOs from IndexedDB |
| Auth | Identity plane + Drive plane | Identity plane only (unchanged); Drive plane moved to Phase 6 |
| Deploy | Needs GCP consent "In production" for `drive` scope, Drive env vars | Identity scopes only; five env vars; no Drive env vars |
| Tests | `FakeDriveApi`, sync, manifest, day-8 token check | Ingest pipeline, IndexedDB contract suite, browser-wipe, authenticated Playwright with a minted session (new, see Finding 13) |

Kept (re-checked only where the browser path changes something): parser configuration and pitfalls, exact decimals, spend rules I/E/P, reconciliation, sample-data goldens, Better Auth stateless login and allowlist DAL, es-MX formatting, analytics/chart design, Vercel facts, test harness. Drive-specific material is condensed into the section **"Phase 6 reference (Drive) - not for Phase 1 planning"** near the end; findings were not deleted.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Re-scope 2026-10-12: browser upload instead of Drive
- **D-20:** Phase 1 has no Drive connection. Invoices enter only by uploading CFDI XML files in the browser. Google login and the email allowlist stay as decided in D-16..D-19, with identity scopes only.
- **D-21:** The upload accepts **XML files only**: several at once from the file picker, or dragged onto the page. Folders, ZIP files and PDFs are out of Phase 1.
- **D-22:** Each XML is **parsed in the browser** with the Phase 1 parser (Plan 01-04). The XML bytes never reach the server, and the server stores no invoice data.
- **D-23:** Parsed invoices are stored **only in that browser (IndexedDB)**, behind the storage interface (STOR-03), with an in-memory fake and one contract suite that runs on both. Nothing is shared between owner and partner in Phase 1; Drive replaces this storage in Phase 6. — **Reversibility:** reversible; the storage sits behind the port.
- **D-24:** Stored invoices are **deleted from the browser when the user signs out** ("Cerrar sesión", and "Usar otra cuenta" on the access-denied screen), and on demand with a **delete button that asks for confirmation**. If the browser holds invoices stored under a different account (for example a session that expired without signing out), they are **deleted as soon as another account signs in**.
- **D-25:** An upload shows a **progress bar and a counter**. At the end it shows a summary with three counts (new, already stored, with problems) and the problem list. D-07 and D-08 still apply to uploaded files. The exact copy lives in the UI-SPEC.
- **D-26:** Uploading an invoice whose UUID is already stored **never creates a duplicate** (ING-04): the stored invoice stays unchanged and the file counts as already stored. If one upload carries two different files with the same UUID, the first is kept and the others are listed as "UUID repetido".
- **D-27:** The first visit with no invoices in this browser shows a **guided empty state** that invites the user to upload XML files. The user never sees a dashboard full of zeros.
- **D-28:** The dashboard and the supplier detail are **computed in the browser** from the stored invoices, with the rules in D-11..D-15. Charts still receive pre-aggregated data. The server renders only the page shell behind the allowlist.
- **D-29:** The app is **deployed on Vercel** at the shared URL in Phase 1 (AUTH-04).

### Drive connection (moved to Phase 6)
- **D-01 [deferred]:** The owner authorizes Drive once with a **local script** (`pnpm drive:auth`, loopback consent). The script prints the refresh token, which is pasted into a Vercel env var. The token never passes through the app UI, and there is no in-app "Conectar Drive" button.
- **D-02 [deferred]:** The invoice folder is configured **in the app**. A "Ajustes" screen accepts a pasted Drive folder link or ID. It validates that the folder exists and is readable, shows how many XML files it sees (including year subfolders), and saves the folder ID. By default it looks for a folder named `Facturas/`. This replaces the research's `DRIVE_ROOT_FOLDER_ID` env var as the source of truth. An env var may still seed the initial default.
- **D-03 [deferred]:** All app state lives in **`<chosen folder>/_app/`**, where it is visible and can be backed up. Only the folder ID is stored somewhere fixed: a tiny bootstrap pointer the app can find before it knows the folder. Changing the folder means starting from the state in the new folder's `_app/`. — **Reversibility:** costly — moving state later means migrating the `_app/` files and the pointer format.
- **D-04 [deferred]:** **Both** allowlisted users can change the folder. No roles in v1.

### Sync (the Drive sync moved to Phase 6; the parse rules still apply to uploads)
- **D-05 [deferred]:** Sync is **manual**. A "Sincronizar" button shows the time of the last sync. The dashboard loads instantly from the stored JSON, and nothing syncs automatically on page load.
- **D-06 [folded]:** Progress shows a **bar and a counter** ("Importando 87 de 143…"). If a batch hits the function time budget, the client automatically calls the next batch until nothing remains. At the end it shows a summary: new, unchanged, with problems. Folded into D-25 for uploads.
- **D-07:** A file that fails to parse is **skipped and listed** with a reason, such as "no se pudo leer", "tipo N/T omitido" or "total no cuadra". The import never aborts because of one bad file. The full data-quality panel is Phase 4; Phase 1 only shows the list in the import summary (since the re-scope, the upload summary).
- **D-08:** If an invoice parses but its concepts don't reconcile with its `Total` (difference > $0.10), it **still counts, using the XML header `Total`**, and is flagged in the problem list.
- **D-09 [deferred]:** Sync **mirrors Drive**. A modified file is re-parsed, and a file deleted or trashed in Drive disappears from the dataset. The same UUID never creates a duplicate (ING-04).
- **D-10 [folded]:** First run shows **guided steps** in an empty state: 1) elegir carpeta, 2) Sincronizar. The user never sees an empty dashboard full of zeros. Folded into D-27 for uploads.

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
- How the browser reaches IndexedDB: the raw API or a small wrapper library, plus the database and object-store layout and its versioning. Any new package goes through the package legitimacy gate, and the user confirms the install.
- Whether parsing runs on the main thread or in a Web Worker, and how often the progress updates.
- The exact shape of the storage interface, as long as the Phase 6 Drive adapter can implement it.
- Visual design details: navigation, chart colors and the spacing of the Spanish copy. The defaults are shadcn and Recharts.
- (Done in Plan 01-03) How fixtures are anonymized for LEDG-07.
- (Moved to Phase 6) Where the D-03 bootstrap pointer lives, the sync batch size and time budget, the manifest diff strategy and the JSON shard layout.

### Deferred Ideas (OUT OF SCOPE)
- The Drive connection and sync (D-01..D-05, D-09), the upload saved to Drive (ING-03) and concurrent-safe edits (STOR-02) moved to Phase 6 on 2026-10-12.
- Folder, ZIP and PDF upload are out of Phase 1 (D-21).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Sign in with Google | Better Auth 1.7.7 stateless + Google, identity scopes only; already built in Plan 01-01; production redirect URI + consent screen in "Deploy" (Finding 10) |
| AUTH-02 | Allowlist on every page, action and API route | `requireUser()` DAL (built); structural test that every `page.tsx`/`route.ts` calls it and that no `"use server"` file exists; authenticated-denied Playwright case via minted session (Finding 13) |
| AUTH-03 | Session persists across refresh; logout button | Stateless cookie session (built); `SessionKeepAlive` still needed for the 30-day slide (Pitfall 10); logout now also wipes browser data (Finding 7) |
| AUTH-04 | Deployed on Vercel at a shared URL | Env vars, redirect URI, consent screen, anonymous smoke against production (Finding 10) |
| ING-04 | Same UUID never duplicates | In-batch first-wins (pure) + stored-wins inside one IndexedDB transaction (Finding 4, Pattern 3) |
| ING-06 | Upload XML in the browser (several / drag), parsed in the browser, files never leave the computer | File input + drop target, size cap before read, client-side `parseCfdi`, time-sliced loop, network-silence test (Findings 1-3, 8) |
| LEDG-01 | Parse CFDI 4.0 tolerant of BOM, prefixes, single concept, no declaration, unknown complements | Plan 01-04 parser (unchanged); isomorphic-safe (Finding 2) |
| LEDG-02 | Exact decimals; reconcile within $0.10 | decimal.js 10.6.0; measured max concept-level diff 0.01 *(carried)*; cents only at `toCents` |
| LEDG-03 | I adds, E subtracts, P zero, N/T omitted and reported | Discriminated union + goldens 217,880.82 / 16,053.07 / 13,679.30 |
| LEDG-07 | Parser covered by anonymized fixtures | Done in Plan 01-03 (143 fixtures + leak guard); Plan 01-04 adds synthetic files and tests |
| STOR-03 | Storage behind an interface; in-memory fake | `InvoiceStore` port, IndexedDB adapter + memory fake, one contract suite (Finding 5) |
| STOR-04 | Invoices only in that browser (IndexedDB), survive reload, deleted on sign-out or delete button | Layout/transactions (Finding 4), wipe orchestration + `Clear-Site-Data` backstop (Finding 7), no-server-data assertions (Finding 8) |
| DASH-04 | Supplier ranking and monthly evolution | Pure `src/analytics` over `Invoice[]` computed in the browser (Finding 9) |
| DASH-09 | Spanish UI with MXN formatting | `Intl.NumberFormat("es-MX")`; `<html lang="es-MX">` already set |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Sources: `./CLAUDE.md`, `./AGENTS.md`, `./.claude/CLAUDE.md` (read this session). Treated as locked.
- **Ask, never infer.** Anything not explicit in the request, code or `.planning/` is a question to the user, not a default. Open items are in "Open Questions".
- **Spanish (México)** for UI text and for answers; planning text stays English. Money displayed with `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`. SAT terms stay as is.
- **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` stay on). No `any`, `@ts-ignore`, `as`/`!` to silence errors. **zod** at every trust boundary (parsed XML, **and records read back from IndexedDB**). Money never in `number`: strings from XML, `decimal.js` for math, round only at presentation.
- `import "server-only"` on every module that handles tokens/API keys. The pure core (`src/domain`, `src/parsing`, `src/analytics`) and the browser adapter must **not** import `server-only`, `@/env`, or Node APIs, because they now run in the browser.
- Before finishing: `pnpm typecheck`, `pnpm lint`, `pnpm test`. Package manager **pnpm** only. Confirm with the user before installing dependencies, changing configuration or committing.
- **Stack pins (package.json, read this session):** `next 16.4.0`, `react 19.3.0`, `typescript 6.0.3`, `eslint 9.39.5`, `better-auth 1.7.7`, `fast-xml-parser 5.11.2`, `zod 4.6.5`, `decimal.js 10.6.0`, `recharts 3.10.1`, `vitest 5.0.3`, `@playwright/test 1.64.0`, `packageManager pnpm@11.5.2`, `engines.node 24.x`.
- **Forbidden:** `middleware.ts` (use `proxy.ts`), `next lint`, float money, Server Actions for file upload, sync `cookies()/headers()/params`, `cacheComponents`/React Compiler in v1, `@cfdi/*`, `@nodecfdi/*`, Tremor, SheetJS from npm.
- `Facturas/` holds real fiscal files: never commit, copy to fixtures, or send to external services. Tests use `tests/fixtures/cfdi/` (anonymized).
- **Reinterpretation recorded in CONTEXT (canonical_refs):** the rule "never ship raw invoices to the browser" assumed server-side data; in Phase 1 the invoices come from the user's own files and live only in their browser. Charts still receive pre-aggregated data (D-28).
- **AGENTS.md:** this is Next.js 16.4; read `node_modules/next/dist/docs/` before asserting Next behavior (done below, with file paths).
- GSD workflow: repo edits go through a GSD command.

## Summary

Phase 1 is still a well-bounded walking skeleton, and the re-scope **removes the riskiest parts** (owner Drive credential, token longevity, write concurrency) and replaces them with browser-platform risks that are far easier to test. The pure core (CFDI parser, exact decimals, spend rules, reconciliation, analytics) is unchanged and is isomorphic: no Node-only API is planned in `src/domain` or `src/parsing`, and a browser-platform `esbuild` bundle of `fast-xml-parser` + `decimal.js` + `zod` resolves with no Node built-ins (about **127 KB gzip** total, of which zod's classic build is 93 KB). Parsing cost is small: measured **0.13-0.22 ms per anonymized fixture** (2.6 KB average) in V8 on Node 24, so about 0.3-0.5 ms for a real 5.8 KB file; 1,000 files cost roughly 0.5-1 s of CPU on a desktop. **Recommendation: parse on the main thread with a 12 ms time slice and a yield between slices; no Web Worker in Phase 1.**

For storage, use **`idb` 8.0.4** (1.35 KB gzip, no dependencies, ISC, maintained by Jake Archibald's account) over raw IndexedDB or Dexie, with **`fake-indexeddb` 6.2.5** (dev) to run the *real* adapter in Vitest's node environment. Both are new dependencies and need the user's confirmation. I verified with those packages (run from extracted tarballs, nothing installed) that: a batch with dedupe inside one `readwrite` transaction works with `getKey` + `put`; a caught `add()` `ConstraintError` still **aborts the whole transaction**; a connection that handles `blocking()` lets both `deleteDatabase` and a version upgrade proceed; and `deleteDB` is blocked by connections that ignore `versionchange`.

For the highest-value new behavior, browser-data deletion (D-24), use **three layers**: (1) a client `wipeBrowserData()` that runs *before* `authClient.signOut()` in `SignOutButton`/`SwitchAccountButton`; (2) an owner-email gate in the client provider that wipes before exposing any data when the layout's email differs from the stored meta owner; (3) a `Clear-Site-Data: "storage"` header on the sign-out response as a server-driven backstop. Better Auth 1.7.7 can add it two ways, **both verified working today**: a wrapper around the auth route's `POST` (documented surface, recommended) or `hooks.after` with `ctx.setHeader` (works, but undocumented). MDN's compatibility data lists `"storage"` support in Chrome/Edge 61, Firefox 63 and Safari 17.

A finding that **reverses the earlier research**: an authenticated Playwright session *is* feasible in Better Auth stateless mode. A cookie pair built from `better-auth/crypto`'s `symmetricEncodeJWT` plus an HMAC-signed `session_token`, minted by a test helper that knows the test server's `BETTER_AUTH_SECRET`, was accepted by a **fresh second auth instance** (`getSession` returned the user). That makes upload, persistence across reload, sign-out wipe, denied-account and CSP behavior testable in real Chromium instead of manual-only. It depends on Better Auth's cookie-cache payload shape, so it must be pinned (1.7.7) and covered by a canary test.

**Primary recommendation:** Keep the Plan 01-04 parser untouched; build `InvoiceStore` (port) + `MemoryInvoiceStore` + `IndexedDbInvoiceStore` (via `idb`) with one contract suite; a pure `ingestFiles()` pipeline (filter, size-cap, read, parse, in-batch first-wins, one atomic commit); a `useSyncExternalStore`-backed client provider mounted in the server `(app)` layout that opens IndexedDB only after mount and enforces the owner gate; client-computed analytics reusing the superseded 01-08/01-10 design; the three-layer wipe; a nonce-based CSP in `src/proxy.ts`; and an authenticated Playwright suite built on a minted session. Deploy needs only five env vars and the production redirect URI.

### Disagreements with prior research and with earlier assumptions (with evidence)

| # | Prior statement | Finding | Evidence |
|---|-----------------|---------|----------|
| 1 | STACK sample config `cookieCache.maxAge: 7 days` *(carried)* | Sliding 30 days needs `cookieCache.maxAge` = 30 d, a long `session.expiresIn`, and a client keep-alive. Config already built accordingly | [VERIFIED: src/auth/auth-config.ts read this session] `expiresIn: 365 * DAY_SECONDS,` / `maxAge: 30 * DAY_SECONDS,` / `refreshCache: { updateAge: 29 * DAY_SECONDS },`; refresh path behavior [VERIFIED 2026-10-09: better-auth dist/api/routes/session.mjs] |
| 2 | STACK: complements `terceros, ine, registrofiscal, implocal, iedu, cce20` "1-7 each" *(carried)* | Those namespaces are only **declared**; no element from them exists in the 143 files. Unknown-complement coverage needs synthetic fixtures (Plan 01-04 Task 2 has them) | [VERIFIED 2026-10-09: element census of 143 files] |
| 3 | STACK/ARCH: leave `cacheComponents` off *(carried)* | `create-next-app@16.4.0` generated it ON; Plan 01-01 removed it | [VERIFIED: 01-01-SUMMARY.md read] "`cacheComponents` and `partialPrefetching` removed" |
| 4 | `removeNSPrefix` plus DTD guard is "enough" *(carried)* | The DTD guard is necessary; fast-xml-parser 5.11.2 expands internal entities by default | [VERIFIED 2026-10-09: local probe] `<!DOCTYPE x [<!ENTITY a "AAAA">]><x>&a;</x>` parsed to `{"x":"AAAA"}`. Runs in the browser now, so it protects the user's own tab (self-DoS), not a server |
| 5 | STATE/CONTEXT: largest supplier "~47% of net spend" *(carried)* | With IVA (Phase 1 basis, D-15) it is 49.5% of net `Total`; ~47% is the sin-IVA share. Do not hard-code either in tests | [VERIFIED 2026-10-09: local scan] net `Total` 217,880.82; top issuer 107,862.43 |
| 6 | **01-RESEARCH (2026-10-09), `testUtils` section: "do not plan Playwright authenticated flows by minting cookies"** | **Reversed.** `testUtils` cookies are not portable, but a cookie pair minted with `symmetricEncodeJWT` + an HMAC-signed `session_token` was accepted by a second, fresh instance with the same secret | [VERIFIED 2026-10-12: local probe in scratch dir] output `second instance session: dueno@example.com`. See Finding 13 |
| 7 | STACK: fast-xml-parser "zero deps" | 5.11.2 declares six runtime dependencies (`@nodable/entities`, `fast-xml-builder`, `is-unsafe`, `path-expression-matcher`, `strnum`, `xml-naming`), all already installed and all browser-safe (esbuild `platform: "browser"` bundled it with no Node built-ins) | [VERIFIED 2026-10-12: node_modules/fast-xml-parser/package.json; esbuild 0.28.2 build] |
| 8 | CLAUDE.md: "charts are Client Components: pass pre-aggregated data from Server Components" | In Phase 1 the *client* computes the aggregates (D-28). Keep the intent (charts receive small DTOs, cents-rounded numbers, `YYYY-MM` keys), not the mechanism | CONTEXT canonical_refs note on `.claude/CLAUDE.md` |
| 9 | Superseded plans: `notFound()` in the supplier page for unknown RFCs | `notFound()` is documented for Server Components, Server Functions and Route Handlers only. Browser data cannot be known by the server, so unknown-but-well-formed RFCs need a client-rendered "not found" state | [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md, read] "`notFound()` can be invoked in Server Components, Server Functions, and Route Handlers." |
| 10 | Superseded Drive plans: `YearTransitionArea` with `useTransition` for `?anio=` | Year change is now a synchronous in-memory recompute; use shallow routing (`window.history.replaceState`) instead of a server round trip, no pending UI | [VERIFIED: next docs 01-app/02-guides/single-page-applications.md "Shallow routing on the client"] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Google sign-in, session cookie | Frontend Server (`/api/auth/[...all]`) | Browser (sign-in button, keep-alive ping) | Cookies/secret are server-side; stateless JWE cookie |
| Allowlist enforcement | API / Backend (`requireUser()` DAL in every page/layout; `requireUserApi()` in any handler) | Frontend Server (`proxy.ts` only sets CSP) | D-19; the server still gates *who may load the app shell*, even though it never sees invoices |
| File selection, drag-and-drop, size/extension filter | Browser | — | Files never leave the machine (D-22) |
| CFDI parse + validate (XML bytes to `Invoice`) | Browser (pure core) | — | D-22; same pure functions Plan 01-04 tests in Node |
| Dedupe by UUID | Browser: in-batch (pure) + stored (IndexedDB transaction) | — | D-26 |
| Invoice persistence | Browser storage (IndexedDB behind `InvoiceStore`) | — | D-23, STOR-04; Phase 6 swaps the adapter |
| Browser-data wipe (sign-out, other account, delete button) | Browser (`wipeBrowserData`, owner gate) | Frontend Server (`Clear-Site-Data` header on sign-out) | D-24; server header is a backstop for failures of the client path |
| Analytics (ranking, monthly, years) | Browser (pure `src/analytics`, `useMemo`) | — | D-28; milliseconds for ~1,000 invoices |
| Charts and tables | Browser (Client Components) | — | Recharts is client-only |
| Year selector | Browser (`?anio=` via `useSearchParams` + `history.replaceState`) | Frontend Server (page shell) | No data needed from the server |
| Supplier detail route | Frontend Server validates the RFC *format* and `requireUser()` | Browser computes and renders; renders its own "not found" | Server cannot know browser data |
| CSP and security headers | Frontend Server (`src/proxy.ts`) | — | Nonce per request; XSS is the main exfiltration path for IndexedDB data |
| Network-silence guarantee | Browser CSP `connect-src 'self'` + structural test + Playwright request sniff | — | No invoice data may reach the server |

## Standard Stack

### Core (all already installed by Plan 01-01; pins re-read from package.json this session)
| Library | Version | Purpose in the browser path | Why Standard |
|---------|---------|-----------------------------|--------------|
| next / react / react-dom | 16.4.0 / 19.3.0 | Server shell behind `requireUser()`, client screens | Pinned by CLAUDE.md |
| typescript | 6.0.3 | Strict types | typescript-eslint 8.71.1 caps TS below 6.1 |
| better-auth | 1.7.7 | Google identity, stateless JWE cookie | Built in Plan 01-01; sign-out route gets the `Clear-Site-Data` wrapper |
| fast-xml-parser | 5.11.2 | CFDI XML to object, now in the browser | 21 KB gzip bundled; browser-safe [VERIFIED 2026-10-12: esbuild `platform: "browser"`] |
| decimal.js | 10.6.0 | Exact money in parser, spend rules and analytics | 13 KB gzip; same class used in browser and tests |
| zod | 4.6.5 | Validate parsed CFDI **and records read from IndexedDB** | 93 KB gzip for the classic build (see Pitfall 11) |
| recharts (via shadcn `chart`) | 3.10.1 | Monthly and top-10 charts (client components) | Already installed; re-pin after any `shadcn add` |
| shadcn (Radix) + tailwindcss | 4.21.4 / 4.3.3 | UI primitives; `alert`, `badge`, `button`, `card`, `chart`, `input`, `label`, `progress`, `select`, `separator`, `skeleton`, `sonner`, `table` installed | Delete confirmation needs an `alert-dialog` (see Open Question 6) |
| vitest | 5.0.3 | Unit, contract and pipeline tests (node environment) | Node 24 provides `File`, `Blob`, `BroadcastChannel`, `structuredClone` globals [VERIFIED 2026-10-12: probe] |
| @playwright/test | 1.64.0 | Anonymous smoke **and** authenticated flows with a minted session | Chromium 1248 cached locally [VERIFIED: `ls ~/Library/Caches/ms-playwright`] |
| @t3-oss/env-nextjs, server-only | 0.13.11 / 0.0.1 | Server env validation (never imported by the browser core) | Built in Plan 01-01 |

### New for the browser path (user must confirm each install; see Package Legitimacy Audit)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| idb | 8.0.4 (runtime) | Promise wrapper over IndexedDB: `openDB` with `upgrade`/`blocking`/`terminated`, typed stores, transactions with `tx.done` | The IndexedDB adapter only (`src/adapters/indexeddb/`) |
| fake-indexeddb | 6.2.5 (dev) | Spec-faithful IndexedDB implementation for Vitest's node environment | The IndexedDB adapter's contract tests; import `fake-indexeddb/auto` in those test files only |

### Installed but dormant until Phase 6 (do not use in Phase 1)
`@googleapis/drive` 26.0.2, `google-auth-library` 11.2.0, `p-limit` 7.3.3, `p-retry` 8.0.1, `src/ports/drive-api.ts`, `src/adapters/drive/*`, `scripts/drive-*.ts`, optional `DRIVE_*` keys in `src/env.ts`. They are server-only and imported by no route, so they add nothing to any bundle. Do not delete them (Phase 6 reuses them).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb | Raw IndexedDB API | No dependency, but about 60 lines of hand-written promise/transaction plumbing; the classic bug is awaiting a non-IDB promise inside a transaction (auto-commit) or mishandling `onupgradeneeded`/`onblocked`. Acceptable only if the user refuses any new dependency |
| idb | Dexie 4.4.6 (Apache-2.0, no runtime deps, 3.2 MB unpacked) | Richer query/live-query API we do not need (no indexes, one `getAll`); much heavier |
| fake-indexeddb | Real-browser tests (`@vitest/browser` or Playwright) | Truer to the engine, but needs another package and a harness. Use the authenticated Playwright suite as the real-browser backstop instead |
| Main-thread parse with yielding | Web Worker | See Finding 3: not needed under ~2,000 files; the parser is isomorphic so a worker can be added later behind `ingestFiles`'s `parse` seam |

**Installation (for the planner; the user confirms before it runs; pnpm writes `^` ranges, so re-pin to exact as in 01-01 Deviation 2):**
```bash
pnpm add --save-exact idb@8.0.4
pnpm add -D --save-exact fake-indexeddb@6.2.5
```
**Version verification (2026-10-12, `npm view`):** idb 8.0.4 (published 2026-10-06, previous 8.0.3 on 2025-05-07), fake-indexeddb 6.2.5 (2025-11-07), dexie 4.4.6 (2026-09-10) [VERIFIED: npm registry]. `next` latest is 16.4.0 and `better-auth` latest is 1.7.7, so the pins are still current [VERIFIED: `npm view <pkg> dist-tags.latest`]. `vitest` latest is 5.0.4 (pin is 5.0.3; not worth a bump now). If pnpm's release-age gate rejects the 6-day-old idb 8.0.4 (as it did for `@types/node` in Plan 01-01), fall back to idb 8.0.3 or add a `minimumReleaseAgeExclude` entry [ASSUMED: gate threshold].

## Package Legitimacy Audit

Ran `node .claude/gsd-core/bin/gsd-tools.cjs query package-legitimacy check --ecosystem npm idb dexie fake-indexeddb` on 2026-10-12. Package names for this phase came from the orchestrator's brief (project-authored), not from open web search; no Context7/docs provider is configured, so none carries a docs-confirmed tag and **every new install still goes behind a `checkpoint:human-verify`** (project rule: the user confirms every install). No `postinstall` script exists for any of them (`npm view <pkg> scripts.postinstall` printed nothing; seam signal `postinstall: null`).

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|--------------|-------------|---------|-------------|
| idb 8.0.4 | npm | 11.5 yrs (created 2015-04-02), ISC, maintainer `jaffathecake`, **zero dependencies** | 26.8M | github.com/jakearchibald/idb | SUS (`too-new`: the latest *version* is 6 days old; package itself is old) | Recommended; flagged: planner adds `checkpoint:human-verify`. Mitigation done: I diffed the 8.0.3 and 8.0.4 tarballs locally (`npm pack`, extracted, no install): only `package.json` version and four small refactors in `build/index.js` (`Object.is`, object cache instead of `Map`, array order), no network or `eval` use |
| fake-indexeddb 6.2.5 (dev) | npm | 11.4 yrs (created 2015-05-09), Apache-2.0, maintainer `dumbmatter`, zero dependencies, `engines.node >=18` | 7.6M | github.com/dumbmatter/fakeIndexedDB | OK | Recommended; checkpoint because it is a new install |
| dexie 4.4.6 | npm | 12 yrs (created 2014-08-21), Apache-2.0, two maintainers, zero dependencies, 3.2 MB unpacked | 2.6M | github.com/dexie/Dexie.js | OK | Evaluated, **not recommended** (not installed) |
| All other Phase 1 packages | npm | years | see 2026-10-09 audit | official repos | `too-new` SUS only (latest-version age), approved and installed by the user in Plan 01-01 ("aprobado") | Approved *(carried)* |

**Packages removed due to [SLOP] verdict:** none. **Flagged [SUS]:** `idb` (reason `too-new` only; evidence above).

## Architecture Patterns

### System Architecture Diagram

```
 Browser (owner or partner)                                              Vercel (Next 16.4 server)
 ───────────────────────────                                             ─────────────────────────
  GET /  ───────────────────────────────────────────────────────────▶  src/proxy.ts: nonce + CSP header
                                                                         │
                                                                         ▼
                                                                       (app)/layout.tsx  requireUser()  ── no session ─▶ 307 /login
                                                                         │  allowlist? no ─▶ 307 /acceso-denegado
                                                                         ▼  renders shell + <BrowserDataProvider email={email}>
  ◀── HTML shell + RSC payload (NO invoice data; only the email string) ─┘
  │
  ▼  hydrate; first render = "loading" snapshot on server AND client (no mismatch)
 BrowserDataProvider (client)
  │  useEffect → open IndexedDB (idb) ─▶ owner gate:  meta.ownerEmail ≠ layout email ?
  │                                          yes ─▶ wipe DB first, then publish empty snapshot
  │                                          no  ─▶ load() + zod validate each record ─▶ publish snapshot
  │  BroadcastChannel("facturas-store") ◀──▶ other tabs (changed | cleared | signed-out)
  ▼
 useSyncExternalStore ─▶ screens
   Dashboard (/)        : buildDashboardDto(invoices, ?anio=) ─▶ MonthlySpendChart, TopSuppliersChart, SupplierTable
   Supplier (/proveedores/[rfc]) : buildSupplierDetailDto(...) ─▶ chart, stats, or client "not found"
   empty snapshot       : guided empty state (D-27) with the upload control

 Upload (file input or window drop, any page)
   FileList ─▶ copy to array synchronously ─▶ filter .xml / reject others (listed)
            ─▶ for each file: size cap on file.size ─▶ await file.arrayBuffer() ─▶ parseCfdi(bytes, {fileId: file.name})
               (time-sliced, yield every 12 ms, progress "k de N")
            ─▶ in-batch dedupe: first UUID wins, others = "UUID repetido"
            ─▶ ONE IndexedDB readwrite tx: stored UUID wins ─▶ AddResult
            ─▶ UploadSummary { nuevas, yaGuardadas, conProblemas, problemas[] } ─▶ BroadcastChannel "changed"

 Sign-out / "Usar otra cuenta" / delete button
   wipeBrowserData() FIRST ─▶ authClient.signOut() ─▶ server POST /api/auth/sign-out
                                                       └─ response carries  Clear-Site-Data: "storage"  (backstop)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (public)/login, acceso-denegado         # built (01-01)
│   ├── (app)/layout.tsx                          # server: requireUser(); shell; <BrowserDataProvider>; <SessionKeepAlive/>
│   ├── (app)/page.tsx                            # server: requireUser(); <Suspense><DashboardScreen/></Suspense>
│   ├── (app)/proveedores/[rfc]/page.tsx          # server: requireUser(); await params; format check; <Suspense><SupplierScreen rfc/></Suspense>
│   ├── (app)/loading.tsx, error.tsx, not-found.tsx
│   └── api/auth/[...all]/route.ts                # wrapper that adds Clear-Site-Data on sign-out; the ONLY route handler
├── proxy.ts                                      # CSP + nonce only (no auth logic)
├── auth/                                         # built (01-01)
├── domain/ parsing/cfdi/ analytics/              # PURE, isomorphic: no server-only, no @/env, no Node APIs
├── ports/invoice-store.ts                        # the STOR-03 interface (types only)
├── adapters/memory/memory-invoice-store.ts       # fake: structuredClone in and out
├── adapters/indexeddb/indexeddb-invoice-store.ts # idb
├── upload/ingest.ts                              # pure pipeline, takes File[] + parse fn + InvoiceStore
├── browser/                                      # client-only glue: store singleton, wipe, useBrowserData, provider
├── components/{upload,dashboard,auth}/           # client components
└── lib/format.ts                                 # Intl es-MX formatters
tests/{unit,contract,integration,e2e,fixtures,helpers}/
```
`domain/`, `parsing/`, `analytics/`, `ports/`, `upload/` import nothing from `adapters/`, `app/`, `browser/` or any `server-only` module. Fixtures stay under `tests/fixtures/cfdi/` (never a path named `Facturas`, which `.gitignore` ignores) [VERIFIED: .gitignore read, first line `Facturas`].

### Pattern 1: `InvoiceStore` port, two adapters, one contract suite (STOR-03)
```typescript
// src/ports/invoice-store.ts  (pure types)
export interface StoreMeta { schemaVersion: 1; parserVersion: number; ownerEmail: string; createdAt: string; updatedAt: string }
export interface StoreSnapshot { invoices: Invoice[]; meta: StoreMeta | null; invalidRecords: number }
export interface AddResult { added: string[]; alreadyStored: string[] }          // UUIDs
export type StoreChange = { type: "changed" | "cleared"; at: number };
export class OwnerMismatchError extends Error {}
export interface InvoiceStore {
  load(): Promise<StoreSnapshot>;
  /** Atomic. A UUID already stored keeps the stored record (D-26). Throws OwnerMismatchError if meta.ownerEmail differs. */
  addNew(invoices: readonly Invoice[], owner: { email: string; parserVersion: number }): Promise<AddResult>;
  clear(): Promise<void>;                                   // invoices AND meta
  subscribe(listener: (change: StoreChange) => void): () => void;   // changes made by OTHER instances/tabs
  close(): void;
}
```
- The port is async and returns whole snapshots, so a Phase 6 Drive adapter (shards in `_app/`) can implement it unchanged; `ownerEmail` is simply ignored there. Keep it domain-shaped, not a key-value `save(name, json)`.
- **Contract suite** (`tests/contract/invoice-store.contract.ts`, `describe.each([["memory", makeMemory], ["indexeddb", makeIdb]])`): empty load has `meta: null`; `addNew` then `load` round-trips deep-equal; second `addNew` of the same UUID with a *different* field leaves the stored record unchanged and reports it in `alreadyStored`; same UUID twice inside one call: first wins, second is `alreadyStored`; an unstorable record (contains a function, so structured clone throws) **rejects and leaves nothing from that call stored**; `OwnerMismatchError` for a different email and nothing written; `clear()` removes invoices and meta; a **second instance on the same backing** sees the data (reload simulation) and receives `subscribe` events for the first instance's `addNew`/`clear`; stored records are copies (mutating a loaded invoice does not change the store). IndexedDB-only tests: a hand-inserted garbage record is skipped and counted in `invalidRecords`; v1 to v2 upgrade keeps data; `blocking()` closes the connection so another instance can `deleteDB`.
- The memory fake must `structuredClone` on write and read, otherwise aliasing hides bugs that IndexedDB would expose.

### Pattern 2: IndexedDB layout, transactions, versioning (STOR-04, D-23, D-26)
- **Database** `facturas`, **version 1**, two object stores: `invoices` (keyPath `uuid`, uppercase, no indexes: analytics always loads everything, about 2 KB per invoice, 1,000 invoices is about 2 MB [VERIFIED 2026-10-12: JSON size of 1,000 representative invoices 1.96 MB]) and `meta` (out-of-line key `"app"` holding `StoreMeta`). No `problems` store: the upload summary is ephemeral React state in Phase 1 (Phase 4's review panel is the first consumer; adding a store is a trivial `oldVersion < 2` step).
- **Upgrade pattern:** `upgrade(db, oldVersion) { if (oldVersion < 1) { create both stores } /* if (oldVersion < 2) { ... } */ }`; always add steps, never rewrite earlier ones. `blocking()` must close the connection so another tab's newer version (or a `deleteDB`) can proceed; `terminated()` (browser killed the connection, for example after `Clear-Site-Data` or "clear site data") must drop the cached handle so the next call reopens.
- **Batch commit = one `readwrite` transaction over `["invoices", "meta"]`:** read `meta`, compare owner, `getAllKeys()` once into a `Set`, `add` only the missing ones, write/refresh `meta`, `await tx.done`. **Never `await` a non-IndexedDB promise inside the transaction** (it auto-commits and the next request throws `TransactionInactiveError`).
- **Do not rely on catching a duplicate-key error.** [VERIFIED 2026-10-12: probe with idb 8.0.4 + fake-indexeddb 6.2.5] a caught `add()` `ConstraintError` still ends with `tx.done` rejecting `AbortError` and nothing from the transaction stored. Check keys first.
- **Atomic and idempotent:** all-or-nothing per call; two tabs committing the same files serialize (readwrite transactions on one store do not overlap), so the second sees the first's writes and reports `alreadyStored`.
- **Validation on read:** `load()` runs `invoiceSchema.safeParse` per record; invalid ones are counted in `invalidRecords` and skipped, never deleted or overwritten (same rule as the Drive plan: never destroy state that fails validation). 1,000 representative invoices validate in 3-11 ms [VERIFIED 2026-10-12: zod 4.6.5 bench].
- **`StoreMeta.parserVersion`:** raw XML is not stored (D-22/D-23), so a future `PARSER_VERSION` bump cannot re-derive old records. Phase 1 stores the version used; Phase 2 decides between a "vuelve a subir tus XML" notice and keeping the XML text in a third store. See Open Question 4.
- **Quota / failures:** `QuotaExceededError` aborts the transaction (nothing stored); map to a Spanish error. 1,000 invoices (~2 MB) is far below any quota [CITED: MDN Storage quotas: Chrome up to 60% of disk per origin, Firefox 10% of disk (best-effort), Safari browser app up to 60%; WebKit blog "Updates to Storage Policy"].

### Pattern 3: Upload pipeline (`src/upload/ingest.ts`, pure, Web-API only)
```typescript
export type UploadProblemCode = ProblemCode | "no_es_xml" | "carpeta_no_admitida" | "lectura_fallida"; // extends 01-04 codes without editing them
export interface UploadProblem { archivo: string; code: UploadProblemCode; mensaje: string; contada: boolean }
export interface UploadSummary { nuevas: number; yaGuardadas: number; conProblemas: number; problemas: UploadProblem[] }
export async function ingestFiles(args: {
  files: readonly File[]; store: InvoiceStore; owner: { email: string; parserVersion: number };
  parse?: (bytes: Uint8Array, ctx: { fileId: string }) => ParseResult;   // default: parseCfdi (seam for a future worker)
  onProgress?: (p: { done: number; total: number }) => void; signal?: AbortSignal;
}): Promise<UploadSummary>;
```
Steps: (1) non-`.xml` names (case-insensitive) become `no_es_xml` problems, listed, never read; (2) `file.size > MAX_XML_BYTES` becomes `archivo_demasiado_grande` **before** `arrayBuffer()`; (3) read sequentially (or 4 at a time), `parseCfdi(new Uint8Array(buf), { fileId: file.name })`; (4) `ok` invoices with flags `total_no_cuadra`/`moneda_extranjera` are kept **and** listed with `contada: true` (D-08); `ok: false` results are listed with `contada: false`; (5) in-batch first-wins by UUID, repeats listed as `uuid_duplicado` ("UUID repetido", D-26); (6) one `store.addNew(unique)`; (7) `nuevas = added.length`, `yaGuardadas = alreadyStored.length`, `conProblemas = problemas.length`. Files = `nuevas + yaGuardadas + rechazados`. Interrupted by a reload before step 6: **nothing is stored** (see Finding 11).

### Pattern 4: Client store + provider (`src/browser/`)
Module-level singleton with `subscribe` / `getSnapshot` / `getServerSnapshot`, consumed with `useSyncExternalStore`. `getServerSnapshot` and the initial snapshot are the **same frozen `{ status: "loading" }` object**, so server and first client render match and there is no hydration mismatch; `getSnapshot` must return a cached object whose identity changes only when the data changes (otherwise React loops). IndexedDB is touched **only** inside a `useEffect` started by `<BrowserDataProvider email>`, never at module load (modules are also evaluated during SSR of Client Components). Snapshot states: `loading`, `unavailable` (no `indexedDB`, open failed, private-mode quirk), `ready { invoices, invalidRecords }`. See Finding 6.

### Pattern 5: Browser-data wipe, three layers (D-24)
`wipeBrowserData()` (client, no provider required) closes this tab's connection, runs `deleteDB("facturas")`, with a ~3 s timeout so it can never hang the sign-out, then broadcasts `cleared`. Callers: `SignOutButton`, `SwitchAccountButton`, the confirmed delete button (which may instead call `store.clear()`), and the owner gate. Order for sign-out: **wipe, then `authClient.signOut()`, then `router.replace("/login")`**. Server backstop: `Clear-Site-Data: "storage"` on the sign-out response. See Finding 7.

### Pattern 6: Identity plane and DAL *(retained from 2026-10-09; built in Plan 01-01)*
- `requireUser()` returns `{ email }` or redirects (anonymous to `/login`, denied to `/acceso-denegado`); `requireUserApi()`/`apiGateFor` return 401/403 JSON for handlers [VERIFIED: src/auth/require-user.ts read this session]. Comparison is lowercase/trim exact and requires `emailVerified` (Plan 01-01 tests).
- **No sign-in-time rejection hook**: D-17 shows the denied user's email, which needs the session to exist; the session grants nothing because every entry point calls the DAL. `/acceso-denegado` reads the session only.
- Structural test (Vitest, `node:fs` walk of `src/app`): every `page.tsx` and `route.ts` (except `/login`, `/acceso-denegado`, `api/auth/[...all]`) must call `requireUser(`/`requireUserApi(` after comment/import stripping; **plus new for the browser path:** zero files contain `"use server"`, and the only `route.ts` under `src/app/api` is `auth/[...all]` (so no handler can receive invoice data). Special files (`loading.tsx`, `error.tsx`, `not-found.tsx`) import no data module.
- Next 16.4 docs warn Server Functions are POSTs to the page route, so a `proxy.ts` matcher that excludes a path also skips them [VERIFIED: docs/01-app/03-api-reference/03-file-conventions/proxy.md "Execution order" note]. With no Server Functions in Phase 1 this is moot, but the structural test keeps it that way.
- In-process DAL tests keep using Better Auth's `testUtils()` (Plan 01-01 `tests/unit/require-user.test.ts`); that helper's cookies are not portable across instances, which is why Playwright uses the separate mint in Finding 13.
- **Sliding session needs `SessionKeepAlive`** (not yet built; the old plan 01-05 that carried it is superseded): a tiny client component in the `(app)` layout that calls `authClient.getSession()` on mount and on window focus at most once per hour, because Server Components cannot set cookies (Pitfall 10).

### Pattern 7: Dashboard analytics (carry-over from superseded 01-08/01-10)
Same pure modules and signatures, now fed by the client store: `yearsWithData`, `monthlyTotals`, `supplierRanking`, `supplierMonthly`, `toCents` (the **only** money-to-number boundary), `resolveYear`, `buildDashboardDto`, `buildSupplierDetailDto`, plus `src/lib/format.ts` (`formatMXN`, `formatMXNCompact`, `formatPercent`, `monthLabel`, `monthLabelLong`). Differences: inputs are `readonly Invoice[]` from the snapshot; `resolveYear` takes the `?anio=` string from `useSearchParams`; results are memoized with `useMemo` on `[invoices, anio]`; no DatasetService/`getDataset`/`estado_invalido` (replaced by the store snapshot states). See Finding 9.

### Anti-Patterns to Avoid
- **Touching `indexedDB`/`window` at module scope** or inside `getSnapshot` (SSR crash or hydration mismatch). Open lazily in an effect.
- **`deleteDatabase` as the only wipe with connections that ignore `versionchange`** (it blocks); every connection must implement `blocking()`.
- **Rendering "not found" before the store has loaded** (`status === "loading"` must render a skeleton, never a 404).
- **Awaiting `fetch`/timers inside an IndexedDB transaction.**
- **Storing `Decimal` instances or class objects** (structured clone drops prototypes). `Invoice` is plain strings; keep it that way.
- **Reading `event.dataTransfer` after an `await`** in a drop handler (Finding 1).
- **Reading whole files before checking `file.size`.**
- **Any `fetch`, `sendBeacon`, `XMLHttpRequest`, `WebSocket` in `src/upload`, `src/browser`, `src/adapters/indexeddb`, `src/analytics`, `src/parsing`** (Finding 8).
- **Carrying forward the superseded Drive structures** (`DatasetService`, `getDataset`, `SyncButton`, manifest). They are Phase 6 reference only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise/transaction plumbing | Hand-wrapped `IDBRequest`s | `idb` (1.35 KB gzip) | Transaction lifetime, `upgrade`/`blocking`/`terminated` callbacks, typed stores |
| IndexedDB in unit tests | A custom `Map`-backed fake of the IDB API | `fake-indexeddb` for the adapter; the *port's* memory fake stays hand-written (it is the product's fake, not an IDB fake) | Spec-faithful transaction semantics (aborts, blocked, versionchange) |
| XML parsing | Regex over CFDI | `fast-xml-parser` + DTD guard | Entities, namespaces |
| Money arithmetic | Integer-centavo juggling | `decimal.js` | 6-decimal unit prices |
| Currency/percent/month formatting | String building | `Intl.NumberFormat/DateTimeFormat("es-MX")` | Verified outputs below |
| Charts | SVG bars | shadcn `chart` (Recharts 3) | Theming, tooltips, a11y |
| Cross-tab notifications | `storage` events or polling | `BroadcastChannel` (platform) | Works in Node 24 for tests [VERIFIED 2026-10-12: probe] |
| File drop zone | A drop-zone library | Native `dragenter/dragover/drop` + `<input type="file" multiple>` | Folders, window-level default prevention and the keyboard path are small and need care, not a dependency |
| Yielding to the main thread | A scheduler library | `scheduler.yield()` if present, else `setTimeout(0)` | Chrome/Edge 129+, Firefox 142+; Safari lacks it |
| Session for authenticated e2e | Driving Google consent | A minted Better Auth cookie pair (Finding 13) | Google blocks automation |
| CSP nonce plumbing | Hand-built header injection per page | `src/proxy.ts` per the Next 16.4 CSP guide | Next attaches the nonce to its own scripts automatically |
| Sign-out header | A custom logout endpoint | Wrap the Better Auth route `POST` (or `hooks.after`) | Keeps Better Auth's cookie clearing |

**Key insight:** the code worth writing is the CFDI mapper, spend rules, `ingestFiles`, the `InvoiceStore` adapters and contract suite, the wipe orchestration, and the analytics. Everything else has a platform API or a small verified library.

## Browser-Path Findings (answers to the re-scope questions)

### Finding 1: Reading files in the browser (D-21, ING-06)
- **Control:** `<input type="file" multiple accept=".xml,application/xml,text/xml">`. `accept` is only a hint (the picker lets the user choose "All files"), and `file.type` is unreliable across OSes (empty, `text/xml` or `application/xml`), so **always filter by name** (`/\.xml$/i`) and list everything else as a `no_es_xml` problem without reading it [ASSUMED: HTML behavior, standard]. Reset `input.value = ""` after handling so choosing the same files again fires `change` again [ASSUMED]. An empty selection (picker cancelled) is a no-op: no summary, no state change.
- **Drag and drop onto the page:** register `dragenter`/`dragover`/`drop` on `window` while the upload UI is mounted. `drop` only fires if `dragover` was cancelled, and a drop outside a handled target makes the browser open or download the file, losing the app state, so call `preventDefault()` for events whose `dataTransfer.items` include a `kind === "file"` item [CITED: MDN "File drag and drop"]. `dragstart`/`dragend` do not fire for OS files; use a `dragenter`/`dragleave` counter for the overlay [CITED: same page]. Show the overlay only when `dataTransfer.types` includes `"Files"`.
- **Capture synchronously.** The drag data store is readable only in `dragstart` and `drop` handlers [CITED: MDN `DataTransferItem.webkitGetAsEntry`]. In the `drop` handler, before any `await`: `const items = Array.from(e.dataTransfer.items)`, take `item.webkitGetAsEntry?.()` and `item.getAsFile()` for each, then continue asynchronously with plain `File` objects. Entries with `isDirectory === true` become `carpeta_no_admitida` problems (folders are out of scope, D-21) [CITED: MDN, `isDirectory`; directories need entries because a directory's `getAsFile()` result cannot be read, ASSUMED]. Note: the same MDN page says `webkitGetAsEntry` may be renamed `getAsEntry`; code defensively with optional chaining.
- **Accessibility:** the drop zone is a pointer enhancement. The keyboard path is a real `<button>` ("Seleccionar archivos XML") that opens the native input (or a `<label>` bound to a visually hidden but focusable input); both must show the focus ring. Progress uses the installed shadcn `Progress` with an `aria-label`; the counter and the final summary live in a `role="status"` / `aria-live="polite"` region. Do not give the drop zone `role="button"`.
- **Size cap before reading:** check `file.size > MAX_XML_BYTES` first. [VERIFIED: 01-04-PLAN.md] `export const MAX_XML_BYTES = 2_000_000;` and `parseCfdi(bytes, ctx: { fileId: string })` rejects only after the bytes are already in memory, so the browser path needs its own pre-read check using the same constant.
- **Reading:** `new Uint8Array(await file.arrayBuffer())` then `parseCfdi(bytes, { fileId: file.name })`. Node 24 provides global `File`/`Blob.arrayBuffer`, so `ingestFiles` is testable in Vitest's node environment with `new File([bytes], "x.xml")` [VERIFIED 2026-10-12: probe, `File.arrayBuffer bytes: 7`].
- **`ctx.fileId` for an uploaded file = `file.name`.** [VERIFIED: 01-04-PLAN.md] `fileId: string` is required in `Invoice`; in the browser path there is no stable id, so the file name is used for provenance and for the problem list (Drive ids replace it in Phase 6). It is untrusted text: render as plain text with `break-all`. Cap stored length (for example 255 characters) in `ingestFiles`.

### Finding 2: The Plan 01-04 parser runs in the browser unchanged (D-22)
- **No Node-only API is planned.** [VERIFIED: 01-04-PLAN.md] the parser uses `XMLParser`/`XMLValidator` from fast-xml-parser, `decimal.js`, `zod`, and the global `TextDecoder`; its negative grep already bans `parseFloat|Number\(|new Date\(` in `src/domain` and `src/parsing`. fast-xml-parser 5.11.2's `exports` map has only `"."` (import/require conditions) and its six dependencies bundle for the browser [VERIFIED 2026-10-12: esbuild 0.28.2, `platform: "browser"`, no `node:` resolution errors].
- **Bundle impact (minified, esbuild, tree-shaking on) [VERIFIED 2026-10-12]:**

| Module | Minified | Gzip |
|--------|----------|------|
| fast-xml-parser (`XMLParser` + `XMLValidator`) | 63.5 KB | 21.3 KB |
| decimal.js | 32.3 KB | 13.0 KB |
| zod 4.6.5 (`import { z } from "zod"`, classic) | 453 KB | 93.1 KB |
| zod/mini (not usable: Plan 01-04 and 01-01 use the classic API) | 12.4 KB | 4.4 KB |
| All three together | 549 KB | 127.4 KB |
| idb 8.0.4 | 3.3 KB | 1.35 KB |

 Turbopack output will differ somewhat. For a two-user internal tool this is acceptable. Two cheap mitigations: load `@/parsing/cfdi/parse` with a dynamic `import()` inside the upload handler (keeps fast-xml-parser, 21 KB gzip, off the first dashboard load), and keep zod imports as named/namespace imports from `"zod"`. Do not try to swap schemas to `zod/mini` in Phase 1.
- **Rules that keep the core isomorphic** (add a structural Vitest test): no `import "server-only"`, no `@/env`, no `node:*`, no `process.env`, no `Buffer` under `src/domain`, `src/parsing`, `src/analytics`, `src/upload`, `src/ports`, `src/adapters/memory`, `src/adapters/indexeddb`. Import `Decimal` through `@/domain/money` everywhere (the plan configures precision/rounding there on the shared class; code that imports `decimal.js` directly could run with default precision).
- **SSR caveat:** Client Components are also executed on the server during prerender, so any module they import must be safe to evaluate in Node (no top-level `indexedDB`/`window`).
- **Turbopack production bundling of the parser is unproven** until `pnpm build` and a Playwright run exercise it [ASSUMED]; make "build passes and a fixture uploads in Chromium" a Wave-level gate.
- The DTD/ENTITY and size guards remain (T-01-14, T-01-15). They now protect the user's own tab (a hostile file could otherwise freeze it), not a server.

### Finding 3: Main thread vs Web Worker for parsing (D-25)
- **Measured cost** [VERIFIED 2026-10-12: local benchmark, Node 24.14 / V8, fast-xml-parser 5.11.2 with the planned options + `XMLValidator` + DTD regex + `TextDecoder` + Decimal sum of concept amounts, over `tests/fixtures/cfdi` (anonymized, 2,622 bytes average)]:

| Files parsed | Total | Per file |
|--------------|-------|----------|
| 143 (cold) | 31 ms | 0.217 ms |
| 1,001 | 148 ms | 0.148 ms |
| 2,860 | 382 ms | 0.134 ms |

 Real files average 5.8 KB *(carried: sample facts)*, about 2.2x the fixtures, so expect roughly **0.3-0.5 ms per file**, plus `File.arrayBuffer()` and zod mapping (validating 1,000 representative invoices took 3.4-11 ms in total). 1,000 files is about 0.5-1 s of CPU on a desktop; a low-end phone may be 3-6x slower [ASSUMED].
- **Recommendation: main thread, time-sliced.** Process files sequentially; keep a slice start time; after about **12 ms** of work call `await yieldToMain()` and flush progress. `yieldToMain` = `scheduler.yield()` when present, else `setTimeout(resolve, 0)` (Chrome/Edge 129+, Firefox 142+; not Safari) [CITED: developer.chrome.com/blog/use-scheduler-yield and secondary summary; Safari status MEDIUM]. Update React progress state at most every 50-100 ms (a counter does not need a re-render per file). `await file.arrayBuffer()` already crosses a task boundary, but do not rely on it for responsiveness.
- **When a worker becomes advisable:** more than about 3,000 files per batch or observed long tasks over 50 ms on the owner's devices. `ingestFiles` takes the parse function as a parameter, and the core is isomorphic, so a worker is a later swap. How it would be bundled: `new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" })`. The bundled docs confirm Turbopack's magic comments "work with ... `new Worker()` expressions" [VERIFIED: docs/01-app/02-guides/lazy-loading.md], but there is no dedicated Worker guide in the 16.4 docs, and a search surfaced a regression for relative-URL worker entries in 16.2.4 that was being fixed [CITED: search summary, LOW confidence]. A worker would also need `worker-src 'self'` in the CSP. Not Phase 1.

### Finding 4: IndexedDB: wrapper choice, layout, transactions, tabs, quotas (D-23, STOR-04)
- **Choice: `idb` 8.0.4** (legitimacy evidence in the audit table). Raw API is possible but easy to get wrong; Dexie is far heavier than the need. Layout, transaction recipe, upgrade pattern, validation-on-read and `parserVersion` are in Pattern 2. Probe results [VERIFIED 2026-10-12: idb 8.0.4 + fake-indexeddb 6.2.5 from extracted tarballs]:
  - batch 1 `[A, B, A]` gave `nuevas 2, repetidas [A]`; batch 2 `[B', C]` gave `nuevas 1, ya 1` and `B` stayed unchanged (stored wins);
  - caught duplicate `add()` aborts the transaction: `tx aborted after caught add error: AbortError | D stored? false`;
  - `clear()` from a second connection works while the first stays open (not blocked);
  - `deleteDB` is blocked when the open connection does not handle `versionchange`; with a `blocking()` handler that closes, `deleteDB` completes and the `blocked` callback never fires; an upgrade from v1 to v2 proceeds the same way (`old connection told to close (blocking)`, `upgrade 1 -> 2`);
  - `deleteDB` of a database that never existed does not create it; after a delete the database can be reopened empty.
- **Multiple tabs:** every connection implements `blocking()` (close and drop the handle; reopen lazily on the next call) and `terminated()` (handle gone, emit a local `cleared` refresh). After each successful `addNew` with `added.length > 0`, and after `clear`, post `{ type, at }` on `new BroadcastChannel("facturas-store")` (no data in the message). Other tabs re-`load()`. `BroadcastChannel` delivers to other channel objects, including those in the same process, which also makes cross-tab behavior unit-testable [VERIFIED 2026-10-12: probe]. Browser support is broad in current Safari, Chrome, Firefox [ASSUMED].
- **Persistence request:** call `navigator.storage.persist()` once after the first successful save and ignore the result. Chromium and Safari grant or deny silently from engagement history; Firefox shows a permission popup; it returns a Boolean, is not available in Web Workers, and requires a secure context [CITED: MDN `StorageManager.persist`, MDN Storage quotas]. Best-effort data is evicted all-or-nothing under storage pressure, least-recently-used origin first [CITED: MDN Storage quotas].
- **Safari:** with tracking prevention on, an origin with no user interaction for seven days of browser use has its script-created data deleted (cookies set by the server are exempt) [CITED: MDN Storage quotas]. A partner who opens the app less than weekly in Safari may find it empty; the UI should say "se guarda solo en este navegador" and re-upload is the recovery path. WebKit's own storage-policy post lists origin quota up to 60% of disk for browser apps and that `persist()` is granted by heuristics [CITED: webkit.org/blog/14403].
- **Private mode / blocked storage:** MDN says only that private browsing may apply different quotas and usually deletes data at the end of the session [CITED: MDN Storage quotas]. Browser-specific IndexedDB availability in private windows is not documented there [ASSUMED], so treat `openDB` rejection or a missing `indexedDB` as a first-class `unavailable` state with a Spanish message. Whether to degrade to an in-memory session store is a UX decision (Open Question 5).
- **Quota exceeded:** IndexedDB writes fail with `QuotaExceededError` [CITED: MDN Storage quotas]; surface a Spanish error, nothing stored.

### Finding 5: Storage port and how to test it (STOR-03)
- Port shape and the contract suite are in Pattern 1. A Phase 6 Drive adapter implements the same five methods (`load` reads shards, `addNew` writes them, `ownerEmail` ignored).
- **Vitest (node environment) recipe for the IndexedDB adapter:** in the IndexedDB contract test file only, `import "fake-indexeddb/auto"` (installs the global `indexedDB`), and in `beforeEach` assign `globalThis.indexedDB = new IDBFactory()` (import `IDBFactory` from `fake-indexeddb`) for isolation. `idb` looks up the global `indexedDB` at call time, so reassigning works [VERIFIED 2026-10-12: probe, `fresh factory is empty: true`]. Two store instances over the same factory simulate two tabs; `BroadcastChannel` is real in Node 24. `vitest.config.ts` needs no change (`environment: "node"`, `include: ["tests/**/*.test.ts"]`) [VERIFIED: vitest.config.ts read this session]; keep tests in `.ts` files.
- fake-indexeddb is spec-faithful but not an engine: 1,000 `put`s took 30 ms in the fake, which says nothing about Chrome or Safari timing. Engine-specific behavior (Safari eviction, `Clear-Site-Data` on `fetch`, persistence grants) is covered by the authenticated Playwright suite (Chromium only) and a human check on Safari/Firefox.

### Finding 6: Next 16.4 App Router with client-only data (D-27, D-28)
- **Server layout/page keep `requireUser()`** (D-19) and pass only the email string to `<BrowserDataProvider email={email}>`. The provider lives in the layout, so it persists across client navigations: IndexedDB is opened once per page load, not per route.
- **No IndexedDB during SSR and no hydration mismatch:** the external store's `getServerSnapshot` and initial `getSnapshot` return the same frozen `loading` object; the loading skeleton is rendered by both server and first client pass. The Next docs list three techniques for browser-only data: `dynamic(..., { ssr: false })`, a `useEffect` check, and React 19.3's `use(browser())` [VERIFIED: docs/01-app/02-guides/single-page-applications.md; `browser` exists in installed react-dom 19.3.0: `exports.browser = function (reason)` and `export function browser(reason?: string | (() => unknown)): BrowserUsable;` in @types/react-dom]. The `useSyncExternalStore` + explicit `loading` snapshot needs none of them because there is nothing to mismatch.
- **`?anio=` with `useSearchParams`:** it is a Client Component hook; for a prerendered route the client tree up to the closest `Suspense` is client-rendered and a static page without `Suspense` fails `next build`; for a dynamically rendered route it works on the server [VERIFIED: docs/01-app/03-api-reference/04-functions/use-search-params.md, "Prerendering" and "Dynamic Rendering"]. The `(app)` routes are dynamic because `requireUser()` awaits `headers()` [VERIFIED: src/auth/require-user.ts], but wrap the screen reading `useSearchParams` in `<Suspense fallback={<DashboardSkeleton/>}>` anyway (free, and it survives a future static change). Page `searchParams` is not needed.
- **Writing the year:** `window.history.replaceState(null, "", "?anio=2024")` "integrate[s] into the Next.js Router, allowing you to sync with usePathname and useSearchParams" [VERIFIED: docs single-page-applications.md "Shallow routing on the client"]. No server request, no pending state (the recompute is synchronous and takes milliseconds). Links to `/proveedores/[rfc]?anio=` are normal `next/link` navigations, which re-run the server page and therefore re-check the allowlist (good for D-19).
- **Supplier detail `/proveedores/[rfc]`:** the server page does `await requireUser()`, `await params`, `decodeURIComponent` in try/catch, uppercase, and validates the *format* `^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$` (carried from the superseded Plan 01-10); malformed gives `notFound()` (a decision that depends only on the URL, so it is valid on the server). It then renders `<Suspense><SupplierScreen rfc={rfc}/></Suspense>`. `SupplierScreen` computes `buildSupplierDetailDto` client-side and renders its own Spanish "Proveedor no encontrado" for a well-formed RFC absent from the data, because `notFound()` is documented for Server Components, Server Functions and Route Handlers only [VERIFIED: docs 04-functions/not-found.md] and the server cannot know browser data. That state has HTTP 200, which is fine behind login. **Never render "not found" while the snapshot is `loading`.** If the snapshot is `ready` with zero invoices, `router.replace("/")` so the user lands on the guided empty state (D-27).
- **Special files:** keep `(app)/loading.tsx` (server streaming skeleton), `error.tsx` (client boundary; the Next 16.4 boundary exposes `retry`, per the superseded 01-08 reading of the docs) and `not-found.tsx` for malformed RFCs and unknown URLs; they must import no data module. The client `loading` skeleton must have the same shape as the loaded screen (the UI-SPEC blocks apply: 28 px header, 280 px monthly block, 400 px top-10 block, 8 table rows).
- **Dev gotchas:** React Strict Mode runs effects twice in development, so `startBrowserData` must be idempotent; HMR can re-evaluate the store module, so keep the singleton on `globalThis` in development.

### Finding 7: Clearing browser data on sign-out, other account, and delete (D-24)
| Layer | What | Strength | Weakness |
|-------|------|----------|----------|
| 1. Client wipe before sign-out | `await wipeBrowserData()` then `authClient.signOut()` | Data is gone even if the network call fails; works on `/acceso-denegado` (no provider needed) | Skipped if the tab dies first; blocked by an unclosable foreign connection (none exist; all of ours close on `versionchange`) |
| 2. Owner gate on load | Provider compares the layout email (lowercase) with `meta.ownerEmail`; mismatch, or invoices present with no meta, wipes **before the first `ready` snapshot is published** | Covers session expiry without sign-out and a different account signing in (D-24 third clause) | Gmail dot/plus aliases count as "different" and wipe: safe direction |
| 3. `Clear-Site-Data: "storage"` on the sign-out response | Server backstop | Independent of client code paths | Browser behavior is the weak link (below); does not run on session expiry |
| 4. Delete button | Confirmed dialog, then `store.clear()` (invoices + meta, one transaction) and broadcast `cleared` | Never blocked by other tabs | Needs an AlertDialog (Open Question 6) |

- **`Clear-Site-Data` facts:** `"storage"` clears localStorage, sessionStorage, IndexedDB (`deleteDatabase` per database), service-worker registrations and more; it does **not** clear cookies (that is `"cookies"`); available only in secure contexts; directive strings must be quoted [CITED: MDN Clear-Site-Data]. Support, from MDN's browser-compat-data: header and `storage` from Chrome/Edge 61, Firefox 63, Safari/iOS 17 [CITED: mdn/browser-compat-data http/headers/Clear-Site-Data.json]. Do **not** use `"*"` or `"executionContexts"` (partial/unsupported in Chromium). **Not established by any source I could read:** whether each browser applies it to a `fetch()` response (the sign-out call is a `fetch`, not a navigation), and how it treats connections held open by other tabs [ASSUMED]. It is a backstop, so the planner should schedule a human check in Chrome, Firefox and Safari (DevTools, Application, IndexedDB empty after logout) rather than depend on it.
- **Adding the header with Better Auth 1.7.7 (both verified in a scratch process today):**
  1. **Wrapper around the route's `POST` (recommended; documented surface).** `toNextJsHandler(auth).POST(req)` returns a mutable `Response`; when `new URL(req.url).pathname.endsWith("/sign-out")`, `res.headers.set("Clear-Site-Data", '"storage"')`. Result: `200 "storage" 5 set-cookie headers` (all five Set-Cookie clearing headers preserved) [VERIFIED 2026-10-12: probe].
  2. `hooks.after` with `createAuthMiddleware` and `ctx.setHeader("Clear-Site-Data", '"storage"')` on `ctx.path === "/sign-out"` also works (`clear-site-data : "storage"` appeared in the response) [VERIFIED 2026-10-12: probe], but the Better Auth hooks page documents only reading `responseHeaders` and `setCookie`, not `setHeader` [CITED: better-auth.com/docs/concepts/hooks], so prefer the wrapper.
  Because `POST /api/auth/sign-out` answers 200 with the header even without a session, an **anonymous** Playwright test can assert it against production.
- **Failure modes and decisions:**
  - Wipe fails or times out (about 3 s): continue to `signOut()` and rely on layers 2 and 3.
  - `signOut()` fails after a successful wipe: the user is still signed in with an empty store (re-upload recovers); acceptable. `authClient.signOut()` resolves with `{ data, error }` rather than throwing, so check `error` and keep the user on the page with a Spanish message instead of redirecting.
  - Sign-out in tab A while tab B is open: A broadcasts `cleared` then `signed-out`; B drops its in-memory state and `router.replace("/login")`. A suspended tab that misses the message is caught by the server redirect on its next navigation.
  - Session expires without sign-out: data stays until the same account returns (kept, intended) or another account signs in (gate wipes before any render). `/login` and `/acceso-denegado` never read IndexedDB. Residual exposure window = XSS on those pages; the CSP covers it.
  - "Usar otra cuenta" on `/acceso-denegado`: the page is outside the provider, so `SwitchAccountButton` calls `wipeBrowserData()` directly before `signOut()` then `signIn.social`.

### Finding 8: Browser-side security for fiscal data (T-01-14, XSS, no data to the server)
- **CSP feasibility on Next 16.4 + Vercel.** [VERIFIED: docs/01-app/02-guides/content-security-policy.md] Nonces are generated in `proxy.ts`, Next extracts the nonce from the `Content-Security-Policy` header and attaches it to framework and page scripts; **all pages must be dynamically rendered** (no static optimization, PPR incompatible); dev needs `'unsafe-eval'`, production does not; a non-nonce alternative is a static header in `next.config` using `'unsafe-inline'`; SRI is experimental. Here: `(app)` routes are already dynamic; `/login` and `/acceso-denegado` must opt in with `await connection()` (a prerendered page would ship scripts without a nonce and break under `strict-dynamic`). There is **no `src/proxy.ts` in the repo today** [VERIFIED: `git ls-files | grep -E 'proxy|middleware'` printed nothing], so this is a new CSP-only file (matcher excluding `api`, `_next/static`, `_next/image`, `favicon.ico`, prefetches, per the guide).
- **Recommended policy:** `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` (+ `'unsafe-eval'` in dev only). `connect-src 'self'` is the exfiltration control; strict `script-src` is the injection control. `style-src 'unsafe-inline'` is a pragmatic exception because server-rendered `style="..."` attributes from React/Radix/Recharts are not covered by a style nonce [ASSUMED]; CSS cannot exfiltrate under `img-src 'self'`/`connect-src 'self'`. Google sign-in is a top-level navigation after a same-origin `fetch` returned the consent URL (the existing e2e test already asserts that URL), so `connect-src 'self'` should not block it [ASSUMED; the e2e suite exercises it]. Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- **Detecting CSP breakage:** an anonymous Playwright test that listens to `console` for "Content Security Policy" on `/login`, plus the same listener in the authenticated dashboard test with charts rendered (see Finding 13). The SSR'd button alone would pass a "button is visible" assertion even if hydration were blocked, so also click something that needs hydration.
- **XSS hygiene:** no `dangerouslySetInnerHTML` outside generated `src/components/ui` (grep gate, ESLint `react/no-danger`); supplier names, file names and problem messages render as React text; RFCs in URLs pass through `encodeURIComponent`; the hostile-name synthetic fixture (Plan 01-04: `sintetico-nombre-hostil.xml`, "an escaped script tag in Emisor Nombre") flows through analytics and the authenticated e2e test, which asserts the string appears as text and no dialog/handler fires.
- **XML guards stay in front of the parser:** `/<!DOCTYPE|<!ENTITY/i` on decoded text before `parser.parse`, `MAX_XML_BYTES`, `XMLValidator.validate`, parse errors mapped to listed problems (never thrown) [VERIFIED: 01-04-PLAN.md Task 2 action].
- **Proving "no invoice data reaches the server" (layers):** (a) *Architecture:* no `"use server"` file and the only `route.ts` is Better Auth's (structural test); (b) *CSP:* `connect-src 'self'` and no external origins; (c) *Unit:* run `ingestFiles` with 143 fixtures wrapped as `File`s while `globalThis.fetch`, `XMLHttpRequest`, `WebSocket` and `navigator.sendBeacon` are replaced by throwing stubs, then assert zero calls; (d) *Source guard:* a test that fails if `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `EventSource` appear under `src/upload`, `src/browser`, `src/adapters/indexeddb`, `src/analytics`, `src/parsing`; (e) *Playwright (authenticated):* record every request during upload, reload and navigation; allowed: GET to `/_next/*`, RSC navigations, `/api/auth/*`; assert no request body or URL contains `AAAAAAAA-0000-4000-8000` (the fixture UUID prefix) or `Comprobante`; (f) *Manual:* DevTools Network during a real upload.
- **Risk to record explicitly (user-accepted by D-23/D-24):** keeping business data in IndexedDB conflicts with the letter of OWASP ASVS V8 client-side data protection ("no sensitive data in browser storage") [ASSUMED: training-memory reading of ASVS 4.0.3 V8.2.2; confirm]. Mitigations that exist or are planned: no receptor data is stored [VERIFIED: 01-04-PLAN.md] "No receptor data is stored (privacy; not needed by any phase)"; three-layer wipe; CSP; visible "se guarda solo en este navegador" copy.

### Finding 9: Browser-computed analytics (D-28, D-11..D-15)
- Reuse the superseded 01-08/01-10 modules and DTOs as the design (they were never executed): `monthlyTotals(invoices, year)` = 12 zero-filled entries `YYYY-01..YYYY-12`; `supplierRanking` groups by `emisor.rfc`, `total = sumMoney(spendOf)`, `facturas` = count of tipo I (assumption A8, still to confirm), `nombre` from the invoice with the greatest `fecha` (ties: greatest `uuid`), `share` from unrounded Decimals (0 when the grand total is 0), sort by total desc then RFC asc; suppliers with only P documents are not listed; a year with only Pagos is not offered; a supplier whose documents net to 0 but include an I or E is listed at $0.00. DTOs: `MonthPoint { mes, total }`, `SupplierRow { rfc, nombre, total, porcentaje, facturas }`, `DashboardDto { anio, anios, total, meses, top, proveedores }`, `SupplierDetailDto { anio, anios, rfc, nombre, total, facturas, meses }`. `toCents(d)` = `d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()` is the only money-to-number boundary; `buildDashboardDto` returns `null` when no year has I/E data, which renders the empty state instead of zeros (D-27).
- Changes for the browser: functions take `readonly Invoice[]` straight from the snapshot; `resolveYear(requested, years)` receives the `?anio=` string from `useSearchParams` (integer present in the data, else the most recent year, else `null`); memoize with `useMemo([invoices, anioParam])`; no `getDataset`, `DatasetService` or `estado_invalido`. The store snapshot states replace them.
- Boundaries kept: `src/analytics` forbids `new Date(` and `parseFloat` (negative grep); month keys and years are string slices of `Fecha` (`fechaMonth`, `fechaYear` from Plan 01-04); `monthLabel("YYYY-MM")` may build a UTC `Date` from the key's numeric parts only (never from a CFDI `Fecha`).
- es-MX formatting re-verified on Node 24.14 ICU: `$1,234.50`, `-$1,234,567.50`, `$0.00`, `49.5%`, `jun`, `octubre de 2025`; compact `$108 k` for 107,862.43 [VERIFIED 2026-10-12: `node -e` probe]. Browser ICU can differ slightly (non-breaking spaces, "k" vs "mil"), so the format unit tests assert Node output after normalizing U+00A0, and the Playwright test asserts only stable substrings (for example the total `$217,880.82`).
- Goldens (carried; PROFILE.json re-read this session: `files 143`, `issuers 39`, `withBom 142`, `withoutDeclaration 1`, `singleConcept 89`, `netTotal "217880.82"`): net 217,880.82 over 39 issuers; the only issuer with Pagos nets 16,053.07 (7 I + 7 P); the only issuer with Egresos nets 13,679.30 (8 I 18,879.30 minus 3 E 5,200.00). Find anchors structurally (only RFC with tipo P / tipo E) so no real identity appears in tests. The local cross-check against the real XMLs (superseded 01-10 Task 3, a throwaway checker outside the repo, node builtins only, never printing RFC/name/UUID/file name) still applies, and the owner's UAT is now: upload `Facturas/2025/*.xml` in the deployed app and compare the rows named Telmex and Google Ads.
- Performance: a few thousand invoices is a few milliseconds of Decimal addition; no worker or index is needed.

### Finding 10: Deploy to Vercel without Drive (D-29, AUTH-04)
- **Env vars (Production):** `BETTER_AUTH_URL=https://<project>.vercel.app`, `BETTER_AUTH_SECRET` (at least 32 chars; `openssl rand -base64 32`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` (comma-separated, lowercase). [VERIFIED: src/env.ts read this session] the `server` schema marks these as required (`BETTER_AUTH_URL: z.url()`, `BETTER_AUTH_SECRET: z.string().min(32)`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`) and the four `DRIVE_*` keys `.optional()`, so the build does not need them. There are no client (`NEXT_PUBLIC_*`) variables by design.
- **Google Cloud:** one OAuth **Web** client; Authorized redirect URIs exactly `http://localhost:3000/api/auth/callback/google` and `https://<project>.vercel.app/api/auth/callback/google` [CITED: better-auth.com/docs/authentication/google, carried]. No Drive API, no Desktop client, no `drive` scope; the app requests `openid email profile` only (asserted by the existing e2e test and `auth-config.test.ts`).
- **Consent screen publishing (new decision point).** Google's page says apps in **Testing** are limited to up to 100 listed test users, authorizations by a test user expire after seven days, and projects **In production** are available to any Google account; requests for only non-sensitive scopes (openid, email, profile) do not need the trusted-user list or the unverified-app screen [CITED: support.google.com/cloud/answer/15549945]. STATE.md says the consent screen "does not need publishing" for identity-only scopes; that is true for the owner and partner if they are test users, **but** success criterion 1 requires that *any other* Google account sees our "Acceso denegado" screen. In Testing, a non-listed account is stopped by Google before reaching the app (the page implies it, but does not state the exact error) [ASSUMED]. Recommendation: publish the consent screen "In production" (identity scopes need no verification) so the denied-account path can be exercised. Needs a user decision (Open Question 2).
- **Vercel:** Git integration on `main`; Node 24.x (the `engines` field is set); framework preset Next.js; production URL is the stable `*.vercel.app` alias. Preview deployments cannot log in (`redirect_uri_mismatch`), so test auth only on production and localhost (carried Pitfall 10). A deployment alias other than the one in `BETTER_AUTH_URL` will fail Better Auth's origin check [ASSUMED], so share one URL. Hobby is non-commercial per Vercel's fair-use page (carried; Open Question 7).
- **Smoke:** `E2E_BASE_URL=https://<project>.vercel.app pnpm exec playwright test tests/e2e/anonymous.spec.ts` (the config already skips the local web server when `E2E_BASE_URL` is set) [VERIFIED: playwright.config.ts read]. Extend with: `/proveedores/EMI010101AAA` redirects 307 to `/login`; `POST /api/auth/sign-out` (with `Origin`) returns 200 and a `clear-site-data` header; `/login` response carries `content-security-policy` with a nonce and no CSP console errors. Authenticated e2e (Finding 13) runs against a local production build with a test secret, never against production.
- **From the superseded 01-05/01-09 plans, still applicable:** `SessionKeepAlive` (client, `authClient.getSession()` on mount and focus at most hourly) and the shell/`AppNav` (UI-SPEC) are Phase 1 work again; the structural entry-point test; the anonymous smoke. **Dropped (Phase 6):** health route, `proxy.ts` session redirect (the DAL already redirects; `proxy.ts` is now CSP-only), If-Match spike, day-8/day-30 token checks, Drive env vars, runbook sections for `drive:auth`.
- **Human prerequisites (blocking for the deploy slice):** GCP project + consent screen + Web OAuth client with both redirect URIs; Vercel project linked to the repo with the five env vars; permission to push `main` (project rule: confirm before commit/push).

### Finding 11: Edge cases to plan for
| Case | Expected behavior | How it is tested |
|------|-------------------|------------------|
| Empty selection / picker cancelled | No-op: no progress, no summary, no store call | `ingestFiles([])` returns an all-zero summary without touching the store; Playwright cancel |
| Only non-XML files | Each listed `no_es_xml`; nothing read; store untouched; `nuevas 0` | Vitest |
| Zero valid invoices | Summary with `nuevas 0` and the list; no `addNew` call; dashboard stays as it was (or empty state) | Vitest |
| Same UUID twice in one batch (different files) | First kept; others `uuid_duplicado` ("UUID repetido") | Vitest with `sintetico-uuid-repetido-a/b.xml` (Plan 01-04) |
| Re-upload of a stored UUID | Stored record unchanged; counted `yaGuardadas`; re-uploading all 143 gives `nuevas 0, yaGuardadas 143` | Vitest + contract |
| Hostile supplier name / file name | Rendered as text; no markup injected | Vitest (DTO text), Playwright |
| File over 2,000,000 bytes | `archivo_demasiado_grande`, never read | Vitest with a `File` of 2,000,001 bytes |
| Mixed years | `anios` newest first; `?anio=` defaults to the most recent; uploading an older year does not change the selected year | Vitest analytics |
| Folder dropped | `carpeta_no_admitida` listed; rest of the drop processed | Playwright (best effort) / manual |
| Reload mid-batch | **Nothing from that batch is stored** (single atomic commit at the end; parse is in memory); the user sees the previous state and re-uploads; no marker needed | Playwright (reload during a large upload) |
| Two tabs open | Upload in A refreshes B via `BroadcastChannel`; simultaneous uploads serialize in IndexedDB, second reports `yaGuardadas` | Contract test with two instances; Playwright with two pages |
| IndexedDB unavailable | `unavailable` snapshot with Spanish message; no crash | Vitest (stub missing `indexedDB`) |
| Corrupt stored record | Skipped, counted in `invalidRecords`, banner; never deleted | IndexedDB-specific contract test |
| Quota exceeded during commit | Transaction aborts; nothing stored; Spanish error | IndexedDB test with an injected `QuotaExceededError` (fake-indexeddb cannot produce it naturally: stub) |

 Chunked commits (partial persistence) are the alternative to the single end-of-parse commit; I rejected them because a reload would then leave a dashboard that silently shows only part of the batch, which would need a "carga interrumpida" marker and extra UI states. At about 0.5-1 s per 1,000 files the exposure window is small.

### Finding 12: Shell and session continuity
The signed-in shell (UI-SPEC: brand, `AppNav` active indicator, email, `SignOutButton`) stays server-rendered with `requireUser()` first, then renders the client `BrowserDataProvider`, the window-level upload drop overlay (so a drop works on any page), `SessionKeepAlive`, and the sonner `Toaster` (already in the root layout). The old Ajustes page and `SyncButton` are gone; the UI-SPEC update replaces them with the upload control, the progress/summary block, the empty state and the delete confirmation.

### Finding 13: Authenticated Playwright sessions are feasible (reverses the 2026-10-09 research)
- **Probe result [VERIFIED 2026-10-12: scratch script against the installed better-auth 1.7.7]:** with the same stateless options as `buildAuthOptions` (JWE cookie cache), a minter that used only `symmetricEncodeJWT` from the public `better-auth/crypto` export plus an HMAC-SHA256-signed `better-auth.session_token` produced a cookie pair that a **fresh second `betterAuth` instance with the same secret accepted** (`auth.api.getSession` returned the user). The earlier finding that `testUtils` cookies were not portable still holds; this is a different, self-contained mint.
- **What the `session_data` payload must contain:** the cookie-cache schema in `dist/cookies/cache.mjs` is `{ session: <session>, user: <user>, updatedAt: number, version?: string }` (a first attempt with an extra `{ session: { session, user } }` nesting was rejected with schema issues). The session `token` must equal the signed `session_token` cookie value, `expiresAt` must be in the future, and `version` must equal the configured cache version (default `"1"`) [VERIFIED: dist/api/routes/session.mjs lines 20-98 read; dist/cookies/cache.mjs read].
- **Helper shape (`tests/helpers/mint-session.ts`, never imported by `src/`):** takes `{ secret, email, emailVerified: true }`, returns the two cookies (names from `(await auth.$context).authCookies`: `better-auth.session_token`, `better-auth.session_data` for an `http://localhost` base URL; a `https` base URL adds the `__Secure-` prefix) to pass to `context.addCookies`. The signed value format is `encodeURIComponent(value + "." + base64(HMAC-SHA256(secret, value)))` [VERIFIED: better-call crypto.mjs `signCookieValue`].
- **Rules:** use only against a local production build started by Playwright's `webServer` with an explicit test `BETTER_AUTH_SECRET` and `ALLOWED_EMAILS=e2e@example.com` in `webServer.env` (not `.env.local`); never mint against production. It depends on Better Auth's internal cookie-cache format, so pin `better-auth` exactly (already pinned) and add a canary test that fails loudly if the minted cookie stops authenticating after an upgrade.
- **What it unlocks** (real Chromium, anonymized fixtures only): upload via `setInputFiles` and a synthetic drop, progress and summary, dashboard totals, reload persistence in real IndexedDB, sign-out wipe plus `Clear-Site-Data` header, denied account (email not in `ALLOWED_EMAILS` reaches `/acceso-denegado`), two different accounts in sequence (owner gate), CSP console check, the network-silence sniff, hostile name rendering. Safari and Firefox remain manual.

## Common Pitfalls

### Pitfall 1: A thrown error inside an IndexedDB transaction does not abort it
**What goes wrong:** A record that cannot be structured-cloned (or any exception in your own code) leaves the earlier writes of the same transaction committed.
**Evidence:** [VERIFIED 2026-10-12: probe, idb 8.0.4 + fake-indexeddb 6.2.5] adding `{uuid:"A"}` then `{uuid:"B", bad: () => 1}` threw `DataCloneError`; without `tx.abort()` the transaction resolved and `A` stayed stored; with `tx.done.catch(() => {}); tx.abort()` in the catch, `tx.done` rejected `AbortError` and nothing was stored.
**How to avoid:** wrap the whole batch in `try/catch`, call `tx.abort()` (after attaching a catch to `tx.done`) and rethrow. The contract test "an unstorable record rejects and leaves nothing from that call" fails without it.

### Pitfall 2: Catching a duplicate-key error does not save the transaction
`add()` on an existing key raises `ConstraintError` and the transaction still aborts (`AbortError` on `tx.done`) [VERIFIED 2026-10-12: probe]. Look keys up first (`getAllKeys`), then `add` only absent ones.

### Pitfall 3: Awaiting anything but IndexedDB requests inside a transaction
The transaction auto-commits when control returns to the event loop without a pending request; the next request throws `TransactionInactiveError`. Parse and validate **before** opening the transaction; inside it, `await` only `idb` calls. [ASSUMED: IndexedDB spec behavior; standard]

### Pitfall 4: Hydration mismatch and SSR crashes from client-only data
`useSyncExternalStore` requires `getServerSnapshot` in a component that is server-rendered; its value must equal the first client snapshot (`loading`). `getSnapshot` must return a stable cached object between changes (a fresh object every call loops). Importing `idb` is safe in SSR; **calling** `openDB`/`indexedDB` at module scope or during render is not. Open inside `useEffect`.

### Pitfall 5: Reading `DataTransfer` after an `await`
The drag data store is only readable during the `drop` event [CITED: MDN `webkitGetAsEntry`]; copy items, entries and files synchronously (Code Example D) before any async work.

### Pitfall 6: "Proveedor no encontrado" flashing while IndexedDB loads
The server cannot know browser data. The supplier screen must render the skeleton for `loading`, redirect to `/` for an empty store, and show its own 404 state only for `ready` data without that RFC.

### Pitfall 7: `deleteDatabase` blocked by your own other tab
A connection that ignores `versionchange` blocks deletes and upgrades [VERIFIED 2026-10-12: probe, `deleteDB blocked while connections open: true`]. Every `openDB` call passes `blocking()` (close + drop handle) and `terminated()`.

### Pitfall 8: `Clear-Site-Data` details
Values are quoted strings (`'"storage"'` in JS); `"storage"` does not clear cookies; it needs HTTPS (localhost counts as a secure context in practice) [CITED: MDN]; `"*"`/`"executionContexts"` are partial or unsupported in Chromium [CITED: browser-compat-data]. Treat it as a backstop and verify per browser by hand.

### Pitfall 9: CSP with nonces breaks statically prerendered pages
Next attaches the nonce only while rendering a request; a prerendered `/login` has none, and `strict-dynamic` then blocks its scripts [VERIFIED: Next 16.4 CSP guide]. Add `await connection()` to `/login` and `/acceso-denegado`, and keep `'unsafe-eval'` for development only. Detect with a Playwright console listener for "Content Security Policy".

### Pitfall 10: Sliding session silently becomes 7 days or a fixed 30 *(carried, still applies)*
In stateless mode the cookie cache is the only session store and the refresh path re-signs the cookie while keeping the embedded `expiresAt` [VERIFIED 2026-10-09: better-auth dist/api/routes/session.mjs]. The config (365-day cap, 30-day `cookieCache.maxAge`, 29-day `updateAge`) is built and unit-tested; renewal only happens if the browser calls the session endpoint, hence `SessionKeepAlive`. Observe real renewal once on the deployed URL [MEDIUM: derived from source, not yet observed end to end].

### Pitfall 11: zod's classic build is 93 KB gzip
Not a blocker for an internal tool (Finding 2). Do not "fix" it by introducing `zod/mini` mid-phase; the parser plan and Better Auth both use the classic API.

### Pitfall 12: `Decimal` configured in one module, used in another
Plan 01-04 sets precision/rounding in `src/domain/money.ts` on the shared class. Import `Decimal` via `@/domain/money` in analytics and tests so the configuration is always loaded.

### Pitfall 13: XML entity expansion and namespace-blind matching *(carried)*
Internal entities expand by default in fast-xml-parser 5.11.2 [VERIFIED 2026-10-09: local probe], `removeNSPrefix` hides which namespace an element belongs to, so keep the `/<!DOCTYPE|<!ENTITY/i` rejection on decoded text, require `Version === "4.0"`, root `Comprobante`, and match complements by local name at known paths only. `pago20:` declared in 9 files, real Pagos in 7.

### Pitfall 14: Dashboard numbers drift from the XML *(carried)*
Sums pass through `number`, percentages from rounded values, negative supplier net. Sum `Decimal`s, round only in `toCents`, compute `% del total` from unrounded Decimals, allow negative suppliers, count `facturas` as Ingreso documents only (assumption A8).

### Pitfall 15: Authenticated e2e cookies that Better Auth rejects
Wrong nesting of the cache payload, a token that differs between `session_token` and `session_data`, a missing `emailVerified: true`, an email not in the test server's `ALLOWED_EMAILS`, or the `__Secure-` cookie prefix when the base URL is https. Cover with the canary test (Finding 13).

### Pitfall 16: Safari removes data after seven idle days
See Finding 4. Not testable; it is a copy/UX concern ("se guarda solo en este navegador") and the reason re-upload must always be cheap.

### Pitfall 17: shadcn CLI rewrites pins
`shadcn add` writes `^` ranges and can downgrade `recharts` (01-01 Deviation 2 and 4). Re-pin after any `shadcn add` (for example `alert-dialog`) and re-run `pnpm ls recharts`.

### Pitfall 18: Preview deployments cannot log in *(carried)*
`redirect_uri_mismatch` on per-branch URLs. Register exactly localhost and the production URL; test auth only there.

### Pitfall 19: `fake-indexeddb/auto` in a shared setup file
It installs a global `indexedDB` for every test file. Import it only in the IndexedDB adapter tests so that the "IndexedDB unavailable" path stays testable elsewhere.

### Pitfall 20: Vitest only runs `tests/**/*.test.ts`
[VERIFIED: vitest.config.ts] `.tsx` tests are not collected. Keep logic in `.ts` modules (`ingest.ts`, `browser/*.ts`, analytics) so Vitest covers it without happy-dom/Testing Library, which are not installed.

## Code Examples

All TypeScript below is illustrative and must satisfy the project's `strictTypeChecked` lint (no `as`/`any`; narrow with guards or zod).

### A. CFDI parser entry *(carried; verified against all 143 files on 2026-10-09; unchanged in Plan 01-04)*
```typescript
import { XMLParser, XMLValidator } from "fast-xml-parser";
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true,
  parseAttributeValue: false, parseTagValue: false, trimValues: true,
  isArray: (name) => ["Concepto","Traslado","Retencion","CfdiRelacionado","Pago","DoctoRelacionado"].includes(name),
});
export function decodeCfdi(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new CfdiError("xml_no_permitido");
  return text;
}
// then XMLValidator.validate(text) === true, parser.parse(text).Comprobante -> zod -> Invoice (Decimal on every amount string)
```
Reconciliation (flag only the concept-level one for D-08): `diff = conceptTotal.minus(total).abs(); if (diff.gt("0.10")) flags.push("total_no_cuadra")` (strictly greater; exactly 0.10 is not flagged).

### B. Auth route with the sign-out header (verified pattern)
```typescript
// src/app/api/auth/[...all]/route.ts   (exempt from the DAL structural test, as today)
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";
const handlers = toNextJsHandler(auth);
export const { GET } = handlers;
export async function POST(request: Request): Promise<Response> {
  const response = await handlers.POST(request);
  if (new URL(request.url).pathname.endsWith("/sign-out")) {
    response.headers.set("Clear-Site-Data", '"storage"');   // verified: 5 Set-Cookie headers preserved
  }
  return response;
}
```

### C. Drop handler that captures everything synchronously
```typescript
function onDrop(e: DragEvent): void {
  const dt = e.dataTransfer;
  if (!dt || !Array.from(dt.types).includes("Files")) return;
  e.preventDefault();
  const picked = Array.from(dt.items).flatMap((item) => {
    if (item.kind !== "file") return [];
    const entry = item.webkitGetAsEntry?.() ?? null;       // may be named getAsEntry in future
    if (entry?.isDirectory) return [{ carpeta: entry.name }];
    const file = item.getAsFile();
    return file ? [{ file }] : [];
  });
  void startUpload(picked);                                // async work only AFTER the synchronous copy
}
// window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });   // required for drop to fire
```

### D. Time-sliced ingest loop (core of `ingestFiles`)
```typescript
const SLICE_MS = 12;
let sliceStart = performance.now();
for (const [i, file] of xmlFiles.entries()) {
  if (file.size > MAX_XML_BYTES) { problems.push(tooBig(file)); continue; }       // before reading
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = parse(bytes, { fileId: file.name.slice(0, 255) });
  /* classify: ok -> candidates (flags total_no_cuadra / moneda_extranjera also listed, contada: true); !ok -> problems (contada: false) */
  if (performance.now() - sliceStart > SLICE_MS) {
    onProgress?.({ done: i + 1, total: xmlFiles.length });
    await yieldToMain();                                  // scheduler.yield() if present, else setTimeout 0
    sliceStart = performance.now();
  }
}
/* then: in-batch first-wins by uuid; ONE store.addNew(unique, owner) */
```

### E. IndexedDB adapter: atomic `addNew`
```typescript
async addNew(invoices: readonly Invoice[], owner: { email: string; parserVersion: number }): Promise<AddResult> {
  const db = await this.open();
  const tx = db.transaction(["invoices", "meta"], "readwrite");
  try {
    const meta = await tx.objectStore("meta").get("app");
    if (meta && meta.ownerEmail !== owner.email) throw new OwnerMismatchError();
    const stored = new Set(await tx.objectStore("invoices").getAllKeys());
    const added: string[] = []; const alreadyStored: string[] = [];
    for (const inv of invoices) {
      if (stored.has(inv.uuid)) { alreadyStored.push(inv.uuid); continue; }
      stored.add(inv.uuid);
      await tx.objectStore("invoices").add(inv);          // only IndexedDB awaits inside the transaction
      added.push(inv.uuid);
    }
    await tx.objectStore("meta").put(nextMeta(meta, owner, this.now()), "app");
    await tx.done;
    if (added.length > 0) this.channel.postMessage({ type: "changed", at: Date.now() });
    return { added, alreadyStored };
  } catch (error) {
    tx.done.catch(() => undefined);                        // avoid an unhandled rejection
    tx.abort();                                            // a thrown error does NOT abort by itself (Pitfall 1)
    throw error;
  }
}
// openDB("facturas", 1, { upgrade(db, old) { if (old < 1) { db.createObjectStore("invoices", { keyPath: "uuid" }); db.createObjectStore("meta"); } },
//   blocking() { this.drop(); }, terminated() { this.drop(); } })
```

### F. External store for the client
```typescript
type BrowserData =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; invoices: readonly Invoice[]; invalidRecords: number };
const LOADING: BrowserData = Object.freeze({ status: "loading" });
let snapshot: BrowserData = LOADING;
const listeners = new Set<() => void>();
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getSnapshot = () => snapshot;                 // stable identity between changes
export const getServerSnapshot = () => LOADING;            // same object the client starts with
// Provider: useEffect(() => { void startBrowserData(email) }, [email])  -> owner gate, load(), publish
// Hook:     useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
```

### G. Sign-out with wipe first
```typescript
onClick={async () => {
  await wipeBrowserData();                                  // never throws; ~3 s timeout
  const { error } = await authClient.signOut();
  if (error) { /* keep user on page, Spanish message */ return; }
  router.replace("/login");
}}
```

### H. `src/proxy.ts` (CSP only; adapted from the Next 16.4 CSP guide)
```typescript
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "font-src 'self'",
    "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    "frame-ancestors 'none'", "upgrade-insecure-requests",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
// config.matcher per the guide: exclude api, _next/static, _next/image, favicon.ico, and prefetch requests
```

### I. Minting a Better Auth session for Playwright (verified in a scratch process)
```typescript
// tests/helpers/mint-session.ts  (test-only)
import { symmetricEncodeJWT } from "better-auth/crypto";
const now = Date.now(); const token = "tok_" + crypto.randomUUID().replaceAll("-", "");
const user = { id: "u1", email, emailVerified: true, name: "E2E", image: null, createdAt: iso(now), updatedAt: iso(now) };
const session = { id: "s1", token, userId: "u1", expiresAt: iso(now + 365 * 864e5), createdAt: iso(now), updatedAt: iso(now), ipAddress: null, userAgent: null };
const sessionData = await symmetricEncodeJWT({ session, user, updatedAt: now, version: "1" }, secretConfig, "better-auth-session", 30 * 86400);
// session_token cookie value = encodeURIComponent(`${token}.${base64(HMAC_SHA256(secret, token))}`); session_data cookie value = sessionData
// context.addCookies([{ name: "better-auth.session_token", value, url: baseURL }, { name: "better-auth.session_data", value: sessionData, url: baseURL }])
```
`secretConfig` was taken from `(await auth.$context).secretConfig` in the probe; the helper should obtain it the same way from an auth instance built with `buildAuthOptions` and the test secret.

### J. Network-silence sniff (Playwright, authenticated)
```typescript
const bodies: string[] = [];
page.on("request", (r) => { const b = r.postData(); if (b) bodies.push(b); const u = new URL(r.url()); expect(u.origin).toBe(origin); });
await page.setInputFiles('input[type="file"]', fixtureXmlPaths);          // tests/fixtures/cfdi only
/* wait for the summary, reload, open a supplier */
expect(bodies.join("")).not.toMatch(/AAAAAAAA-0000-4000-8000|Comprobante/);
```

## Fixture anonymization and sample-data facts *(carried; Plan 01-03 is complete)*

The 143 anonymized fixtures (`tests/fixtures/cfdi/001.xml`..., neutral names) and the leak guard `tests/unit/fixtures-clean.test.ts` exist [VERIFIED: `ls tests/fixtures/cfdi | wc -l` printed 144 = 143 XML + `PROFILE.json`; leak-guard header read this session]. Placeholders: `EMI010101xxx`/`EMIX010101xxx`, `RCP010101AA1`, `AAAAAAAA-0000-4000-8000-NNNNNNNNNNNN`, `PROVEEDOR NNN SA DE CV`, seals `SELLO`; synthetic files use `SIN010101xxx`, `BBBBBBBB-...`, `SINTETICO ...`. Fixtures average 2.6 KB because seals are replaced; real files average 5.8 KB.

**Synthetic fixtures** still required by Plan 01-04 Task 2: default namespace, alternate prefix, unknown complement, `ImpuestosLocales`, retenciones, IVA exento, USD with `TipoCambio`, tipo N and T, Version 3.3, truncated XML, DOCTYPE with entity, no BOM and no declaration, CRLF, zero-total invoice, two files with one UUID, Pago pointing to an absent invoice, hostile supplier name, recon 0.10 / 0.11.

| Fact | Value | Test use |
|------|-------|----------|
| Files / pairs | 143 XML (PROFILE.json `files 143`) | fixture count |
| `TipoDeComprobante` | I 133, E 3, P 7; no N/T | ledger |
| Version, prefix | 4.0 x143; root prefix `cfdi:` x143 | alt-prefix needs synthetic |
| BOM / no declaration | 142 with BOM (`withBom 142`); 1 without declaration (`withoutDeclaration 1`) | parser |
| Single-concept files | 89 of 143 (`singleConcept 89`) | forced arrays |
| Namespaces with elements | `cfd/4`, `TimbreFiscalDigital`, `Pagos20` only | complements |
| Relations | `04` x1, `07` x4 (single), `07,07` x1; 14 references, 1 dangling | Phase 2 |
| Issuers | 39 RFCs (`issuers 39`) | ranking |
| Net `Total` (I minus E) | 217,880.82 (`netTotal "217880.82"`) | dashboard grand total |
| Telmex | 7 I = 16,053.07; 7 P = 0 | success criterion 3 anchor |
| Google Ads | 8 I = 18,879.30; 3 E = 5,200.00; net 13,679.30 | success criterion 3 anchor |
| Months with data (by `Fecha`) | 2025-01..04: 1 each (penny invoices); 05: 9; 06: 25; 07: 13; 08: 23; 09: 17; 10: 18; 11: 20; 12: 14 | monthly chart |
| `Moneda` / `TipoCambio` | MXN x136, XXX x7 (Pagos); no FX in sample | no FX |
| Concept-level reconciliation | max abs diff 0.01 across the 136 non-Pago files | D-08 threshold has headroom |
| Sizes | XML 4.6-10.1 KB, mean 5.8 KB | per-file size cap irrelevant in practice |

Values not in PROFILE.json (relations, per-month counts, Telmex/Google Ads totals, sizes) were measured on 2026-10-09 and not re-run. Phase 1 caveat: a single `04` substitution relation exists, so plain `I - E` may overcount that one invoice until Phase 2's LEDG-04; the Google Ads net already comes out right.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` (Node runtime default) | Next 16.0 | Here used only for the CSP nonce; auth stays in the DAL [CITED: docs proxy.md] |
| Auth.js v5 beta | Better Auth stateless | 2025-26 | DB-less cookie sessions built in |
| `next lint` | `eslint .` | Next 16 | Add to CI/pre-commit |
| Hand-rolled IndexedDB | `idb` 8 | 8.0.0 (2023-12) | Drops EdgeHTML; one build with async iterators |
| `setTimeout(0)` to yield | `scheduler.yield()` with fallback | Chrome 129 (2024-09), Firefox 142 (2025-08) | Better task priority; Safari still lacks it [CITED] |
| Data via server fetch for browser-only state | `useSyncExternalStore` + explicit `loading` snapshot; React 19.3 `browser()` exists for first-render mismatches | React 19.x | No mismatch to suppress |

**Deprecated/outdated for this phase:** sync `cookies()`/`headers()`/`params` (always `await`); `deepseek-chat`/`deepseek-reasoner` (irrelevant).

## Phase 6 reference (Drive) - not for Phase 1 planning

> Everything below was researched on 2026-10-09 for the original Drive-based Phase 1 and is preserved, condensed, for Phase 6 (AUTH-05, ING-01, ING-02, ING-03, STOR-01, STOR-02). **None of it applies to Phase 1 plans.** Items tagged *(carried)* were not re-verified on 2026-10-12. Related dormant code: `src/ports/drive-api.ts`, `src/adapters/drive/{credentials,drive-errors,google-drive-api,tree}.ts`, `scripts/{drive-auth,drive-check}.ts`, optional `DRIVE_*` keys in `src/env.ts`. Superseded plans kept as reference: 01-02 (owner authorization; Task 1 code merged in f9355b4), 01-05 (Ajustes folder, pointer, deploy, health check), 01-06 (first sync, ports, fakes, contract suite), 01-07 (resumable sync), 01-08 (Drive-fed dashboard), 01-09 (hardening, If-Match spike, day-8 check), 01-10 (supplier detail, onboarding).

**Credential architecture (D-01).** Better Auth stays identity-only (`openid email profile`). Drive is reached with a plain `google-auth-library` `OAuth2Client` holding the owner's refresh token from env vars (`DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN`), built with a **Desktop-app OAuth client** (loopback redirect, nothing to register); login uses a separate **Web client**. `adapters/drive/credentials.ts` builds `OAuth2Client.setCredentials({ refresh_token })` and passes it to `@googleapis/drive`. Map `invalid_grant` to a Spanish operator message ("La autorización de Drive caducó. El dueño debe ejecutar `pnpm drive:auth` y actualizar DRIVE_REFRESH_TOKEN"). `pnpm drive:auth`: `generateCodeVerifierAsync`, `generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"], code_challenge, code_challenge_method: S256 })`, a `node:http` listener on `127.0.0.1`, `state` check, `getToken({ code, codeVerifier })`; print only `DRIVE_REFRESH_TOKEN=...`, never write it to disk or logs. *(carried)*

**Scopes, consent screen, token longevity.** `drive.file` is non-sensitive but only sees files the app created or the user shared via Picker; `drive`, `drive.readonly` are restricted. Default plan: `drive` for the owner's existing folder, behind the storage port so it can narrow later. Consent screen **Testing**: external users' refresh tokens expire in 7 days; publish **In production** (unverified is acceptable for a couple of users; cap is 100 new users lifetime once the unverified screen is shown) **before** running `drive:auth`, and re-mint after publishing because Google's page is silent about tokens minted earlier [CITED: developers.google.com/identity/protocols/oauth2; support.google.com/cloud/answer/15549945]. Other invalidations: user revokes, six months unused, 100 live refresh tokens per account/client, admin restrictions. The partner requests only identity scopes and should not see the unverified-app screen; Google's page now states non-sensitive scopes do not trigger the warning or the 7-day expiry [CITED: support.google.com/cloud/answer/15549945, 2026-10-12]. Service accounts are not viable for writes on a personal Gmail (0 GB quota, `storageQuotaExceeded`) [MEDIUM]. **AUTH-05** can be proven only by waiting: run `/api/health/drive` and a sync on day 8 and day 30 after minting; assumption A5 (production + unverified + restricted scope yields tokens that outlive 7 days) is unproven.

**Bootstrap pointer (D-03).** A tiny `facturas-app-pointer.json` at My Drive root: `{ schemaVersion, folderId, folderName, updatedBy, updatedAt }`, looked up with `files.list` `q="name = 'facturas-app-pointer.json' and 'root' in parents and trashed = false"`. Resolution order: pointer, `DRIVE_FOLDER_ID` env seed, a name search for a folder called `Facturas` offered as a suggestion. Rejected: `appDataFolder` (needs `drive.appdata`, hidden from the UI), Edge Config / env writes (second credential), env-only (change requires redeploy). Folder input: parse `https://drive.google.com/drive/folders/<id>` or a bare id (`/^[A-Za-z0-9_-]{10,}$/`), `getMeta` must be a non-trashed folder, count XML via BFS, then write the pointer and ensure `<folder>/_app/` exists (oldest wins if duplicates; memoize ids).

**State layout (STOR-01).** `_app/manifest.json { schemaVersion, parserVersion, syncStartedAt?, lastSyncAt, lastSummary, files: { [driveFileId]: { name, md5, modifiedTime, status: "ok"|"skipped"|"duplicate", reason?, uuid?, year?, canonicalFileId? } } }` and `_app/invoices-YYYY.json { schemaVersion, year, invoices: Invoice[] }`, sharded by the `Fecha` year (string slice). Canonical record for a UUID = file with the earliest `modifiedTime` (ties: lowest `fileId`); others `duplicate`, re-queued if the canonical is removed or changed. Every doc carries `schemaVersion`; reads validate with zod; **never overwrite a doc that fails validation**; cache ids after create (Drive list is eventually consistent, no name uniqueness).

**Sync design (ING-02).** Stateless-resume: each `POST /api/sync` relists the tree (BFS from `folderId`, `files.list` with `pageSize=1000`, skip a child folder named `_app`, `.xml` only, ignore shortcuts), diffs against the manifest (new, changed `md5Checksum`, all files when `parserVersion` changed, duplicates whose canonical changed; removed files are deleted from the dataset, D-09), processes a bounded batch (`BATCH_SIZE=25`, `DOWNLOAD_CONCURRENCY=8` with `p-limit`, call budget 90 s, `maxDuration=300`), writes shards first then the manifest (commit marker), returns `{ processed, remaining, counts, problems }`; the client loops until `remaining = 0`. Constants injectable for tests; latency estimate (143 files in 1-2 calls) is assumption A6. Route hardening: `requireUserApi()` first, reject `Sec-Fetch-Site` not `same-origin`, require `Content-Type: application/json`. The browser parser and summary types from Phase 1 are reused for upload-to-Drive (ING-03).

**Ports (STOR-03 for Drive).** `DriveApi { list(q), getBytes(id), getMeta(id, fields), createFile(...), updateFile(id, body) }` and `JsonDocStore { read(name), write(name, doc, { ifRev }) }` with a `FakeDriveApi` (folders, md5, modifiedTime, trashed, pagination, injected failures) so the Drive-backed repositories run the same contract suite as the memory and IndexedDB stores. Phase 6 adds a `DriveInvoiceStore implements InvoiceStore` (Pattern 1) over these.

**Write concurrency (STOR-02) and retries.** The official `files.update` reference documents no `If-Match` precondition [CITED: developers.google.com/workspace/drive/api/reference/rest/v3/files/update]; assumption A1 says it is ignored. Spike: create `probe.json` in a throwaway folder, read ETag/version, media-update with the correct and a stale `If-Match`, race five read-modify-write increments, record the `fields=etag` error, trash the folder. Decision rule: 412 on stale means implement CAS in `JsonDocStore.write(ifRev)`; 200 means Phase 3/6 corrections use per-user append-only logs (`_app/edits/<userKey>.json`, single writer, merged on read, last-writer-wins per key by timestamp). `@googleapis/drive` (gaxios) retries only idempotent methods (`httpMethodsToRetry: [ 'GET', 'HEAD', 'PUT', 'OPTIONS', 'DELETE' ]`), so wrap PATCH/POST in `p-retry` [VERIFIED 2026-10-09: local config dump]. Record both outcomes in PROJECT.md Key Decisions.

**Phase 6 spike acceptance (from the old Spike 1):** (a) token mints and `files.list` on the existing `Facturas/` folder returns pre-existing children; (b) creating the pointer and `_app/` succeeds with no `storageQuotaExceeded`; (c) partner login shows no unverified-app screen; (d) denied account reaches `/acceso-denegado`; (e) session cookie Max-Age renews with the keep-alive; (f) `@googleapis/drive` bundles under Turbopack without `serverExternalPackages` and the function size is sane; (g) day 8 and day 30 health checks pass. Fallback if the credential path fails: Auth.js v5 beta JWT strategy for identity only.

**Drive-specific threats:** owner Drive token theft (env var only, `server-only`, never logged, rotate by re-running the script and revoking at myaccount.google.com/permissions); malformed Drive JSON overwriting state (zod before write, refuse overwrite); CSRF on `POST /api/sync` (SameSite=Lax + `Sec-Fetch-Site` + JSON content type).

**Phase 6 research flags still open:** A1 (If-Match), A3 (pointer lookup by name in root with the `drive` scope), A4 (Desktop client refresh from a server), A5 (token longevity), A6 (sync latency).

## Runtime State Inventory

Not a rename/refactor/migration phase. The only new runtime state is the browser database `facturas` (IndexedDB, version 1) on each user's browser; it is created by the first upload and removed by sign-out, the delete button, or a different account signing in. Nothing is registered with the OS, Vercel or Google beyond the OAuth client and five env vars.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drive `files.update` ignores `If-Match` (no 412) | Phase 6 reference | Low for Phase 1; decides Phase 6 concurrency |
| A3 | Pointer lookup by name in My Drive root works with the `drive` scope | Phase 6 reference | Med (Phase 6) |
| A4 | A Desktop-client refresh token refreshes from a server with client id/secret only | Phase 6 reference | Low-Med (Phase 6) |
| A5 | "In production" + unverified + restricted `drive` scope yields tokens that outlive 7 days | Phase 6 reference | High impact, Phase 6 only |
| A6 | Initial Drive sync of 143 files finishes in 1-2 calls | Phase 6 reference | Low |
| A8 | "Facturas" per supplier counts Ingreso documents only | Finding 9 | Low: display-only; confirm with owner (Open Question 8) |
| A9 | Foreign-currency invoices count as `Total x TipoCambio` with a flag (none in the sample) | Plan 01-04 | Low |
| A11 | `emailVerified` is true for all personal Gmail accounts Google returns | Pattern 6 | Low: DAL would deny; verify at first login |
| A12 | A 365-day `expiresIn` cap is acceptable | Pitfall 10 | Low |
| B1 | `accept` is only a hint and `file.type` is unreliable; resetting `input.value` re-enables `change` for the same files | Finding 1 | Low: filter by name regardless |
| B2 | A dropped directory's `getAsFile()` cannot be read, so `webkitGetAsEntry().isDirectory` is needed; entries API is available in current browsers | Finding 1 | Low-Med: folder drops would surface as "no se pudo leer" instead of a clear message |
| B3 | A low-end phone parses 3-6x slower than the desktop measurement | Finding 3 | Low: time slicing still holds; worker is the escape hatch |
| B4 | Chromium, Firefox and Safari apply `Clear-Site-Data: "storage"` to a `fetch()` response and also delete databases held open by other tabs | Finding 7 | Med: only the backstop layer is affected; client wipe + owner gate remain |
| B5 | IndexedDB availability in Firefox/Safari private windows | Finding 4 | Low: `unavailable` state handles it |
| B6 | `BroadcastChannel` works in current Safari, Chrome, Firefox | Finding 4 | Low: tabs just refresh on next load |
| B7 | `style-src 'unsafe-inline'` is needed for server-rendered style attributes; `connect-src 'self'` does not block the Google sign-in navigation | Finding 8 | Low-Med: found by the CSP console e2e check |
| B8 | A Google account that is not a listed test user is stopped by Google (not by our denied page) while the consent screen is in Testing | Finding 10 | Med: decides whether the consent screen must be published (Open Question 2) |
| B9 | OWASP ASVS 4.0.3 V8.2.2 says client-side storage (including IndexedDB) must not hold sensitive data | Finding 8 | Low: documentation of an accepted risk |
| B10 | Turbopack production build bundles fast-xml-parser, zod, decimal.js and idb into client chunks without special config | Finding 2 | Med: caught by `pnpm build` + the authenticated e2e upload |
| B11 | pnpm's release-age gate might reject the 6-day-old idb 8.0.4 | Standard Stack | Low: fall back to 8.0.3 or add an exclude entry |
| B12 | A deployment alias other than `BETTER_AUTH_URL` is rejected by Better Auth's origin check | Finding 10 | Low: share a single URL |
| B13 | Playwright `setInputFiles` and a synthetic `DataTransfer` drop exercise the real handlers in Chromium | Finding 13 | Low-Med: fall back to `setInputFiles` only |
| B14 | `navigator.storage.persist()` is granted often enough to matter in Chrome for a regularly used site | Finding 4 | Low: best effort only |

## Open Questions (RESOLVED)

1. **Is there a cap on files per upload?**
   - What we know: 1,000 files is about 0.5-1 s of parsing and about 2 MB stored; the parser caps each file at 2,000,000 bytes.
   - What's unclear: whether the user wants a visible limit (for example 2,000 per upload) or none.
   - Recommendation: no cap in Phase 1 (progress handles it); ask the user at UI-SPEC time. This is a product rule, so do not invent one.
   - **RESOLVED:** D-35: 1,000 files per upload, with a warning above that.
2. **Publish the Google consent screen "In production"?**
   - What we know: identity scopes need no verification; Testing restricts to listed test users and expires their authorizations in seven days [CITED: support.google.com/cloud/answer/15549945].
   - What's unclear: whether the owner wants unknown Google accounts to reach our "Acceso denegado" page (success criterion 1) or to be stopped by Google.
   - Recommendation: publish "In production" so criterion 1 is observable; the user decides (it is a console setting only they can change).
   - **RESOLVED:** D-34: the owner publishes the consent screen "In production" (manual checkpoint in 01-17).
3. **How should the three summary counts overlap?**
   - What we know: the superseded UI-SPEC shows "Nuevas / Con problemas" and a "Contado"/"No contado" badge per problem; flagged invoices (`total_no_cuadra`, `moneda_extranjera`) are both counted and listed (D-08).
   - What's unclear: whether "con problemas" includes counted-but-flagged files.
   - Recommendation: `conProblemas = problemas.length` (includes flagged ones), as in the superseded UI-SPEC; confirm in the UI-SPEC update.
   - **RESOLVED:** D-36 and the UI-SPEC counting contract.
4. **Keep the raw XML so a future parser version can re-derive records?**
   - What we know: Phase 1 stores only the parsed `Invoice` plus `meta.parserVersion`; the XML never leaves the machine and is not stored (D-22/D-23). Phase 2 adds fields (LEDG-05/06) that the current `Invoice` already carries per concept, but a future change could need the original XML.
   - What's unclear: whether re-upload ("vuelve a subir tus XML") is acceptable as the migration path.
   - Recommendation: do not store XML in Phase 1; revisit in Phase 2 discussion.
   - **RESOLVED:** D-32: no raw XML; parserVersion in meta.
5. **IndexedDB unavailable: hard error or in-memory session mode?**
   - What we know: the in-memory store already exists as the test fake and could back a labelled "sin guardado" session.
   - What's unclear: whether the user wants that degradation (it weakens "stored in the browser" semantics) or just an error message.
   - Recommendation: error message only in Phase 1; ask before adding the fallback.
   - **RESOLVED:** D-33: error message only, upload disabled.
6. **Delete confirmation component.**
   - What we know: UI-SPEC forbids installing `dialog`/`collapsible`/etc. for the old design; `radix-ui` 1.7.0 is already installed, so shadcn `alert-dialog` adds a component file, not an npm package, but the shadcn CLI rewrites version ranges (Pitfall 17).
   - What's unclear: shadcn `AlertDialog` vs native `<dialog>`/`window.confirm`.
   - Recommendation: shadcn `AlertDialog` decided in the UI-SPEC update; re-pin after the CLI run.
   - **RESOLVED:** shadcn AlertDialog (UI-SPEC, approved 2026-10-12; confirmed at the 01-19 install checkpoint and added in 01-14).
7. **Vercel Hobby is non-commercial** [CITED: vercel.com/docs/limits/fair-use-guidelines, carried]. This is a business tool. Not blocking; the owner decides before relying on it.
   - **RESOLVED:** User 2026-10-12: deploy on Hobby for now; upgrading to Pro is recorded as a pending todo in STATE.md before relying on it for business use.
8. **What does "número de facturas" count?** Recommendation: Ingreso documents only (A8); confirm during UAT.
   - **RESOLVED:** D-37: "Facturas" counts I + E documents (not Ingreso only).
9. **Ship the nonce-based CSP in Phase 1?**
   - What we know: it is not in any requirement ID, but XSS is the main exfiltration path for browser-stored fiscal data and the app is already dynamic.
   - What's unclear: whether the user accepts the extra file (`src/proxy.ts`) and the `await connection()` on the two public pages in this phase.
   - Recommendation: yes; it is a config change, so confirm before executing.
   - **RESOLVED:** D-31: nonce CSP in src/proxy.ts in Phase 1.
10. **Who runs the Safari/Firefox manual checks and on which devices?** The owner's and partner's real browsers matter most (Safari's seven-day eviction affects exactly them).
   - **RESOLVED:** User 2026-10-12: the user runs the Safari and Firefox checks on their own and the partner's browsers during the 01-17 UAT, with a checklist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | 24.14.0 [VERIFIED: `node --version`] | — |
| pnpm | package manager | yes | 11.5.2 (matches `packageManager`) [VERIFIED: `pnpm --version`] | — |
| npm registry access | version checks, `npm pack` evidence | yes | `npm view` and `npm pack` worked | — |
| git + remote | Vercel Git integration | yes | `origin` = github.com/marcos611morales/invoice-checker [VERIFIED: `git remote -v`] | — |
| Playwright Chromium | e2e (anonymous and authenticated) | yes | chromium-1248 and headless shell cached [VERIFIED: `ls ~/Library/Caches/ms-playwright`] | `pnpm exec playwright install chromium` |
| Playwright WebKit / Firefox | cross-browser e2e | not installed | — | manual checks by the owner (Open Question 10); optional `playwright install webkit firefox` needs user confirmation |
| Google Cloud project, OAuth Web client with both redirect URIs, consent screen | AUTH-01/04 | unknown, human task | — | none (blocks the deploy slice) |
| Vercel project linked to the repo + five env vars | AUTH-04 | unknown, human task | — | none (blocks the deploy slice) |
| Vercel CLI / gh CLI | optional | not probed this session (earlier session: absent) | — | Git integration / web UI |

**Missing dependencies with no fallback:** GCP/OAuth setup and the Vercel project (human). **With fallback:** WebKit/Firefox automation (manual).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED: file read this session], so this section is required. It replaces the 2026-10-09 version.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.3 (environment `node`, `include: ["tests/**/*.test.ts"]`, `@` and `server-only` aliases) for unit, contract and pipeline tests; Playwright 1.64.0 (Chromium) for anonymous smoke and authenticated browser flows |
| Config file | `vitest.config.ts`, `playwright.config.ts` (both exist); Playwright's `webServer` needs an explicit test `env` (secret, `ALLOWED_EMAILS`) for authenticated specs |
| Quick run command | `pnpm vitest run tests/unit tests/contract` |
| Full suite command | `pnpm vitest run && pnpm lint && pnpm typecheck && pnpm build && pnpm exec playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Identity-only Google sign-in; consent URL has no `drive` scope | unit + e2e (anonymous) | `pnpm vitest run tests/unit/auth-config.test.ts`; `pnpm exec playwright test tests/e2e/anonymous.spec.ts` | yes (Plan 01-01) |
| AUTH-02 | Non-allowlisted denied on every page and route | unit (allowlist, DAL), structural walk, e2e: anonymous 307, minted non-allowlisted session reaches `/acceso-denegado` and shows its email, no `"use server"` file, only the auth `route.ts` | `pnpm vitest run tests/unit/allowlist.test.ts tests/unit/require-user.test.ts tests/unit/entrypoints-guarded.test.ts` | partly; structural test Wave 0 |
| AUTH-03 | Session persists across refresh; logout works; config is 30 d sliding / 365 d cap | unit (config) + e2e (minted session survives `page.reload()`; "Cerrar sesión" returns to `/login` and clears cookies) + manual (real renewal on the deployed URL) | `pnpm vitest run tests/unit/auth-config.test.ts`; `pnpm exec playwright test tests/e2e/browser-upload.spec.ts -g "sesión"` | config yes; e2e Wave 0 |
| AUTH-04 | Reachable at the shared URL | e2e anonymous against production (`E2E_BASE_URL`); sign-out answers with `clear-site-data`; `/login` carries a CSP header | `E2E_BASE_URL=https://<project>.vercel.app pnpm exec playwright test tests/e2e/anonymous.spec.ts` | extend existing spec |
| ING-04 | Same UUID never duplicates (stored wins, in-batch first wins, 143 re-uploaded = 143 already stored) | unit (pipeline over fixtures + synthetic duplicates) + contract | `pnpm vitest run tests/unit/ingest.test.ts tests/contract` | Wave 0 |
| ING-06 | Pick/drop XML, filter non-XML, size cap, progress, summary; parsed in the browser; files never leave the computer | unit (`ingestFiles` with `File` objects and network stubs), e2e (`setInputFiles`, synthetic drop, progress, summary, request sniff) | `pnpm vitest run tests/unit/ingest.test.ts tests/unit/no-network.test.ts`; `pnpm exec playwright test tests/e2e/browser-upload.spec.ts` | Wave 0 |
| LEDG-01 | Parse tolerance (BOM, prefixes, single concept, no declaration, unknown complements, DTD, size) and isomorphic imports | unit (Plan 01-04) + new import-guard test | `pnpm vitest run tests/unit/cfdi-parse.test.ts tests/unit/isomorphic-imports.test.ts` | Plan 01-04 / Wave 0 |
| LEDG-02 | Exact decimals; reconcile within $0.10 (0.10 not flagged, 0.11 flagged) | unit (Plan 01-04) | `pnpm vitest run tests/unit/money-recon.test.ts` | Plan 01-04 |
| LEDG-03 | I +, E -, P 0, N/T omitted and listed; goldens 217,880.82 / 16,053.07 / 13,679.30 | unit (Plan 01-04), analytics, e2e dashboard total | `pnpm vitest run tests/unit/spend-rules.test.ts tests/unit/analytics.test.ts` | Plan 01-04 / Wave 0 |
| LEDG-07 | Anonymized fixtures, no real data | unit (leak guard) | `pnpm vitest run tests/unit/fixtures-clean.test.ts` | yes (Plan 01-03) |
| STOR-03 | Same behavior on memory fake and IndexedDB adapter; atomic batch; stored wins; owner mismatch; cross-instance events; v1 to v2 upgrade; `blocking` close | contract suite (`describe.each`) + IndexedDB-specific tests with `fake-indexeddb` | `pnpm vitest run tests/contract tests/unit/idb-adapter.test.ts` | Wave 0 (needs `idb`, `fake-indexeddb`) |
| STOR-04 | Survives reload; deleted on sign-out, on delete button, and when another account signs in; nothing reaches the server | contract (new instance sees data), unit (owner gate, `wipeBrowserData`, sign-out sequence with stubs), e2e (reload persistence in real IndexedDB; logout leaves no `facturas` database; two minted users in sequence; request sniff), unit on the auth route wrapper (`Clear-Site-Data`) | `pnpm vitest run tests/unit/browser-data.test.ts tests/unit/auth-route.test.ts`; `pnpm exec playwright test tests/e2e/browser-upload.spec.ts` | Wave 0 |
| DASH-04 | Ranking, top 10, monthly evolution, supplier detail, ties, empty and single cases, year selection | unit (analytics, supplier detail) + e2e (dashboard shows the fixture total and 39 suppliers; supplier page; unknown RFC state) | `pnpm vitest run tests/unit/analytics.test.ts tests/unit/supplier-detail.test.ts` | Wave 0 |
| DASH-09 | es-MX formatting, `lang="es-MX"`, Spanish copy | unit (formatters) + e2e text assertions | `pnpm vitest run tests/unit/format.test.ts` | Wave 0 |
| Security (T-01-14/15, XSS, CSP) | DTD/ENTITY and oversize rejected; hostile name as text; CSP header present, no CSP violations, no inline-HTML escape hatches | unit (Plan 01-04 + `csp.test.ts` for the header builder + grep gates), e2e console listener | `pnpm vitest run tests/unit/csp.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched area>` (target under 30 s); parser-adjacent tasks also re-run `fixtures-clean`.
- **Per wave merge:** `pnpm vitest run && pnpm lint && pnpm typecheck`; waves that touch routes, CSP, auth or the provider also run `pnpm build && pnpm exec playwright test`.
- **Phase gate:** full suite green, then the manual list below, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `idb` 8.0.4 and `fake-indexeddb` 6.2.5 installed (user confirms; checkpoint:human-verify) and exact-pinned.
- [ ] `tests/contract/invoice-store.contract.test.ts` (shared suite, `describe.each`), `tests/unit/idb-adapter.test.ts`, memory fake with `structuredClone`.
- [ ] `tests/unit/ingest.test.ts`, `tests/unit/no-network.test.ts`, `tests/unit/isomorphic-imports.test.ts`, `tests/unit/browser-data.test.ts`, `tests/unit/auth-route.test.ts`, `tests/unit/csp.test.ts`, `tests/unit/entrypoints-guarded.test.ts` (adapted: also asserts no `"use server"` and a single `route.ts`), plus the analytics/format tests carried over from the superseded plans.
- [ ] `tests/helpers/mint-session.ts` and a canary test; `playwright.config.ts` `webServer.env` with a test secret and `ALLOWED_EMAILS`; `tests/e2e/browser-upload.spec.ts` skipped when `E2E_BASE_URL` is set.
- [ ] Plan 01-04 (parser, domain, synthetic fixtures, three suites) executes first; it is the dependency of every pipeline and analytics test.
- [ ] `src/proxy.ts` plus `await connection()` on `/login` and `/acceso-denegado` if the CSP is accepted (Open Question 9).

### Manual-only verifications (cannot be automated here)
| Behavior | Requirement | Why manual | Steps |
|----------|-------------|-----------|-------|
| Real Google sign-in for owner and partner at the production URL; a third account sees "Acceso denegado" with its email | AUTH-01, AUTH-02, AUTH-04 | Google blocks automated consent | Sign in with both allowlisted accounts and one other (consent screen decision in Open Question 2) |
| Sliding session renewal on the deployed URL | AUTH-03 | Needs real time or a lowered `updateAge` on a test deployment | Inspect `Set-Cookie` Max-Age of `better-auth.session_data` after a second visit past the update age |
| Safari and Firefox: upload, reload persistence, logout wipe, `Clear-Site-Data` effect (DevTools, Application, IndexedDB empty), `persist()` outcome | STOR-04 | WebKit/Gecko are not automated | Run the checklist on the owner's and partner's real browsers |
| Telmex / Google Ads totals against the real XMLs | LEDG-03, DASH-04 | Fiscal files never leave the machine; names are not in fixtures | Run the throwaway checker (node builtins only, no identifiers printed), upload `Facturas/2025/*.xml` in the deployed app, compare the rows named Telmex ($16,053.07, 7 facturas) and Google Ads ($13,679.30, 8 facturas) |
| Populated dashboard at 1280 px and 390 px; teal bar contrast | DASH-04, DASH-09 | CSS result and layout (UI-SPEC backstops) | Visual check |
| CSP on the production dashboard with real charts | Security | Console violations depend on the real build | Open DevTools console after an upload |

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high) [VERIFIED: .planning/config.json read this session: `"security_enforcement": true`, `"security_asvs_level": 1`, `"security_block_on": "high"`].

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Google OIDC via Better Auth; no passwords; account picker `prompt: select_account` (built) |
| V3 Session Management | yes | Encrypted (JWE) httpOnly SameSite cookies; 30-day sliding window, 365-day cap; logout wipes browser data; `SessionKeepAlive` |
| V4 Access Control | yes | `requireUser()` DAL in every page/layout, allowlist recomputed per request (D-19); structural test; no Server Functions and no route handlers other than Better Auth |
| V5 Input Validation | yes | Untrusted files: extension filter, `MAX_XML_BYTES` before read, DTD/ENTITY rejection, `XMLValidator`, zod on parse and **on IndexedDB reads**; `?anio=` through `resolveYear`; RFC route param by regex |
| V6 Cryptography | yes | No custom crypto; `BETTER_AUTH_SECRET` high entropy; test-only session minting uses the test secret and never touches production |
| V8 Data Protection (client-side) | yes | Business data in IndexedDB is a **user-accepted risk** (D-23) [ASSUMED: ASVS wording]; no receptor data stored; three-layer wipe; CSP `connect-src 'self'` and strict `script-src`; clear "solo en este navegador" copy |
| V14 Configuration / headers | yes | CSP with nonce, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS reads IndexedDB and exfiltrates | Information disclosure | Nonce CSP (`script-src ... 'strict-dynamic'`, `connect-src 'self'`), React text rendering only, no `dangerouslySetInnerHTML`, hostile-name fixture, dependency pinning |
| Leftover data on a shared computer after sign-out | Information disclosure | Wipe before sign-out + owner gate + `Clear-Site-Data` |
| A different account sees the previous account's data | Information disclosure | Owner gate before the first `ready` snapshot; `addNew` rejects `OwnerMismatchError` |
| XML entity expansion / oversized or hostile file freezes the tab | Denial of service | Reject `<!DOCTYPE|<!ENTITY`, `MAX_XML_BYTES` on `file.size` before reading, `XMLValidator`, parse never throws |
| Allowlist evasion (case, unverified email, alias) | Spoofing | Lowercase exact match + `emailVerified` + env-only list (D-16) |
| Auth bypass via proxy-only checks | Elevation | DAL in every entry point; `proxy.ts` sets CSP only |
| Invoice data sent to the server by accident (analytics, error reporting, server action) | Information disclosure | No Server Functions/handlers, source guard, network-stubbed unit test, Playwright request sniff, CSP `connect-src 'self'` |
| Test-only session minting abused | Elevation | Helper lives under `tests/`, requires the test secret, only used by Playwright against a local build; canary test; never imported by `src/` |
| Secrets in git / real fiscal files in git | Information disclosure | `.env*` ignored (`!.env.example`), `Facturas/` ignored, leak guard test on fixtures |
| Float arithmetic on money | Tampering | Decimal strings + decimal.js; `toCents` is the only conversion; negative grep for `parseFloat`/`Number(`/`new Date(` in the pure core |

## Sources

### Primary (HIGH confidence)
- Local files read this session: `.planning/phases/01-real-spend-by-supplier/{01-CONTEXT,01-RESEARCH(old),01-04-PLAN,01-01-SUMMARY,01-UI-SPEC,01-08-PLAN,01-10-PLAN,01-09-PLAN,01-VALIDATION,01-SKELETON}.md`, `.planning/{REQUIREMENTS,STATE,ROADMAP,config.json}`, `package.json`, `src/auth/*`, `src/components/auth/auth-buttons.tsx`, `src/env.ts`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tests/e2e/anonymous.spec.ts`, `tests/fixtures/cfdi/PROFILE.json`, `tests/unit/fixtures-clean.test.ts` header.
- Next.js 16.4.0 bundled docs (`node_modules/next/dist/docs/01-app/`): `02-guides/content-security-policy.md`, `02-guides/single-page-applications.md`, `02-guides/lazy-loading.md`, `03-api-reference/04-functions/use-search-params.md`, `.../not-found.md`, `03-api-reference/03-file-conventions/proxy.md`, `03-api-reference/08-turbopack.md`.
- Local probes today (scratch directory, no project changes): idb 8.0.4 + fake-indexeddb 6.2.5 behaviors (batch dedupe, caught `ConstraintError` aborts, thrown `DataCloneError` does not abort, `blocking()`/`deleteDB`/upgrade, global factory reset, `BroadcastChannel`, Node `File`); `esbuild` 0.28.2 bundle sizes; fast-xml-parser parse benchmark over anonymized fixtures; zod bench; Better Auth 1.7.7 sign-out header via wrapper and via `hooks.after`; Better Auth minted session accepted by a fresh instance; `Intl` es-MX outputs; `npm view` and `gsd-tools query package-legitimacy check` for idb, dexie, fake-indexeddb; local tarball diff idb 8.0.3 vs 8.0.4.

### Secondary (MEDIUM confidence)
- MDN: Clear-Site-Data; `StorageManager.persist()`; Storage quotas and eviction criteria; File drag and drop; `DataTransferItem.webkitGetAsEntry`; mdn/browser-compat-data `http/headers/Clear-Site-Data.json`.
- https://webkit.org/blog/14403/updates-to-storage-policy/ (quota and `persist()` heuristics).
- https://support.google.com/cloud/answer/15549945 (Testing vs In production, non-sensitive scopes, unverified-app cap).
- https://www.better-auth.com/docs/concepts/hooks (documented hook surface).
- https://developer.chrome.com/blog/use-scheduler-yield (and a secondary search summary for Firefox 142 and Safari status).
- Prior project research `.planning/research/{STACK,ARCHITECTURE,PITFALLS,FEATURES,SUMMARY}.md` (cited where relied on). Earlier-session sources for the Drive material are listed in the 2026-10-09 version of this file and summarized in the Phase 6 reference section.

### Tertiary (LOW confidence)
- Web-search summary on Turbopack `new Worker(new URL(...))` support and a relative-URL regression in 16.2.4 (not confirmed against release notes).
- Training-memory items listed as `[ASSUMED]` in the Assumptions Log (B1-B14).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH for existing pins and the idb/fake-indexeddb evidence (registry, seam, local behavior); MEDIUM only for the pnpm age gate on idb 8.0.4.
- Parser / ledger / fixtures / analytics: HIGH (carried from 143-file verification; browser safety verified by bundling and benchmark; Turbopack bundling still to be proven by a build).
- IndexedDB design and tests: HIGH (spec behavior reproduced with fake-indexeddb); MEDIUM for real-browser specifics (Safari eviction, private mode, `persist()`).
- Browser-data wipe: HIGH for the client layers and the Better Auth header mechanics; MEDIUM-LOW for `Clear-Site-Data` behavior on `fetch` across browsers (backstop only).
- CSP: MEDIUM-HIGH (documented pattern; inline-style exception and Google redirect behavior to be confirmed by the console e2e check).
- Authenticated e2e via minted cookies: MEDIUM-HIGH (works on 1.7.7; depends on an internal payload shape, hence the canary).
- Deploy: MEDIUM (human prerequisites unknown; consent-screen decision open).

**Research date:** 2026-10-12 (browser-path re-research); 2026-10-09 (original)
**Valid until:** 2026-10-26 (Next 16.4.0 is days old; Better Auth, Playwright and idb release often; re-check pins and the idb 8.0.4 age gate at plan time)
