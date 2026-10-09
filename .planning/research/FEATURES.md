# Feature Research

**Domain:** Análisis de gastos a partir de CFDI recibidos (herramienta interna, 2 usuarios, cafetería + coworking, México)
**Researched:** 2026-10-09
**Confidence:** MEDIUM-HIGH. Las reglas CFDI y el perfil de datos son HIGH (verificados contra los 143 XML reales). El panorama de competidores es MEDIUM/LOW: la búsqueda web no devolvió páginas de producto de Contalink, Heru ni Konta, así que esa parte viene de conocimiento previo y debe tratarse como orientativa.

---

## 0. Perfil de la muestra real (143 XML de 2025, datos agregados)

Estos números sustentan casi todas las decisiones de abajo. Se obtuvieron escaneando los XML (sin datos personales).

| Hallazgo | Dato | Implicación para features |
|----------|------|---------------------------|
| Versión CFDI | 143/143 son 4.0 | 3.3 es opcional; no invertir en él hasta que aparezca |
| TipoDeComprobante | I=133, P=7, E=3, N=0, T=0 | Debe manejar I, E y P desde el día 1. N y T: ignorar y avisar |
| MetodoPago | PUE=128, PPD=8, vacío=7 (los P) | Los 8 PPD son facturas de Telmex, con 7 complementos de pago en la muestra |
| Moneda | MXN=136, XXX=7 (los P). `TipoCambio="1"` aparece en 65 comprobantes MXN | Con MXN se ignora TipoCambio. Soportar USD es barato pero hoy no hay ningún caso |
| Descuentos | 195 conceptos con `Descuento`. 68 comprobantes con `Descuento` global | En 133/133 de los I el descuento global es igual a la suma de los de concepto: restarlo dos veces sería un error |
| Cuadre aritmético | 133/133 cumplen Subtotal - Descuento + Traslados - Retenciones = Total, y suma de conceptos = Subtotal | La validación de totales es barata como guardia contra regresiones |
| Retenciones | 0 en la muestra | Parsearlas igual: rentas y honorarios de personas físicas las traen |
| Impuestos | IVA 16% (272 líneas), IVA 0% (220), IEPS 3% (14), IEPS 8% (4), IEPS 0% (2). ObjetoImp 01 (21), 02 (340), 04 (1) | El IVA 0% es casi tan frecuente como el 16% por línea (despensa). El IEPS no es IVA y no se acredita. Hay que separarlos |
| UsoCFDI | G03=118, S01=15, CP01=7 (los P), G02=3 | 15 facturas S01 ("sin efectos fiscales"), no acreditables ni deducibles. Hay que marcarlas |
| FormaPago | 28 (débito)=62, 03 (transferencia)=41, 04 (crédito)=16, 99 (por definir)=8, 31=5, 30=3, 01 (efectivo)=1 | Dato útil para marcar efectivo > $2,000, que no es deducible |
| UUID duplicado | 0. Pares XML/PDF: 143/143 completos | La detección de duplicados y de huérfanos tiene hoy valor preventivo, no correctivo |
| CfdiRelacionados | TipoRelacion 07 (6 veces), 04 (1 vez) | Ver el patrón de anticipo de Google Ads, más abajo |
| Proveedores | 39 RFC emisores (PROJECT.md decía unos 25) | Un solo proveedor concentra 47% del gasto neto. Walmart, 16.7%. Google Ads, 8.3%. Telmex, 6.9% |
| Conceptos | 362 en total, mediana 1 por factura, máximo 13 | La mayoría de las facturas son de una sola línea (servicios). Walmart aporta las multilínea |
| ClaveProdServ | 120 claves distintas. Solo 18 aparecen con 2 o más proveedores | La comparación de precios entre proveedores solo aplica a un subconjunto pequeño. Hay que dar expectativas realistas |
| ClaveProdServ no confiable | Walmart factura bajo `84111506` (servicios de facturación) fresas, arándanos y jabón. `50131700` agrupa 17 descripciones distintas | La clave es una señal, no una verdad. Se categoriza por concepto, no por factura ni por clave sola |
| ClaveUnidad | `H87` (pieza) domina con unas 250 de 362 líneas. `KGM` y `LTR` son pocas. 15 conceptos tienen cantidad fraccionaria. Los textos de `Unidad` son inconsistentes ("PIEZAS", "Pieza", "UN", "Pza", "PIEZA *") | La clave normaliza poco. Los tamaños de empaque van dentro de la descripción ("12/1LT", "2KG", "5L") |
| Descripciones | Abreviadas y crípticas en Walmart ("MM LECHE ENT", "12/1LT DESLA"). Sin `NoIdentificacion` en 69 conceptos | La agrupación de productos necesita IA más corrección manual. No sirve un match por texto |
| Meses | Ene-Abr contienen solo facturas del emisor BSI061110963 por $0.01 con total $0 (12 de ellas en todo el año, todas S01). Los datos reales van de mayo a diciembre | El promedio mensual debe usar meses con datos, o el periodo que elija el usuario. Hay que excluir las facturas de $0 |
| Facturas multipropósito | La factura de Telmex incluye una suscripción de Netflix | Un default por proveedor no basta. La categoría se asigna por concepto |

