# Requirements: Facturas — Análisis de gastos

**Defined:** 2026-10-09
**Core Value:** Ver con claridad en qué se va el dinero: gasto por categoría y por proveedor, y el promedio mensual, calculados con exactitud a partir de los XML CFDI.

## v1 Requirements

### Access & Deployment

- [ ] **AUTH-01**: User can sign in with their Google account
- [ ] **AUTH-02**: Only emails on a server-side allowlist (owner + partner) can access any page, action, or API route; others see an access-denied screen
- [ ] **AUTH-03**: User session persists across browser refresh and can be ended with a logout button
- [ ] **AUTH-04**: App is deployed on Vercel and reachable at a shared URL
- [ ] **AUTH-05**: Server keeps working Drive access for at least 30 days without anyone re-authorizing (consent screen published "In production"; no 7-day token expiry)

### Ingestion

- [ ] **ING-01**: User can configure the Google Drive folder that holds the invoices (default `Facturas/`, including year subfolders)
- [ ] **ING-02**: User can trigger a sync that imports new/changed XML invoices from Drive; sync resumes where it stopped if it exceeds the function time budget and shows progress
- [ ] **ING-03**: User can upload one or more XML (and matching PDF) files manually from the browser; uploaded files are saved to the Drive folder with canonical name `YYYY-MM-DD_RFC_UUID.ext`
- [ ] **ING-04**: Importing the same invoice twice (same TFD UUID, via Drive or upload) never creates a duplicate record
- [ ] **ING-05**: Each invoice's PDF is paired with its XML by UUID and can be opened from the app

### Ledger (CFDI parsing & spend engine)

- [ ] **LEDG-01**: System parses CFDI 4.0 XML tolerating UTF-8 BOM, namespace prefixes, single-concept files, missing XML declaration and unknown complements
- [ ] **LEDG-02**: All money is handled as exact decimals (no floating point); totals reconcile with the XML header within $0.10
- [ ] **LEDG-03**: Ingreso (I) invoices add to spend, Egreso (E) credit notes subtract, Pago (P) complements contribute zero; N/T types are omitted and reported
- [ ] **LEDG-04**: Related CFDI chains (TipoRelacion 07 anticipo application, 04 substitution) are resolved so spend is not double-counted (e.g. Google Ads anticipo + cancelación de prepago nets correctly)
- [ ] **LEDG-05**: Line-level discounts are applied to each concept's net amount (Importe − Descuento) without subtracting the header discount again
- [ ] **LEDG-06**: Taxes are captured per line in buckets: IVA 16%, IVA 0%, exento, no objeto, IEPS (as cost, not IVA), retenciones
- [ ] **LEDG-07**: Parser is covered by automated tests against the real sample (anonymized fixtures committed; real files stay git-ignored)

### Dashboard

- [ ] **DASH-01**: User sees total spend for a selected period (month, quarter, year, custom range)
- [ ] **DASH-02**: User sees average monthly spend computed over months that have real spend, with the month count shown
- [ ] **DASH-03**: User sees spend by category (chart + table) for the selected period
- [ ] **DASH-04**: User sees spend by supplier ranked, and each supplier's monthly evolution
- [ ] **DASH-05**: User sees spend split into fixed vs variable (fixed/variable flag per category, editable)
- [ ] **DASH-06**: User can click any figure to drill down to the invoices and concept lines that compose it, and open the PDF
- [ ] **DASH-07**: User can toggle amounts between "sin IVA" (default) and "con IVA"
- [ ] **DASH-08**: Selected filters are kept in the URL so a view can be shared with the partner
- [ ] **DASH-09**: UI is in Spanish (México) with amounts formatted in MXN

### Categorization (AI + manual)

