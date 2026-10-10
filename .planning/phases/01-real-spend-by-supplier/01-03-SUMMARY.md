---
phase: 01-real-spend-by-supplier
plan: 03
subsystem: testing
tags: [cfdi, fixtures, anonymization, vitest, fast-xml-parser, decimal.js]

requires:
  - phase: 01-real-spend-by-supplier
    provides: "Plan 01-01 scaffold (tsx, vitest, fast-xml-parser, decimal.js pins, fixtures:build script entry)"
provides:
  - "scripts/build-fixtures.ts: local-only deterministic CFDI anonymizer with injectivity, total-preservation, structure-invariance and leak-scan assertions"
  - "143 anonymized CFDI fixtures at tests/fixtures/cfdi/001.xml..143.xml plus aggregate PROFILE.json"
  - "tests/unit/fixtures-clean.test.ts: placeholder-pattern leak guard over tests/fixtures/cfdi and tests/fixtures/synthetic"
  - "Binding placeholder conventions for all later fixtures (cfdi and synthetic)"
affects: [01-04 synthetic fixtures, 01-05 parser, 01-06 ledger, 01-07 analytics, dashboard tests]

actuals:
  tokens: 150000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "String-level, attribute-scoped XML rewriting (never parse-and-rebuild) to preserve BOM, declaration, prefixes, schemaLocation"
    - "Deterministic injective maps built from sorted real values; temp-dir swap for atomic output"
    - "Skeleton comparison: blank every rewritten attribute in input and output; the two must be identical"

key-files:
  created:
    - scripts/build-fixtures.ts
    - tests/fixtures/cfdi/001.xml
    - tests/fixtures/cfdi/143.xml
    - tests/fixtures/cfdi/PROFILE.json
    - tests/unit/fixtures-clean.test.ts
  modified: []

key-decisions:
  - "Issuer Nombre is keyed by the Emisor tag's own Rfc (not a name map), so a name shared by two RFCs cannot collapse issuers"
  - "XMLValidator from fast-xml-parser is kept (plan-mandated) with a scoped eslint-disable for no-deprecated; the replacement package is not a pinned dependency"
  - "Leak scan uses substring checks for long sensitive values and per-attribute exact checks for short/low-entropy ones, avoiding false positives against placeholders"

patterns-established:
  - "Fixture placeholders: EMI010101xxx / EMIX010101xxx, RCP010101AA1, PAC010101AA1, BAN010101AA1, TER010101AA1, AAAAAAAA-0000-4000-8000-NNNNNNNNNNNN, PROVEEDOR NNN SA DE CV, CONCEPTO NNNN; synthetic: SIN010101xxx, BBBBBBBB-0000-4000-8000-NNNNNNNNNNNN, SINTETICO ..."
  - "Guard assertion messages name fixture and attribute, never the value"

requirements-completed: [LEDG-07]

coverage:
  - id: D1
    description: "143 anonymized fixtures committed with identical structure and amounts; builder is deterministic and self-checking"
    requirement: "LEDG-07"
    verification:
      - kind: other
        ref: "pnpm fixtures:build (exit 0; profile reports 143 files, netTotal 217880.82); two consecutive runs produced identical file hashes"
        status: pass
      - kind: unit
        ref: "tests/unit/fixtures-clean.test.ts#holds exactly 143 cfdi fixtures and PROFILE.json agrees"
        status: pass
    human_judgment: false
  - id: D2
    description: "Committed leak guard fails on any non-placeholder RFC, UUID, Nombre, seal, certificate or account, and on misplaced sample paths"
    requirement: "LEDG-07"
    verification:
      - kind: unit
        ref: "tests/unit/fixtures-clean.test.ts#rejects real-looking identifiers (the guard discriminates)"
        status: pass
      - kind: unit
        ref: "tests/unit/fixtures-clean.test.ts#keeps fixtures tracked and the sample folder out of git and out of test paths"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-10
status: complete
plan_head_before: 139a4daf5051afabd5a37b369b2b99d5dcb4442b
plan_head_after: f3b6924138655fb0b577d28190a03d2260747e76
commits: 3
---

# Phase 1 Plan 03: Anonymized CFDI Fixtures Summary

**Deterministic string-level CFDI anonymizer producing 143 byte-faithful fixtures (BOM, prefixes, amounts, 39 distinct issuers, net Total 217880.82 preserved) guarded by a strict placeholder-allowlist Vitest suite.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-10T03:28Z (approx.)
- **Completed:** 2026-10-10T03:36Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 146 created (builder, 143 fixtures, PROFILE.json, test)

## Aggregate profile (builder output, aggregate only)

```json
{
  "files": 143,
  "tipos": { "I": 133, "E": 3, "P": 7 },
  "issuers": 39,
  "withBom": 142,
  "withoutDeclaration": 1,
  "singleConcept": 89,
  "netTotal": "217880.82",
  "months": {
    "2025-01": 1, "2025-02": 1, "2025-03": 1, "2025-04": 1,
    "2025-05": 9, "2025-06": 25, "2025-07": 13, "2025-08": 23,
    "2025-09": 17, "2025-10": 18, "2025-11": 20, "2025-12": 14
  }
}
```