### Patrones CFDI críticos observados

1. **Anticipo con Egreso (Google Ads).** Se factura un prepago como Ingreso (I): $200 y $1,000 en agosto, $4,000 en noviembre. En la factura de consumo final (I, con TipoRelacion 07 hacia los prepagos) el total sube a $1,401.78 y $4,187.47. Después se emiten Egresos (E) "Cancelación Prepago" por $1,200 y $4,000, relacionados con la factura final. El gasto neto correcto es I - E. Si se ignoran los E, el sistema duplica unos $5,200 con IVA (unos $4,483 sin IVA). Es el caso de prueba más importante del dominio.
2. **Telmex PPD + Pagos 2.0.** Hay una factura I mensual con PPD, FormaPago 99. Luego se emite un P con Total 0, Moneda XXX y UsoCFDI CP01, que referencia la factura (DoctoRelacionado). El P nunca es gasto: solo marca la fecha real de pago. El monto de IVA del P (ImpuestosP) sirve para el IVA acreditable por flujo de efectivo.
3. **Sustitución (TipoRelacion 04).** La factura de EST850628K51 sustituye a una factura previa cancelada que no está en la carpeta. Si las dos estuvieran, habría que descartar la sustituida. Localmente no hay forma de saber si un CFDI fue cancelado después: eso solo lo dice el SAT.
4. **Facturas "sin efectos" de $0.01.** Doce facturas de BSI061110963 (UsoCFDI S01, total 0.00) ensucian rankings y conteos de facturas si no se tratan. Además hay 3 S01 de DCM991109KR2 por unos $2,147 en total, que sí tienen monto.

---

## 1. Reglas de dominio CFDI (el motor de cálculo)

Estas reglas son requisitos funcionales del parser y del motor de gasto, no son una lista de deseos. Si fallan, el "core value" (ver con claridad en qué se va el dinero) es falso.

