# Phase 1: Real Spend by Supplier - Context

**Gathered:** 2026-10-09
**Re-scoped:** 2026-10-12. Invoices are uploaded as XML in the browser and kept only there; the Drive connection moved to Phase 6.
**Status:** Ready for planning

<domain>
## Phase Boundary

Walking skeleton, with no AI and no Drive:
- Google login gated by an email allowlist (identity scopes only).
- Manual upload of CFDI XML files in the browser (several at once, or dragged onto the page), parsed in the browser.
- Parsed invoices stored only in that browser (IndexedDB), behind a storage interface with an in-memory fake for tests. No invoice data reaches the server, and nothing is shared between owner and partner yet.
- A tested CFDI 4.0 parser with exact decimal money (Plan 01-04, unchanged by the re-scope).
- A Spanish (es-MX) dashboard, computed in the browser, that ranks suppliers by spend and shows each supplier's monthly evolution.
- Deployed on Vercel at the shared URL.

Requirements: AUTH-01..04, ING-04, ING-06, LEDG-01, LEDG-02, LEDG-03, LEDG-07, STOR-03, STOR-04, DASH-04, DASH-09.

Plan status after the re-scope:
- 01-01 (toolchain and allowlisted login) and 01-03 (anonymized fixtures) are done. 01-04 (parser and spend rules) is unchanged and still to execute.
- 01-02 (owner Drive authorization; its Task 1 code is merged in f9355b4) and 01-05..01-10 (Ajustes folder, Drive sync, `_app/` JSON, the Drive-fed dashboard and hardening) are marked `status: superseded` and kept as reference for Phase 6. New Phase 1 plans start at 01-11.

These belong to later phases, not here:
- Period filters, the IVA toggle, drill-down, PDF pairing and the LEDG-04/05/06 chains and buckets (Phase 2).
- Categories (Phase 3).
- The review panel and Excel export (Phase 4).
- Drive: owner authorization, the folder setting, the resumable sync, `_app/` JSON state, the upload saved to Drive and concurrent-safe edits (Phase 6: AUTH-05, ING-01, ING-02, ING-03, STOR-01, STOR-02).

</domain>

<decisions>
## Implementation Decisions

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

