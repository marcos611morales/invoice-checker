---
gsd_state_version: "1.0"
current_phase: 01
current_phase_name: Real Spend by Supplier
status: executing
stopped_at: Phase 01 UI-SPEC approved (re-scope)
last_updated: "2026-10-12T20:03:49.423Z"
last_activity: 2026-10-09
last_activity_desc: Phase 01 execution started
state_head: 905c1bb0bb6aa9fd626e23e776f13c05f040a452
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 15
  completed_plans: 2
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** Ver con claridad en qué se va el dinero: gasto por categoría y por proveedor, y el promedio mensual, calculados con exactitud a partir de los XML CFDI.
**Current focus:** Phase 01 — Real Spend by Supplier

## Current Position

Phase: 01 (Real Spend by Supplier) — READY TO EXECUTE
Plan: 1 of 10
Status: Ready to execute
Last activity: 2026-10-09 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Personal Gmail (not Workspace). Drive is accessed with the owner's OAuth refresh token stored server-side, and the consent screen must be "In production".
- [Init]: CFDI XML is the source of truth. All state is JSON in `Facturas/_app/` behind a storage interface, with no database in v1.
- [Init]: DeepSeek receives descriptions, SAT codes, amounts and supplier data only, never receptor or personal data.
- [Roadmap]: Vertical MVP in 5 phases, all `**Mode:** mvp`. Real numbers without AI in Phase 1; categories in Phase 3; product grouping and price comparison last (user confirmed).
- [2026-10-12, Phase 1 re-scope, user decision under time pressure]: Drive connection is DEFERRED to a later phase. Phase 1 ingests invoices by direct manual upload of XML files in the browser, parsed and stored ONLY in the uploader's browser (IndexedDB) — no server-side storage, nothing shared between owner and partner yet. Google login with the email allowlist STAYS (identity scopes only; no Drive scope, so the consent screen does not need publishing). Plan 01-02 is paused at its owner checkpoint (Task 1 code merged, f9355b4) and moves with the Drive work; plans 01-05..01-10 (Ajustes folder, Drive sync, `_app/` JSON) must be re-planned around upload + browser storage. 01-01, 01-03 and 01-04 (parser/spend rules) are unaffected. Keep the storage interface (STOR-03) so Drive can replace browser storage later.
- [2026-10-12, re-scope follow-up, user decisions during /gsd-plan-phase 01]: Drive becomes a new Phase 6 after Phase 5, with AUTH-05, ING-01, ING-02 and STOR-01, plus ING-03 (from Phase 4) and STOR-02 (from Phase 3), which need Drive. Phase 1 adds ING-06 (browser XML upload) and STOR-04 (browser-only storage). The upload accepts XML only (several at once or drag-and-drop). Browser data is deleted at sign-out, when a different account signs in, and with a confirmed delete button. Re-uploading a stored UUID keeps the stored invoice. Plans 01-02 and 01-05..01-10 become `status: superseded` (Phase 6 reference); new Phase 1 plans start at 01-11. CONTEXT.md D-20..D-29 record the details.

### Pending Todos

- Upgrade Vercel from Hobby (non-commercial only) to Pro before relying on the app for business use (user decision 2026-10-12: Hobby for now).

### Blockers/Concerns

- [Phase 1 — re-planned 2026-10-12]: Plans 01-11..01-22 replace the superseded Drive plans (browser upload + IndexedDB). Execution order 01-11 → 01-04 → 01-18 → 01-19 → 01-12 → 01-13 → 01-20 → 01-14 → 01-15 → 01-21 → 01-16 → 01-22 → 01-17. Checkpoints: 01-19 package install (idb, fake-indexeddb, alert-dialog); 01-17 Google consent "In production", Vercel setup and push.
- [Phase 6]: The Drive credential path is unproven (owner refresh token, "In production", Better Auth + refresh). The spike must pass before anything builds on it.
- [Phase 6]: The Drive JSON write-concurrency policy is undecided (`If-Match` behavior). The spike decides it, and STOR-02 (now in Phase 6) depends on it.
- [Phase 6]: AUTH-05 asks for 30 days without re-authorizing. The phase can only verify more than 7 days, so re-check Drive access 30 days after the owner authorizes.
- [Phases 2–5, re-scope impact]: Until Phase 6, data lives only in each browser and is deleted at sign-out. These items assume shared or durable storage and must be re-scoped when each phase is discussed: Phase 2 ING-05 (PDF pairing) and success criterion 5 (the partner opens the same URL and view); Phase 3 CAT-03 (AI cache) and CAT-04 / success criterion 2 (corrections that must persist); Phase 4 QUAL-01 XML/PDF pairing items; Phase 5 product-group decisions that must persist.
- [Phase 3]: Confirm DeepSeek's retention terms and current model ID, and build a golden set of 50–100 owner-labeled lines, before sending real data.
- [Phase 4]: The accountant must validate PPD IVA timing and S01 handling before the IVA view is shared.
- [Data]: The sample has 39 issuer RFCs, not ~25. The largest supplier is ~47% of net spend and has a generic description, so it needs a manual category.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-12T18:25:01.028Z
Stopped at: Phase 01 UI-SPEC approved (re-scope)
Resume file: .planning/phases/01-real-spend-by-supplier/01-UI-SPEC.md