- [ ] **CAT-01**: Each concept line is assigned one category from an editable café + coworking taxonomy (~17 categories + "Sin clasificar")
- [ ] **CAT-02**: Lines are auto-categorized with DeepSeek; only product descriptions, SAT codes, amounts and supplier data are sent — never the owner's name, address or personal data
- [ ] **CAT-03**: AI results are cached so the same concept is never re-sent (no repeated cost)
- [ ] **CAT-04**: User can correct any line's category; corrections persist and always win over AI
- [ ] **CAT-05**: User can set a default category per supplier (e.g. the largest admin-services supplier)
- [ ] **CAT-06**: User can see which categories came from AI vs manual, and review a queue of uncategorized / low-confidence lines
- [ ] **CAT-07**: App still works (with "Sin clasificar" / rule-based categories) if DeepSeek is unavailable

### Taxes & Data Quality

- [ ] **IVA-01**: User sees a monthly IVA summary (informativo) with IVA 16% paid, IVA 0% base, exento, IEPS, and IVA from invoices with UsoCFDI S01 excluded
- [ ] **IVA-02**: PUE invoices count IVA by invoice date; PPD invoices count IVA by payment-complement date
- [ ] **IVA-03**: Invoices with UsoCFDI S01 ("sin efectos fiscales") are flagged with a visible alert
- [ ] **QUAL-01**: User sees a review panel listing duplicate UUIDs, XML without PDF and PDF without XML, invoices whose totals don't reconcile, omitted N/T documents, and zero-total invoices
- [ ] **QUAL-02**: Figures are labeled "según XML, sin validar contra SAT" (cancellation not verified)

### Products & Prices

- [ ] **PROD-01**: System proposes groups of equivalent products across suppliers (AI-assisted), with stable group IDs
- [ ] **PROD-02**: User can confirm, rename, merge or split product groups; manual decisions persist and win over AI
- [ ] **PROD-03**: User can set/confirm the base unit and quantity per line (e.g. 1 L, 12 pzas) so unit prices are comparable
- [ ] **PROD-04**: User sees, per product group, the net unit price (sin IVA) by supplier and which supplier is cheapest; groups without comparable data say "sin datos comparables"
- [ ] **PROD-05**: User sees each product group's unit-price trend over time

### Export

- [ ] **EXP-01**: User can export the current view (summary, by category, by supplier, line detail, IVA) to an .xlsx file
- [ ] **EXP-02**: Exported cells are safe from formula injection and money cells are numeric

### Persistence

- [ ] **STOR-01**: All app state (parsed index, AI cache, corrections, product groups) is stored as JSON files in the Drive folder (`_app/`); no database
- [ ] **STOR-02**: Two users editing at the same time don't silently overwrite each other's corrections
- [ ] **STOR-03**: Storage is behind an interface so it can be swapped for a database later without touching analytics/UI

## v2 Requirements

### Validation

- **VAL-01**: Check each UUID's status (vigente/cancelada) against the SAT service
- **VAL-02**: Alert on cash payments over $2,000 (non-deductible)

### Business

- **BIZ-01**: Split spend between café and coworking units
- **BIZ-02**: Monthly budgets per category with alerts
- **BIZ-03**: Issued invoices (ingresos) to see profit
- **BIZ-04**: Migrate storage to a database (Postgres)

### Ingestion

- **ING2-01**: Automatic download of received CFDIs from the SAT portal
- **ING2-02**: Scheduled (cron) background sync

## Out of Scope

| Feature | Reason |
|---------|--------|
| SAT bulk download with e.firma in v1 | Requires custody of the FIEL; high risk, deferred to v2 |
| DIOT, declarations, accounting entries, deductibility advice | Not an accounting product; IVA is informativo only, validated with the accountant |
| Bank reconciliation | Not requested; different data source |
| OCR of PDFs without XML | XML CFDI is the source of truth; every sample PDF has its XML |
| Chat / natural-language Q&A over the data | User chose a dashboard |
| Multi-company, roles, permissions beyond allowlist | 2 users, one business |
| CFDI 3.3, nómina, carta porte | Not present in data; add only if such files appear |
| Inventory / recipe costing | Different product |
| Real-time sync | Manual/resumable sync is enough for this volume |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 0
- Unmapped: 48 ⚠️

---
*Requirements defined: 2026-10-09*
*Last updated: 2026-10-09 after initial definition*
