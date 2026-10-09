# Stack Research

**Domain:** Mexican CFDI (SAT e-invoice) expense-analysis web app (small cafe + coworking, 2 users, ~150-500 invoices/year, no DB in v1)
**Researched:** 2026-10-09
**Confidence:** MEDIUM-HIGH overall (versions verified live against the npm registry and official docs on 2026-10-09; the Google Drive scope strategy and Better Auth stateless token flow are the two items that need an early spike, see "Open Spikes")

> **Read this first: the 2025 playbook is stale.** Between late 2025 and today several defaults changed. Do not rely on training-data memory for any of these:
> - Next.js is **16.4** (Turbopack default, `middleware.ts` renamed `proxy.ts`, `next lint` removed, sync `cookies()/headers()/params` access removed).
> - Auth.js / NextAuth v5 is **still `5.0.0-beta.32`** and the team now sits under Better Auth, which says to start new projects on Better Auth.
> - DeepSeek **`deepseek-chat` / `deepseek-reasoner` were retired 2026-07-24**. Current models are `deepseek-flash` and `deepseek-v4-pro`, and **thinking mode is ON by default**.
> - **TypeScript 7.0.2 is `latest` on npm but typescript-eslint does not support it yet** (peer `<6.1.0`). Use TS 6.0.x.
> - **ESLint 10 is `latest` but `eslint-config-next`'s plugins (react, jsx-a11y, import) do not support it yet** (peers top out at `^9`). Use ESLint 9.39.x.
> - Node 20 is deprecated on Vercel (2026-10-01). Use Node 24.x.

## Recommended Stack

### Core Technologies

