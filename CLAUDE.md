@AGENTS.md

# Facturas: análisis de gastos

App web (Next.js 16 + TypeScript en Vercel) para analizar las facturas de compra (CFDI XML/PDF del SAT) de una cafetería y coworking. Muestra el gasto por categoría y por proveedor, el promedio mensual, la comparación de precios y el IVA, todo calculado con exactitud a partir de los XML. El stack completo, las decisiones y el flujo GSD están en `.claude/CLAUDE.md`.

## Reglas fundamentales

### 1. Preguntar siempre, nunca inferir

- Si algo no está explícito en la petición, en el código o en `.planning/`, **pregunta antes de actuar**. No asumas requisitos, nombres, formatos, reglas fiscales ni comportamiento de UI.
- Cuando haya más de una interpretación razonable, presenta las opciones (con tu recomendación) y espera la respuesta.
- No "rellenes huecos" con valores por defecto inventados: montos, tasas, categorías, textos de interfaz, correos de la allowlist, IDs de carpetas, etc.
- Antes de borrar, sobrescribir, instalar dependencias, cambiar configuración o hacer commits/push, confirma.
- Si una instrucción contradice este archivo o `.planning/`, señálalo y pregunta cuál manda.
- Al reportar, distingue lo verificado (tests, typecheck, ejecución real) de lo que no se pudo comprobar.

### 2. Respuestas en español

- Todas las respuestas, preguntas, resúmenes y explicaciones van en **español (México)**.
- Los textos de la interfaz están en español de México; los montos van en MXN con `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`.
- Los identificadores de código (variables, funciones, tipos) siguen la convención que ya existe en el archivo; los términos del SAT (`TipoDeComprobante`, `ClaveProdServ`, `ValorUnitario`…) se dejan tal cual.

### 3. TypeScript en modo estricto

- `tsconfig.json` mantiene `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. **No se relajan.**
- Prohibido `any`, `@ts-ignore`, `@ts-expect-error` sin justificación, y aserciones `as` o `!` para silenciar errores. Usa narrowing, type guards o zod.
- Valida con **zod** todo dato que cruce una frontera de confianza: XML parseado, respuestas de DeepSeek, JSON de Drive, variables de entorno y entradas de API.
- El dinero nunca va en `number`: usa strings del XML, convierte a `decimal.js` y redondea solo al presentar.
- Pon `import "server-only"` en todo módulo que maneje tokens o API keys.
- Antes de dar algo por terminado, corre:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`

## Comandos

| Comando | Uso |
|---------|-----|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `eslint .` (no existe `next lint`) |
| `pnpm test` / `pnpm test:e2e` | Vitest / Playwright |

Gestor de paquetes: **pnpm** (no uses npm ni yarn).

## Estructura

- `src/app`: rutas App Router (`(app)` protegido, `(public)`, `api`)
- `src/auth`: Better Auth, allowlist, `require-user`
- `src/ports` / `src/adapters`: interfaces y sus implementaciones (p. ej. Drive), para poder migrar a una base de datos después
- `src/components/ui`: componentes shadcn
- `Facturas/`: XML/PDF reales con datos fiscales. **No los subas, no los copies a fixtures ni los mandes a servicios externos.**
