# Walking Skeleton — Facturas — Análisis de gastos

**Phase:** 1
**Generated:** 2026-10-09
**Updated:** 2026-10-12, for the re-scope (browser XML upload, invoices kept only in the browser; Drive moved to Phase 6)
**Built by:** Plans 01-01 (toolchain + allowlisted login), 01-03 (anonymized fixtures), 01-04 (CFDI parser and spend rules), 01-11 (nonce CSP, authenticated e2e harness), 01-18 (shell, keep-alive, `Clear-Site-Data` backstop, structural DAL test), 01-19 (package gate, `InvoiceStore` with IndexedDB and memory adapters, contract suite), 01-12 (upload → IndexedDB through `InvoiceStore`), 01-13 (import summary and ingest rules), 01-20 (guided empty state, storage-unavailable and loading states), 01-14 (browser wipe and delete), 01-15 (monthly spend dashboard), 01-21 (supplier ranking, top 10, year selector), 01-16 (supplier detail), 01-22 (drag-and-drop, Spanish 404 and error boundary), 01-17 (Vercel deploy and UAT). Plans 01-02 and 01-05..01-10 are superseded (Phase 6 reference). Execution order: 01-11 → 01-04 → 01-18 → 01-19 → 01-12 → 01-13 → 01-20 → 01-14 → 01-15 → 01-21 → 01-16 → 01-22 → 01-17.

## Capability Proven End-to-End

