# Architecture Research

**Domain:** Mexican CFDI expense-analysis web app (small cafe + coworking), serverless, no database, Google Drive as system of record
**Researched:** 2026-10-09
**Confidence:** MEDIUM-HIGH (Vercel limits, Next.js caching semantics, Drive File fields, OAuth token lifetime verified against official docs; Drive optimistic-concurrency behavior and browser-direct resumable upload NOT verified - flagged as early spikes)

## Standard Architecture

This is a small "ETL-into-a-document-store plus read-mostly analytics" app. The robust shape is a **ports-and-adapters (hexagonal) layout inside a single Next.js app**: pure domain + parser + analytics in the middle, Drive/DeepSeek/Auth as adapters on the edge, and Server Components / Server Actions / Route Handlers as thin delivery layer. Everything that touches Drive is behind repository interfaces, which is what makes the later DB migration a swap, not a rewrite.

Key framing decisions (all justified below):

1. **XML is the only source of truth for invoice facts. Everything else is either user-authored (overrides) or a rebuildable cache (parsed invoices, AI results).** The Drive JSON files fall into exactly these two classes, and the design treats them differently (the user-authored class is precious and conflict-sensitive; the cache class is disposable and rebuildable).
2. **Analytics are computed on request from an in-memory dataset. No precomputed aggregate snapshot in v1.** At 150-2000 invoices (about 1k-20k line items) aggregation is milliseconds; the real cost is Drive I/O, so cache the *loaded dataset*, not the aggregates.
3. **Drive data-plane credentials are decoupled from user login.** Users log in with Google (identity only, basic scopes). The server reads/writes Drive with one owner-authorized credential. Neither user's session ever holds a Drive token.
4. **Single-writer-per-file where possible, commutative key-level patches where not.** This is the cheap substitute for transactions.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DELIVERY (Next.js App Router, Node runtime)                              │
│  RSC pages (dashboard, proveedores, productos, IVA, calidad, revision)   │
│  Client islands (charts, tables, upload dropzone)                        │
│  Server Actions (overrides, trigger sync/enrich)  Route Handlers         │
│  (/api/upload, /api/sync, /api/enrich, /api/export/[report])             │
│  proxy.ts (optimistic redirect only)  +  requireUser() in EVERY handler  │
├──────────────────────────────────────────────────────────────────────────┤
│ APPLICATION SERVICES (orchestration, no I/O details)                     │
│  SyncService   EnrichmentService   OverridesService   UploadService      │
│  DatasetService (assemble "effective" dataset)   ReportService           │
├───────────────────────────────┬──────────────────────────────────────────┤
│ PURE CORE (no I/O, unit-tested)│ PORTS (interfaces)                       │
│  domain types + Money          │  InvoiceSource (list/read raw files)     │
│  CFDI parser (3.3 / 4.0)       │  InvoiceRepository                       │
│  conceptHash / normalizers     │  EnrichmentRepository (AI cache)         │
│  effective-view resolver       │  OverridesRepository  GroupRepository    │
│  analytics (pure fns)          │  SyncStateRepository                     │
│  issue detectors               │  Categorizer (LLM port)                  │
├───────────────────────────────┴──────────────────────────────────────────┤
│ ADAPTERS (swap points)                                                   │
│  adapters/drive: DriveClient (REST+retry), CredentialProvider,           │
│                  JsonDocStore (versioned read/patch), Drive* repos,      │
│                  DriveInvoiceSource                                      │
│  adapters/deepseek: OpenAI-compatible client, batcher, JSON validation   │
│  adapters/memory: in-memory fakes (tests + local dev with fixtures)      │
│  adapters/db (FUTURE): Postgres implementations of the same ports        │
├──────────────────────────────────────────────────────────────────────────┤
│ EXTERNAL / STATE                                                         │
│  Google Drive:  Facturas/YYYY/*.xml|pdf   (immutable source)             │
│                 Facturas/_app/*.json      (cache + user-authored state)  │
│  DeepSeek API   Google OAuth (login)      Vercel env (secrets)           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Auth & access guard | Google login, allowlist enforced at sign-in AND re-checked on every server entry point; owns zero Drive tokens | Auth.js/Better Auth-style stateless cookie session; `requireUser()` helper called in every RSC page, action, route handler; `proxy.ts` only for cheap redirects |
| DriveClient + CredentialProvider | Mint access tokens from the owner's refresh token, paginate, retry 429/5xx with jittered backoff, minimal `fields` masks | `google-auth-library` + thin `fetch` wrapper (avoid the heavy `googleapis` mega-package in serverless bundles) |
| InvoiceSource (Drive) | Enumerate folder tree (`Facturas/**`), diff against manifest, download changed XML | Full metadata listing each sync (see Pattern 2), not Changes API |
| CFDI parser | XML string -> normalized `Invoice` (pure, deterministic, versioned) | `fast-xml-parser` with `parseAttributeValue:false` (keep amounts as strings), namespace prefixes stripped; handles 3.3 and 4.0, tipo I/E/P/T, TFD UUID |
| SyncService | Source -> parser -> InvoiceRepository upsert; produce issues (duplicates, orphan PDF/XML, invalid) | Time-budgeted, resumable, idempotent; returns `{processed, remaining}` |
| EnrichmentService | Find concept hashes lacking AI results, batch to DeepSeek, validate, merge-write cache | Checkpoint after each batch; prompt-versioned; sends only description + ClaveProdServ + unit (no RFC, no amounts) |
| OverridesService | Apply user corrections (category per concept/supplier, product-group assignment/rename/merge) | Command-style ops (`setCategory`, `assignGroup`) - never "save whole document" |
| DatasetService | Load shards + enrichment + overrides, resolve *effective* category/group per line item, memoize | In-memory memo validated by Drive file `version`s (Pattern 4) |
| Analytics (ReportService) | Spend by category/supplier/month, averages, IVA acreditable, price comparison/trends, issues | Pure functions `(Dataset, Filters) => ReportDTO`; same DTOs feed UI tables and Excel |
| UploadService | Validate + parse uploaded XML/PDF, canonical filename, idempotent create in Drive, upsert invoice immediately | Route Handler, multipart, one file per request (under 4.5 MB) |
| Export | DTO -> `.xlsx` | ExcelJS in a Route Handler; numbers as numbers, MXN formats |

## Recommended Project Structure

```
src/
├── app/                          # Delivery only: thin, no business logic
│   ├── (public)/login/
│   ├── (app)/                    # layout calls requireUser()
│   │   ├── dashboard/  proveedores/  productos/  iva/
│   │   ├── calidad/              # duplicates / orphans / invalid
│   │   ├── revision/             # AI proposals awaiting user correction
│   │   └── subir/                # upload UI
│   └── api/
│       ├── upload/route.ts       # multipart, 1 file per request
│       ├── sync/route.ts         # time-budgeted, resumable
│       ├── enrich/route.ts       # time-budgeted, resumable
│       └── export/[report]/route.ts
├── domain/                       # Pure. No imports from adapters/app.
│   ├── invoice.ts  money.ts  concept-hash.ts  overrides.ts  issues.ts
├── parsing/cfdi/                 # Pure XML -> Invoice; isomorphic (also used in browser preview)
├── analytics/                    # Pure report functions + DTO types
├── services/                     # sync, enrichment, overrides, upload, dataset, reports
├── ports/                        # Repository / Source / Categorizer interfaces
├── adapters/
│   ├── drive/                    # client, credentials, json-doc-store, repos, source
│   ├── deepseek/
│   ├── memory/                   # fakes
│   └── db/                       # (future) same ports on Postgres
├── export/                       # ExcelJS workbook builders (consume report DTOs)
├── auth/                         # config, requireUser(), allowlist
├── container.ts                  # wires ports -> adapters from env (STORAGE=drive|db)
└── env.ts                        # zod-validated env, `server-only`
scripts/
└── drive-auth.ts                 # one-time local script: owner consents, prints refresh token
```

### Structure Rationale

- **`domain/`, `parsing/`, `analytics/` import nothing from `adapters/`.** This is the rule that makes the DB migration cheap and makes the parser/analytics testable with fixtures and no network.
- **`ports/` are aggregate-shaped, not generic key-value.** `OverridesRepository.apply(ops)` and `EnrichmentRepository.putMany()` map naturally onto SQL later; `store.save(fileName, wholeJson)` would not.
- **`container.ts` is the single place that knows Drive exists.** Services receive ports via constructor/arguments.
- **`server-only` on `adapters/*` and `env.ts`** so a stray client import fails the build instead of leaking tokens.
- **Parser is isomorphic** so the upload page can preview ("UUID, emisor, total, ya existe?") client-side before sending, using the exact same code the server later trusts-but-re-verifies.

## Drive Layout (the "database")

```
Facturas/                         root folder (ID in env DRIVE_ROOT_FOLDER_ID)
  2025/                           user-managed, immutable from the app's view
    2025-05-12_RFC_UUID.xml
    2025-05-12_RFC_UUID.pdf
  _app/                           app-owned; every file carries schemaVersion
    manifest.json                 sync state: {driveFileId -> md5, modifiedTime, kind, uuid?, parseStatus}, parserVersion
    invoices-2025.json            normalized invoices, sharded by fiscal year (REBUILDABLE from XML)
    enrichment.json               AI cache: conceptHash -> {category, groupKey, model, promptVersion, ts}  (REBUILDABLE, costs money)
    overrides.json                USER-AUTHORED corrections - the only irreplaceable file
    groups.json                   canonical product groups {id, name, origin: ai|user}
```

- **Class A - rebuildable cache** (`invoices-*`, `manifest`, `enrichment`): lose it and the app re-derives it (enrichment costs a few cents of DeepSeek).
- **Class B - user-authored** (`overrides`, user-edited `groups`): irreplaceable. Rely on Drive revision history as free undo; keep it small and rarely written.
- Keep `_app/` inside the same root folder (matches PROJECT.md: "JSON en la misma carpeta") rather than Drive's hidden `appDataFolder`, so the owner can see, back up, and hand-edit the files, and the sync lister can skip `_app/` by name.
- Shard invoices by year: matches the existing `Facturas/2025/` convention, bounds file size (about 1-3 MB at ~700 invoices/year), and confines write conflicts to the sync writer.
- Money in JSON: **decimal strings** (`"1234.56"`, unit prices up to 6 decimals), never floats. Do math with a decimal library or integer centavos. Convert to JS number only at the Excel boundary.

## Architectural Patterns

### Pattern 1: Repository ports with command-style writes

**What:** Services depend on interfaces; Drive-JSON and (future) Postgres implement them. Mutations are expressed as ops, and the adapter decides how to apply them atomically.
**When to use:** All persistence. This is the migration seam.
**Trade-offs:** Slightly more ceremony than "read JSON, edit, write JSON"; pays for itself at the first conflict and at the DB migration.

```typescript
// ports/overrides.ts
export type OverrideOp =
  | { op: 'setCategory'; conceptHash: string; category: string }
  | { op: 'clearCategory'; conceptHash: string }
  | { op: 'assignGroup'; conceptHash: string; groupId: string }
  | { op: 'renameGroup'; groupId: string; name: string }
  | { op: 'mergeGroups'; from: string; into: string };

export interface OverridesRepository {
  get(): Promise<{ overrides: Overrides; rev: string }>;
  apply(ops: OverrideOp[]): Promise<{ overrides: Overrides; rev: string }>; // conflict handling is the adapter's job
}

// ports/enrichment.ts
export interface EnrichmentRepository {
  getMany(hashes: string[], promptVersion: string): Promise<Map<string, EnrichmentEntry>>;
  putMany(entries: EnrichmentEntry[]): Promise<void>; // union-merge by key; idempotent
}
```

### Pattern 2: Full metadata listing + manifest diff (skip the Changes API in v1)

**What:** Each sync does a recursive `files.list` over `Facturas/` (fields: `id,name,mimeType,md5Checksum,modifiedTime,parents,trashed`, `pageSize=1000`), diffs against `manifest.json` by `(driveFileId, md5Checksum)`, and downloads/parses only new or changed XML. Missing-from-listing + present-in-manifest = deleted.
**When to use:** Up to a few thousand files. 4,000 files (2,000 XML + 2,000 PDF) is about 4 list pages - a handful of API calls. It also detects deletions and moves for free, which `modifiedTime > last` queries cannot.
**Trade-offs:** Changes API (`changes.list` with a saved `startPageToken`) is cheaper at scale but adds token state, parent-filtering of change feeds, and edge cases (moves, shared-drive flags). Not worth it below ~50k files. `modifiedTime` filtering alone is wrong (misses deletes/moves).

```typescript
const listing = await source.listAll();                 // ~4 calls for 4k files
const { added, changed, removed } = diff(listing, manifest);
// download+parse only added/changed XML, concurrency ~8, within a time budget
```

**Time-budgeting (required on serverless):** process in order until ~240 s of the 300 s default function duration is used, persist the manifest after every batch of ~50 files, and return `{processed, remaining}`. The UI (or a cron) re-invokes until `remaining = 0`. Initial backfill of ~2,000 XML is roughly 2-5 min at concurrency 8 (estimate, MEDIUM) - so it *will* need two or three invocations; design for it from day one. The 300 s default/maximum on Hobby and 800 s on Pro are confirmed (Vercel docs, Fluid compute).

### Pattern 3: Versioned JSON document store with merge-retry (concurrency between 2 users)

**What:** One small `JsonDocStore` in `adapters/drive` is the only code that writes `_app/*.json`. `update(name, mutate)` does read -> apply pure patch -> pre-write version check -> write -> read-back verify, retrying with jitter (max ~4) by re-reading and **re-applying the same ops** (ops are key-level and commutative, so retries converge).
**When to use:** `overrides.json`, `groups.json`, `enrichment.json`.
**Trade-offs and honesty about guarantees:**
- Drive v3's `File` resource has `version` (monotonic int64), `headRevisionId`, `md5Checksum`, `modifiedTime` but **no `etag` field and no documented `If-Match`/optimistic-concurrency support** (verified against the v3 File reference). So there is **no atomic compare-and-swap you can count on**. The pre-write check narrows the race window to milliseconds; it does not close it.
- For two humans editing categories occasionally, that residual risk is acceptable, *provided* writes are key-level patches (last-writer-wins per key, never per document) and Drive revision history is the safety net.
- **Spike early (LOW confidence until tested):** try `If-Match` with the HTTP ETag on `files.update` media upload. If Drive returns 412 on mismatch, switch the pre-write check to a real CAS with no other code changes (the seam is `JsonDocStore.update`).
- Reduce contention structurally: `invoices-*.json` and `manifest.json` have one writer (SyncService, idempotent and deterministic - a double-run just wastes work, no lock needed); `enrichment.json` is additive with deterministic-ish values so conflicting merges are harmless; only `overrides.json`/`groups.json` see human concurrency.

```typescript
async update<T>(name: string, mutate: (doc: T) => T): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { doc, version } = await this.read<T>(name);
    const next = mutate(doc);                           // pure, commutative key-level patch
    if ((await this.meta(name)).version !== version) { await jitter(attempt); continue; }
    await this.writeMedia(name, next);
    if (await this.contentHash(name) === hash(next)) return next;   // read-back verify
    await jitter(attempt);                              // someone interleaved; re-apply on fresh state
  }
  throw new ConflictError(name);
}
```

### Pattern 4: Version-validated in-memory dataset memo (instead of leaning on Next.js caching)

**What:** `DatasetService.load()` assembles the *effective dataset* (invoices ⊕ enrichment ⊕ overrides ⊕ baseline). It keeps the result in a module-level memo. Per request it performs ONE cheap `files.list` on `_app/` (fields: `name,version,md5Checksum`, ~100-200 ms) and reuses the memo if the version fingerprint matches; otherwise it re-fetches only the changed shards (parallel). Add a ~10 s TTL to skip even the fingerprint check during a burst of navigation. In-process mutations update the memo directly.
**Why not Next's cache for this:** Verified in Next.js 16.4 docs: with the default handler on **serverless, `use cache` entries typically do not persist across requests**, and neither `use cache` variant survives a new deploy (build ID is in the key); `unstable_cache` is now labelled legacy-but-supported for cross-deploy persistence of non-fetch work. `'use cache: remote'` needs a platform cache handler (extra cost). Vercel Fluid compute reuses warm instances, so a module-level memo gets good hit rates for two users, and a version fingerprint makes it correct across instances.
**Recommendation:** Do **not** enable `cacheComponents` in v1. Every page is auth-gated and per-session dynamic; there is no static shell to win, and the flag changes defaults. Use `revalidatePath` after Server Actions so RSC output refreshes. Optionally wrap *small* final report DTOs in `unstable_cache` with tags later if profiling demands (size limit of the Data Cache for large values is unverified - do not cache the full dataset there).
**Trade-offs:** Cold start pays full load (roughly 0.5-1.5 s for ~2-6 MB of JSON fetched in parallel from Drive - estimate, MEDIUM). Acceptable for a 2-user back-office tool.

### Pattern 5: Effective-view resolver with strict precedence (AI never overwrites the user)

**What:** AI output and user corrections live in **separate files and are merged only at read time**:

```
effectiveCategory(item) =
     overrides.concept[conceptHash]                // user, most specific
  ?? overrides.supplierDefault[rfcEmisor + claveProdServ]   // optional user rule
  ?? enrichment[conceptHash]?.category             // AI
  ?? baselineFromClaveProdServ(item.claveProdServ) // deterministic, no-AI fallback (segment-level)
  ?? 'Sin categoría'
```

Same shape for product group. Never copy an override into the AI cache or vice versa: re-running enrichment with a new prompt version cannot clobber a human decision, and "revert to AI suggestion" is just deleting the override key.
**Baseline from ClaveProdServ** (SAT catalog segments) gives a useful deterministic category view *before* any AI exists, so dashboard value is not blocked on DeepSeek.

### Pattern 6: Content-hash-keyed, prompt-versioned, checkpointed AI enrichment

**What:**
- `conceptHash = sha256(normalize(descripcion) | claveProdServ | claveUnidad)` truncated to 16 hex. Normalize = NFKD, strip accents, lowercase, remove punctuation, collapse whitespace. **Exclude price, quantity, emisor, date** so the same concept across invoices (and suppliers with identical text) is classified once.
- Work set = distinct hashes in dataset minus hashes already cached for the current `promptVersion` (and minus hashes with a user override - no point paying to classify them).
- Batch ~40-60 concepts per DeepSeek call, JSON-only output validated with a zod schema; invalid/missing items are retried once individually, otherwise left unclassified (not guessed).
- `putMany` after **every** batch (checkpoint) so a timeout loses at most one batch. Time-budgeted exactly like sync.
- Grouping is stateful: give the model the **existing group names** plus the new concepts and ask it to assign to an existing group id or propose a new one. This keeps group IDs stable across runs and avoids re-clustering the world (which would churn user corrections).
- Data minimization: send only description + ClaveProdServ (+ unit). No RFCs, amounts, or invoice identifiers go to a third-party LLM host.
- Keep the prompt prefix (instructions + category list) byte-stable and put variable concepts last - DeepSeek bills repeated prefixes at a cache-hit rate (third-party sources; verify current pricing and `response_format` JSON-mode params in official docs before coding).
- Run-to-completion model: `POST /api/enrich` processes within budget and returns `{remaining}`; UI shows progress and re-calls. Do not rely on fire-and-forget background work in serverless.

### Pattern 7: Drive credential = owner's OAuth refresh token (data plane), login = separate identity plane

**What:** Two independent Google OAuth concerns:

| Plane | Who | Scopes | Where it lives |
|-------|-----|--------|----------------|
| Identity (login) | Each of the 2 users | `openid email profile` (non-sensitive) | Signed/encrypted session cookie; carries no Drive token |
| Data (Drive) | The business owner, once | `https://www.googleapis.com/auth/drive` | Refresh token in Vercel env var (server only), minted by `scripts/drive-auth.ts` run locally |

**Why owner OAuth over a service account:** a service account that *creates* files in a folder shared from a personal "My Drive" can hit `storageQuotaExceeded` (service accounts get 0 GB own quota; created files count against the SA, not the sharing user - MEDIUM confidence: consistent across sources and my prior knowledge, but test it in the credential spike). The app must create `_app/*.json` and uploaded invoices, so SA fails unless a Shared Drive (Workspace) or domain-wide delegation is available. Owner OAuth works on a personal account and attributes new files to the owner.
**Why scope `drive` and not `drive.file`:** `drive.file` only covers files the app itself created (or the user picked via Picker). The existing invoice folder was created by the user, so listing it needs the full scope. `drive` is a *restricted* scope; for a private 2-user app that stays an unverified "External / In production" consent screen with the unverified-app warning (acceptable for personal use, user cap 100).
**Critical gotcha (verified):** if the OAuth consent screen's publishing status is **"Testing", refresh tokens expire after 7 days**. Publish to "In production" (still unverified) before minting the real token, or the app silently dies a week after launch. Production tokens last until revoked or unused for ~6 months - the app uses it constantly.
**Partner access:** the partner needs no Drive permissions of her own; she authenticates (identity plane), passes the allowlist, and the server acts through the owner's credential. Folder must live in (or be shared with) the owner's Drive.
**If the owner has Google Workspace:** a Shared Drive + service account (no expiry, no consent screen) is cleaner; swap `CredentialProvider` only. Open question for the user.

### Pattern 8: Upload through the server (it fits); direct-to-Drive only as a documented fallback

**What:** The Vercel **4.5 MB** request/response body limit (verified) is irrelevant for CFDI XML (tens of KB) and typical PDFs (50-300 KB). Therefore: client posts **one file per request** as multipart to `/api/upload`; server enforces size cap (about 4 MB), parses the XML, derives the canonical name `YYYY-MM-DD_RFCEMISOR_UUID.xml`, checks UUID idempotency (manifest + `appProperties.uuid`), creates the file in `Facturas/<year>/` with `appProperties {uuid, kind, source:'upload'}`, and upserts the parsed invoice immediately (no waiting for a sync). Duplicate UUID returns 409 with the existing file reference (surfaces as a duplicate issue, not a failure).
- PDFs pair to XML by UUID: accept a PDF only alongside its XML in the same batch or if that UUID's XML already exists; otherwise reject with "PDF sin XML" (OCR is out of scope).
- Next.js Server Actions default body limit is ~1 MB (`serverActions.bodySizeLimit`); use a Route Handler for uploads to avoid that trap.
- **Fallback if a PDF ever exceeds ~4 MB:** server initiates a Drive resumable session (`uploadType=resumable`, passing the browser `Origin`), returns the session URI, browser PUTs chunks directly (multiples of 256 KB; session URI valid one week - verified). Browser CORS acceptance for Drive session URIs was NOT verified (LOW) - do not build this in v1; spike only if needed.
- Client-side preview parse (shared parser) gives instant validation feedback; server remains authoritative.

### Pattern 9: One report layer, two renderers (UI and Excel)

**What:** `ReportService` returns table-shaped DTOs (`columns`, `rows`, `totals`). RSC pages render them with chart/table components; the export route renders the *same* DTOs through ExcelJS. Guarantees the spreadsheet matches the screen and avoids a second calculation path.
**Details:** server-side ExcelJS in `GET /api/export/[report]?year=&...`; numeric cells as real numbers with MXN number format; one sheet per report (resumen mensual, categoría, proveedor, productos/precios, IVA, partidas). Output for a full year of line items is on the order of 1 MB, under the 4.5 MB response ceiling; paginate/filter by year if a full export ever approaches it. Avoid the unmaintained/vulnerable `xlsx` (SheetJS npm) package.

## Data Flow

### Ingestion (Drive and manual upload converge on the same repository)

```
Drive folder ──list──▶ SyncService ──diff vs manifest──▶ download changed XML
                          │                                   │
Upload UI ─▶ /api/upload ─┼──▶ UploadService ──create file──▶ Drive (canonical name)
                          │                                   │
                          ▼                                   ▼
                   CFDI parser (pure) ──▶ Invoice (normalized, parserVersion)
                          │
                          ▼
              InvoiceRepository.upsertMany  ──▶ _app/invoices-YYYY.json
              SyncStateRepository           ──▶ _app/manifest.json (+ issues)
```

### Enrichment

```
DatasetService (invoices) ─▶ distinct conceptHashes
   − already in enrichment.json (same promptVersion)
   − already overridden by user
        │
        ▼ batches of ~50, checkpoint each
   Categorizer (DeepSeek; description+ClaveProdServ only) ─▶ zod-validate ─▶ EnrichmentRepository.putMany
```

### Read path (every page / export)

```
Request ─▶ requireUser() ─▶ DatasetService.load()
              │  1 cheap files.list on _app/ (versions)  ── unchanged? ──▶ module memo
              │  else fetch changed shards in parallel
              ▼
   effective-view resolver (override ▷ AI ▷ baseline)
              ▼
   Analytics fns (pure) ─▶ ReportDTO ─▶ RSC render │ ExcelJS download
```

### Write path (user correction)

```
UI edit ─▶ Server Action (requireUser) ─▶ OverridesService.apply(ops)
        ─▶ JsonDocStore.update (read → patch → version check → write → verify, retry)
        ─▶ update memo + revalidatePath ─▶ UI re-renders with new effective view
```

### Domain model essentials (drives parser and analytics correctness)

- `Invoice`: `uuid`, `fecha`, `tipoDeComprobante` (I/E/P/T), `metodoPago` (PUE/PPD), `formaPago`, `moneda`/`tipoCambio`, `emisor{rfc,nombre}`, `receptor{rfc}`, `subtotal`, `descuento`, `total`, impuestos totals, `conceptos[]`, `source{driveFileId, pdfFileId?}`, `parserVersion`.
- `Concepto`: `claveProdServ`, `descripcion`, `cantidad`, `claveUnidad`, `valorUnitario`, `importe`, `descuento`, `impuestos[]` (traslados/retenciones with `base,impuesto,tasa,importe`), `conceptHash`.
- **Spend rules live in the domain, not in charts:** tipo `I` (income *to the supplier*) = our expense; `E` (egreso/nota de crédito) subtracts; `P` (complemento de pagos, Pagos20) and `T` contribute **zero spend** and must never double count; non-MXN invoices convert via `TipoCambio` or are flagged. `PPD` invoices have IVA acreditable only when paid (via a `P` complement) - the IVA report needs this modeling decision recorded early (see PITFALLS).
- Validate `receptor.rfc` against the business RFC (env) and flag foreign invoices as issues - part of the "comprobantes no válidos" requirement.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ~150 invoices (today) | Everything works trivially; even a single `invoices.json` would do. Build the year-sharded layout anyway (no extra cost, avoids a migration). |
| ~2,000 invoices (the stated ceiling) | Dataset ~2-6 MB JSON. Memo + version fingerprint keeps typical pages at one list call. Sync backfill needs 2-3 time-budgeted invocations. All analytics are sub-100 ms in memory. |
| 20k+ invoices or 3+ users | Trigger to migrate: dataset load > ~2 s cold, shard files > ~10 MB, or conflict errors appear. Then implement `adapters/db` (Postgres) behind the same ports; Drive keeps only the XML/PDF blobs. Analytics may move to SQL. |

### Scaling Priorities

1. **First bottleneck: Drive I/O on cold dataset load** (not compute). Fix: year shards, parallel fetch, version-fingerprint memo, then DB.
2. **Second bottleneck: serverless duration during backfill/enrichment.** Fix: time-budgeted resumable endpoints (already designed in); Vercel Cron (daily on Hobby) as an optional safety net.
3. **Not a bottleneck:** analytics compute. Precomputed aggregate snapshots are explicitly deferred; add one only if profiling shows a report >1 s *after* the dataset is in memory.

### DB-migration path (design guarantee)

1. Implement each port in `adapters/db` (tables: `invoices`, `invoice_lines`, `enrichment`, `overrides`, `groups`, `sync_state`).
2. One-shot script reads via Drive repositories and writes via DB repositories (domain types are the interchange format; every JSON carries `schemaVersion`).
3. Flip `STORAGE=db` in `container.ts`. Services, analytics, UI, export untouched. `overrides.apply(ops)` becomes a SQL transaction - conflicts disappear.

## Anti-Patterns

### Anti-Pattern 1: Putting Drive tokens in the user session

**What people do:** Use the NextAuth Google provider with Drive scopes and stash `access_token`/`refresh_token` in the JWT/session.
**Why it's wrong:** Each user would need folder access; tokens expire per user; refresh logic spreads into route handlers; tokens leak to the client if the session callback is sloppy.
**Do this instead:** Identity plane vs data plane (Pattern 7). Session = who you are + allowlist result only.

### Anti-Pattern 2: Whole-document `save()` on shared JSON

**What people do:** `read overrides.json` -> mutate in memory -> overwrite the file; two users clobber each other.
**Why it's wrong:** Silent lost updates on the one file that cannot be rebuilt.
**Do this instead:** Command ops + `JsonDocStore.update` merge-retry (Pattern 3); keep user-authored state in its own small file.

### Anti-Pattern 3: Re-downloading and re-parsing XML on every request

**What people do:** Treat Drive like a filesystem and parse the folder per page load.
**Why it's wrong:** 2,000 file downloads per request; seconds-to-minutes latency, Drive quota burn.
**Do this instead:** Parse once into `_app/invoices-YYYY.json` keyed by UUID with `parserVersion`; re-parse only changed/new files or when `parserVersion` bumps.

### Anti-Pattern 4: Merging AI output and user overrides in one record

**What people do:** Single `categories.json` where AI writes and the user edits the same field.
**Why it's wrong:** A re-run of AI (new prompt, new model) erases human corrections; can't tell AI from human.
**Do this instead:** Separate files, read-time precedence (Pattern 5), `origin` fields for audit.

### Anti-Pattern 5: Floats for money and `parseAttributeValue: true`

**What people do:** Let the XML parser coerce `"0.160000"`/amounts to JS numbers and sum them.
**Why it's wrong:** Rounding drift in IVA and totals; loses the exactness that is the app's Core Value.
**Do this instead:** Keep attributes as strings, use decimal arithmetic, round only at presentation; reconcile `sum(conceptos) vs Total` as a parser self-check and surface mismatches as issues.

### Anti-Pattern 6: Relying on Next.js caches or fire-and-forget background work for correctness

**What people do:** Wrap Drive reads in `use cache` and expect cross-request reuse on serverless; kick off AI enrichment after responding and assume it finishes.
**Why it's wrong:** Per-instance in-memory caches don't persist across requests; unawaited work is killed at function end.
**Do this instead:** Version-validated memo (Pattern 4); explicit resumable time-budgeted endpoints with persisted checkpoints.

### Anti-Pattern 7: Protecting data only with `proxy.ts` (middleware)

**What people do:** Single auth check in the proxy/middleware file.
**Why it's wrong:** Middleware-only auth has been bypassed before (CVE-2025-29927); fiscal data is at stake.
**Do this instead:** Allowlist in the sign-in callback, then `requireUser()` (session + allowlist re-check) at every RSC page, Server Action and Route Handler; the proxy only does UX redirects.

### Anti-Pattern 8: Over-building the Changes API / resumable uploads / precomputed snapshots in v1

**What people do:** Implement the "scalable" version of every Drive feature up front.
**Why it's wrong:** Each adds state and failure modes that this data volume never needs.
**Do this instead:** Full listing + manifest diff; server-proxied upload; on-request analytics. Each has a stated trigger for revisiting (see Scaling).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Drive API v3 | REST via `fetch` + `google-auth-library` refresh-token client; `fields` masks everywhere; recursive list; media PATCH for JSON | No `etag`/documented `If-Match` in v3 File resource; use `version`/`md5Checksum`. Backoff on 403 `rateLimitExceeded`/429/5xx. Resumable session URIs last 1 week. |
| Google OAuth (login) | Auth library, scopes `openid email profile`, `signIn` callback allowlist (require `email_verified` and lowercase exact match) | Check library maintenance status when STACK.md is finalized (LOW: Auth.js ecosystem has been changing). |
| Google OAuth (Drive bootstrap) | Local script `drive-auth.ts`, loopback consent, prints refresh token for Vercel env | Publish consent screen to "In production" first (Testing = 7-day tokens). |
| DeepSeek API | OpenAI-compatible client, JSON-mode output validated by zod, ~50 concepts/batch | Third-party host: send descriptions only. Confirm JSON-mode param and current pricing in official docs at implementation time. |
| Vercel | Node runtime (not Edge) for all Drive/Excel routes; set `maxDuration` on `/api/sync` and `/api/enrich`; env vars for secrets | 4.5 MB request AND response body cap; 300 s default duration on Fluid compute; no persistent disk. |
| Excel | ExcelJS in Route Handler | Return as attachment; keep under 4.5 MB. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Delivery ↔ Services | Direct function calls via `container` | Delivery never imports adapters. |
| Services ↔ Ports | Interfaces | Only place persistence is abstracted. |
| Services ↔ Pure core | Direct imports (one-way: services -> core) | Core never imports services/adapters. |
| Server ↔ Client components | Serializable DTOs only | No domain objects with classes/Decimal instances across the boundary; pass strings/numbers. |
| Parser ↔ Browser | Same module imported client-side for preview | Keep it free of Node-only APIs. |

## Suggested Build Order (dependencies drive phases)

```
1 Foundations: scaffold, env.ts, auth+allowlist+requireUser, Drive credential bootstrap
        │   (SPIKES: credential/quota on the owner's account type; Drive If-Match)
2 Domain + CFDI parser (pure) ── tested on the real 143 XMLs (fixtures kept local; repo ignores Facturas/)
        │
3 Drive adapters: DriveClient, JsonDocStore, DriveInvoiceSource, repos (+ memory fakes)
        │
4 SyncService + manifest + issue detection ──▶ DatasetService (memo) ──▶ FIRST VERTICAL SLICE:
        │     dashboard w/ total, monthly average, by supplier (exact from XML), no AI needed
        ├──▶ 5 Upload flow (needs parser + repos + canonical naming)         [parallel with 6]
        ├──▶ 6 Analytics breadth: IVA report, quality/duplicates page, baseline ClaveProdServ categories
        │
7 Enrichment pipeline (DeepSeek categories) + Overrides repo/service + review UI   (needs 3,4; effective-view resolver)
        │
8 Product grouping + price comparison + price trends                              (needs 7: groups + overrides)
        │
9 Excel export (needs report DTOs from 4,6,8)
        │
10 Hardening: conflict tests for JsonDocStore, rate-limit/backoff, parserVersion re-parse, optional cron, DB-port conformance tests
```

Ordering rationale:
- **Parser before everything:** it defines the domain model that every other component consumes; amount correctness is the Core Value.
- **Drive adapters before sync, sync before dashboard:** a read-only vertical slice (supplier/month spend) delivers Core Value without AI or overrides and exercises the riskiest infrastructure (credentials, listing, time budget) early.
- **IVA/quality/duplicates need only the parser,** so they can precede AI; they are cheap wins and force the P/E/PPD modeling decisions early.
- **Overrides must exist before AI results are shown to users,** otherwise the review loop ("AI proposes, user corrects") has nowhere to store corrections; build the Overrides port in the same phase as enrichment.
- **Grouping depends on enrichment + overrides** (stable group IDs, user merges) - strictly after.
- **Excel last:** it only re-renders report DTOs; adding it earlier means re-doing it as reports evolve.
- **Concurrency hardening** can be incremental, but `JsonDocStore.update` must be correct from the first write to `overrides.json` (build it right in phase 3, test it in 10).

### Research flags for phases

- Phase 1 (credentials): needs a **hands-on spike**, not more reading: personal Gmail vs Workspace owner, consent screen published to production, SA-vs-OAuth quota behavior, ability to create files in `_app/`.
- Phase 3 (JsonDocStore): spike `If-Match`/ETag behavior on Drive v3 media updates; decide CAS vs best-effort.
- Phase 2 (parser): needs real-data validation (Walmart tickets with many partidas, Telmex, Pagos20 complements, discounts, retentions); domain rules for IVA acreditable PPD vs PUE need accounting-semantics research.
- Phase 7/8 (AI): needs a small prompt/eval harness on real concept strings (Spanish, abbreviations, Walmart codes) before committing to batch sizes and category taxonomy; confirm DeepSeek JSON-mode and rate limits from official docs.
- Phases 4, 5, 9: standard patterns, unlikely to need deeper research.

## Sources

- Vercel Functions limits (request/response body 4.5 MB; 300 s default and max on Hobby, 800 s Pro; memory; Fluid compute) - https://vercel.com/docs/functions/limitations (HIGH, fetched, last updated 2026-08-24)
- Next.js `use cache` directive, v16.4.0 (serverless in-memory cache does not persist across requests; build ID in key; `unstable_cache` for cross-deploy persistence; `cacheComponents` flag; `cacheTag`/`revalidateTag`/`updateTag`) - https://nextjs.org/docs/app/api-reference/directives/use-cache (HIGH, fetched, last updated 2026-09-29)
- Google Drive API v3 File resource (`version`, `headRevisionId`, `md5Checksum`, `modifiedTime`, `appProperties`; no `etag`, no documented concurrency control) - https://developers.google.com/workspace/drive/api/reference/rest/v3/files (HIGH for field list; absence of If-Match support is MEDIUM - absence in docs is not proof)
- Google Drive resumable upload guide (session URI via `Location`, 256 KB chunk multiples, one-week expiry, 5 MB multipart threshold) - https://developers.google.com/workspace/drive/api/guides/manage-uploads (HIGH; browser CORS behavior not documented there)
- OAuth refresh token 7-day expiry in "Testing" publishing status; production tokens persist until revoked/unused ~6 months - https://developers.google.com/identity/protocols/oauth2 and search results on Google developer docs (MEDIUM-HIGH, consistent across sources)
- Service-account storage quota behavior for files created in user-shared folders (0 GB default quota; use Shared Drive, delegation, or user OAuth) - web search results (MEDIUM; verify in spike)
- Next.js 16 `middleware` -> `proxy` rename; defense-in-depth after CVE-2025-29927 - web search results incl. DEV Community write-ups (MEDIUM)
- DeepSeek JSON output / prefix context caching / pricing - third-party guides only (LOW; confirm at https://api-docs.deepseek.com before implementing)
- Estimates for backfill duration, dataset load time, and file sizes are reasoned estimates from typical CFDI sizes and Drive latencies (MEDIUM; measure in phase 3-4)

---
*Architecture research for: Mexican CFDI expense-analysis app on Next.js/Vercel with Google Drive as storage*
*Researched: 2026-10-09*
