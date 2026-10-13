# Registro de decisiones de arquitectura (ADR)

Cada ADR tiene estado: **Propuesta** (pendiente de confirmar), **Aceptada** o **Reemplazada**. Todas son
*Propuesta* en la Fase 1 y pasan a *Aceptada* cuando se cierre el spike o la pregunta que las bloquea.

| ID | Decisión | Estado | Bloqueada por |
|---|---|---|---|
| ADR-0001 | Monolito modular con arquitectura hexagonal | Propuesta | — |
| ADR-0002 | Multiempresa con esquema compartido y *Row-Level Security* | Propuesta | Q-01 |
| ADR-0003 | Emisión DIAN mediante proveedor tecnológico detrás de un puerto | Propuesta | Q-02 |
| ADR-0004 | TypeORM restringido a infraestructura; migraciones en SQL revisable | Propuesta | Spike S-ORM |
| ADR-0005 | Reglas fiscales como datos con vigencia | Propuesta | — |
| ADR-0006 | Consistencia: transacción única para lo contable, *outbox* para lo externo | Propuesta | — |
| ADR-0007 | Dinero como decimal exacto; API con importes en cadena | Propuesta | — |
| ADR-0008 | Renderizado de PDF: Asia-POP detrás de un puerto, con alternativa interna | Propuesta | Spike S-PDF, Q-03 |

---

## ADR-0001 · Monolito modular con arquitectura hexagonal

**Contexto.** Una emisión de factura toca numeración, inventario, contabilidad e impuestos, y debe ser
atómica. El equipo es pequeño y la operación de varios servicios sería costosa.

**Decisión.** Un solo despliegue NestJS organizado en módulos con límites estrictos (`index.ts` como API pública,
sin acceso cruzado a tablas, sin ciclos), cada uno con capas `domain/application/infrastructure/interfaces`.
`api` y `worker` son el mismo código en dos modos de ejecución.

**Consecuencias.** (+) Transacciones locales, despliegue simple, depuración sencilla. (−) Un módulo defectuoso
afecta a todos; se mitiga con límites verificados en CI y pruebas. (−) Escalado conjunto; se mitiga
escalando réplicas del `worker` aparte y extrayendo `einvoicing` o `documents` si hiciera falta.

**Alternativas descartadas.** Microservicios desde el inicio (sagas en el camino contable); monolito sin
módulos (acoplamiento creciente).

---

## ADR-0002 · Multiempresa con esquema compartido y RLS

**Contexto.** S-01 asume SaaS multiempresa. Opciones: base por empresa, esquema por empresa, o tablas
compartidas con `company_id`.

**Decisión.** Tablas compartidas con `company_id` y *Row-Level Security*: cada transacción ejecuta
`SET LOCAL app.company_id = …`; las políticas filtran por esa variable. El rol de la aplicación **no** es
dueño de las tablas ni tiene `BYPASSRLS`.

**Consecuencias.** (+) Operación y migraciones únicas, costo por empresa bajo. (−) Un error de RLS expone datos
ajenos: se cubre con pruebas automáticas que intentan leer entre empresas en cada tabla nueva. (−) Una
empresa muy grande puede afectar a otras (vecino ruidoso): limitación de tasa y, si hiciera falta, mover esa
empresa a su propia base (la clave `company_id` lo permite).

**Alternativas.** Base por empresa (mayor aislamiento y costo operativo); esquema por empresa (migraciones ×N).

**Revisión.** Si Q-01 resulta «una instalación por cliente», `company_id` se conserva (permite SaaS después) y
RLS pasa a ser defensa en profundidad.

---

## ADR-0003 · Emisión DIAN mediante proveedor tecnológico detrás de un puerto

**Contexto.** Ser facturador con software propio exige habilitación, certificado de firma, firma XAdES con la
política de la DIAN, operación continua y manejo de contingencia.

**Decisión.** El módulo `einvoicing` define el puerto `EInvoiceProvider` (submit, getStatus, fetchArtifacts,
fetchValidationResult). La Fase 3 implementa **un** adaptador de proveedor tecnológico autorizado. SIFCA
construye el documento canónico y recalcula/valida el CUFE localmente; el proveedor firma y transmite.

**Consecuencias.** (+) Menor riesgo y tiempo hasta la primera factura aceptada. (−) Costo por documento y
dependencia del proveedor; se mitiga con el puerto y un estado propio de cada transmisión. Un segundo adaptador
(otro proveedor o software propio) debe poder agregarse sin tocar `sales`.

