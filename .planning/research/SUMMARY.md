# Project Research Summary

**Project:** Facturas — CFDI expense analysis (café + coworking)
**Domain:** Mexican CFDI 4.0 purchase-invoice analysis; 2 users; ~150–500 invoices/yr; no DB in v1
**Researched:** 2026-10-09
**Confidence:** MEDIUM-HIGH

## Executive Summary

- Internal two-user tool: parse purchase CFDI XML (source of truth), show a spend dashboard, monthly IVA informativo, product price comparison later, and Excel export. It is one Next.js 16.4 / TS 6 strict / pnpm app on Vercel. Google Drive is the only persistence (XML/PDF plus small JSON files for cache and corrections), behind repository ports so a DB can replace it later.
- Build the deterministic ledger first: E subtracts, P is zero spend, line discounts are netted, BOM and single-child arrays are handled, and IVA 0% stays distinct from exento. Test it against the 143 real files, then add AI (DeepSeek) categorization with user overrides always winning.
- Main risks:
  - the Drive credential model;
  - Drive-as-DB lost updates;
  - fiscal data sent to DeepSeek;
  - fiscal claims (IVA acreditable, PPD timing, cancelled CFDIs) that must be labeled informativo and checked with the accountant.

## Key Findings

### Recommended Stack

Versions verified on 2026-10-09 (see STACK.md):
- **Runtime and language:** Node 24.x, Next 16.4.0 and React 19.3. TypeScript 6.0.3, because TS 7 breaks typescript-eslint. ESLint 9.39.x, because 10 breaks the Next plugin peers.
- **Auth:** Better Auth 1.7.7, stateless. Fallback is Auth.js v5 beta with the JWT strategy.
- **Drive:** @googleapis/drive 26.0.2 + google-auth-library 11.2.0. Not `googleapis`, which is 245 MB.
- **CFDI parsing:**
  - fast-xml-parser 5.11.2 with `parseAttributeValue:false`, `removeNSPrefix`, forced arrays and DTD rejection;
  - a hand-written CFDI mapper plus zod 4.6.5;
  - decimal.js 10.6.0 for money.
- **AI:** the openai 7.31 SDK pointed at DeepSeek. Use model `deepseek-flash` (keep it in an env var) with `thinking: {type:"disabled"}`. Use `json_object` plus zod validation, retry, then fall back to "Sin clasificar".
- **UI:**
  - Tailwind 4.3 + shadcn 4.21 (Radix);
  - Recharts 3.10 through shadcn chart;
  - TanStack Table 9.2;
  - nuqs for URL state;
  - fflate to unzip SAT ZIPs in the browser;
  - date-fns, without converting CFDI `Fecha` to UTC.
