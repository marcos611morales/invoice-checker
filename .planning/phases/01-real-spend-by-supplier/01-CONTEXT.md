# Phase 1: Real Spend by Supplier - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Walking skeleton, with no AI:
- Google login gated by an email allowlist.
- Server-side Drive access through the owner's one-time OAuth refresh token.
- A folder setting.
- A manual, resumable, idempotent sync of CFDI XMLs from Drive.
- A tested CFDI 4.0 parser with exact decimal money.
- A Spanish (es-MX) dashboard that ranks suppliers by spend and shows each supplier's monthly evolution.
- All state stored as JSON in `<folder>/_app/` behind a storage interface, with an in-memory fake for tests.

Requirements: AUTH-01..05, ING-01, ING-02, ING-04, LEDG-01, LEDG-02, LEDG-03, LEDG-07, STOR-01, STOR-03, DASH-04, DASH-09.

These belong to later phases, not here:
- Period filters, the IVA toggle, drill-down, PDF pairing and the LEDG-04/05/06 chains and buckets (Phase 2).
- Categories (Phase 3).
- The review panel, upload and Excel export (Phase 4).

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — Core value, constraints, Key Decisions (personal Gmail, owner OAuth, DeepSeek data rules).
- `.planning/REQUIREMENTS.md` — AUTH, ING, LEDG, STOR and DASH requirement text for this phase.
- `.planning/ROADMAP.md` §Phase 1 — Success criteria and the **research flag**. The research flag asks for two spikes first: the credential path (owner refresh token, "In production", Better Auth stateless) and the Drive JSON write-concurrency policy (`If-Match` test). Record both outcomes in PROJECT.md Key Decisions.
- `.planning/STATE.md` — Open blockers. AUTH-05 can only be verified past 7 days in-phase, so re-check at 30 days.

### Research
- `.planning/research/STACK.md` — Pinned versions (Next 16.4, TS 6.0.3, Better Auth 1.7.7, @googleapis/drive, fast-xml-parser ≥5.6, decimal.js, zod 4) and the CFDI parser configuration.
- `.planning/research/ARCHITECTURE.md` — Ports and adapters layout, the `_app/` file layout, the full-listing and manifest sync (Pattern 2), the JsonDocStore with read-back (Pattern 3), the time-budgeted resumable sync, and the owner credential versus the login identity plane (Pattern 7).
- `.planning/research/PITFALLS.md` — Float money, P/E double counting, BOM and single-child arrays, the 7-day Testing token.
- `.planning/research/FEATURES.md` — Table stakes and sample-specific rules (Telmex PPD + P, Google Ads chain).
- `.planning/research/SUMMARY.md` — Condensed findings.
- `.claude/CLAUDE.md` — Stack table, "What NOT to use" list (no `middleware.ts`, no `googleapis` monolith, no float money, no Server Actions for upload).

### Data
- `Facturas/2025/*.xml|pdf` — 143 real sample pairs. They are **git-ignored and must never be committed**, so the fixtures have to be anonymized copies.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None: greenfield. The repo has only `.gitignore`, `.planning/` and `.claude/`.

### Established Patterns
- None yet. Follow the research architecture: a pure core (domain, parser, analytics) importing nothing from adapters, services depending on ports, and adapters for Drive and in-memory storage.

### Integration Points
- Vercel env vars: Google OAuth client id and secret, `BETTER_AUTH_SECRET`, the owner Drive refresh token, `ALLOWED_EMAILS` and optionally a default folder.
- The Drive folder `Facturas/` with year subfolders (`2025/`), with app state in `Facturas/_app/`.

</code_context>

<specifics>
## Specific Ideas

- Sync copy: "Importando 87 de 143…" and a final summary with three counts: nuevas, sin cambios, con problemas.
- Access-denied copy shows the signed-in email: "tu cuenta x@gmail.com no tiene acceso".
- Supplier row: the emisor name, such as "NUEVA WAL MART DE MEXICO", with `NWM9709244W4` in small grey text beneath.
- Amounts are formatted `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`, with a "con IVA" label in Phase 1.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope. Items already owned by later phases are listed under Phase Boundary.

</deferred>

---

*Phase: 01-real-spend-by-supplier*
*Context gathered: 2026-10-09*