### Follow-up decisions after the 2026-10-12 re-research
- **D-30:** IndexedDB is reached through **`idb` 8.0.4**, and adapter tests use **`fake-indexeddb` 6.2.5** (dev dependency). The user approved both installs; they still go through the package legitimacy gate as a checkpoint before installing.
- **D-31:** Phase 1 adds a **nonce-based Content-Security-Policy** in a new `src/proxy.ts` (strict `script-src`, `connect-src 'self'`). `/login` and `/acceso-denegado` render dynamically as needed for the nonce.
- **D-32:** Only the **parsed invoice** is stored, plus the parser version in the meta record. The raw XML is **not** stored; if the parser changes, the user uploads the files again.
- **D-33:** If the browser cannot use IndexedDB (for example some private modes), the app shows an **error message** explaining that the invoices cannot be saved in this browser, and upload is disabled. There is no in-memory fallback.
- **D-34:** The owner **publishes the Google OAuth consent screen "In production"** (identity scopes only, no verification needed), so a non-allowlisted account reaches "Acceso denegado". This is a manual checkpoint for the user.
- **D-35:** An upload accepts **at most 1,000 files**. Above that, the app warns and asks the user to upload in parts.
- **D-36:** In the upload summary, an invoice that counts but carries a flag (for example "total no cuadra") is counted **both in "nuevas" and in "con problemas"**. "Con problemas" therefore covers flagged invoices that count and files that were not imported, and the problem list says which ones count and which do not.
- **D-37:** The supplier table's **"Facturas" column counts Ingreso and Egreso documents (I + E)**. Pagos (P) are not counted.

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md` — Core value, constraints, Key Decisions (personal Gmail, DeepSeek data rules, the 2026-10-12 re-scope).
- `.planning/REQUIREMENTS.md` — AUTH, ING (including ING-06), LEDG, STOR (including STOR-04) and DASH requirement text for this phase.
- `.planning/ROADMAP.md` §Phase 1 — Success criteria and the research flag for the browser path. §Phase 6 holds the Drive work and its two spikes.
- `.planning/STATE.md` — The 2026-10-12 re-scope decisions and the open blockers.

### Research
- `.planning/phases/01-real-spend-by-supplier/01-RESEARCH.md` — Parser, auth, money and dashboard findings still apply. The Drive sections are Phase 6 reference. Re-researched on 2026-10-12 for the browser upload and IndexedDB path.
- `.planning/research/STACK.md` — Pinned versions (Next 16.4, TS 6.0.3, Better Auth 1.7.7, fast-xml-parser ≥5.6, decimal.js, zod 4) and the CFDI parser configuration.
- `.planning/research/ARCHITECTURE.md` — Ports and adapters layout. The manifest sync (Pattern 2), the JsonDocStore (Pattern 3) and the owner credential (Pattern 7) are Phase 6 reference.
- `.planning/research/PITFALLS.md` — Float money, P/E double counting, BOM and single-child arrays.
- `.planning/research/FEATURES.md` — Table stakes and sample-specific rules (Telmex PPD + P, Google Ads chain).
- `.planning/research/SUMMARY.md` — Condensed findings.
- `.claude/CLAUDE.md` — Stack table and the "What NOT to use" list (no `middleware.ts`, no float money, no Server Actions for upload). Its rule "never ship raw invoices to the browser" assumed server-side data; in Phase 1 the invoices come from the user's own files and live only in their browser (D-22, D-23), while charts still receive pre-aggregated data (D-28).

### Data
- `Facturas/2025/*.xml|pdf` — 143 real sample pairs. They are **git-ignored and must never be committed**; tests use the anonymized copies in `tests/fixtures/cfdi/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Auth (Plan 01-01): `src/auth/auth-config.ts`, `src/auth/auth.ts` (Better Auth stateless), `src/auth/client.ts` (`authClient`), `src/auth/allowlist.ts`, `src/auth/require-user.ts` (`getAccess`, `requireUser`, `requireUserApi`).
- Screens: `src/app/(app)/layout.tsx` (signed-in shell with email and `SignOutButton`), `src/app/(app)/page.tsx` (placeholder home), `src/app/(public)/login/page.tsx`, `src/app/(public)/acceso-denegado/page.tsx`.
- `src/components/auth/auth-buttons.tsx`: `SignInButton`, `SignOutButton`, `SwitchAccountButton`. These are the sign-out paths that must clear browser storage (D-24).
- shadcn components in `src/components/ui/`: alert, badge, button, card, chart, input, label, progress, select, separator, skeleton, sonner, table.
- Fixtures (Plan 01-03): 143 anonymized CFDI files in `tests/fixtures/cfdi/` with `PROFILE.json`, and the leak guard `tests/unit/fixtures-clean.test.ts`.
- Dormant until Phase 6: `src/ports/drive-api.ts`, `src/adapters/drive/*`, `scripts/drive-auth.ts`, `scripts/drive-check.ts`. The Drive env vars in `src/env.ts` are optional.

### Established Patterns
- Every page and layout calls `requireUser()`, and route handlers call `requireUserApi()`. There is no `middleware.ts`.
- The pure access decision (`allowlist.ts`) is separate from the server-only DAL (`require-user.ts`).
- Ports and adapters: interfaces in `src/ports/`, implementations in `src/adapters/`. The pure core (domain, parser, analytics) imports nothing from adapters, services or app.
- `import "server-only"` on every module that holds secrets. Vitest runs in the node environment with a `server-only` stub (`tests/stubs/server-only.ts`).

### Integration Points
- Vercel env vars: the Google OAuth client id and secret, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `ALLOWED_EMAILS`. The Drive vars stay unset until Phase 6.
- Sign-out (`SignOutButton`, `SwitchAccountButton`) and sign-in with a different account must clear the browser's stored invoices (D-24).

</code_context>

<specifics>
## Specific Ideas

- Upload copy: a counter like "Importando 87 de 143…" and a final summary with three counts (nuevas, ya guardadas, con problemas). The UI-SPEC fixes the exact wording.
- Access-denied copy shows the signed-in email: "tu cuenta x@gmail.com no tiene acceso".
- Supplier row: the emisor name, such as "NUEVA WAL MART DE MEXICO", with `NWM9709244W4` in small grey text beneath.
- Amounts are formatted `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`, with a "con IVA" label in Phase 1.

</specifics>

<deferred>
## Deferred Ideas

- The Drive connection and sync (D-01..D-05, D-09), the upload saved to Drive (ING-03) and concurrent-safe edits (STOR-02) moved to Phase 6 on 2026-10-12.
- Folder, ZIP and PDF upload are out of Phase 1 (D-21).

</deferred>

---

*Phase: 01-real-spend-by-supplier*
*Context gathered: 2026-10-09; re-scoped 2026-10-12*