- **Testing:** Vitest 5 and Playwright 1.64 with minted sessions.
- **Avoid:**
  - deepseek-chat and deepseek-reasoner (retired 2026-07-24);
  - next-auth@4, `middleware.ts` (use `proxy.ts`) and `next lint`;
  - Server Actions for upload (1 MB default limit);
  - @tremor, and SheetJS from npm;
  - @cfdi/* and @nodecfdi/*, which are built for issuing invoices;
  - float money.

### Expected Features

**Must have (table stakes, v1):**
- CFDI 4.0 parsing that tolerates namespaces and the BOM.
- Spend engine: I counts +, E counts −, P counts 0, and N/T are omitted with a notice.
- Drive ingestion plus manual upload, idempotent by UUID, with XML–PDF pairing by UUID.
- Dashboard:
  - total spend;
  - monthly average over months with data, showing the denominator;
  - spend by supplier and by category;
  - period filters stored in the URL.
- AI category per concept from a closed taxonomy of about 17 categories plus "Sin clasificar". Manual corrections persist.
- Monthly IVA informativo:
  - buckets for 16%, 0% base, exento, separate IEPS, and retenciones;
  - PUE counted by `Fecha`, PPD by payment date;
  - S01 excluded.
- Review panel: duplicates, XML without PDF and the reverse, totals that don't reconcile, N/T omitted, uncategorized lines, zero-total invoices.
- Excel export.
- Google login with a server-side allowlist.
- Spanish UI with MXN in es-MX format.

**Should have (differentiators, v1.x):**
- Product grouping confirmed by the user.
- Unit price comparison: net, without IVA, by base unit, and "no comparable" when a unit is unconfirmed. Only about 18 of 120 ClaveProdServ codes have two or more suppliers.
- Price trends.
- SAT status check.
- Fixed vs variable spend.
- Supplier concentration.
- Warnings for cash payments over $2,000 and for S01.

**Defer / anti-features:**
- Issued invoices (keep a `direction` field for later).
- DB migration.
- Café vs coworking split.
- SAT bulk download with e.firma.
- Chat over the data.
- DIOT and declarations.
- Bank reconciliation.
- Budgets.
- OCR without XML.
- CFDI 3.3, nómina and carta porte, unless such files appear.

**Critical sample rules:**
- Google Ads anticipo chain: 2 advances, a final invoice with TipoRelacion 07, and 3 Egresos. Net = I − E. Ignoring the E double-counts about $5,200 with IVA.
- Telmex PPD invoices plus P complements (Total 0, Moneda XXX).
- The header discount equals the sum of line discounts, so don't subtract it twice.

### Architecture Approach

Ports and adapters inside one app:
- **Pure core:** domain, parser, analytics and the effective-view resolver. It imports nothing from adapters.
- **Services:** sync, enrichment, overrides, upload, dataset and reports. They depend on ports.
- **Adapters:** Drive, DeepSeek, in-memory, and a future Postgres. A single container wires them.

**Drive layout:**
- `Facturas/YYYY/*` holds the invoices and is immutable.
- `Facturas/_app/` holds:
  - `manifest.json`;
  - `invoices-YYYY.json`, which can be rebuilt;
  - `enrichment.json`, the AI cache, keyed by a hash of the normalized description, ClaveProdServ and unit, and versioned by prompt;
  - `overrides.json` and `groups.json`, which users author and which cannot be rebuilt.

**Major components:**
1. **CFDI parser + ledger (pure):** XML becomes a normalized Invoice/Line with decimal money, tax buckets and the Tipo/Relación rules.
2. **Drive adapters + sync:**
   - a full listing plus a manifest diff;
   - time-budgeted, resumable sync (about 240 s of the 300 s limit, returning `{processed, remaining}`);
   - a versioned JsonDocStore with read-back verification.
3. **Dataset + analytics:** an in-memory memo, validated by the `_app` file versions. Don't rely on `use cache`, and don't enable `cacheComponents`.
4. **Enrichment + overrides:** the effective category is the override, then AI, then the ClaveProdServ baseline, then "Sin categoría". Edits are command-style ops.
5. **Reports:** one DTO rendered both to the UI and to Excel.
6. **Upload:** one file per request through a Route Handler, with canonical naming.

### Critical Pitfalls

1. **Float money and 6-decimal unit prices** (for example 17.241379). Keep values as strings plus decimal and round only for presentation. Phase: Parser.
2. **Double counting Pagos, Egresos and anticipos.** Gate on TipoDeComprobante and TipoRelacion (07, 04). Acceptance: spend = ΣI − ΣE, and P contributes 0. Phase: Parser.
3. **XML shape traps.**
   - Single-child arrays occur in 89 of 143 files.
   - The BOM occurs in 142 of 143.
   - `pago20` is declared in 9 files but only 7 are real Pagos.
   - Fix: force arrays and match on namespace URI plus local name.
4. **OAuth "Testing" status.** Refresh tokens die after 7 days. Publish the consent screen to "In production" and prove it with a spike. Phase: Foundations.
5. **JSON in Drive as a database.** Drive v3 has no compare-and-swap. Mitigations:
   - split files by concern;
   - merge at key level;
   - refuse to overwrite a file that fails zod validation;
   - test concurrent edits.

   Phase: Foundations for the interface, and the corrections phase for the rest.

Also:
- **DeepSeek privacy and prompt injection:** minimize the payload and constrain output to an enum.
- **Misreported IVA acreditable:** S01, PPD timing, and 0% vs exento vs IEPS.
- **Unit price across pack sizes.**
- **Excel formula injection:** 8 descriptions start with "-".
- **Cancelled or substituted CFDIs look valid offline:** label figures "según XML, sin validar contra SAT".

## Implications for Roadmap

### Phase 1: Foundations, auth and Drive credential spike
**Rationale:** everything depends on authenticated access to Drive. The 7-day token trap and auth bypass are architectural.
**Delivers:**
- scaffold and env setup;
- Google login with the allowlist checked in the callback, plus `requireUser()` everywhere;
- a proven credential path: token lifetime over 8 days, writes to `_app`, pagination, shortcuts and trashed files handled;
- ports with an in-memory fake;
- the JSON write policy.

**Avoids:** pitfalls 4 and 5, and auth bypass.

### Phase 2: CFDI parser and ledger (pure core)
**Delivers:**
- forced arrays and BOM tolerance;
- decimal money;
- I/E/P/N/T handling and line discounts;
- tax buckets;
- TFD UUID identity and date handling;
- reconciliation within 0.10 MXN;
- DTD rejection and a zod schema;
- anonymized and synthetic fixtures.

**Avoids:** pitfalls 1–3. Standard patterns.

### Phase 3: Drive adapters, sync and first vertical slice (dashboard)
**Delivers:**
- a DriveClient with backoff;
- the manifest diff and resumable sync;
- year shards;
- the DatasetService memo;
- the dashboard: total, monthly average with the denominator shown, supplier ranking and evolution, and filters.

### Phase 4: IVA, data quality, upload and Excel export
**Delivers:**
- monthly IVA informativo by bucket;
- the review/quality panel;
- one-file-per-request upload;
- .xlsx export with hostile-string tests.

**Research flag:** PPD and S01 rules need the accountant's validation.

### Phase 5: AI categorization, overrides and review UI
**Delivers:**
- DeepSeek classification over the closed taxonomy, validated with zod;
- a hash-keyed, prompt-versioned cache;
- OverridesService ops and the effective-view resolver;
- a review queue with IA/manual badges;
- ClaveProdServ and supplier rules;
- a "modo sin IA".

**Research flag:** build a golden set of 50–100 lines labeled by the owner, and confirm DeepSeek's data policy.

### Phase 6: Product grouping and price comparison
**Delivers:**
- candidate grouping, then AI yes/no/unsure decisions;
- user confirm, split and merge, with must-link and cannot-link constraints;
- base-unit normalization;
- net unit price without IVA;
- price trends;
- a minimum of 2 suppliers and 2 observations before comparing.

**Research flag:** spike grouping on real descriptions.

### Phase 7: Hardening and optional checks
**Delivers:**
- concurrent-edit and stale-revision tests;
- schema versioning and re-parse driven by `parserVersion`;
- a Playwright smoke test;
- an optional SAT status check;
- an optional cron.

### Phase Ordering Rationale
- The parser comes before everything else.
- Drive and sync come before the dashboard.
- IVA, data quality and export come before AI.
- Overrides must exist before any AI output is shown.
- Grouping comes last.

### Research Flags
- **Needs research or a spike:**
  - Phase 1: credentials;
  - Phase 4: the accountant;
  - Phase 5: the eval harness and DeepSeek's data policy;
  - Phase 6: grouping;
  - Phase 7: the SAT service.
- **Standard patterns:** Phases 2 and 3, and the upload and export parts of Phase 4.

## Open Decisions

1. **Drive credential model.** Partly resolved after research: the user confirmed a **personal Gmail** account, not Workspace.
   - This rules out a Shared Drive. A service account with writes is also a poor fit, because of the `storageQuotaExceeded` risk.
   - **Default:** use the owner's OAuth refresh token with the `drive` scope, stored server-side, and publish the consent screen as "In production".
   - Login identity stays separate from Drive access.
   - Still open for the Phase 1 spike: the Better Auth stateless per-user token alternative, and whether `drive.file` + Picker can see a picked folder's existing child files.
2. **Excel library.** write-excel-file 4.1.1 is recommended: MIT, one dependency, styles and frozen rows. ExcelJS 4.4.0 is the fallback.
3. **Data sent to DeepSeek.** Resolved after research. The user allows descriptions, ClaveProdServ, amounts and supplier names. The owner's name, address and personal data (receptor info) must never be sent. Still keep the provider swappable and offer a "modo sin IA".
4. **Drive JSON write strategy.** The researchers suggested three approaches:
   - key-level patches with read-back;
   - an append-only event log for user edits;
   - per-entity append-only files.

   All three converge on key-level merges. Choose in Phase 1.
5. **Fiscal defaults to review with the accountant:**
   - spend = Subtotal − Descuento by default, with a toggle to include IVA;
   - PPD IVA on the payment date;
   - S01 counts as spend but is excluded from IVA;
   - cash payments over $2,000 are flagged, not blocked.
6. **Sample-data counts differ slightly between researchers.**
   - IVA 16% lines: 168–272, and IVA 0% lines: 172–222. The spread depends on the counting unit. 0% is nearly as common as 16%.
   - Consistent across researchers: 362 concepts, 89/143 single-concept files, 7 P, 3 E and 12 penny S01 invoices.
   - There are **39 issuer RFCs**, not about 25.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions verified live. The Better Auth + Google + Drive refresh combination is untested. |
| Features | MEDIUM-HIGH | The data profile is HIGH. Fiscal interpretations are MEDIUM. Competitor claims are LOW. |
| Architecture | MEDIUM-HIGH | Vercel and OAuth limits are HIGH. Drive `If-Match` and resumable-upload CORS are unverified. |
| Pitfalls | HIGH (data) / MEDIUM (external) | Checked against 143 files. Drive concurrency, the SAT service and DeepSeek's policy are MEDIUM or LOW. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- **Phase 1 spikes:**
  - Better Auth stateless + Drive refresh;
  - whether `drive.file` + Picker sees a folder's child files;
  - Drive `If-Match` behavior;
  - the "In production" unverified-app flow for the partner.
- **Before using real data with AI:** check DeepSeek's retention terms and current model IDs.
- **Before Phase 7:** check the SAT cancellation endpoint against official docs.
- **Before Phase 4 output is shared:** the accountant reviews PPD IVA timing and S01.
- **First review:** the owner assigns a category to the largest supplier, which is about 47% of net spend and uses a generic admin-services description.
- **Before Phase 5:** build a golden set for AI evaluation.

## Sources

### Primary (HIGH confidence)
- Local scan of the 143 XMLs in `Facturas/2025/`.
- Vercel function limits.
- The Next.js 16 release notes and upgrade guide.
- Google OAuth token expiry rules.
- Drive scope sensitivity.
- Google's 100-user cap for unverified apps.
- DeepSeek API docs.
- shadcn docs.
- The npm registry, checked 2026-10-09.

### Secondary (MEDIUM confidence)
- Better Auth Google/session docs.
- The Drive File reference and resumable-upload guide.
- SAT CFDI catalogs, to be verified against Anexo 20.
- Service-account quota behavior.
- satcfdi and cfdibills, for the SAT status service.
- KPMG's note on IVA cash flow.

### Tertiary (LOW confidence)
- Competitor product claims (Contalink, Heru, Konta).
- DeepSeek privacy press coverage from 2025.

---
*Research completed: 2026-10-09*
*Ready for roadmap: yes*