Builder also reported 144 distinct UUIDs (143 plus the one dangling reference), 227 distinct descriptions mapped, 0 Addenda. Golden anchors confirmed structurally on the fixtures: 39 issuers, an issuer netting 16053.07, an issuer netting 13679.30, top issuer 107862.43.

## Accomplishments

- Builder rewrites only named attributes at string level, so BOM bytes, the declaration (and its single absence), namespace prefixes, schemaLocation and element order are untouched; asserts same type counts, per-file Total/Fecha, per-issuer net Total multiset, injective RFC mapping, well-formedness (XMLValidator) and zero leaks.
- Output is swapped in from `tests/fixtures/.cfdi-tmp` (with recovery of an interrupted swap); a second run is byte-identical.
- Independent cross-check (separate script, not committed): none of 59 real RFC-shaped or 144 real UUIDs appear in the fixtures; the only substring coincidences among 1766 sensitive attribute values were six 8-character `NoIdentificacion` strings contained in placeholder zeros, not identifiers.
- Leak guard suite (7 tests) passes; full suite 30/30, `pnpm typecheck` and `pnpm lint` clean.

## Task Commits

1. **Task 1: Anonymizer + 143 fixtures + PROFILE.json** - `8497bf0` (feat)
2. **Task 2 RED: failing leak-guard suite** - `8728ab0` (test)
3. **Task 2 GREEN: matchers implemented** - `f3b6924` (feat)

No REFACTOR commit (no cleanup needed).

## TDD Gate Compliance

- **RED:** `tests/unit/fixtures-clean.test.ts` written with accept-all stub matchers. Run: 1 failed, 6 passed. The failing target was "rejects real-looking identifiers (the guard discriminates)", failing on `expect(isAllowedRfc("ABC850101AB1")).toBe(false)` (received true) - the planned assertion, for the intended reason. Semantic assessment: valid RED for the discrimination behavior. The other six tests passed at RED because they assert properties of already-committed fixtures (Task 1 precedes Task 2 by plan design) and an accept-all stub cannot fail them; they become meaningful once GREEN tightens the matchers. The `check tdd-red-evidence` classifier was not run (`workflow.tdd_mode` is not enabled in config).
- **GREEN:** strict allowlist regexes; 7/7 pass.
- **REFACTOR:** none.

## Decisions Made

- Issuer name placeholder is derived from the Emisor tag's own Rfc, never from a name-to-index map.
- Kept `XMLValidator` (plan-required, `contains: "XMLValidator"`) with a scoped `eslint-disable-next-line @typescript-eslint/no-deprecated` and a comment; no new package installed.
- `BOM` is built with `String.fromCodePoint(0xfeff)` so the invisible character never lives in source text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Scrub `InformacionAduanera@NumeroPedimento`**
- **Found during:** Task 1 (attribute census of the sample)
- **Issue:** One file carries a customs pedimento number, a real shipment identifier not listed in the plan's replacement table.
- **Fix:** Added a fixed-value rule (`000000000000000`) with an exact-value leak check.
- **Files modified:** scripts/build-fixtures.ts
- **Committed in:** 8497bf0

**2. [Rule 3 - Blocking] Lint failures in the new script**
- **Found during:** Task 1 verification (`pnpm lint`)
- **Issue:** `restrict-template-expressions` on numeric template parts and `no-deprecated` on `XMLValidator`; also a formatter had inlined the BOM escape as a literal invisible character.
- **Fix:** `String(...)` around numbers, scoped eslint-disable with justification, BOM helper via code point.
- **Verification:** `pnpm typecheck`, `pnpm lint` clean; fixtures byte-identical after rebuild.
- **Committed in:** 8497bf0

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3). **Impact:** none on scope; both strengthen privacy/lint compliance.

## Issues Encountered

- The sample folder is absent from the worktree; a git-ignored symlink to the main checkout's sample was used read-only and removed before finishing (`git ls-files -- Facturas` prints nothing).

## Known Stubs

None.

## Threat Flags

None. Mitigations T-01-11/12/13 are implemented (leak scan + committed guard, aggregate-only stdout with no RFC-shaped tokens, injectivity and net-total multiset assertions). No new packages (T-01-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parser and ledger plans can test against `tests/fixtures/cfdi/*.xml`; PROFILE.json holds the golden aggregates.
- Plan 01-04 must follow the synthetic placeholder set (`SIN010101xxx`, `BBBBBBBB-...`, `SINTETICO ...`); the guard scans `tests/fixtures/synthetic/` when it exists.
- Caveat: running `pnpm fixtures:build` requires the git-ignored sample locally (repo-root `Facturas/` or `--input <dir>`).

## Self-Check: PASSED

- scripts/build-fixtures.ts, tests/unit/fixtures-clean.test.ts, tests/fixtures/cfdi/PROFILE.json present; 143 fixture XML files present.
- Commits 8497bf0, 8728ab0, f3b6924 are ancestors of HEAD.

---
*Phase: 01-real-spend-by-supplier*
*Completed: 2026-10-10*