| Caso | Regla recomendada | Confianza |
|------|-------------------|-----------|
| **I (Ingreso)** | Es gasto positivo para el negocio receptor | HIGH |
| **E (Egreso, nota de crédito)** | Resta del gasto, con signo negativo en la fecha del E. Hereda la categoría y proveedor de la factura relacionada (CfdiRelacionados) o, si no se puede resolver, del proveedor y concepto propios. En el patrón de anticipos, el E relaciona con la factura final, no con el prepago | HIGH |
| **P (Pago, Pagos 2.0)** | Nunca suma al gasto (Total=0, Moneda=XXX). Solo se usa para (a) marcar la factura PPD como pagada, con fecha y forma de pago, y (b) fijar el mes del IVA acreditable de PPD | HIGH |
| **N (Nómina) y T (Traslado)** | Fuera de alcance. Se ignoran con un aviso visible ("N archivos omitidos") | HIGH |
| **PUE** | Pagada al emitirse. Gasto e IVA en el mes de `Fecha` | HIGH |
| **PPD** | El gasto se reconoce en `Fecha` de la factura (base devengada, para análisis de gasto). El IVA acreditable se reconoce en la fecha de pago del P (base de flujo de efectivo, que es como se acredita el IVA en México). Mostrar "pendiente de pago" mientras no haya P | MEDIUM: el criterio fiscal debe validarse con el contador. La búsqueda no confirmó el detalle |
| **Cancelados** | Localmente no se detectan. Hay un servicio público del SAT de consulta de estatus (Vigente / Cancelado / No encontrado) que recibe RFC emisor, RFC receptor, total y UUID, y los cuatro datos están en el XML. Requiere confirmar el endpoint exacto | MEDIUM: lo describen proyectos de terceros como cfdibills y satcfdi, no el SAT |
| **Reemplazos (TipoRelacion 04)** | Si el UUID sustituido está en la base, marcarlo como "sustituido" y excluirlo del gasto | HIGH |
| **Descuentos** | Costo neto de la línea = Importe - Descuento. El `Descuento` global del comprobante es la suma de los de línea, así que no restarlo otra vez | HIGH (verificado en la muestra) |
| **Gasto "base"** | Gasto = Subtotal - Descuento (sin IVA) por defecto, con interruptor "con IVA". El IVA acreditable es recuperable, así que no es costo. Para facturas S01 o no acreditables, el IVA sí es costo | MEDIUM: es una decisión de producto que debe confirmar el usuario |
| **IVA 0%, exento, IEPS** | Desglosar por impuesto y tasa. El IEPS (refrescos, por ejemplo) es costo y no entra al IVA acreditable | HIGH |
| **Retenciones (ISR/IVA)** | Parsear (`Impuestos/Retenciones`). El gasto no cambia. Mostrarlas en el resumen de impuestos. Total = Sub - Desc + Traslados - Retenciones | HIGH |
| **Moneda extranjera** | Si Moneda ≠ MXN, importes en MXN = importe × TipoCambio (del XML). Si Moneda = MXN, ignorar TipoCambio. Conservar el importe original y la moneda | HIGH |
| **UsoCFDI S01** | Marcar "sin efectos fiscales". Excluir de IVA acreditable. Dejar que cuente en el gasto, con un interruptor | MEDIUM |
| **Efectivo > $2,000** | Marcar para revisión (FormaPago 01 con total > $2,000 no es deducible). Es un warning, no un bloqueo | MEDIUM: regla fiscal general, validar con el contador |
| **Precio unitario comparable** | Precio unitario neto = (Importe - Descuento) / Cantidad, sin IVA, normalizado a unidad base (kg, L o pieza) usando ClaveUnidad más el tamaño del empaque parseado de la descripción | HIGH sobre la fórmula. MEDIUM sobre la calidad de la normalización |
| **Fecha** | Usar el `Fecha` del XML, no el nombre del archivo. Convertir a zona local (México) para el mes | HIGH |
| **Identidad** | UUID (TimbreFiscalDigital) es la llave primaria única | HIGH |

---

## 2. Feature Landscape

### Table Stakes (Users Expect These)

Si falta alguno, el dashboard da números equivocados o no se confía en él.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Parseo CFDI 4.0 completo (emisor, receptor, conceptos, impuestos por tasa, CfdiRelacionados, TimbreFiscalDigital, Pagos20) | Es la fuente de verdad del proyecto | MEDIUM | Tolerar prefijos de namespace y archivos con BOM (la muestra los tiene). Modelo interno desacoplado del XML para migrar a DB |
| Motor de gasto con los tipos I/E/P (ver sección 1) | Sin esto, el gasto se duplica con anticipos y complementos de pago | MEDIUM | Es la parte de mayor riesgo de corrección. Pruebas unitarias con los casos reales de la muestra (Google Ads, Telmex) |
| Ingesta: carpeta de Google Drive + subida manual (XML con PDF como respaldo) | Es la forma en que las facturas llegan | MEDIUM | Emparejar XML y PDF por UUID, no por nombre de archivo. Idempotente por UUID |
| Dashboard de gasto total y promedio mensual | Es el core value | LOW | El promedio mensual cuenta solo meses con datos (mayo-dic en la muestra) o el periodo elegido. Mostrar cuántos meses promedia |
| Gasto por categoría (resumen + detalle navegable hasta la factura) | Es el core value | LOW-MEDIUM | Barras o dona con top N. Clic para ver conceptos y facturas. Siempre con el bucket "Sin clasificar" visible |
| Gasto por proveedor (ranking + evolución mensual) | Es el core value | LOW | Mostrar % del total (hoy un proveedor concentra 47%) |
| Filtro de periodo (mes, trimestre, año, rango) y de proveedor / categoría | Cualquier analítica lo exige | LOW | Estado en la URL para compartir vistas entre los 2 usuarios |
| Categorización por IA con taxonomía fija y editable (ver sección 4) | Sin categorías no hay "por categoría" | MEDIUM | Por concepto, no por factura. Prompt con taxonomía cerrada, ClaveProdServ + descripción + proveedor como contexto. Cache en Drive |
| Corrección manual de categoría con memoria (regla "siempre que..."), persistida | La IA se equivoca. Sin corrección no se confía en el dashboard | MEDIUM | Prioridad de resolución: corrección manual > caché IA > regla por ClaveProdServ > default del proveedor > Sin clasificar. Una corrección debe aplicarse a todos los conceptos equivalentes, no a uno |
| Resumen de IVA por mes: IVA 16% trasladado, base 0%, exento, IEPS, retenciones | El usuario pidió IVA acreditable | MEDIUM | PUE por mes de Fecha. PPD por fecha del P. S01 excluido. Etiquetar como "informativo, no es declaración" |
| Exportar a Excel (tablas del dashboard y detalle por concepto) | Es el flujo estándar con el contador | LOW-MEDIUM | Generar `.xlsx` real (no CSV), con una hoja por vista y montos numéricos. Incluir UUID, RFC, fecha, subtotal, descuento, IVA, total, categoría |
| Detección de duplicados y errores | Pedido explícito del usuario | LOW-MEDIUM | UUID repetido, XML sin PDF, PDF sin XML, XML que no parsea, total que no cuadra, P sin factura relacionada, factura PPD sin P, tipo N/T omitido. Pantalla "Revisión" con contador visible |
| Login con Google + allowlist de correos | Son datos fiscales | LOW | Verificación en servidor, nunca solo en el cliente |
| Interfaz en español (México), montos en MXN con formato es-MX | Requisito del usuario | LOW | Fechas y separadores es-MX |
| Navegar de cualquier cifra al CFDI de origen (UUID, PDF adjunto) | Auditar es la forma de confiar en un número | LOW | El PDF abre desde Drive |

