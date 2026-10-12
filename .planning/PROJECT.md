# Facturas — Análisis de gastos

## What This Is

Una app web (Next.js en Vercel) para analizar las facturas de compra (CFDI XML/PDF del SAT) de una cafetería y coworking. Lee las facturas desde Google Drive o por subida manual y muestra en un dashboard en qué se gasta el dinero, el promedio de gasto, la comparación de precios entre proveedores y el IVA. La usan el dueño y su socio/equipo, con login de Google.

## Core Value

Ver con claridad en qué se va el dinero: gasto por categoría y por proveedor, y el promedio mensual, calculados con exactitud a partir de los XML CFDI.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Ingesta de facturas desde una carpeta de Google Drive (API de Drive con OAuth)
- [ ] Subida manual de facturas (XML, y PDF como respaldo/adjunto)
- [ ] Parseo de CFDI 4.0 (y 3.3 si aparece): emisor, fecha, conceptos, cantidades, precio unitario, ClaveProdServ, impuestos, total
- [ ] Dashboard: gasto total y promedio mensual, gasto por categoría, gasto por proveedor (ranking y evolución)
- [ ] Categorización automática de conceptos con IA (DeepSeek) adaptada a cafetería y coworking (insumos de cafetería, desechables, servicios como internet/luz/teléfono, software, limpieza, mantenimiento, etc.)
- [ ] Agrupación de productos equivalentes entre proveedores con IA (DeepSeek), con corrección manual por el usuario
- [ ] Comparación de precio unitario del mismo producto entre proveedores ("¿dónde sale más barato?")
- [ ] Tendencias de precio por producto a lo largo del tiempo
- [ ] Resumen de IVA / impuestos (IVA acreditable por mes)
- [ ] Detección de duplicados y errores (UUID repetido, PDF sin XML, XML sin PDF, comprobantes no válidos)
- [ ] Exportar tablas/análisis a Excel
- [ ] Login con Google restringido a una lista de correos autorizados (dueño + socio)
- [ ] Persistencia sin base de datos: las correcciones (categorías, grupos de productos) se guardan como JSON en la misma carpeta de Google Drive
- [ ] Despliegue en Vercel

### Out of Scope

- Facturas emitidas / ingresos — por ahora solo gastos; utilidad e ingresos podrían venir después
- Base de datos formal (Postgres, etc.) — el usuario no la quiere todavía; el diseño debe permitir migrar después
- Descarga automática desde el portal del SAT — idea a futuro, no v1
- Presupuestos y alertas por categoría — no fue prioridad
- Separar gastos cafetería vs coworking — no fue prioridad en v1
- OCR de PDFs sin XML — el XML CFDI es la fuente de verdad; el PDF es solo respaldo

## Context

- Negocio: cafetería + coworking en México. Las facturas son CFDI emitidas por proveedores al negocio.
- Muestra actual: 143 pares XML+PDF de 2025 (mayo–diciembre) en `Facturas/2025/`, nombrados `YYYY-MM-DD_RFCEMISOR_UUID.ext`. Son unos 25 proveedores; el principal es Nueva Wal-Mart de México (NWM9709244W4, 39 facturas), seguido de VPO230317FE6, Telmex (TME840315KT6), BSI061110963 y GOM0809114P5.
- Las XML son CFDI 4.0 (algunas incluyen el namespace Pagos20; hay que distinguir complementos de pago de facturas de ingreso para no contar doble).
- La carpeta `Facturas/` está en `.gitignore`: son datos fiscales y no deben subirse al repo.
- El nombre de un mismo producto varía entre proveedores; ClaveProdServ ayuda a agrupar, pero no basta.

## Constraints

- **Tech stack**: Next.js + TypeScript en modo estricto, gestor de paquetes pnpm (preferencia del usuario).
- **Hosting**: Vercel, que no tiene disco persistente; todo el estado vive en Google Drive.
- **Storage**: sin base de datos en v1; la capa de almacenamiento debe abstraerse para migrar después a una DB.
- **AI provider**: DeepSeek (API compatible con OpenAI) para categorizar y agrupar; se cachean los resultados en Drive para no volver a pagar.
- **Security**: datos fiscales; login con Google obligatorio y allowlist de correos; tokens de Drive y API keys solo en el servidor.
- **Language**: interfaz en español (México); montos en MXN.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| XML CFDI como fuente de verdad, no los PDFs | Datos estructurados exactos del SAT; no hace falta OCR | — Pending |
| Google Drive como "base de datos" (JSON de correcciones en la carpeta) | El usuario no quiere DB todavía y Vercel no tiene disco | — Pending |
| Next.js + TS estricto + pnpm en Vercel | Preferencia del usuario; nativo de Vercel | — Pending |
| DeepSeek para la IA | Elección del usuario (costo) | — Pending |
| IA propone agrupación/categorías y el usuario corrige | Balance entre automatización y precisión | — Pending |
| Login con Google y allowlist | Encaja con la API de Drive; protege datos fiscales | — Pending |
| Cuenta de Google = Gmail personal (no Workspace) | Respuesta del usuario; descarta la Unidad Compartida y la cuenta de servicio con cuota. Drive se accede con un OAuth del dueño y la pantalla de consentimiento debe publicarse como "In production" para que el refresh token no caduque a los 7 días | — Pending |
| Datos enviados a DeepSeek: sí descripciones, claves SAT, montos y proveedores; nunca nombre, dirección ni datos personales del dueño (receptor) | Preferencia del usuario | — Pending |
| Fase 1 re-acotada (2026-10-12): los XML se suben y se analizan en el navegador y se guardan solo ahí (IndexedDB), se borran al cerrar sesión; Drive pasa a una fase 6 nueva al final | Presión de tiempo: ver el gasto por proveedor sin depender de la credencial de Drive. La interfaz de almacenamiento permite que Drive reemplace al navegador después | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-12 after the Phase 1 re-scope (browser upload; Drive moved to Phase 6)*
