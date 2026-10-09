# Phase 1: Real Spend by Supplier - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-09
**Phase:** 01-real-spend-by-supplier
**Areas discussed:** Conexión con Drive, Sincronización, Vista de proveedores, Acceso y sesión

---

## Conexión con Drive

| Option | Description | Selected |
|--------|-------------|----------|
| Script local | `pnpm drive:auth` imprime el refresh token para Vercel env | ✓ |
| Botón en la app | "Conectar Drive" en Ajustes; token cifrado guardado en algún lado | |
| Tú decides | Lo define el plan | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ajustes en la app | Pegar enlace, validar, guardar ID | ✓ |
| Variable de entorno | `DRIVE_ROOT_FOLDER_ID`, cambio = redeploy | |
| Ambas | Env default, Ajustes sobreescribe | |

| Option | Description | Selected |
|--------|-------------|----------|
| _app dentro de la carpeta elegida | Puntero fijo solo con el ID; estado en `<carpeta>/_app/` | ✓ |
| _app fija en Mi unidad | `Facturas-app/` independiente de la carpeta | |
| Tú decides | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ambos | Dueño y socio pueden cambiar la carpeta | ✓ |
| Solo el dueño | Requiere roles | |

**User's choice:** Todas las recomendadas.

---

## Sincronización

| Question | Options | Selected |
|----------|---------|----------|
| Disparo | Botón manual / Automático al abrir + botón | Botón manual |
| Progreso | Barra + contador / Spinner + resumen | Barra + contador |
| XML ilegible | Se salta y se lista / Se detiene | Se salta y se lista |
| Cambios en Drive | Refleja Drive / Nunca borra | Refleja Drive |
| Total no cuadra | Cuenta con Total del XML y se marca / Se excluye | Cuenta y se marca |
| Primera vez | Pasos guiados / Dashboard vacío + aviso | Pasos guiados |

**User's choice:** Todas las recomendadas.

---

## Vista de proveedores

| Question | Options | Selected |
|----------|---------|----------|
| Ranking | Barras horizontales + tabla / Solo tabla | Barras + tabla |
| Identificación | Nombre del XML + RFC chico / Solo RFC | Nombre + RFC |
| Evolución mensual | Clic → barras por mes / Apiladas top 5 + Otros / Tabla proveedor×mes | Clic → barras por mes |
| Periodo en F1 | Selector de año / Todo junto | Selector de año |
| Monto en F1 | Total del XML (con IVA) / Subtotal − Descuento / Ambas | Total del XML |

**User's choice:** Todas las recomendadas.

---

## Acceso y sesión

| Question | Options | Selected |
|----------|---------|----------|
| Allowlist | Env var / JSON en Drive | Env var |
| No autorizado | Pantalla "Acceso denegado" con correo / Mensaje genérico | Acceso denegado con correo |
| Duración sesión | 30 días deslizante / 7 días / 1 día | 30 días deslizante |
| Revocación | Cada solicitud / Solo al login | Cada solicitud |

**User's choice:** Todas las recomendadas.

---

## Claude's Discretion

- Ubicación del puntero bootstrap de la carpeta.
- Tamaño de lote/tiempo de sync, layout de shards JSON.
- Método de anonimización de fixtures.
- Detalles visuales.

## Deferred Ideas

None.
