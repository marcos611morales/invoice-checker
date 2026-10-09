# Phase 1: Real Spend by Supplier - Pattern Map

**Mapped:** 2026-10-09
**Files analyzed:** ~45 planned (from 01-RESEARCH.md "Recommended Project Structure")
**Analogs found:** 0 in-repo / 45 (greenfield: `git ls-files` shows only `.gitignore`)

## Key finding

There is no application code to copy from. Every file is "No Analog Found". The reference patterns are the in-RESEARCH.md excerpts below (cited by line in 01-RESEARCH.md). The only real in-repo constraint is `.gitignore` (ignores `Facturas`, `.claude`, `.DS_Store`), so the fixtures folder must be `tests/fixtures/cfdi/`, never named `Facturas`, and `.env.example` needs `!.env.example`.

Once the first plans land, later plans should use those files as analogs. Suggested intra-phase analog chain:
- `adapters/drive/*` copy shape from `ports/*` and `adapters/memory/*` (contract suite runs on both).
- Every `page.tsx` / `route.ts` / `"use server"` file copies the `requireUser()` call from the first one written.

## File Classification

| File | Role | Data Flow | Analog | Reference (RESEARCH.md) |
|------|------|-----------|--------|-------------------------|
| `src/parsing/cfdi/{parse,schema,errors}.ts` | utility | transform | none | Code Examples L427-440 |
| `src/domain/{invoice,money,spend}.ts` | model | transform | none | Pattern 5 L328-341 |
| `src/analytics/{supplier-spend,monthly,dto}.ts` | utility | transform | none | Pitfall 8 L412-414 |
| `src/ports/*.ts` | port | CRUD | none | Pattern 3 L297-315 |
| `src/adapters/memory/*` | adapter/fake | CRUD | none | Pattern 3 |
| `src/adapters/drive/{credentials,drive-api,json-doc-store,invoice-source,repositories,pointer}.ts` | adapter | file-I/O | none | Patterns 1, 3, 4 (L270-326) |
| `src/services/{sync,dataset,settings}-service.ts` | service | batch / CRUD | none | Pattern 2 L286-295 |
| `src/auth/{auth,require-user,allowlist,client}.ts` | middleware/DAL | request-response | none | Pattern 6 L343-348, Pitfall 2 L381-385 |
| `src/proxy.ts` | middleware | request-response | none | redirect only, never the gate |
| `src/app/api/{auth/[...all],sync,health/drive}/route.ts` | route | request-response | none | Pattern 6 (sync guards) |
| `src/app/(app)/**/page.tsx`, `ajustes/actions.ts` | component/action | request-response | none | Architecture diagram L212-242 |
| `src/app/(public)/{login,acceso-denegado}/page.tsx` | component | request-response | none | D-17 |
| Client components (charts, SyncButton, YearSelect, SessionKeepAlive) | component | event-driven | none | shadcn `chart` |
| `src/container.ts`, `src/env.ts` | config | n/a | none | `@t3-oss/env-nextjs` + zod |
| `scripts/{drive-auth,build-fixtures,spike-drive-concurrency}.ts` | utility | batch | none | Don't Hand-Roll L369 |
| `tests/{unit,contract,e2e}/**`, fixtures | test | n/a | none | contract suite per Pattern 3 |

## Reference patterns to copy (verbatim from RESEARCH.md)

### Drive credential (adapters/drive/credentials.ts), RESEARCH L274-282
```typescript
import "server-only";
import { OAuth2Client } from "google-auth-library";
import { drive as makeDrive } from "@googleapis/drive";
export function makeDriveClient(env: { DRIVE_CLIENT_ID: string; DRIVE_CLIENT_SECRET: string; DRIVE_REFRESH_TOKEN: string }) {
  const auth = new OAuth2Client(env.DRIVE_CLIENT_ID, env.DRIVE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.DRIVE_REFRESH_TOKEN });
  return makeDrive({ version: "v3", auth });
}
```
Map `invalid_grant` to the Spanish operator message (L284).

### CFDI parser (parsing/cfdi/parse.ts), RESEARCH L429-440
```typescript
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
```
Then `parser.parse(text).Comprobante` -> zod -> `Invoice`, all amounts via `Decimal`.

### Ports (ports/drive-api.ts, ports/json-doc.ts), RESEARCH L301-314
`DriveApi { list, getBytes, getMeta, createFile, updateFile }` and `JsonDocStore { read<T>, write<T>(name, doc, {ifRev}) }`. Rules: `schemaVersion` on every doc, zod-validate reads, never overwrite a doc that fails validation, wrap writes in `p-retry` (gaxios does not retry PATCH/POST), cache `_app` ids after create.

### Auth DAL (auth/require-user.ts), RESEARCH L344-348
- `requireUser()` returns `{ email }` or redirects (`/login`, or `/acceso-denegado` if signed in but not allowed); `requireUserApi()` returns 401/403 JSON.
- Compare `email.trim().toLowerCase()` to the `ALLOWED_EMAILS` set and require `emailVerified === true`.
- Structural Vitest test: every `page.tsx`, `route.ts` (except `api/auth/[...all]`) and every `"use server"` file references `requireUser`/`requireUserApi`; explicit exceptions `/login`, `/acceso-denegado`.
- `POST /api/sync` also rejects `Sec-Fetch-Site` not `same-origin` and non-JSON content type.

### Better Auth session config, RESEARCH Pitfall 2 L384
`session.expiresIn = 365d`, `session.cookieCache = { enabled: true, strategy: "jwe", maxAge: 30d, refreshCache: { updateAge: 29d } }`, plus a client `<SessionKeepAlive/>` calling `authClient.getSession()` on mount. Scopes `openid email profile` only.

### Sync (services/sync-service.ts, app/api/sync/route.ts), RESEARCH L286-295
Stateless-resume: relist (BFS, skip `_app`, `.xml` only), diff vs manifest by md5, process `BATCH_SIZE=25` at concurrency 8 (`p-limit`), write shards then manifest, return `{processed, remaining, counts, problems}`. `maxDuration = 300`, `SYNC_CALL_BUDGET_MS = 90_000`; make constants injectable.

### Spend rule and dates, RESEARCH L341, L84
`I:+total`, `E:-total`, `P:0`; bucket months by `fecha.slice(0,7)`, never `new Date(fecha)`; sum `Decimal`, round only in DTO.

## Shared Patterns
- `import "server-only"` in every module touching Drive tokens, auth or env secrets.
- Domain/parsing/analytics import nothing from adapters/services/app.
- Spanish copy, `Intl.NumberFormat("es-MX", {style:"currency",currency:"MXN"})`, `<html lang="es-MX">`.
- Scaffold in a sibling temp dir, copy in, remove `cacheComponents` and `partialPrefetching` from `next.config.ts`, merge `.gitignore` (keep `Facturas`, add `!.env.example`) (RESEARCH Pitfall 1 L375-379).

## No Analog Found
All files above. Planner should use the RESEARCH.md excerpts, and within-phase files as analogs for later plans.

## Metadata
**Analog search scope:** whole repo (`git ls-files`)
**Files scanned:** 1 tracked (`.gitignore`)
**Note:** RESEARCH.md was read to line 441 of 727; later sections (sync design, fixtures, validation) were not needed for this map.
**Pattern extraction date:** 2026-10-09