### Differentiators (Competitive Advantage)

Alineados con el core value y con los dolores propios de un negocio de este tamaño. Los productos grandes no los hacen bien porque están pensados para contadores, no para dueños.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Comparación de precio unitario del mismo producto entre proveedores ("¿dónde sale más barato?") | Es la pregunta que ningún software contable responde y que sí ahorra dinero | HIGH | Requiere agrupación + normalización de unidades. Hoy solo 18 de 120 claves tienen 2 o más proveedores, así que hay que decir con claridad "sin datos comparables" en vez de inventar. Mostrar la última compra, el mínimo, el promedio y el proveedor más barato, con la cantidad comprada |
| Agrupación de productos equivalentes con IA + corrección manual (fusionar / separar / renombrar) | Sin esto no hay comparación ni tendencias | HIGH | Dos pasos: (1) parsear nombre limpio + tamaño de empaque + unidad base; (2) agrupar por embedding o IA. La IA propone, el usuario confirma. Un grupo se identifica con un ID estable, no con el nombre |
| Normalización de unidades (ClaveUnidad + tamaño de empaque en la descripción) | Compara peras con peras ($/kg, $/L, $/pieza) | MEDIUM-HIGH | Regex para patrones "12/1LT", "2KG", "5L", "PACK 6", y fallback con IA. Si no se puede normalizar, no comparar |
| Tendencia de precio por producto (línea de tiempo) con alerta visual de alza | Detecta inflación de proveedor | MEDIUM | Depende de la agrupación. Mostrar variación % contra el promedio móvil o la primera compra. Precio neto sin IVA y con descuento aplicado |
| Gasto neto correcto en anticipos / notas de crédito, y explicación visible ("este monto ya descuenta el E de $1,000") | Evita que los números se vean mal sin que nadie sepa por qué | MEDIUM | Se logra mostrando el desglose I / E en el detalle del proveedor. Es parte del motor, pero la UI de explicación es el diferenciador |
| Validación de vigencia contra el SAT (Vigente / Cancelado) | Detecta facturas canceladas que no deben contar | MEDIUM | Consulta pública por UUID. Sin FIEL. Ejecutar bajo demanda o en lote con límite de tasa. Cachear. Verificar el endpoint antes de planear |
| Separación gasto recurrente vs variable (renta, internet, software frente a insumos) | Responde "¿cuál es mi gasto fijo mensual?" | LOW-MEDIUM | Derivable de la categoría (cada categoría tiene el atributo fijo / variable) |
| Panel "Revisión" con prioridad: sin clasificar, bajo nivel de confianza de IA, sin normalizar, S01, efectivo > $2,000 | Convierte el trabajo manual en una cola corta | MEDIUM | Mostrar confianza de la IA. Es el lugar para dedicar los 10 minutos semanales |
| Facturas de múltiples propósitos divididas por línea (Telmex con Netflix) | Hace exacta la categoría | LOW | Ya sale gratis si la categoría vive en el concepto |
| Concentración de proveedores (top 5 = X%) y variación mes contra mes | Contexto de riesgo y de cambio, de bajo costo | LOW | Se calcula sobre datos que ya existen |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Descarga masiva automática del SAT con e.firma / FIEL | Evita subir facturas a mano. Contalink y otros lo ofrecen | Obliga a custodiar la e.firma de un negocio en un hosting sin disco ni DB. El riesgo supera el beneficio. Ya está fuera de alcance en PROJECT.md | Carpeta de Drive + subida manual. Si el volumen crece, usar el Excel de metadatos del SAT para detectar faltantes, sin custodiar la FIEL |
| Declaración de impuestos / DIOT / contabilidad electrónica / pólizas | Es lo que hacen Contalink y CONTPAQi | Es un producto distinto y regulado, de riesgo alto. El usuario tiene contador | Un resumen de IVA etiquetado "informativo" y exportable a Excel para el contador |
| Dictaminar "deducible / no deducible" y dar asesoría fiscal | Parece útil | Se vuelve responsabilidad del sistema. Las reglas dependen del régimen y de los hechos | Solo marcar alertas objetivas (S01, efectivo > $2,000) con la leyenda "revisar con el contador" |
| Conciliación bancaria | Casi todos los competidores la ofrecen | Requiere importar estados de cuenta y matching difuso. No contribuye a ver en qué se va el dinero | Mostrar FormaPago de cada CFDI. Revisar después, si hace falta |
| Emisión de facturas e ingresos / utilidad | Parece natural completar el cuadro | Fuera de alcance ("solo gastos"). Duplicaría el modelo de datos | Dejar el modelo de datos listo para que otro milestone lo agregue (campo `direction`) |
| Presupuestos y alertas por categoría | Es común en herramientas de gasto | El usuario dijo que no es prioridad. Requiere notificaciones y estado | Variación mes contra mes en el dashboard |
| OCR de PDF sin XML | Facturas sin XML | Poca precisión, lento. El XML es la fuente de verdad | Marcar el PDF huérfano como error de revisión: pedir el XML al proveedor |
| Separar cafetería vs coworking por centro de costos | Parece útil | Los usuarios la dejaron fuera de v1. Obliga a repartir gastos compartidos (renta, luz) con criterios arbitrarios | Dejar un campo de etiqueta libre en la categoría o concepto para después |
| Chat con IA sobre los datos ("pregúntale a tus facturas") | Suena moderno | Alucina cifras. Un dashboard sobre dinero debe ser determinista, y el costo y la latencia crecen | La IA solo clasifica y agrupa (con revisión humana). Los números siempre vienen de cálculo determinista |
| Dashboards personalizables / constructor de reportes | Flexibilidad | Para 2 usuarios, una vista fija con filtros cubre el 95%. Esto es mucha UI | Vistas fijas bien elegidas + exportar a Excel para análisis libre |
| Roles, permisos, multi-empresa, facturación de la app | Pensar en escalar | Son 2 usuarios en 1 negocio | Allowlist de correos. Dejar la capa de storage abstraída |
| Tiempo real / webhooks / sincronización continua con Drive | "Siempre actualizado" | Complejidad y límites de la API de Drive en un hosting sin estado | Botón "Sincronizar" manual y re-proceso idempotente por UUID |
| Conversión de moneda con tipo de cambio histórico externo | Parece más correcto | El CFDI ya trae TipoCambio. No hay facturas en USD en la muestra | Usar el TipoCambio del XML |
| Soporte CFDI 3.3, nómina y carta porte | Compatibilidad | No aparecen en la muestra y agregan costo | Aceptar 3.3 solo si aparece. Omitir N y T con aviso |
| Módulo de inventario / costeo por receta | Sería lo que más valor da a una cafetería | Requiere ventas, recetas y conteos: otro producto | Solo tendencias de precio de insumos |

