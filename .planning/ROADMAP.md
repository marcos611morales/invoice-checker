# Roadmap: Facturas — Análisis de gastos

## Overview

Five vertical slices. Each one ends with something the owner and partner can use on the deployed Vercel app.
1. **Walking skeleton.** Google login with the allowlist, server-side Drive access with the owner's token, a resumable sync and a CFDI parser. The user sees real spend by supplier and month from the XMLs before any AI exists.
2. **Explore and verify.** Period filters, monthly average, drill-down to invoices and PDFs, the IVA toggle, and complete ledger accuracy (relation chains, line discounts, tax buckets).
3. **Categories.** AI categorization with manual corrections that always win. This completes the core value: spend by category, by supplier, and the monthly average.
4. **Accountant-facing output.** Monthly IVA informativo, a data-quality review panel, manual upload to fix missing files, and Excel export.
5. **Product grouping and price comparison.** Last, as the user confirmed.

All state lives as JSON in Drive behind a storage interface, so a database can be added later.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Real Spend by Supplier** - Walking skeleton: secure login, Drive credential spike, resumable sync, CFDI parser and exact spend by supplier per month (no AI)
- [ ] **Phase 2: Trustworthy, Explorable Figures** - Period filters, monthly average, drill-down to invoices and PDF, sin/con IVA toggle and full ledger accuracy
- [ ] **Phase 3: Spend by Category** - DeepSeek categorization with cache, manual corrections and supplier defaults, review queue, category and fixed/variable views
- [ ] **Phase 4: IVA, Data Quality & Excel Export** - Monthly IVA informativo, review panel, manual upload to Drive, and safe .xlsx export
- [ ] **Phase 5: Products & Price Comparison** - Product groups across suppliers, base-unit normalization, cheapest supplier and price trends

## Phase Details

### Phase 1: Real Spend by Supplier

**Goal:** As a business owner, I want to sign in and sync my Drive invoices, so that I see exact spend by supplier and month.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ING-01, ING-02, ING-04, LEDG-01, LEDG-02, LEDG-03, LEDG-07, STOR-01, STOR-03, DASH-04, DASH-09
**Success Criteria** (what must be TRUE):
  1. Owner and partner sign in with Google at the shared Vercel URL, stay signed in across refreshes, and can log out. Any other Google account gets an access-denied screen on every page, action and API route.
  2. User sets the Drive invoice folder (default `Facturas/`, including year subfolders) and runs a sync that shows progress and resumes where it stopped if cut off. Re-importing the same UUID never creates a duplicate.
  3. The dashboard is in Spanish with es-MX MXN formatting. It ranks suppliers by spend and shows each supplier's monthly evolution for the 2025 sample. Egresos subtract and Pago complements add zero, so Telmex and Google Ads totals match their XMLs.
  4. Automated tests parse anonymized fixtures of all 143 sample files without errors, covering BOM, single-concept files, namespace prefixes and unknown complements. Money uses exact decimals, and every invoice reconciles with its XML total within $0.10. No real fiscal file is committed.
  5. The server reads and writes Drive using the owner's one-time authorization, and still works more than 7 days later without anyone re-authorizing. All app state is JSON in `Facturas/_app/`, reached only through a storage interface that tests also run against an in-memory fake.