| Technology | Version (pin) | Purpose | Why Recommended | Confidence |
|------------|---------------|---------|-----------------|------------|
| Node.js | 24.x (`engines.node: "24.x"`) | Runtime | Vercel default is now 24.x; Node 20 is deprecated on Vercel; Vitest 5 requires `^22.12 \|\| ^24`; `openai@7` requires `>=22`. | HIGH |
| Next.js (App Router) | 16.4.0 | Full-stack framework | Current `latest`. Turbopack is default and stable; `proxy.ts` replaces middleware; Cache Components is opt-in (leave off in v1). Node >=20.9 and TS >=5.1 required. Native Vercel target. | HIGH |
| React / React DOM | 19.3.0 | UI | Required by Next 16 (App Router ships React canary with 19.2+ features). | HIGH |
| TypeScript | **6.0.3** (strict) | Language | 7.0.2 (native compiler) is `latest` on npm, but `typescript-eslint@8.71.1` declares `typescript >=4.8.4 <6.1.0`, so 7.x breaks typed linting. Next needs only >=5.1. Revisit 7.x when typescript-eslint supports it. Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. | HIGH |
| pnpm | 11.5.x (via `packageManager` field / Corepack) | Package manager | User preference; first-class on Vercel. | HIGH |
| Better Auth | 1.7.7 | Google login, session, provider token storage/refresh | Auth.js v5 never left beta (`5.0.0-beta.32`) and its maintainers moved to Better Auth, which recommends itself for new projects. **Stateless mode (no database) is built in**: when no `database` is passed, sessions live in a signed/encrypted cookie and Google tokens in an encrypted `account_data` cookie, with `getAccessToken({ useAccountCookie: true })` refreshing expired access tokens. Peer-compatible with Next ^16. | MEDIUM-HIGH (see Spike 1) |
| @googleapis/drive | 26.0.2 | Drive v3 client | Scoped package (2.4 MB unpacked) instead of `googleapis` (**245 MB unpacked**, which is dangerously close to Vercel's 250 MB function size limit and slows cold starts). Typed, Google-maintained, built-in gaxios retry. | HIGH |
| google-auth-library | 11.2.0 | `OAuth2Client` to hand the user's access token to the Drive client | Required companion to `@googleapis/drive` when you supply your own token. | HIGH |
| fast-xml-parser | 5.11.2 (>=5.6 mandatory) | CFDI XML to JS object | 82M weekly downloads, zero deps, fast, handles namespaces/attributes. 5.x had a run of entity-expansion DoS CVEs (CVE-2026-26278, CVE-2026-33036, fixed in later 5.x); 5.11.2 post-dates them. Still guard inputs (see Pattern below). | HIGH |
| zod | 4.6.5 | Validation of parsed CFDI, AI output, Drive JSON, env, API inputs | Single schema language across all trust boundaries. Peer-compatible with `ai`, `openai`, `@t3-oss/env-nextjs`. | HIGH |
| decimal.js | 10.6.0 | Exact money/tax arithmetic | Core value is "exactness from the XML". Never use JS floats for `ValorUnitario` (up to 6 decimals), `Importe`, `Descuento`, IVA bases. Keep attribute values as strings in the parser, convert to `Decimal`, round only at presentation. | HIGH |
| openai (SDK) | 7.31.0 | DeepSeek client (`baseURL: https://api.deepseek.com`) | DeepSeek documents the OpenAI SDK as the reference client. DeepSeek supports only `response_format: {type:"json_object"}` (no strict `json_schema`), so AI SDK's schema-enforcement advantage disappears; you validate with zod and retry yourself. Fewer moving parts than `ai@7` (which is at patch `7.0.137`, high churn). | MEDIUM-HIGH |
| Tailwind CSS | 4.3.3 (+ `@tailwindcss/postcss` 4.3.3) | Styling | shadcn/ui's current baseline (OKLCH tokens, `tw-animate-css`). CSS-first config. | HIGH |
| shadcn/ui (CLI `shadcn`) | 4.21.4 | Component source (copy-in), Radix flavor | Owns the code, Tailwind v4 + React 19 native, includes `chart`, `data-table`, `sidebar`, `sonner`, forms. Pick the **Radix** base (default, most examples). | HIGH |
| Recharts (via shadcn `chart`) | 3.10.1 | Charts | shadcn's `chart` component is built on Recharts **v3**; gives bar, line, area, pie/donut, stacked with themed tooltip/legend. 57M weekly downloads. | HIGH |
| @tanstack/react-table | 9.2.8 | Sortable/filterable tables (suppliers, line items, price comparison) | shadcn's current `data-table` guide installs v9 (`pnpm add @tanstack/react-table`). | MEDIUM-HIGH |
| write-excel-file | 4.1.1 | `.xlsx` export | MIT, single dep (`fflate`), released 2026-06, ~1.2M weekly downloads. Supports bold/fills/borders/alignment, currency & date number formats, column widths, frozen rows (`stickyRowsCount`), formulas, multiple sheets, `toBuffer()` in Node. Covers everything an expense report needs. See Alternatives for why not ExcelJS / SheetJS. | MEDIUM-HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @t3-oss/env-nextjs | 0.13.11 | Typed, zod-validated env vars (Google client id/secret, `BETTER_AUTH_SECRET`, `DEEPSEEK_API_KEY`, `ALLOWED_EMAILS`, `DRIVE_FOLDER_ID`) | Always; fail the build on missing secrets. |
| server-only | 0.0.1 | Compile-time guard that Drive/DeepSeek/auth modules never reach the client bundle | Put `import "server-only"` at top of every module touching tokens or API keys. |
| p-limit | 7.3.3 | Bounded concurrency when downloading ~300 files from Drive (`concurrency: 8`) | Ingestion/sync. |
| p-retry | 8.0.1 | Exponential backoff for Drive 429/403-rateLimit and DeepSeek 429/5xx | Wrap all outbound calls; `@googleapis/drive` retries some, DeepSeek client needs explicit policy. |
| fflate | 0.8.3 | Unzip SAT-portal ZIP downloads **in the browser** before upload | Manual upload: SAT delivers ZIPs; unzip client-side so each XML is its own small request (sidesteps the 4.5 MB body cap). |
| date-fns | 4.4.0 | Month bucketing, `es-MX` formatting | CFDI `Fecha` is local time without offset; parse as a calendar date, never via `new Date()` UTC conversion. |
| nuqs | 2.10.2 | Type-safe URL query state (date range, supplier, category filters) | Dashboard filters that must survive reload/share between the two users. |
| lucide-react | 1.54.0 | Icons (shadcn default) | Always. |
| clsx / tailwind-merge / class-variance-authority | 2.1.1 / 3.7.0 / 0.7.1 | shadcn utility trio | Installed by shadcn init. |
| radix-ui | 1.7.0 | Primitives behind shadcn components | Installed by shadcn. |
| sonner | 2.0.8 | Toasts (shadcn) | Upload/classification feedback. |
| tw-animate-css | 1.4.0 | Animation utilities (replaces `tailwindcss-animate`) | Installed by shadcn init. |
| fuse.js | 7.5.0 | Cheap local fuzzy pre-clustering of product descriptions before/alongside the LLM | Optional; use to pre-group near-identical descriptions inside the same `ClaveProdServ` so the LLM only sees representatives (cuts tokens). |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| ESLint | **9.39.5** | Linting | NOT 10.x: `eslint-plugin-react@7.37.5`, `jsx-a11y@6.10.2`, `import@2.32.0` (all pulled in by `eslint-config-next`) cap at `^9`. Flat config only (`eslint.config.mjs`). |
| eslint-config-next | 16.4.0 | Next/React/a11y rules | Peer `eslint >=9`. Run `eslint .` directly (no `next lint`; `next build` no longer lints, so add lint to CI). |
| typescript-eslint | 8.71.1 | Type-aware strict rules | Use `strictTypeChecked` + `stylisticTypeChecked`. Peer `typescript <6.1.0` is the reason TS stays on 6.0.x. |
| Prettier + prettier-plugin-tailwindcss | 3.9.9 / 0.8.1 | Formatting, Tailwind class ordering | Add `eslint-config-prettier@10.1.8` to disable rule overlap. |
| Vitest | 5.0.3 (+ `@vitest/coverage-v8` 5.0.3) | Unit/integration tests | Needs Node `^22.12 \|\| ^24` and Vite `^6.4 \|\| ^7 \|\| ^8` (Vitest installs a compatible Vite). Test environment `node` for parser, aggregation, AI-response validation, storage layer; this is where 90% of the value is. |
| @testing-library/react + jest-dom + happy-dom | 16.3.3 / 7.0.1 / 20.14.6 | Client component tests | Only for interactive client components (correction editor, upload dropzone). Async Server Components cannot be unit-tested in Vitest; cover them in Playwright. |
| Playwright (`@playwright/test`) | 1.64.0 | E2E smoke | Do not automate the real Google consent screen. Mint a Better Auth session cookie in a test-only setup and reuse via `storageState`; mock Drive and DeepSeek behind the storage/AI interfaces (see Spike 1, Spike 4). |
| msw | 3.0.2 | HTTP-level fakes for DeepSeek contract tests | Optional; prefer in-memory fakes behind the `Storage` and `Categorizer` interfaces for most tests. |
| @types/node / @types/react / @types/react-dom | 24.19.2 / 19.3.0 / 19.3.0 | Types | Match Node 24 (NOT `@types/node@26`). |

## Domain Findings From the Sample Data (143 real XMLs, 2025)

These drive the parser design and are more important than any library choice. Counts come from the real files in `Facturas/2025/` (no personal data reproduced here).

| Observation | Count | Consequence for the stack/parser |
|-------------|-------|----------------------------------|
| `Version="4.0"` | 143/143 | Parse 4.0; keep the 3.3 path minimal (namespace `http://www.sat.gob.mx/cfd/3`) but do not build it until a 3.3 file shows up. |
| **UTF-8 BOM (`EF BB BF`) at file start** | 142/143 | Strip BOM (`text.replace(/^\uFEFF/, "")`) before parsing, or the first tag fails. Decode bytes as UTF-8 explicitly (encoding attribute is `utf-8` or `UTF-8`). |
| `TipoDeComprobante`: I=133, **E=3**, **P=7** | | **E (egreso/credit notes) must subtract** from spend (6 files carry `CfdiRelacionados`; link by related UUID). **P (pago) has `Moneda="XXX"`, `Total=0` and a `pago20:Pagos` complement; exclude from spend** to avoid double counting. Model `kind` as a discriminated union in zod. |
| Complements beyond TFD/Pagos: `terceros`, `ine`, `registrofiscal`, `implocal`, `iedu`, `cce20` | 1-7 each | Whitelist-parse only `tfd:TimbreFiscalDigital` (UUID, FechaTimbrado) and Pagos; ignore unknown complements without failing. `implocal` (local taxes) can change `Total` vs sum of concepts; reconcile at the document level. |
| `Descuento` present at concept level | 195 concepts | Net line amount = `Importe - Descuento`; the tax `Base` already reflects the discount (e.g. Importe 91.05, Descuento 2.05, Base 89.00). Compute unit price comparisons on **net** amounts. |
| `ObjetoImp`: 01 (no tax object) x21, 02 x340, 04 x1 | | Concepts with 01 have no `Impuestos` node; do not assume it exists. |
| IVA `TasaOCuota`: 0.000000 x222, 0.160000 x272, 0.080000 x4; IEPS (`Impuesto="003"`) x20 incl. 0.03 | | Tasa 0% is **not** exempt ("Exento") and is not zero-tax-free; keep rate + base. IVA acreditable = sum of `Impuesto="002"` Traslados with positive rate; IEPS is a separate bucket (not creditable like IVA). No `Retencion` nodes in sample, but still support them. |
| Single vs multiple children (`Concepto`, `Traslado`, `Retencion`) | | fast-xml-parser returns an object for one child and an array for many: force arrays with `isArray`. |
| File sizes: XML avg 5.8 KB (max 10 KB), PDF avg 45 KB (max 54 KB); whole year 7.3 MB | | Per-file requests are far below Vercel's 4.5 MB cap; only ZIPs and batched multipart can hit it. |

### CFDI parser configuration (load-bearing)

```ts
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",       // Rfc, Total, ClaveProdServ... as plain keys
  removeNSPrefix: true,          // cfdi:Concepto -> Concepto, tfd:TimbreFiscalDigital -> TimbreFiscalDigital
  parseAttributeValue: false,    // KEEP STRINGS. Money goes to Decimal, never to float. RFCs/UUIDs must not coerce.
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ["Concepto", "Traslado", "Retencion", "CfdiRelacionado", "Pago", "DoctoRelacionado"].includes(name),
});

export function parseCfdiXml(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("DTD not allowed in CFDI"); // CFDI never has a DTD; kills the entity-expansion CVE class
  return cfdiSchema.parse(parser.parse(text)); // zod validates + normalizes to the domain model
}
```

Write the CFDI mapper yourself (about 150 lines + zod): the app needs ~15 fields and has edge cases (E/P types, discounts, complements) that generic libraries gloss over. See "What NOT to Use" for the CFDI-specific libraries.

## Architecture-Affecting Stack Decisions

### Authentication: Better Auth, stateless, Google, allowlist

```ts
// lib/auth.ts (server-only)
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // NO `database` => stateless mode (cookie sessions)
  session: { cookieCache: { enabled: true, maxAge: 7 * 24 * 60 * 60, strategy: "jwe", refreshCache: true } },
  account: { storeStateStrategy: "cookie", storeAccountCookie: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      accessType: "offline",              // refresh token
      prompt: "select_account consent",   // re-issue refresh token every sign-in
      scope: ["openid", "email", "profile" /* + Drive scope(s) per Spike 2 */],
    },
  },
  plugins: [nextCookies()], // must be last; lets Server Actions set cookies
});
```

Rules that matter:
1. **Allowlist is enforced in the data-access layer, not only in `proxy.ts`.** Create `requireUser()` that calls `auth.api.getSession({ headers: await headers() })`, checks `session.user.email` against `ALLOWED_EMAILS` (lower-cased, **and** `emailVerified === true`), and call it in every page, Route Handler and Server Action. Better Auth's own docs warn that a cookie-presence check in `proxy.ts` is forgeable and is only for redirects. Also reject at the OAuth callback so non-allowlisted users never get a session cookie (spike the cleanest hook).
2. **Cookies cannot be set from Server Components.** `getAccessToken({ useAccountCookie: true })` returns a refreshed token and a `Set-Cookie`; in a Server Component the new cookie is dropped, so every request after the first hour re-refreshes (Google refresh tokens are not rotated, so this is correct but wasteful). Do Drive work in Route Handlers / Server Actions (with `nextCookies()`), and keep a 5-minute in-memory margin.
3. **Cookie size:** id_token + access + refresh token are chunked by Better Auth; fine for Google. Do not add other providers.
4. **Revocation:** stateless sessions cannot be killed individually. Bump `cookieCache.version` and redeploy to log everyone out. Acceptable for 2 trusted users.
5. `BETTER_AUTH_SECRET` also encrypts the refresh token cookie (a Drive-scoped token). Treat it like a production secret; rotate = forced re-login.

### Google Drive access: scopes and consent-screen status (the sharpest edge)

- Verified facts (Google docs): `drive.file` is **non-sensitive** (only files the app created or the user explicitly shared with it via Picker). `drive.readonly`, `drive`, `drive.metadata*` are **restricted**. An **unverified** app requesting a sensitive/restricted scope is capped at **100 new users** and shows an "unverified app" screen. With the consent screen in **Testing**, refresh tokens **expire after 7 days** (exception: only name/email/profile scopes).
- Consequence: for this app, leaving the OAuth consent screen in "Testing" means users are bounced to re-login weekly. **Publish the consent screen to "In production"** (unverified is acceptable for 2 users, well under the cap; accept the warning screen) or, if the business owns a Google Workspace domain, set it to **Internal**.
- Scope decision (see Spike 2): the existing 143-file invoice folder was not created by the app, so `drive.file` alone only works if a Picker-selected folder also exposes its children (undocumented, must be tested). Default plan: **`drive` (restricted) so the app can read the existing folder and write correction JSON into it**, wrapped behind a `Storage` interface so the scope can be narrowed later. Accept that the refresh token in the cookie is therefore full-Drive-capable; mitigate with httpOnly/secure/SameSite cookies, no logging of tokens, `server-only`.
- **Do not switch to a service account for writes.** Service accounts have a 0 GB default quota; files created by a service account inside a consumer user's My Drive folder fail with `storageQuotaExceeded` (works only on Shared Drives, which need Workspace). A service account is viable for read-only ingestion only. (MEDIUM: secondary sources.)
- Drive has no conditional write (no `If-Match` for file content on v3). Two users editing corrections = last write wins. Store corrections as small per-entity or per-user append-only JSON files and merge on read rather than one big `corrections.json`.

### AI: DeepSeek via OpenAI SDK

```ts
import OpenAI from "openai";
export const deepseek = new OpenAI({ apiKey: env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com", maxRetries: 0, timeout: 60_000 });

const res = await deepseek.chat.completions.create({
  model: env.DEEPSEEK_MODEL,                       // default "deepseek-flash"; env-configurable because aliases get retired
  messages,                                        // system prompt MUST contain the word "json" + an example object
  response_format: { type: "json_object" },
  max_tokens: 8000,                                // generous: truncated JSON is the #1 failure
  temperature: 0,
  // @ts-expect-error DeepSeek extension param (not in OpenAI types): disable thinking for deterministic classification
  thinking: { type: "disabled" },
});
```

- Model: **`deepseek-flash`** (DeepSeek-V4.1-Flash, 1M context, JSON output + tool calls supported, concurrency limit 2500). Reserve `deepseek-v4-pro` (concurrency 500) for the "regroup ambiguous products" pass if flash quality is insufficient.
- **Thinking mode is on by default**; it ignores `temperature`, burns output tokens and latency. Send `thinking: {type: "disabled"}` for classification/grouping.
- JSON: only `json_object` exists (no strict `json_schema`, so `zodResponseFormat` from the OpenAI SDK will NOT work). Docs warn of **occasional empty content**: validate with zod, retry up to 2 times with a re-worded prompt, and fall back to "Sin clasificar" rather than failing the batch.
- Pricing is negligible (flash: $0.15-$0.30 per 1M input cache-miss, $0.60-$1.20 per 1M output; off-peak is half). A year of ~2,000 distinct line descriptions costs cents. Cache every verdict in Drive keyed by `sha1(normalized description + ClaveProdServ + unidad)` so nothing is paid for twice.
- **Privacy:** DeepSeek is a third-party (China-hosted) API. Send only normalized line description, `ClaveProdServ`, unit and (optionally) supplier trade name. Never send the receptor RFC, names, UUIDs, totals or seals.
- Run classification as **client-driven batches** (30-60 items per request, 3 concurrent) with a progress bar; each request finishes well inside the 300 s default function duration. No queue/Workflow needed in v1.
- Fallback client: `ai@7.0.137` + `@ai-sdk/deepseek@3.0.63` (supports `thinking`, `reasoningEffort`, object generation). Choose it only if streaming/chat UX is added later.

### File upload on Vercel

- Hard limit: **4.5 MB request or response body per Vercel Function**, returns `413 FUNCTION_PAYLOAD_TOO_LARGE` (verified in Vercel docs, last updated 2026-08-24). Max duration is 300 s on Hobby (800 s Pro).
- **Do not use Server Actions for uploads**: their body limit is **1 MB by default** (`experimental.serverActions.bodySizeLimit`, verified for Next 16.4), and raising it past 4.5 MB is pointless on Vercel.
- Use a **Route Handler** (`POST /api/upload`, `export const runtime = "nodejs"`) receiving **one file per request** (XML ~6 KB, PDF ~45 KB), client concurrency of 4. Validate: extension/MIME, size <= 4 MB, XML must parse, filename sanitized, then write to Drive using the user's token. Reject DTDs.
- ZIPs from the SAT portal: unzip in the browser with `fflate`, then send each member individually. A ZIP over ~4 MB is handled client-side, not server-side.
- Escape hatch if you ever need >4.5 MB files (not expected): Drive **resumable upload** with the browser PUTting directly to the session URI that the server creates, or Vercel Blob client uploads (`@vercel/blob@2.8.1`). Not needed in v1; PDFs are backup only.
- Export (`.xlsx`) is a Route Handler returning a `Buffer`; sizes are tiny. Response also has the 4.5 MB cap (streaming lifts it for responses only).

### UI/Charts

- shadcn `chart` (Recharts 3) for: monthly spend (bar + average reference line), category donut/stacked bar, supplier ranking (horizontal bar), supplier evolution (stacked area), product price trend (multi-line per supplier), IVA by month (bar).
- Charts are Client Components: pass **pre-aggregated serializable data** (numbers rounded to cents, month keys as `YYYY-MM`) from Server Components; never ship raw invoices to the browser.
- Locale: `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`; UI strings in Spanish; set `<html lang="es-MX">`.
- Use the **Radix** shadcn flavor; `@base-ui/react@1.9.0` is the alternative base and has fewer examples.

## Installation

```bash
# Scaffold (answers: TypeScript, ESLint, Tailwind, App Router, src dir, Turbopack, alias @/*)
pnpm dlx create-next-app@16.4.0 facturas --ts --eslint --tailwind --app --src-dir --use-pnpm
cd facturas

# Pin toolchain majors that differ from "latest"
pnpm add -D typescript@~6.0.3 eslint@~9.39.5 @types/node@~24.19.2

# Core runtime deps
pnpm add better-auth@1.7.7 @googleapis/drive@26.0.2 google-auth-library@11.2.0 \
  fast-xml-parser@5.11.2 zod@4.6.5 decimal.js@10.6.0 openai@7.31.0 \
  write-excel-file@4.1.1 recharts@3.10.1 @tanstack/react-table@9.2.8 \
  @t3-oss/env-nextjs@0.13.11 server-only p-limit@7.3.3 p-retry@8.0.1 \
  fflate@0.8.3 date-fns@4.4.0 nuqs@2.10.2

# UI (shadcn init pulls radix-ui, lucide-react, clsx, tailwind-merge, cva, tw-animate-css)
pnpm dlx shadcn@4.21.4 init
pnpm dlx shadcn@4.21.4 add chart table card button select tabs dialog sheet sonner skeleton badge input

# Dev tooling
pnpm add -D vitest@5.0.3 @vitest/coverage-v8@5.0.3 @playwright/test@1.64.0 \
  @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 happy-dom@20.14.6 \
  typescript-eslint@8.71.1 prettier@3.9.9 prettier-plugin-tailwindcss@0.8.1 eslint-config-prettier@10.1.8
pnpm exec playwright install chromium
```

`package.json`: `"engines": { "node": "24.x" }`, `"packageManager": "pnpm@11.5.2"`. In Vercel project settings set Node 24.x and Fluid compute (default for new projects). In `next.config.ts` add `serverExternalPackages: ["@googleapis/drive", "google-auth-library"]` only if bundling issues appear (spike result).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Better Auth 1.7.7 (stateless) | Auth.js / next-auth `5.0.0-beta.32` (JWT strategy, refresh in `jwt` callback) | **Fallback if Spike 1 fails.** Well-trodden Google+Drive refresh pattern, works without a DB, but still beta and in maintenance mode (security patches only). `next-auth@4.24.15` is `latest` on npm and is the wrong major for the App Router. |
| Better Auth stateless | Better Auth + a database | When migrating off Drive-as-DB (post v1): store tokens server-side, enable per-session revocation. The stateless config is a drop-in subset. |
| `@googleapis/drive` | Raw `fetch` against Drive REST v3 | If the dependency fights Turbopack bundling. The needed surface is tiny (list, get media, multipart create, update). Keep it behind the `Storage` interface so swapping is local. |
| `@googleapis/drive` | `googleapis` (monolith) | Never here: 245 MB unpacked vs Vercel's 250 MB function limit, slow cold starts. |
| `openai` SDK | `ai` + `@ai-sdk/deepseek` | If streaming chat/"ask your invoices" UI is added, or you want provider portability. |
| `deepseek-flash` | `deepseek-v4-pro` | A/B on a sample of ~100 hard items; pro costs ~4x on input and ~3x on output. |
| write-excel-file | ExcelJS 4.4.0 | If you need reading existing workbooks, rich worksheet features (data validation, images, conditional formatting, streaming huge files). MIT and widely used (17.6M weekly) but last release is 2024-12-20 and it carries old transitive deps (`archiver@5`, `unzipper@0.10`, `uuid@8`). Acceptable fallback; not first choice for a greenfield. |
| write-excel-file | SheetJS `xlsx` | Only via `https://cdn.sheetjs.com/xlsx-0.20.x/...tgz`: the npm `xlsx@0.18.5` is frozen and affected by CVE-2023-30533 (prototype pollution, parse path) and CVE-2024-22363 (ReDoS, fixed 0.20.2); the free Community Edition has no cell styling (Pro only). Wrong tool for styled report output. |
| shadcn `chart` (Recharts 3) | Tremor `@tremor/react@3.18.7` | Tremor's npm package was last published 2025-01-13 and targets Recharts 2 / Tailwind 3; shadcn charts cover the same needs on the current stack. |
| shadcn `chart` | visx / Nivo / ECharts | Only if you need chart types Recharts lacks (Sankey for category flow, treemap is in Recharts). Not needed in v1. |
| ESLint 9 + eslint-config-next | Biome 2.5.15 | Next 16 docs endorse "Biome or ESLint". Biome is faster and one tool, but you lose `eslint-config-next` Next-specific rules and typescript-eslint type-aware rules. Pick Biome only if you want zero-config speed over rule depth. |
| Vitest | Jest | No reason; Vitest 5 is ESM/TS-native. |
| decimal.js | big.js 7.0.1 / dinero.js 2.0.2 | big.js if bundle size on the client matters (it won't; math stays server-side). Dinero models currency amounts with fixed minor units and is awkward for 6-decimal unit prices. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `deepseek-chat` / `deepseek-reasoner` model names | **Retired 2026-07-24.** Old tutorials still show them. | `deepseek-flash` (env-configurable `DEEPSEEK_MODEL`). |
| DeepSeek thinking mode left default | On by default: slow, expensive, ignores temperature. | `thinking: {type: "disabled"}`. |
| `zodResponseFormat` / `response_format: json_schema` with DeepSeek | Not supported (only `json_object`). | `json_object` + zod validation + retry. |
| `googleapis` | 245 MB package; threatens the 250 MB Vercel function limit. | `@googleapis/drive`. |
| TypeScript 7.0.x (for now) | typescript-eslint peer `<6.1.0`; typed linting breaks. | TS 6.0.3. |
| ESLint 10.x (for now) | `eslint-plugin-react/jsx-a11y/import` peers stop at `^9`; peer-dep conflicts under pnpm. | ESLint 9.39.5. |
| `next-auth@4` / `next-auth@latest` | `latest` tag is v4 (Pages Router era). v5 is only on the `beta` tag. | Better Auth. |
| `middleware.ts` | Deprecated in Next 16. Also never the sole auth gate. | `proxy.ts` for redirects only + DAL checks. |
| `next lint` | Removed in Next 16. | `eslint .` in CI/pre-commit. |
| Server Actions for file upload | 1 MB default body cap; Vercel caps at 4.5 MB regardless. | Route Handler, one file per request. |
| Sync `cookies()`, `headers()`, `params` | Removed in Next 16. | `await cookies()`, `await params`. |
| `@tremor/react` | Stale since Jan 2025, Recharts 2/Tailwind 3 era. | shadcn `chart`. |
| xlsx (SheetJS) from npm | Frozen vulnerable 0.18.5, no styling in CE. | write-excel-file (or ExcelJS). |
| `@cfdi/*` (e.g. `@cfdi/2json`), `@nodecfdi/*` | The `@cfdi/*` suite has ~3 weekly downloads (unproven); `@nodecfdi/cfdi-to-json` ~765/week; most `@nodecfdi` packages last published 2022-2024; they target **issuing/sealing/stamping** CFDI, not analytics, and do not model E/P types, concept discounts or complements the way this app needs. | Own ~150-line fast-xml-parser + zod mapper, tested against the 143 real files. |
| Parsing money as JS `number` | Accumulated float drift breaks "exactness" core value. | strings in, `Decimal` for math, round to centavos on output. |
| Fixed `corrections.json` single-file overwrite | Drive has no conditional write; two users clobber each other. | Per-entity / per-user JSON files merged on read. |
| Real Google OAuth in Playwright | Google blocks automation (captcha/consent). | Test-minted session cookie + faked Drive. |
| React Compiler / `cacheComponents` in v1 | Unneeded risk (Babel build cost; Cache Components requires Suspense discipline). | Plain RSC + explicit short-lived caching of the parsed-invoice index. |

## Stack Patterns by Variant

**If the invoice folder is readable only via the `drive` restricted scope (Spike 2 default):**
- Publish consent screen "In production", unverified; keep users <= 100; document the warning screen for the partner.
- Because the refresh token grants full Drive, keep the token only in the encrypted httpOnly cookie, never log it.

**If a Picker-selected folder exposes children under `drive.file`:**
- Use `drive.file` (non-sensitive, no unverified-app warning, minimal blast radius) plus the Google Picker (`@googleapis/drive` list on the picked folder id, `https://apis.google.com/js/api.js` loaded client-side).
- This is the better end state; adopt it if the spike confirms child visibility including files added later by the owner.

**If the business has a Google Workspace domain:**
- Set the OAuth app type to Internal (no verification, no unverified screen, no 7-day token expiry); a service account + Shared Drive also becomes viable for writes.

**If sync is slow (hundreds of files):**
- Persist a parsed-invoice index (`index.json`: UUID, fileId, modifiedTime, parsed fields) in Drive, and on each load only fetch files whose `modifiedTime`/`id` is new. 143 small downloads at concurrency 8 is only a few seconds, so defer this unless measured.

**If AI quality is weak on short supermarket abbreviations ("MM LECHE DES", "QSO MANCHEGO"):**
- Add `ClaveProdServ` and its 2-digit SAT segment name as context in the prompt, include supplier name, and let the user's saved corrections act as few-shot examples (cheap, big accuracy win).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.4.0 | react@19.3.0, react-dom@19.3.0, node >=20.9, typescript >=5.1 | `eslint-config-next@16.4.0` must match Next minor. |
| better-auth@1.7.7 | next ^14 \|\| ^15 \|\| ^16 | Peers are all optional/other frameworks; no DB driver needed in stateless mode. |
| typescript-eslint@8.71.1 | typescript >=4.8.4 <6.1.0, eslint ^8.57 \|\| ^9 \|\| ^10 | Caps TS at 6.0.x. |
| eslint-config-next@16.4.0 | eslint >=9; bundled plugins support eslint <=9.x | Keep ESLint at 9.39.x. |
| vitest@5.0.3 | node ^22.12 \|\| ^24 \|\| >=26; vite ^6.4 \|\| ^7 \|\| ^8 | Matches Node 24 on Vercel. |
| openai@7.31.0 | node >=22; zod ^3.25 \|\| ^4 | Use Node 24 locally and on Vercel. |
| zod@4.6.5 | ai@7, openai@7, @t3-oss/env-nextjs@0.13 | Single zod major across the repo. |
| recharts@3.10.1 | react ^16.8-^19 (also needs `react-is`) | shadcn `chart` targets Recharts 3; install `react-is` if pnpm strict peers complain. |
| tailwindcss@4.3.3 | @tailwindcss/postcss@4.3.3, shadcn@4.21.4 | `tw-animate-css` replaces `tailwindcss-animate`. |
| @googleapis/drive@26.0.2 | googleapis-common@9, gaxios@8 | Pass the same `google-auth-library` major as `googleapis-common` resolves to, or you get two `OAuth2Client` types. |

## Open Spikes (do these in Phase 1, before building on them)

1. **Better Auth stateless + Google + Drive token refresh on Vercel.** Prove: sign-in with `accessType: offline`, refresh token stored in `account_data` cookie, `getAccessToken({useAccountCookie:true})` called from a Route Handler refreshes after 1 h, allowlist rejects a non-listed Google account without leaving a session, Playwright can mint a session. Fallback: Auth.js v5 beta with JWT strategy. (Docs read confirm each piece individually; the combination is the risk.)
2. **Drive scope.** Test whether `drive.file` + Picker on a folder lets `files.list` with `'<id>' in parents` return pre-existing children (and files added later). If yes, use `drive.file`; if no, use `drive` and publish consent screen "In production".
3. **Consent screen status.** Confirm the "In production + unverified" path issues non-expiring refresh tokens for the two real accounts and that the partner can get past the warning screen.
4. **Better Auth test seam.** Verify how to mint a session in tests (test-utils plugin or direct cookie signing); not confirmed in docs reviewed.
5. **Bundle check.** `next build` + inspect function size with `@googleapis/drive` and `write-excel-file` under Turbopack; add `serverExternalPackages` only if needed.

## Sources

- npm registry (queried live 2026-10-09): versions, dist-tags, peerDependencies, engines, unpacked sizes and weekly downloads for next, react, typescript, typescript-eslint, eslint, eslint-config-next and plugins, better-auth, next-auth, googleapis, @googleapis/drive, google-auth-library, fast-xml-parser, zod, openai, ai, @ai-sdk/deepseek, recharts, @tremor/react, tailwindcss, shadcn, exceljs, xlsx, write-excel-file, vitest, @playwright/test, @tanstack/react-table (HIGH)
- https://nextjs.org/blog/next-16 and https://nextjs.org/docs/app/guides/upgrading/version-16 (v16.4.0 docs, updated 2026-10-02): proxy.ts, Turbopack default, `next lint` removal, async request APIs, Node/TS minimums (HIGH)
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions: 1 MB default Server Action body limit (HIGH)
- https://vercel.com/docs/functions/limitations (updated 2026-08-24): 4.5 MB body limit, 300 s default/max on Hobby, 800 s Pro, 250 MB bundle limit, 2 GB memory (HIGH)
- https://vercel.com/docs/functions/runtimes/node-js/node-js-versions: Node 24.x default, Node 20 deprecation 2026-10-01 (HIGH)
- https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions: Blob client uploads / streaming guidance (HIGH)
- https://www.better-auth.com/docs/authentication/google, /docs/concepts/session-management, /docs/concepts/oauth, /docs/integrations/next: Google provider, stateless mode, account cookie, getAccessToken, nextCookies, proxy guidance (HIGH for documented behavior, MEDIUM for the combined flow, untested)
- https://www.better-auth.com/blog/authjs-joins-better-auth: Auth.js under Better Auth, security patches only, new projects should use Better Auth, stateless sessions were the one named gap (HIGH)
- https://api-docs.deepseek.com/ , /quick_start/pricing , /guides/json_mode , /guides/thinking_mode: base URL, `deepseek-flash` / `deepseek-v4-pro`, 1M context, pricing, JSON mode limits and empty-content caveat, thinking default and `extra_body` disable (HIGH)
- https://ai-sdk.dev/providers/ai-sdk-providers/deepseek: `deepseek-chat`/`deepseek-reasoner` retired 2026-07-24; `thinking`, `reasoningEffort` options (MEDIUM-HIGH, single source for the retirement date; consistent with absence from DeepSeek's own docs)
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth: Drive scope sensitivity classes and `drive.file` semantics (HIGH)
- https://developers.google.com/identity/protocols/oauth2: 7-day refresh token expiry in Testing status, 100 refresh tokens per account/client, 6-month inactivity (HIGH)
- https://support.google.com/cloud/answer/7454865: unverified apps capped at 100 new users (HIGH)
- Service-account 0 GB quota behavior: university IT notices via web search; the specific `storageQuotaExceeded` failure on My Drive is widely reported but not verified against Google docs (MEDIUM)
- NVD / OSV advisories for fast-xml-parser CVE-2026-26278, CVE-2026-33036 (fixed after 5.5.5, verify >=5.6) and SheetJS CVE-2023-30533 / CVE-2024-22363 (MEDIUM-HIGH, via web search of advisory databases)
- https://ui.shadcn.com/docs/components/radix/chart , /docs/components/radix/data-table , /docs/tailwind-v4: Recharts v3, TanStack Table v9, Tailwind v4 baseline (HIGH)
- write-excel-file README (npm registry) : style, format, width, sticky rows, formula, `toBuffer()` (HIGH for features listed; autofilter not documented)
- Local sample analysis of `Facturas/2025/*.xml` (143 files): version, TipoDeComprobante, BOM, complements, discounts, tax rates, sizes (HIGH, first-hand)

---
*Stack research for: Mexican CFDI expense-analysis web app on Next.js + Vercel + Google Drive*
*Researched: 2026-10-09*