---

## 3. Feature Dependencies

```
Parseo CFDI 4.0
    └──requires──> Ingesta (Drive + subida manual)
    └──enables───> Motor de gasto (I/E/P, PUE/PPD, descuentos, moneda)
                       ├──requires──> Resolución de CfdiRelacionados (E -> I, 04 sustitución)
                       ├──enables───> Dashboard: total, promedio mensual, por proveedor
                       ├──enables───> Resumen de IVA (PUE por Fecha, PPD por pago P)
                       └──enables───> Exportar a Excel

Categorización IA (por concepto)
    └──requires──> Parseo + Persistencia de correcciones (JSON en Drive)
    └──enables───> Dashboard: gasto por categoría
    └──enables───> Gasto fijo vs variable

Agrupación de productos (IA + corrección)
    └──requires──> Parseo + Normalización de unidades (ClaveUnidad + empaque)
    └──requires──> Persistencia de correcciones (IDs estables de grupo)
    └──enables───> Comparación de precio unitario entre proveedores
    └──enables───> Tendencias de precio

Persistencia JSON en Drive (correcciones + caché IA)
    └──requires──> Capa de storage abstraída
    └──enables───> Categorización, agrupación, caché que evita volver a pagar a la IA

Detección de duplicados / errores ──enhances──> Ingesta y Motor de gasto
Validación SAT (vigencia) ──enhances──> Motor de gasto (excluye cancelados)
Login Google + allowlist ──requires──> OAuth, que a la vez da acceso a Drive
```