**Plans:** 1/10 plans executed

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Skeleton: pinned toolchain, package legitimacy gate, allowlisted Google login (identity scopes only), Acceso denegado (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — Owner Drive authorization: `pnpm drive:auth`, DriveApi port, external GCP/Vercel setup, token minted day 1 (Wave 2)
- [ ] 01-03-PLAN.md — 143 anonymized CFDI fixtures + leak guard (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-04-PLAN.md — CFDI 4.0 parser, exact-decimal spend rules, reconciliation, golden totals (Wave 3)
- [ ] 01-05-PLAN.md — Skeleton: Ajustes folder (pointer + `_app/`) on real Drive, Vercel deploy, health check, keep-alive (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-06-PLAN.md — First sync into `_app/` JSON through storage ports, in-memory fakes, contract suite (Wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-07-PLAN.md — Resumable sync with progress, Drive mirroring, UUID dedupe, problem list (Wave 5)
- [ ] 01-08-PLAN.md — Spend-by-supplier dashboard (monthly bars, top 10, table, year selector, es-MX formatters) (Wave 5)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 01-10-PLAN.md — Supplier detail page, guided first-run steps, es-MX format tests, real-XML Telmex / Google Ads cross-check (Wave 6)

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 01-09-PLAN.md — Hardening: entry-point guard, anonymous smoke in prod, If-Match spike, day-8 AUTH-05 check; runs last (Wave 7)

**UI hint**: yes
**Research flag**: Spike first, before building on these choices.
  - Credential path: the owner's OAuth refresh token with `drive` scope, stored server-side. Consent screen published "In production". Login identity kept separate from Drive access. Check Better Auth stateless + refresh, and the partner's unverified-app login flow.
  - Drive JSON write-concurrency policy: test Drive `If-Match` behavior, then choose between key-level patch with read-back and an append-only edit log.
  - Record both outcomes in PROJECT.md Key Decisions.

### Phase 2: Trustworthy, Explorable Figures

**Goal:** As a business owner, I want to filter by period and drill any figure down to its invoices, so that I trust every number.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements**: LEDG-04, LEDG-05, LEDG-06, DASH-01, DASH-02, DASH-06, DASH-07, DASH-08, ING-05
**Success Criteria** (what must be TRUE):
  1. User picks a month, quarter, year or custom range and sees total spend plus the monthly average over months with real spend, with the number of months shown.
  2. Clicking any figure (total, supplier, month) lists the invoices and concept lines behind it, and each invoice's paired PDF opens from there.
  3. Line amounts are net of line discounts, and the header discount is not subtracted again. The "sin IVA" (default) / "con IVA" toggle changes every figure consistently, using per-line tax buckets: IVA 16%, IVA 0%, exento, no objeto, IEPS as cost, and retenciones.
  4. Substitution (TipoRelacion 04) and anticipo (TipoRelacion 07) chains are counted once. The Google Ads anticipo + cancelación de prepago nets to its real spend, and the drill-down shows the related CFDIs.
  5. Copying the URL and opening it in the partner's session reproduces the same filters and view.

**Plans:** TBD
**UI hint**: yes

### Phase 3: Spend by Category

**Goal:** As a business owner, I want to see spend by category, with AI suggestions I can correct, so that I know where the money goes.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, DASH-03, DASH-05, STOR-02
**Success Criteria** (what must be TRUE):
  1. Every concept line has one category from the editable café + coworking taxonomy (~17 categories + "Sin clasificar"). For the selected period, the dashboard shows spend by category (chart + table) and a fixed vs variable split, and the fixed/variable flag can be edited per category.
  2. User corrects any line's category or sets a default category per supplier. The change persists after reload and re-sync and always overrides the AI.
  3. Each line shows whether its category came from AI or was set manually. The user can work through a queue of uncategorized and low-confidence lines.
  4. Re-running categorization never sends an already-classified concept to DeepSeek again. The outgoing payload contains only descriptions, SAT codes, amounts and supplier data, never the receptor's name, address or personal data. With DeepSeek unavailable, the app still loads with rule-based or "Sin clasificar" categories.
  5. When owner and partner save corrections at the same time, both corrections survive and neither silently overwrites the other.

**Plans:** TBD
**UI hint**: yes
**Research flag**: This is an AI phase.
  - Build a golden set of 50–100 lines labeled by the owner before tuning.
  - Confirm DeepSeek's retention terms and the current model ID (kept in an env var) before sending real data.
  - The largest supplier (~47% of net spend, generic admin-services description) needs a manual supplier default.

### Phase 4: IVA, Data Quality & Excel Export

**Goal:** As a business owner, I want to check monthly IVA, fix data issues and export to Excel, so that I can share clean numbers.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements**: IVA-01, IVA-02, IVA-03, QUAL-01, QUAL-02, ING-03, EXP-01, EXP-02
**Success Criteria** (what must be TRUE):
  1. User sees a monthly IVA summary (informativo) with IVA 16% paid, IVA 0% base, exento and IEPS. PUE invoices count by invoice date and PPD invoices by payment-complement date. S01 invoices are excluded from IVA and flagged with a visible alert.
  2. User sees a review panel listing duplicate UUIDs, XML without PDF, PDF without XML, invoices whose totals don't reconcile, omitted N/T documents and zero-total invoices. Figures carry the label "según XML, sin validar contra SAT".
  3. User uploads one or more XML files (and matching PDFs) from the browser. They are saved to the Drive folder as `YYYY-MM-DD_RFC_UUID.ext`, show up in the dashboard, and clear the matching "missing file" items. Re-uploading a UUID creates no duplicate.
  4. User exports the current view (summary, by category, by supplier, line detail, IVA) to an .xlsx file that opens in Excel. Money cells are numeric, and descriptions starting with "-", "=", "+" or "@" appear as plain text, never as formulas.

**Plans:** TBD
**UI hint**: yes
**Research flag**: The accountant validates PPD IVA timing and S01 handling before the IVA view is shared.

### Phase 5: Products & Price Comparison

**Goal:** As a business owner, I want to compare a product's unit price across suppliers, so that I buy where it is cheapest.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05
**Success Criteria** (what must be TRUE):
  1. User sees proposed groups of equivalent products across suppliers (AI-assisted) and can confirm, rename, merge or split them. Groups keep their identity across re-syncs, and manual decisions persist and win over AI.
  2. User sets or confirms the base unit and quantity per line (e.g. 1 L, 12 pzas), and unit prices are recalculated per base unit.
  3. For each product group, user sees the net unit price (sin IVA) by supplier with the cheapest highlighted. Groups without comparable data show "sin datos comparables".
  4. User sees each product group's unit-price trend over time.

**Plans:** TBD
**UI hint**: yes
**Research flag**: Spike grouping on real descriptions first. Only ~18 of ~120 ClaveProdServ codes have 2+ suppliers, so a comparison needs 2+ suppliers and 2+ observations.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Real Spend by Supplier | 1/10 | In Progress | - |
| 2. Trustworthy, Explorable Figures | 0/TBD | Not started | - |
| 3. Spend by Category | 0/TBD | Not started | - |
| 4. IVA, Data Quality & Excel Export | 0/TBD | Not started | - |
| 5. Products & Price Comparison | 0/TBD | Not started | - |
