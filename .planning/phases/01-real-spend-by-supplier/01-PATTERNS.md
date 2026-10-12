# Phase 1: Real Spend by Supplier - Pattern Map (re-scope 2026-10-12, browser upload)

**Mapped:** 2026-10-12 (regenerated; replaces the stale Drive-plan map)
**Files analyzed:** 41 new/modified
**Analogs found:** 22 exact/role-match, 12 partial, 7 with no code analog (design in RESEARCH)

All analog paths below are git-tracked (verified with `git ls-files`). Ignore plans 01-02, 01-05..01-10 except as design reference. New plans start at 01-11. Plan 01-04 files (`src/domain/*`, `src/parsing/cfdi/*`) do not exist yet and are out of this map except as imports.

## Conventions observed in the repo (apply to every new file)

- Alias `@/` -> `src/` (tsconfig and `vitest.config.ts` alias). Double quotes, semicolons, trailing commas, 2-space indent.
- Pure decision logic is split from the server-only wrapper: `src/auth/allowlist.ts` (no `server-only`, unit-tested) vs `src/auth/require-user.ts` (`import "server-only"`). The new core (`domain`, `parsing`, `analytics`, `upload`, `ports`, `adapters/memory`, `adapters/indexeddb`, `browser`, `lib/format.ts`) runs in the browser and MUST NOT import `server-only`, `@/env` or Node APIs (RESEARCH L108, L396; add a structural Vitest walk).
- Spanish (es-MX) UI strings and error `mensaje`; error codes are snake_case Spanish (`no_autenticado`, `acceso_denegado`).
- Doc-comment style: short `/** ... (D-xx) */` that cites the decision id.
- Vitest: `environment: "node"`, `include: ["tests/**/*.test.ts"]` (so a shared contract file must be imported by a `*.test.ts`), `server-only` aliased to `tests/stubs/server-only.ts`. IndexedDB tests need `import "fake-indexeddb/auto"` (or `IDBFactory` injection); no jsdom/happy-dom exists in the config, so client components are covered by Playwright (STACK.md rule) and logic is extracted into pure functions.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/ports/invoice-store.ts` | port (types) | CRUD + pub-sub | `src/ports/drive-api.ts` | exact (role) |
| `src/adapters/memory/memory-invoice-store.ts` | adapter (fake) | CRUD | `src/adapters/drive/google-drive-api.ts` (implements a port) | partial |
| `src/adapters/indexeddb/indexeddb-invoice-store.ts` | adapter | CRUD, transactional | `src/adapters/drive/google-drive-api.ts` + RESEARCH Pattern 2 | partial |
| `src/upload/ingest.ts` | service (pure pipeline) | batch / transform | `src/auth/allowlist.ts` (pure, typed unions) + RESEARCH Pattern 3 | partial |
| `src/browser/invoice-store-client.ts` (singleton, `subscribe`/`getSnapshot`) | store | event-driven | none in repo; RESEARCH Pattern 4 | none |
| `src/browser/wipe.ts` (`wipeBrowserData`) | utility | file-I/O (IDB delete) | none; RESEARCH Pattern 5 | none |
| `src/browser/use-browser-data.ts` + `src/browser/browser-data-provider.tsx` | provider/hook | event-driven | `src/auth/client.ts` (client singleton) + `auth-buttons.tsx` ("use client") | partial |
| `src/components/browser/session-keep-alive.tsx` | component (client, effect only) | request-response | `src/components/auth/auth-buttons.tsx` | role-match |
| `src/components/auth/auth-buttons.tsx` (MODIFY) | component | request-response | itself | exact |
| `src/app/api/auth/[...all]/route.ts` (MODIFY) | route | request-response | itself + RESEARCH Example B | exact |
| `src/proxy.ts` | middleware (CSP only) | request-response | none in repo; RESEARCH Example H | none |
| `src/app/(app)/layout.tsx` (MODIFY) | layout (server) | request-response | itself | exact |
| `src/app/(app)/page.tsx` (MODIFY) | page (server shell) | request-response | itself | exact |
| `src/app/(app)/proveedores/[rfc]/page.tsx` | page (server shell, async params) | request-response | `src/app/(app)/page.tsx` | role-match |
| `src/app/(app)/{loading,error,not-found}.tsx` | special files | n/a | `src/components/ui/skeleton.tsx`, `alert.tsx` | partial |
| `src/app/(public)/login/page.tsx`, `acceso-denegado/page.tsx` (MODIFY: `await connection()`) | page | request-response | themselves | exact |
| `src/components/upload/*` (dropzone, import panel, summary, delete-confirm) | components (client) | event-driven | `auth-buttons.tsx` + `ui/progress.tsx`, `ui/alert.tsx`, `ui/button.tsx` | role-match |
| `src/components/dashboard/*` (DashboardScreen, charts, supplier table, SupplierScreen, year select) | components (client) | transform | `ui/chart.tsx`, `ui/table.tsx`, `ui/select.tsx` (primitives) | partial |
| `src/analytics/{monthly,supplier-spend,dto}.ts` | utility (pure) | transform | `src/auth/allowlist.ts` (pure style); signatures in 01-08-PLAN L162-178 | partial |
| `src/lib/format.ts` | utility | transform | `src/lib/utils.ts` | role-match |
| `src/globals.css` font/chart tokens (MODIFY) | config | n/a | itself | exact |
| `tests/contract/invoice-store.contract.ts` + `invoice-store.contract.test.ts` | test | CRUD | `tests/unit/allowlist.test.ts` (style) | partial |
| `tests/unit/idb-adapter.test.ts`, `ingest.test.ts`, `browser-data.test.ts`, `analytics.test.ts`, `format.test.ts`, `isomorphic-core.test.ts`, `structural-dal.test.ts` | test | unit | `tests/unit/allowlist.test.ts`, `require-user.test.ts` | exact |
| `tests/unit/auth-route.test.ts` (Clear-Site-Data) | test | request-response | `tests/unit/require-user.test.ts` (vi.mock edges) | exact |
| `tests/unit/proxy.test.ts` (CSP header) | test | request-response | `tests/unit/require-user.test.ts` | role-match |
| `tests/helpers/mint-session.ts` | test helper | transform | `tests/unit/require-user.test.ts` L60-80 (Better Auth session) + RESEARCH Example I | partial |
| `tests/e2e/browser-upload.spec.ts` (+ anonymous.spec.ts additions) | e2e | request-response | `tests/e2e/anonymous.spec.ts` | exact |
| `playwright.config.ts` / `vitest.config.ts` / `package.json` (MODIFY) | config | n/a | themselves | exact |

## Pattern Assignments

### `src/ports/invoice-store.ts` (port, CRUD + pub-sub)

**Analog:** `src/ports/drive-api.ts` (lines 1-47). Pure file, header doc comment says "Pure: no imports from adapters", exports interface + small helpers + constants; tests use an in-memory fake.

```typescript
/**
 * Port over Google Drive. Pure: no imports from adapters. The production
 * implementation is `GoogleDriveApi`; tests use an in-memory fake (STOR-03).
 */