### Dependency Notes

- **Motor de gasto requiere CfdiRelacionados:** el E de Google Ads solo se asigna a la categoría correcta si se resuelve su relación. Sin ella, cae en "Sin clasificar" con signo negativo.
- **Comparación de precios requiere agrupación y normalización:** son tres capas, y si cualquiera falla, el número final es engañoso. Conviene entregarlas juntas y mostrar "no comparable" cuando falte una.
- **IVA de PPD requiere el P:** la fecha de acreditamiento solo se conoce con el complemento. Por eso el parseo de Pagos 2.0 va en la fase del motor de gasto y no después.
- **Correcciones requieren IDs estables:** si un grupo o una regla se identifica por el nombre mostrado, un cambio de nombre rompe las correcciones persistidas en Drive.
- **Validación SAT mejora el motor, no lo bloquea:** conviene dejarla como mejora (v1.x) para no depender de un servicio externo en el camino crítico.
- **Corrección manual entra con la categorización:** si no, el primer error de la IA obliga a editar JSON a mano.

---

## 4. Taxonomía de categorías de gasto sugerida (cafetería + coworking)

Criterio: pocas categorías (17 más "Otros / Sin clasificar"), mutuamente excluyentes, y que respondan a decisiones del dueño. Cada una trae una pista de segmento ClaveProdServ (aproximada, a validar contra el catálogo del SAT antes de codificar reglas; solo se usa como contexto para la IA) y una marca de fijo (F) o variable (V). La lista es editable por el usuario; la IA solo puede elegir de esta lista cerrada, más "Otros / Sin clasificar".

| # | Categoría | Tipo | Ejemplos | Pista ClaveProdServ (segmento) |
|---|-----------|------|----------|-------------------------------|
| **Costo de venta (cafetería)** | | | | |
| 1 | Café, té y bases de bebida | V | Grano, jarabes, polvos, matcha, chocolate | 5018, 5020 |
| 2 | Lácteos y alternativas | V | Leche, crema, yogur | 5013 |
| 3 | Alimentos y panadería | V | Pan, queso, jamón, fruta, verdura, huevo | 5010, 5011, 5012, 5013, 5017 |
| 4 | Bebidas embotelladas | V | Refrescos, agua, jugos | 5020 |
| 5 | Desechables y empaque | V | Vasos, tapas, popotes, bolsas, servilletas | 2411, 1411 |
| 6 | Limpieza e higiene | V | Jabón, cloro, papel sanitario, trapos | 4712, 5312 |
| **Instalaciones y servicios** | | | | |
| 7 | Renta y administración del local | F | Renta, cuota de administración, mantenimiento del edificio | 8010, 9010 (pista débil) |
| 8 | Luz, agua y gas | F/V | CFE, agua, gas LP o natural | 7710, 8310, 1510 |
| 9 | Internet y telefonía | F | Telmex y similares | 8116, 8111 |
| 10 | Mantenimiento y reparaciones | V | Plomería, aire acondicionado, mantenimiento de equipo | 7218, 7310 |
| **Coworking y equipo** | | | | |
| 11 | Equipo, mobiliario y menaje | V | Cafetera, molino, sillas, vasos de servicio, UPS | 4312, 5211, 5611, 3912 |
| 12 | Papelería y oficina | V | Hojas, plumones, consumibles de impresión | 4410, 4411 |
| 13 | Software, suscripciones y ambiente | F | Herramientas SaaS, música, streaming, POS | 8111, 4323 |
| **Comercial y administrativo** | | | | |
| 14 | Publicidad y marketing | V | Google Ads, impresos, redes sociales | 8410 (84111506), 8210 |
| 15 | Servicios profesionales | F/V | Contador, legal, diseño | 8011, 8012, 8014 |
| 16 | Comisiones y servicios financieros | V | Comisión de terminal, bancos | 8413 |
| 17 | Transporte, envíos y combustible | V | Paquetería, gasolina | 7810, 1510 |
| 18 | Otros / Sin clasificar | V | Todo lo demás. Cola de revisión | cualquiera |