An allowlisted owner or partner signs in with Google at the shared Vercel URL, selects or drops CFDI XML files that are parsed in their own browser and stored only there (IndexedDB, behind the `InvoiceStore` port), and sees exact spend by supplier and month on the dashboard; the data survives a reload and is deleted at sign-out, and any other Google account sees "Acceso denegado" with its own email.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.0 App Router, React 19.3, TypeScript 6.0.3 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), pnpm 11.5 (`packageManager`), Node 24.x | User preference and CLAUDE.md pins; TS 6.0 because typescript-eslint 8.71 caps at <6.1; scaffold's Cache Components and partial-prefetching flags removed (forbidden in v1) |
| Data layer | No database and no server-side invoice storage. Parsed `Invoice` records live only in the uploader's browser: IndexedDB database `facturas` version 1 with store `invoices` (keyPath `uuid`) and store `meta` (owner email, parser version, timestamps). The raw XML is not stored; re-uploading is the recovery path | D-22, D-23, D-32; Vercel has no disk; Drive replaces this storage in Phase 6 |
| Storage seam | Domain-shaped `InvoiceStore` port (`load`, `addNew`, `clear`, `subscribe`, `close`) with `IndexedDbInvoiceStore` (idb 8.0.4) and `MemoryInvoiceStore`; one contract suite runs on both (fake-indexeddb 6.2.5 in Vitest); a stored UUID always wins (D-26); every commit is one atomic transaction | STOR-03, D-23, D-30; Phase 6 adds a Drive adapter (and a database adapter later) that must pass the same suite |
| Ingestion | File picker (`multiple`, XML only) and a window-level drop; pure `ingestFiles`: name filter, size check before reading, 1,000-file cap, main-thread parsing in 12 ms slices, in-batch UUID first-wins, one atomic commit, a summary with three counts; nothing is sent to the server | D-21, D-22, D-25, D-26, D-35, D-36 |
| Auth (identity plane) | Better Auth 1.7.7 stateless (no DB): JWE cookie cache, 30-day sliding window + 365-day cap with a client keep-alive, Google identity scopes only (`openid email profile`), `ALLOWED_EMAILS` env allowlist checked per request by `requireUser()` in every page and layout; the Better Auth route is the only route handler and there are no Server Functions | D-16..D-19, D-20; a structural test enforces the DAL rule |
| Browser data lifecycle | Wipe-first sign-out (also "Usar otra cuenta"), an owner gate that deletes another account's invoices before anything renders, cross-tab sign-out, a confirmed "Borrar facturas", and `Clear-Site-Data: "storage"` on the sign-out response as a backstop | D-24 |
| Security headers | Per-request nonce CSP from `src/proxy.ts` (`'strict-dynamic'`, `connect-src 'self'`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`; `proxy.ts` holds no auth logic | D-31; XSS is the main exfiltration path for browser-stored data |
| Money and dates | Decimal strings in storage, decimal.js in math, cents only at the DTO boundary (`toCents`); CFDI `Fecha` bucketed by string slice, never through a Date | Core value is exactness; CFDI Fecha has no offset |
| Parsing | fast-xml-parser 5.11.2 (`removeNSPrefix`, forced arrays, no value coercion), DTD/ENTITY rejected before parsing, zod-validated Invoice, `PARSER_VERSION` in the store meta; runs in the browser, loaded with a dynamic import | 143/143 real files verified in research; the pure core is browser-safe (structural test) |
| Analytics | Computed in the browser with `useMemo` over the stored invoices into cents-rounded DTOs; the server renders only the shell; charts receive DTOs only | D-28 |
| Deployment target | Vercel production via Git integration on `main`, single shared `https://<project>.vercel.app` URL, five env vars, Google consent screen published "In production" with identity scopes | D-29, D-34; preview URLs cannot log in (redirect URIs registered only for localhost and production) |
| Directory layout | Pure core `src/domain`, `src/parsing`, `src/analytics`, `src/upload`; `src/ports`; `src/adapters/{indexeddb,memory}` (plus the dormant `drive` adapter for Phase 6); `src/browser` (client store, import session, wipe, owner gate); `src/components/{upload,dashboard,auth,ui}`; `src/auth`; `src/proxy.ts`; `src/app/(public)` and `src/app/(app)` route groups; `tests/{unit,contract,e2e,helpers,fixtures}` (never under a path named like the git-ignored sample folder) | Ports and adapters; the core imports nothing from adapters or app and nothing server-only |
| UI | shadcn/ui (Radix) + Tailwind 4.3 + Recharts 3 via shadcn `chart`, plus shadcn `alert-dialog`; Spanish (México) copy, `<html lang="es-MX">`, `Intl` es-MX MXN; 01-UI-SPEC (re-scoped 2026-10-12) is the contract | DASH-09; CLAUDE.md UI rules |
| Testing | Vitest 5 (node env, `@` alias, `server-only` stub; fake-indexeddb only in adapter, contract and browser-data tests), 143 anonymized fixtures + synthetic edge files; Playwright Chromium with minted Better Auth sessions against a local production server on port 3100, plus the anonymous smoke against production; Safari and Firefox checked by hand | Google blocks automated consent; a canary test guards the minted-session format |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — Plan 01-01
- [ ] Routing — `/login`, `/acceso-denegado`, `/`, `/proveedores/[rfc]`, `/api/auth/[...all]` (the only route handler), Spanish 404s, `src/proxy.ts` for the CSP — Plans 01-01, 01-11, 01-18, 01-16, 01-22
- [ ] Database — real write AND real read of parsed invoices in the browser's IndexedDB through `InvoiceStore` (by design there is no server database in Phase 1) — Plans 01-19, 01-12
- [ ] UI — "Subir XML" or a drop → progress and summary → dashboard and supplier detail — Plans 01-12, 01-13, 01-20, 01-15, 01-21, 01-16, 01-22
- [ ] Deployment — production Vercel URL with the anonymous smoke passing against it — Plan 01-17

## Out of Scope (Deferred to Later Slices)

- Drive: owner authorization, the folder setting, the resumable sync, `_app/` JSON state, the upload saved to Drive, concurrent-safe edits, and therefore sharing invoices between owner and partner (Phase 6).
- Folder, ZIP and PDF upload (D-21); storing the raw XML (D-32); an in-memory fallback when IndexedDB is unavailable (D-33); parsing in a Web Worker.
- Period filters beyond the year selector, URL-shared filters, monthly average, drill-down to invoices and PDF pairing (Phase 2).
- "Sin IVA" default and the IVA toggle, line discounts and tax buckets, TipoRelacion 04/07 chain resolution (Phase 2).
- Categories, AI (DeepSeek) and manual corrections (Phase 3).
- Monthly IVA informativo, data-quality review panel, Excel export (Phase 4).
- Product grouping and price comparison (Phase 5).
- Database storage, cron or background sync, SAT validation, CFDI 3.3 (v2 or later).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: period filters, monthly average, drill-down to invoices and PDF, sin/con IVA toggle, full ledger accuracy (its persistence and sharing items are re-scoped when discussed, because data lives only in each browser until Phase 6).
- Phase 3: spend by category with DeepSeek suggestions and manual corrections that always win.
- Phase 4: monthly IVA informativo, data-quality panel, safe Excel export.
- Phase 5: product groups across suppliers and unit-price comparison.
- Phase 6: shared invoices on Drive through a Drive adapter of the same `InvoiceStore` port, which must pass the Phase 1 contract suite.