export interface DriveApi {
  /** Follows `nextPageToken` (pageSize 1000) and returns every match. */
  list(q: string): Promise<DriveEntry[]>;
  ...
}
```

Copy: header doc style citing STOR-03, per-method `/** */` semantics. Content comes from RESEARCH Pattern 1 (L282-296): `StoreMeta`, `StoreSnapshot { invoices, meta, invalidRecords }`, `AddResult { added, alreadyStored }`, `StoreChange`, `OwnerMismatchError`, `InvoiceStore { load, addNew, clear, subscribe, close }`. Only `import type { Invoice } from "@/domain/invoice"` (Plan 01-04). Error class pattern: `src/adapters/drive/drive-errors.ts` (read it for the custom Error class shape; `OwnerMismatchError extends Error` should set `name`).

### `src/adapters/memory/memory-invoice-store.ts` and `src/adapters/indexeddb/indexeddb-invoice-store.ts` (adapters)

**Analog:** `src/adapters/drive/google-drive-api.ts` (class `implements` the port, imports the port type from `@/ports/...`, maps errors at the edge). Take only the structure; no `server-only` here (the Drive adapter has it, the browser adapters must not).
- Memory fake: `structuredClone` on write AND read (RESEARCH Pattern 1 last bullet). Backing object injectable so a "second instance on the same backing" works for the contract suite and `subscribe` events.
- IndexedDB: follow RESEARCH Pattern 2 (L298-308) exactly: db `facturas` v1; stores `invoices` (keyPath `uuid`) and `meta` (key `"app"`); `upgrade(db, oldVersion){ if (oldVersion < 1) ... }`; one `readwrite` tx over `["invoices","meta"]`; check keys with `getAllKeys()` into a `Set` (do NOT rely on ConstraintError); never await non-IDB promises inside the tx; `blocking()` closes, `terminated()` drops cached handle; `load()` runs `invoiceSchema.safeParse` per record and counts `invalidRecords`; `idb` 8.0.4 (`openDB`, `deleteDB`).
- Validate-on-read mirrors the project rule "zod at every trust boundary" (CLAUDE.md rule 3); no `as`/`!`.

### `src/upload/ingest.ts` (pure pipeline, batch/transform)

**Analog:** `src/auth/allowlist.ts` for style (pure, discriminated unions, doc comments citing decisions, no framework imports):

```typescript
export type AccessDecision =
  | { kind: "anonymous" }
  | { kind: "denied"; email: string }
  | { kind: "allowed"; email: string };