**Reglas de uso de la taxonomía:**

- **La unidad de clasificación es el concepto** (no la factura). Una compra de Walmart trae alimentos, lácteos y limpieza en un solo ticket. La factura de Telmex trae Netflix.
- **Orden de resolución:** corrección manual > caché IA > regla por ClaveProdServ confiable > default de proveedor > Sin clasificar.
- **Desconfiar de claves genéricas:** `84111506` (servicios de facturación) aparece en Walmart para fresas y jabón, y en Google Ads para prepagos. Se envía a la IA como una pista más, sin tratarla como verdad.
- **Atributo fijo / variable** por categoría, para el análisis de gasto recurrente.
- **Subcategorías:** no en v1. Con 143 facturas al año, el segundo nivel de detalle lo da el producto agrupado.
- **Un posible punto de aclaración:** el mayor proveedor (47% del gasto neto) factura "gestión y coordinación en trabajos administrativos" bajo `90101603`. La IA no puede deducir si es renta, administración u otro servicio. La primera revisión manual con el dueño debe fijar su categoría.

---

## 5. MVP Definition

### Launch With (v1)

- [ ] Parseo CFDI 4.0 + modelo interno desacoplado — fuente de verdad
- [ ] Ingesta por Drive y por subida manual, idempotente por UUID, con pareo XML/PDF — sin datos no hay producto
- [ ] Motor de gasto con I/E/P, PUE/PPD, descuentos, moneda y relaciones — corrección numérica, con pruebas sobre los casos reales de Google Ads y Telmex
- [ ] Login con Google + allowlist — son datos fiscales
- [ ] Dashboard: gasto total, promedio mensual, por proveedor, por categoría, filtros de periodo — core value
- [ ] Categorización IA por concepto + corrección manual con memoria + persistencia en Drive — necesaria para "por categoría"
- [ ] Panel de revisión: duplicados, huérfanos, totales que no cuadran, tipos omitidos, sin clasificar — pedido explícito y barato
- [ ] Resumen de IVA por mes (PUE por Fecha, PPD por P, S01 excluido, IEPS aparte) — pedido explícito
- [ ] Exportar a Excel — pedido explícito, se consume con el contador

### Add After Validation (v1.x)

- [ ] Agrupación de productos con IA + corrección + normalización de unidades — cuando las categorías ya sean confiables
- [ ] Comparación de precio unitario y tendencias de precio — depende de la agrupación; avisar que el subconjunto comparable es pequeño
- [ ] Validación de vigencia contra el SAT — cuando se confirme el endpoint
- [ ] Gasto fijo vs variable, concentración de proveedores, variación mes contra mes — baratos una vez hay categorías
- [ ] Alertas de efectivo > $2,000 y de UsoCFDI S01 en la pantalla de revisión

### Future Consideration (v2+)

- [ ] Facturas emitidas e ingresos / utilidad — otro milestone; dejar el campo `direction` previsto
- [ ] Migración a base de datos — cuando Drive-JSON deje de alcanzar
- [ ] Separación cafetería vs coworking — si el usuario lo pide
- [ ] Descarga del SAT — solo con un diseño de custodia de FIEL aprobado

---

## 6. Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Parseo CFDI 4.0 + modelo interno | HIGH | MEDIUM | P1 |
| Motor de gasto I/E/P, PUE/PPD, descuentos | HIGH | MEDIUM | P1 |
| Ingesta Drive + subida manual | HIGH | MEDIUM | P1 |
| Login Google + allowlist | HIGH | LOW | P1 |
| Dashboard total / promedio / proveedor | HIGH | LOW | P1 |
| Categorización IA + corrección manual | HIGH | MEDIUM | P1 |
| Dashboard por categoría | HIGH | LOW | P1 |
| Panel de revisión (duplicados y errores) | MEDIUM | LOW-MEDIUM | P1 |
| Resumen de IVA mensual | HIGH | MEDIUM | P1 |
| Exportar a Excel | HIGH | LOW-MEDIUM | P1 |
| Normalización de unidades | HIGH | MEDIUM-HIGH | P2 |
| Agrupación de productos IA + corrección | HIGH | HIGH | P2 |
| Comparación de precio entre proveedores | HIGH | HIGH | P2 |
| Tendencia de precio | MEDIUM | MEDIUM | P2 |
| Validación de vigencia SAT | MEDIUM | MEDIUM | P2 |
| Fijo vs variable / concentración | MEDIUM | LOW | P2 |
| Subcategorías | LOW | MEDIUM | P3 |
| Etiqueta cafetería / coworking | LOW | MEDIUM | P3 |
| Ingresos / facturas emitidas | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## 7. Competitor Feature Analysis

