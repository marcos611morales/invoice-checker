# Walking Skeleton — Facturas — Análisis de gastos

**Phase:** 1
**Generated:** 2026-10-09
**Built by:** Plans 01-01 (toolchain + allowlisted login), 01-02 (owner Drive authorization), 01-05 (Ajustes folder slice + Vercel deploy)

## Capability Proven End-to-End

An allowlisted owner or partner signs in with Google at the shared Vercel URL, pastes the Drive invoice folder in Ajustes, sees how many XML it contains (including year subfolders), and saves it; the server reads and writes the owner's Drive using the one-time refresh token, and any other Google account sees "Acceso denegado" with its own email.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.0 App Router, React 19.3, TypeScript 6.0.3 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), pnpm 11.5 (`packageManager`), Node 24.x | User preference and CLAUDE.md pins; TS 6.0 because typescript-eslint 8.71 caps at <6.1; scaffold's Cache Components and partial-prefetching flags removed (forbidden in v1) |
| Data layer | No database. JSON documents in `<carpeta>/_app/` on the owner's Google Drive (`manifest.json`, `invoices-YYYY.json`), each with `schemaVersion`; one bootstrap pointer `facturas-app-pointer.json` at My Drive root | D-03; Vercel has no disk; state stays visible and backup-able; `_app/` data is rebuildable from the XML |
| Storage seam | Domain-shaped ports (`InvoiceRepository`, `SyncStateRepository`, `FolderPointerStore`, `JsonDocStore`, `DriveApi`); adapters in `src/adapters/drive` and `src/adapters/memory`; one contract suite runs on both | STOR-03; a Postgres adapter later is a swap that must pass the same suite; Phase 3 picks CAS vs append-only behind `JsonDocStore.write(ifRev)` from the Plan 01-09 probe |
| Auth (identity plane) | Better Auth 1.7.7 stateless (no DB): JWE cookie cache, 30-day sliding window + 365-day cap, Google identity scopes only (`openid email profile`), `ALLOWED_EMAILS` env allowlist checked per request by `requireUser()` / `requireUserApi()` in every page, Server Function and route handler; `proxy.ts` optimistic redirect only | D-16..D-19; middleware-only auth is bypassable; partner never sees the restricted-scope consent |
| Drive (credential plane) | Owner's refresh token minted once by `pnpm drive:auth` (Desktop OAuth client, loopback + PKCE, scope `drive`), stored only in server env vars; `google-auth-library` `OAuth2Client` + `@googleapis/drive` (not the `googleapis` monolith) behind `GoogleDriveApi` | D-01; personal Gmail (no Workspace, no service-account quota); consent screen published "In production" before minting so tokens outlive 7 days (AUTH-05) |
| Money and dates | Decimal strings in storage, decimal.js in math, cents only at the DTO boundary; CFDI `Fecha` bucketed by string slice, never through a Date | Core value is exactness; CFDI Fecha has no offset |
| Parsing | fast-xml-parser 5.11.2 (`removeNSPrefix`, forced arrays, no value coercion), DTD/ENTITY rejected before parsing, zod-validated Invoice, `PARSER_VERSION` for cheap re-parse | 143/143 real files verified in research; entity expansion is on by default in the library |
| Deployment target | Vercel production via Git integration on `main`, single shared `https://<project>.vercel.app` URL; Node runtime, sync route `maxDuration = 300` with a 90 s per-call budget and a client loop | AUTH-04; preview URLs cannot log in (redirect URIs registered only for localhost and production) |
| Directory layout | `src/domain`, `src/parsing`, `src/analytics` (pure, import nothing from adapters/services/app); `src/ports`; `src/services`; `src/adapters/{drive,memory}`; `src/auth`; `src/container.ts` (server-only composition root); `src/app/(public)` and `src/app/(app)` route groups; `scripts/` for owner/dev CLIs; `tests/{unit,integration,contract,e2e,fixtures}` (never under a path named like the git-ignored sample folder) | Ports-and-adapters from ARCHITECTURE.md; keeps fiscal logic testable without network |
| UI | shadcn/ui (Radix) + Tailwind 4.3 + Recharts 3 via shadcn `chart`; Spanish (México) copy, `<html lang="es-MX">`, `Intl` es-MX MXN; charts receive pre-aggregated DTOs only | DASH-09; CLAUDE.md UI rules |
| Testing | Vitest 5 (node env, `@` alias and `server-only` stub), `FakeDriveApi` in-memory Drive, 143 anonymized fixtures + synthetic edge files; Playwright for anonymous smoke only (no automated Google consent) | Google blocks automated consent; stateless test sessions are not portable across instances |

## Stack Touched in Phase 1

- [x] Project scaffold (framework, build, lint, test runner) — Plan 01-01
- [x] Routing — `/login`, `/acceso-denegado`, `/`, `/ajustes`, `/api/auth/[...all]`, `/api/health/drive` — Plans 01-01, 01-05
- [x] Database — real read (XML tree listing and count from the owner's Drive) AND real write (pointer file + `_app/` folder) — Plans 01-02, 01-05
- [x] UI — Ajustes form (paste link, "Revisar", "Guardar") wired to Server Actions — Plan 01-05
- [x] Deployment — production Vercel URL with the anonymous smoke passing against it — Plan 01-05

## Out of Scope (Deferred to Later Slices)

- Period filters beyond the year selector, URL-shared filters, monthly average, drill-down to invoices and PDF pairing (Phase 2).
- "Sin IVA" default and the IVA toggle, line discounts and tax buckets, TipoRelacion 04/07 chain resolution (Phase 2).
- Categories, AI (DeepSeek), manual corrections and the concurrent-correction policy implementation (Phase 3).
- Monthly IVA informativo, data-quality review panel, manual upload, Excel export (Phase 4).
- Product grouping and price comparison (Phase 5).
- Database storage, Drive Changes API, cron/background sync, SAT validation, CFDI 3.3, shared drives, shortcuts (v2 or later).

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 1 (rest): resumable idempotent sync into `_app/`, exact CFDI ledger, spend-by-supplier dashboard (Plans 01-03, 01-04, 01-06..01-10).
- Phase 2: period filters, monthly average, drill-down to invoices and PDF, sin/con IVA toggle, full ledger accuracy.
- Phase 3: spend by category with DeepSeek suggestions, manual corrections that always win, concurrent-safe corrections.
- Phase 4: monthly IVA informativo, data-quality panel, manual upload to Drive, safe Excel export.
- Phase 5: product groups across suppliers and unit-price comparison.