```

Body per RESEARCH Pattern 3 (L310-322): `ingestFiles({files, store, owner, parse?, onProgress?, signal?})`, `UploadProblem.contada` drives the "Contado/No contado" badge (UI-SPEC note 4). Rules: non-`.xml` -> `no_es_xml` without reading; size check before `arrayBuffer()`; cap 1,000 (D-35, checked by caller or here); first-wins by UUID (`uuid_duplicado`); flagged-but-counted invoices counted in both `nuevas` and `conProblemas` (D-36); a flagged already-stored file is not listed (UI-SPEC approval). Uses only Web APIs (`File`, `TextDecoder` via `parseCfdi`). Time-slice 12 ms + yield between slices (RESEARCH L119).

### `src/browser/*` (client singleton, wipe, provider, hook)

**No in-repo analog for `useSyncExternalStore`.** Partial analogs for conventions:
- `src/auth/client.ts` (client-side module-level singleton, whole file):
  ```typescript
  import { createAuthClient } from "better-auth/react";
  export const authClient = createAuthClient();
  ```
- `src/components/auth/auth-buttons.tsx` L1-5: `"use client";` first line, then `next/navigation`, `@/components/ui/button`, `@/auth/client` imports.
Design from RESEARCH Pattern 4 (L324-326): frozen `{ status: "loading" }` object used as both `getServerSnapshot` and initial snapshot; `getSnapshot` returns a cached object (identity changes only on data change); IndexedDB opened only in `useEffect` inside `<BrowserDataProvider email>`; states `loading | unavailable | ready{invoices, invalidRecords}` (D-33: unavailable disables upload, no memory fallback). Provider holds import-panel state (UI-SPEC note 3). Owner gate: wipe before exposing data when `email !== meta.ownerEmail` (D-24). `wipeBrowserData()` per Pattern 5 (L328-330): close connection, `deleteDB("facturas")` with ~3 s timeout, never throws, broadcast `cleared`. Unit-test the logic with injected store/clock (node env), not React.

### `src/components/auth/auth-buttons.tsx` (MODIFY: wipe-first sign-out)

**Analog (self), lines 24-62.** Current:

```typescript
export function SignOutButton({ label = "Cerrar sesión", variant = "outline" }) {
  const router = useRouter();
  return (
    <Button variant={variant} onClick={() => {
        void authClient.signOut().then(() => { router.replace("/login"); });
      }}>
```
Change to RESEARCH Example G (L700-710): `await wipeBrowserData()` first (never throws), then `const { error } = await authClient.signOut()`; on error keep the user on the page and show the Spanish failure toast (sonner is already mounted in `src/app/layout.tsx`; UI-SPEC "States" for pending label and failure toast); then `router.replace("/login")`. Apply the same wipe-first to `SwitchAccountButton` (L47-62) before `signOut().then(signIn.social(...))`. `SignInButton` (L7-22) stays. Note: these are used on `/acceso-denegado` outside the `(app)` provider, so `wipeBrowserData` must not need the provider.

### `src/app/api/auth/[...all]/route.ts` (MODIFY: Clear-Site-Data)

**Analog (self), whole file (4 lines):**
```typescript
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";
export const { GET, POST } = toNextJsHandler(auth);
```
Replace with RESEARCH Example B (L598-612): `const handlers = toNextJsHandler(auth); export const { GET } = handlers;` and an `async function POST(request)` that sets `Clear-Site-Data: "storage"` when `new URL(request.url).pathname.endsWith("/sign-out")`. This stays the ONLY `route.ts` under `src/app/api` and stays exempt from the DAL structural check. Test like `tests/unit/require-user.test.ts` L7-14: `vi.mock("@/auth/auth", ...)` with a fake `handlers`/stub `toNextJsHandler` returning a `Response`, assert header present only for sign-out and `set-cookie` preserved.

### `src/proxy.ts` (CSP nonce, request-response)

**No analog; there is no proxy/middleware file.** Use RESEARCH Example H (L713-728) verbatim, plus `config.matcher` excluding `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetch (Next 16.4 CSP guide in `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`; AGENTS.md says read the docs first). `proxy` export name (not `middleware`). Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. Auth stays in the DAL, never here (CLAUDE.md "no middleware.ts"). `/login` and `/acceso-denegado` add `await connection()` from `next/server` (Pitfall 9; D-31) at the top of the async component, before `getAccess()`.

### `src/app/(app)/layout.tsx` and `page.tsx` (MODIFY)

**Analog (self).** Keep the DAL call; mount the provider with the verified email:

```typescript
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireUser();   // layout.tsx L9
  ...
      <main className="flex-1 p-6">{children}</main>
```
Wrap children in `<BrowserDataProvider email={email}>` and add `<SessionKeepAlive/>`; keep the header (L13-19 with `email` + `SignOutButton`) and add the "Borrar facturas" ghost button per UI-SPEC. `page.tsx` keeps the comment-and-call pattern (L4-5: "A layout does not guard its pages' data: every page calls the DAL itself (D-19)") and renders `<Suspense><DashboardScreen/></Suspense>`; the placeholder text mentioning "Ajustes" must go (UI-SPEC note 2). `proveedores/[rfc]/page.tsx`: same `requireUser()` first, then `const { rfc } = await params` (async params, Next 16), validate RFC format (else `notFound()`), render `<Suspense><SupplierScreen rfc/></Suspense>`. Props must be serializable and contain no invoice data.

### `src/app/(app)/{loading,error,not-found}.tsx`

Import no data module (UI-SPEC note 6). Use `Skeleton` (`src/components/ui/skeleton.tsx`) and `Alert` (`src/components/ui/alert.tsx`); `error.tsx` must be `"use client"`.

### `src/components/upload/*` and `src/components/dashboard/*` (client components)

**Analog for conventions:** `src/components/auth/auth-buttons.tsx` (`"use client"`, named exports, `Button` from `@/components/ui/button`, props with defaults, `void promise.then(...)` for fire-and-forget handlers, Spanish copy).
**UI primitives to compose (all tracked):** `src/components/ui/{progress,alert,badge,button,card,chart,table,select,separator,skeleton,input,label,sonner}.tsx`. Example primitive usage: `Progress` takes `value` 0-100 (`src/components/ui/progress.tsx` L8-29).
Charts: use `ChartContainer`/`ChartTooltip` from `ui/chart.tsx`; receive pre-aggregated numbers (`toCents` output) and `YYYY-MM` keys (CLAUDE.md UI rules); year via `useSearchParams` (`?anio=`), `useMemo([invoices, anio])` (RESEARCH Pattern 7). Money formatting only via `src/lib/format.ts`. Exact wording and states: 01-UI-SPEC.md (Copywriting Contract, States and Interactions). Drop works on any page and routes to `/` (UI-SPEC approval); drop handler captures `DataTransfer` files synchronously (RESEARCH Example C, L618+).

### `src/analytics/*` and `src/lib/format.ts` (pure transform)

**Analog:** `src/auth/allowlist.ts` (pure, no framework imports, explicit types) and `src/lib/utils.ts` (tiny util module). Signatures to reuse come from the superseded plan: 01-08-PLAN.md L162-178 (`supplierRanking`, `supplierMonthly`, `yearsWithData`, `monthlyTotals`, `toCents`, `resolveYear`, `buildDashboardDto`; `SupplierRow { rfc, nombre, total, porcentaje, facturas }`). Differences (RESEARCH Pattern 7): input `readonly Invoice[]`, `resolveYear(requested: string | undefined, years)`, no DatasetService. Rules: group by emisor RFC, label from most recent invoice (D-12); Egreso subtracts, Pago adds 0 (D-15); "Facturas" counts I + E only (D-37); import `Decimal` via `@/domain/money`; `toCents` is the only money-to-number boundary; no `parseFloat|Number(|new Date(` in domain/parsing (01-04 negative grep). `format.ts`: `new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })` (CLAUDE.md rule 2), plus `formatMXNCompact`, `formatPercent`, `monthLabel`, `monthLabelLong`.

### Tests

**Unit style analog:** `tests/unit/allowlist.test.ts` / `require-user.test.ts` (vitest imports, `@/` alias, Spanish message assertions, `vi.mock` of `@/auth/auth`, `@/env`, `next/headers`, `next/navigation`, dynamic `await import` after mocks).

```typescript
vi.mock("@/auth/auth", () => ({ auth: { api: {} } }));
vi.mock("@/env", () => ({ env: { ALLOWED_EMAILS: "" } }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const { apiGateFor } = await import("@/auth/require-user");
```
- Contract suite: `tests/contract/invoice-store.contract.ts` exports a function `runInvoiceStoreContract(name, make)`; `tests/contract/invoice-store.contract.test.ts` calls `describe.each([["memory", makeMemory], ["indexeddb", makeIdb]])` (cases listed RESEARCH L298). `import "fake-indexeddb/auto"` in the IDB test; give each test a fresh `IDBFactory`/db name and call `store.close()` + `deleteDB` in teardown.
- Fixtures: `tests/fixtures/cfdi/*.xml` (anonymized, tracked) via `node:fs`; never read `Facturas/`. `tests/unit/fixtures-clean.test.ts` is the leak guard to keep passing. Build `File` objects from them in `ingest.test.ts` (Node 24 has global `File`).
- Structural tests (`isomorphic-core.test.ts`, `structural-dal.test.ts`): `node:fs` walk; rules in RESEARCH L396 and Pattern 6 (every `page.tsx` calls `requireUser(` except login/acceso-denegado; zero `"use server"`; only `route.ts` is `api/auth/[...all]`).
- `tests/unit/auth-config.test.ts` shows testing Better Auth options without a server (use for `tests/helpers/mint-session.ts` conventions: `buildAuthOptions(testEnv)` with the same `testEnv` block, require-user.test.ts L16-21).

### E2E: `tests/e2e/browser-upload.spec.ts`

**Analog:** `tests/e2e/anonymous.spec.ts` (imports `{ expect, test } from "@playwright/test"`; `request.get("/", { maxRedirects: 0 })`; `getByRole("button", { name })`; `Origin` header on Better Auth POSTs; `baseURL ?? "http://localhost:3000"`). Add authenticated context via `storageState`/`context.addCookies` using `tests/helpers/mint-session.ts` (RESEARCH Example I, Finding 13; cookie names `better-auth.session_token` and `better-auth.session_data`). Cases (RESEARCH L515): upload via `setInputFiles` and synthetic drop, summary, dashboard totals vs fixtures, reload persistence, logout leaves no `facturas` database and response has `clear-site-data`, denied account reaches `/acceso-denegado`, two accounts in sequence (owner gate), CSP console check, network sniff proving zero requests carry XML. Config: `playwright.config.ts` runs `pnpm start` (production build) with `reuseExistingServer`; env for the minted secret must be set in `webServer.env` and mirror `BETTER_AUTH_SECRET`; keep `E2E_BASE_URL` skip logic (L3, L15-24).

## Shared Patterns

### DAL on every server entry point
**Source:** `src/auth/require-user.ts` L26-32 / L61-64. **Apply to:** every new `page.tsx`.
```typescript
export async function requireUser(): Promise<{ email: string }> {
  const access = await getAccess();
  if (access.kind === "anonymous") redirect("/login");
  if (access.kind === "denied") redirect("/acceso-denegado");
  return { email: access.email };
}
```
No new route handlers for invoice data exist (D-22). Server pages pass only the verified `email` and route params.

### Isomorphic vs server-only split
**Source:** `src/auth/allowlist.ts` (no server-only) vs `src/auth/require-user.ts` L1 (`import "server-only"`) and `src/env.ts` L1. **Apply to:** keep `server-only`/`@/env` out of everything the browser bundles; `src/env.ts` has `client: {}` on purpose (no `NEXT_PUBLIC_*`).

### Client component conventions
**Source:** `src/components/auth/auth-buttons.tsx` L1-5. `"use client";` first line; `@/components/ui/*` primitives; `useRouter` from `next/navigation`; `void` for floating promises (eslint strictTypeChecked).

### Error shape in Spanish
**Source:** `src/auth/require-user.ts` L40-43: `{ code: "snake_case", mensaje: "Frase en español." }`. Apply to ingest problem codes (`UploadProblem.code`/`mensaje`; UI-layer map keyed by code per UI-SPEC note 4) and storage errors (D-33 message).

### Strictness
CLAUDE.md rule 3: no `any`, `@ts-ignore`, `as`, `!`; zod at boundaries (IndexedDB reads, parsed XML); money as decimal strings. Run `pnpm typecheck`, `pnpm lint`, `pnpm test` per plan.

## No Analog Found (use RESEARCH design)

| File | Role | Data Flow | Reason / Source |
|---|---|---|---|
| `src/browser/invoice-store-client.ts` + hook/provider | store/provider | event-driven | no `useSyncExternalStore` in repo; RESEARCH Pattern 4 |
| `src/browser/wipe.ts` | utility | file-I/O | RESEARCH Pattern 5, Finding 7 |
| `src/adapters/indexeddb/*` (details) | adapter | transactional CRUD | no IndexedDB code; RESEARCH Pattern 2 (verified probes) |
| `src/proxy.ts` | middleware | request-response | no proxy/middleware file; RESEARCH Example H + Next 16.4 CSP guide |
| `tests/helpers/mint-session.ts` | test helper | transform | RESEARCH Example I / Finding 13 |
| `tests/contract/*` | test | CRUD | no contract suite yet; RESEARCH Pattern 1 case list |
| Drop zone (`DataTransfer` capture) | component | event-driven | RESEARCH Example C |

## Metadata

**Analog search scope:** `src/auth`, `src/app`, `src/components`, `src/ports`, `src/adapters/drive`, `src/lib`, `tests/unit`, `tests/e2e`, `tests/stubs`, root configs (`vitest.config.ts`, `playwright.config.ts`, `next.config.ts`).
**Files scanned:** ~45 tracked non-fixture files (143 fixtures excluded).
**Notes for the planner:** (1) `vitest.config.ts` includes only `tests/**/*.test.ts`; keep helper/contract modules out of that glob or import them from a `.test.ts`. (2) `next.config.ts` has only the Tailwind turbopack rule; no headers config is needed because the CSP lives in `src/proxy.ts`. (3) New deps `idb` 8.0.4 and `fake-indexeddb` 6.2.5 need the legitimacy-gate checkpoint before install (D-30). (4) `globals.css` font/chart-token fix lands with the first chart plan (UI-SPEC note 1).
**Pattern extraction date:** 2026-10-12