**Advertencia de confianza:** la búsqueda web no devolvió las páginas oficiales de Contalink, Heru ni Konta. Esta tabla se basa en el conocimiento general del mercado (MEDIUM/LOW) y debe verificarse antes de usarla para decisiones de producto. Lo único contrastado con fuentes es la existencia de las herramientas open source (satcfdi, cfdibills) y del complemento CFDI Tools para Google Sheets.

| Feature | Contalink / contabilidad en la nube (orientados a contadores) | Herramientas ligeras (CFDI Tools en Sheets, satcfdi) | Nuestro enfoque |
|---------|-------------|------------|-----------------|
| Descarga masiva del SAT | Sí, con e.firma del cliente (MEDIUM) | Sí, con FIEL (verificado en la ficha de CFDI Tools y de satcfdi) | No: carpeta de Drive y subida manual |
| Validación de vigencia | Sí (MEDIUM) | Sí, CFDI Tools la anuncia (verificado) | P2: consulta pública por UUID |
| Clasificación de gasto | Cuentas contables, manual o con reglas (MEDIUM) | Columnas planas, sin categorías | IA por concepto + corrección manual, taxonomía de negocio |
| IVA acreditable / DIOT | Sí, es su núcleo (MEDIUM) | Columnas de ISR e IEPS por concepto en CFDI Tools (verificado) | Resumen informativo mensual. Sin DIOT |
| Conciliación bancaria | Sí (MEDIUM) | No | Fuera de alcance |
| Contabilidad electrónica y pólizas | Sí (MEDIUM) | No | Fuera de alcance |
| Comparación de precios por producto | No (LOW: no se conoce ninguna) | No | **Diferenciador principal** |
| Tendencia de precio de insumos | No | No | Diferenciador |
| Gasto neto con E/P bien tratados | Sí, a nivel contable (MEDIUM) | Depende del usuario | Motor propio con explicación visible |
| Exportar a Excel | Sí | Sí (nativo en Sheets) | Sí |

**Lectura:** los productos grandes resuelven el cumplimiento fiscal para contadores. Lo que no cubren, y es lo que pide este usuario, es análisis operativo para el dueño: en qué se va el dinero, quién vende más barato y cómo evolucionan los precios. Ahí es donde conviene invertir, y es donde la herramienta es defendible.

---

## Sources

- Perfil de datos: escaneo de los 143 XML de `Facturas/2025/` (HIGH, es el dato primario).
- Reglas CFDI (tipos I/E/P, PUE/PPD, TipoRelacion 04 y 07, Pagos 2.0): estructura observada en la muestra más conocimiento del Anexo 20 (HIGH sobre lo observado, MEDIUM sobre las interpretaciones fiscales; deben validarse con el contador).
- [satcfdi (PyPI)](https://pypi.org/project/satcfdi/4.0.15): biblioteca que cubre descarga masiva, validación de comprobantes y lista 69B (MEDIUM).
- [cfdibills (PyPI)](https://pypi.org/project/cfdibills): ejemplo de consulta del estatus de un CFDI en el web service del SAT (MEDIUM, endpoint por confirmar).
- [CFDI Tools (Google Workspace Marketplace)](https://workspace.google.com/marketplace/app/cfdi_tools/431167342188): descarga del SAT con FIEL, validación y columnas de ISR / IEPS por concepto (MEDIUM).
- [KPMG México: compensación y flujo de efectivo del IVA](https://kpmg.com/mx/es/home/tendencias/2023/04/ao-implicaciones-compensacion-iva-como-medio-de-pago.html): respalda de forma general que el IVA opera por flujo de efectivo (MEDIUM).
- Contalink, Heru, Konta: sin fuentes verificables en esta búsqueda; conocimiento general (LOW).

---
*Feature research for: análisis de gastos CFDI, cafetería y coworking (México)*
*Researched: 2026-10-09*