**Pendiente.** Elegir proveedor (Q-02) con los criterios de `02-…/03-… §6`.

---

## ADR-0004 · TypeORM restringido a infraestructura; migraciones en SQL

**Contexto.** Ver `03-evaluacion-de-librerias.md` §1.

**Decisión provisional.** TypeORM como ORM de la Fase 2 **solo** dentro de `infrastructure/persistence`;
operaciones críticas (consecutivos, stock, contabilización) con SQL explícito; `synchronize` prohibido;
migraciones escritas y revisadas como SQL (incluyen *triggers*, RLS, índices parciales); reportes con SQL propio.

**Condición de confirmación.** El spike S-ORM supera sus criterios; si no, se repite con Drizzle.

**Consecuencias.** Cambiar de ORM cuesta reescribir `infrastructure/persistence` de cada módulo, nada más.

---

## ADR-0005 · Reglas fiscales como datos con vigencia

**Contexto.** Las bases y tarifas cambian por decreto, incluso con suspensiones judiciales (caso real del
Decreto 572 de 2025, `02-…/02-… §2.2`).

**Decisión.** UVT, impuestos, tarifas, bases mínimas y condiciones viven en tablas con `valid_from`/`valid_to`,
referencia a la norma y estado de verificación. Los documentos guardan **snapshot** de lo aplicado. El motor es
puro y recibe la fecha como parámetro.

**Consecuencias.** (+) Un cambio normativo es una migración de datos más casos de prueba, sin despliegue de
lógica. (+) Reproducibilidad. (−) Hay que gobernar quién puede modificar esas tablas (permiso especial y
auditoría) y una prueba que impida ventanas solapadas ambiguas.

---

## ADR-0006 · Transacción única para lo contable, *outbox* para lo externo

**Decisión.** Numeración, estado del documento, movimientos de inventario y asiento contable se escriben en
**una** transacción de base de datos mediante manejadores de eventos de dominio síncronos en proceso. Los
efectos externos (DIAN, PDF, correo, webhooks) se escriben como filas de `outbox_event` en la misma
transacción y los procesa un trabajador con reintentos (cola respaldada por PostgreSQL al inicio).

**Consecuencias.** (+) No hay estados intermedios inconsistentes en lo contable; (+) los efectos externos son
reintentables e idempotentes. (−) La cola en PostgreSQL tiene un techo de rendimiento; se revisa con métricas
reales y se puede pasar a Redis/BullMQ sin cambiar el contrato del *outbox*.

**Corrección de documentos rechazados.** El asiento y el movimiento de inventario se registran en la emisión
local. Si la DIAN rechaza, el documento queda en `REJECTED` y se corrige conservando número; los cambios que
alteren valores generan una **revisión** (`document_revision`) con asiento de reversa y nuevo asiento
(auditable). *Alternativa:* contabilizar solo al ser aceptada; se descarta por ahora porque deja el inventario
y el período sin reflejar ventas ya entregadas; **a validar con el contador** (hay quien prefiere
contabilizar tras la aceptación).

---

## ADR-0007 · Dinero como decimal exacto

**Decisión.** En la base: `NUMERIC(18,2)` para importes, `NUMERIC(18,6)` para costos unitarios, `NUMERIC(18,4)`
para cantidades. En el dominio: objeto `Money` sobre `decimal.js`; lint que prohíbe `number` en cálculos
monetarios. En la API: importes y cantidades como **cadenas decimales**. Redondeo *half-up* por línea
(R-CON-009).

**Consecuencias.** (+) Sin errores de punto flotante y con totales reproducibles frente a la DIAN. (−) Los
clientes deben parsear cadenas; el cliente generado y el paquete `domain-shared` lo encapsulan.

---

## ADR-0008 · Renderizado de PDF: Asia-POP detrás de un puerto

**Contexto.** Asia-POP hoy es una aplicación de catálogo local de una sola tienda (`05-integracion-asia-pop.md`).

**Decisión.** El módulo `documents` define el puerto `DocumentRenderer`. Catálogos: nivel 0/1 de integración.
Documentos transaccionales: se prueba primero con el spike S-PDF; si Asia-POP puede cubrir AP-CR-02…10 en el
calendario necesario, se usa `AsiaPopRenderer`; si no, se usa un `LocalPuppeteerRenderer` dentro de SIFCA con
las mismas plantillas HTML/CSS y Asia-POP queda solo para catálogos. El PDF de un documento fiscal se genera
una vez y se almacena.

**Consecuencias.** Ninguna dependencia fuerte de un tercer repositorio en el camino crítico de facturación.
