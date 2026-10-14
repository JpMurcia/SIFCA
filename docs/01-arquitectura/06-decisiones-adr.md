# Registro de decisiones de arquitectura (ADR)

Estados: **Aceptada** (decisión vigente), **Aceptada con verificación** (vigente; una prueba confirma sus
mitigaciones), **Reemplazada** (conservada por historial). Los ADR documentan **cómo** se cumplen los
principios de [`../constitution.md`](../constitution.md); si un ADR la contradice, prevalece la constitución.

| ID | Decisión | Estado | Principio | Verificación pendiente |
|---|---|---|---|---|
| ADR-0001 | Monolito modular con **Clean Architecture** en cuatro capas | Aceptada | II | `dependency-cruiser` en CI |
| ADR-0002 | SaaS multiempresa: `tenant_id` + *Row-Level Security* | Aceptada | IV | Prueba de aislamiento por tabla |
| ADR-0003 | Emisión DIAN por **PTA** detrás del puerto `EInvoiceProvider` | Aceptada | IX | Q-13 (elegir PTA) |
| ADR-0004 | **Prisma ORM** con `UnitOfWork` (reemplaza a TypeORM) | Aceptada con verificación | II, III | Spike S-PRISMA |
| ADR-0005 | Reglas fiscales y de costeo parametrizables como datos con vigencia | Aceptada | VII | — |
| ADR-0006 | Transacción única para el evento comercial; *outbox* para lo externo | Aceptada | III | Pruebas de atomicidad |
| ADR-0007 | Dinero como decimal exacto; API con importes en cadena | Aceptada | VI | — |
| ADR-0008 | Documentos PDF: puerto `DocumentRenderer`; motores externos (Asia-POP) en fase futura | Aceptada | IX | Q-13 |
| ADR-0009 | **Zod** como única fuente de contratos y validación | Aceptada con verificación | V | Spike S-ZOD |
| ADR-0010 | Valuación de inventario por ítem: PEPS o promedio; **UEPS solo como despacho** | Aceptada | VII | Q-14 (devoluciones), contador |
| ADR-0011 | **Ventas a crédito y cartera** en lugar de préstamos | Aceptada | Alcance | — |
| ADR-0012 | Inmutabilidad contable por privilegios y *triggers* (no solo por código) | Aceptada | I | Spike S-PRISMA |
| ADR-0013 | Gobernanza con Spec Kit: constitución y specs en `docs/` | Aceptada | VIII | `scripts/docs.mjs check` |

---

## ADR-0001 · Monolito modular con Clean Architecture en cuatro capas

**Contexto.** Una emisión de factura toca numeración, inventario, cartera, contabilidad e impuestos y debe
ser atómica. El equipo es pequeño y operar varios servicios sería costoso.

**Decisión.** Un solo despliegue NestJS organizado en módulos. Cada módulo se estructura en capas
concéntricas **Domain → Application → Infrastructure → Presentation** con la **regla de dependencia**: las
dependencias de código apuntan solo hacia adentro (detalle y reglas D-1…D-7 en `01-vision-general-y-modulos.md`
§4). Resumen:

- **Domain:** TypeScript puro; no conoce NestJS, Prisma, Zod, base de datos ni reloj.
- **Application:** casos de uso (uno por operación) y **puertos** que ella define (`UnitOfWork`, repositorios,
  `Clock`, `EInvoiceProvider`, `CreditPolicyPort`…).
- **Infrastructure:** implementa los puertos (Prisma, PTA, almacenamiento, cola).
- **Presentation:** controladores, consumidores de cola y webhooks; sin reglas de negocio.
- **Composición:** los `*.module.ts` y `main.ts` son la única *composition root*.
- **Entre módulos:** fachada pública (`index.ts`), eventos con esquemas en `packages/contracts`, y puertos
  definidos por el consumidor e implementados por el proveedor (inversión de dependencias); el grafo es un DAG.

**Consecuencias.** (+) El dominio contable se prueba sin base de datos ni framework; el ORM, el PTA y el
transporte son reemplazables. (+) Transacciones locales. (−) Más archivos e indirección; se acepta a cambio de
límites verificables. (−) Un módulo defectuoso afecta a todos; se mitiga con límites verificados en CI.

**Alternativas descartadas.** Microservicios desde el inicio (sagas en el camino contable); NestJS «por
defecto» con servicios que usan el ORM directamente (acopla reglas a la persistencia).

---

## ADR-0002 · SaaS multiempresa con `tenant_id` y RLS

**Contexto.** Q-01: SaaS multiempresa con aislamiento por `tenant_id` y esquema compartido.

**Decisión.** Tablas compartidas con `tenant_id uuid NOT NULL` y *Row-Level Security* **habilitada y forzada**.
Cada transacción ejecuta `set_config('app.tenant_id', <id>, true)` (equivale a `SET LOCAL`) antes de cualquier
consulta, desde el `UnitOfWork`. El rol de la aplicación **no** es propietario de las tablas ni tiene
`BYPASSRLS`. En el MVP **un tenant es una empresa (un NIT)** (S-01).

**Consecuencias.** (+) Operación y migraciones únicas, costo por tenant bajo. (−) Un error de RLS expone datos
ajenos: toda tabla nueva trae su prueba de aislamiento (G-07). (−) Vecino ruidoso: límite de tasa y, de ser
necesario, mover un tenant a su propia base (la clave `tenant_id` lo permite).

**Alternativas.** Base por tenant (mayor aislamiento y costo operativo); esquema por tenant (migraciones ×N).

---

## ADR-0003 · Emisión DIAN por Proveedor Tecnológico Autorizado detrás de un puerto

**Contexto.** Q-02: la primera fase factura mediante un PTA para reducir la fricción inicial, dejando abierta la
facturación directa. Ser facturador con software propio exige habilitación, certificado de firma, firma XAdES
con la política de la DIAN y operación continua.

**Decisión.** El puerto `EInvoiceProvider` (definido en la capa Application de `einvoicing`) ofrece `submit`,
`getStatus`, `fetchArtifacts` y `fetchValidationResult`. La primera implementación es un adaptador de PTA en
`infrastructure/clients`. SIFCA construye el documento canónico y **recalcula el CUFE localmente** para
detectar diferencias; el PTA firma y transmite. El dominio y `sales` no conocen al proveedor: reciben eventos
`EInvoiceAccepted`/`EInvoiceRejected`.

**Consecuencias.** (+) Menor riesgo y tiempo hasta la primera factura aceptada. (+) Cambiar de PTA o pasar a
facturación directa es escribir otro adaptador. (−) Costo por documento y dependencia operativa; se mitiga con
estado propio de cada transmisión, cola con reintentos y contingencia (R-FE-011).

**Pendiente.** Elegir proveedor (Q-13) con los criterios de `02-normativa-y-reglas/03-… §6`.

---

## ADR-0004 · Prisma ORM con `UnitOfWork` (reemplaza a TypeORM)

**Estado.** Aceptada con verificación. **Reemplaza** la propuesta de la Fase 1 (TypeORM).

**Contexto.** El arquitecto principal fija Prisma como ORM definitivo por su tipado estricto generado en tiempo
de compilación y sus transacciones interactivas `$transaction`. La evaluación de la Fase 1 advertía que Prisma
no expresa en su API tipada `FOR UPDATE`, las variables de sesión por transacción (RLS), los *triggers* ni los
privilegios.

**Decisión.**

1. Prisma vive **solo** en `infrastructure/persistence`; sus tipos no salen de allí (G-03).
2. El puerto `UnitOfWork.run(fn)` (Application) lo implementa Infrastructure con
   `prisma.$transaction(async (tx) => …, { maxWait, timeout, isolationLevel })`, con valores **explícitos**; fija
   `app.tenant_id` y propaga `tx` a los repositorios (contexto asíncrono). Ningún otro código abre transacciones.
3. Donde Prisma no ofrece la operación, se usa **SQL explícito dentro de la misma transacción**
   (`tx.$queryRaw`/`$executeRaw`), limitado a utilidades auditadas (`lockRows`, `setTenant`, `appendOnlyInsert`)
   y a reportes, con prueba de integración sobre PostgreSQL real.
4. Las migraciones se crean con Prisma Migrate y **se editan a mano** para incluir RLS, `REVOKE`, *triggers*,
   índices parciales y GIN; se revisan como código.
5. `Decimal` se convierte de inmediato a objetos de valor del dominio (ADR-0007).

**Consecuencias.** (+) Tipado fuerte y buen flujo de migraciones. (−) Una parte del núcleo contable usa SQL
explícito; se acota y se prueba. (−) Plazo corto por defecto de las transacciones interactivas: se configuran
explícitamente y se mantienen cortas (sin llamadas de red dentro, principio III).

**Verificación.** Spike S-PRISMA (`03-evaluacion-de-librerias.md` §1.5). Si un criterio no puede cumplirse, se
escala; el ORM no se cambia por iniciativa propia.

---

## ADR-0005 · Reglas fiscales y de costeo parametrizables como datos con vigencia

**Contexto.** Las bases y tarifas cambian por decreto, incluso con suspensiones judiciales (caso real del
Decreto 572 de 2025, `02-normativa-y-reglas/02-… §2.2`). Los umbrales de negocio (ABC, niveles de servicio,
días de mora) también cambian por cliente.

**Decisión.** UVT, impuestos, tarifas, bases mínimas y condiciones viven en tablas con `valid_from`/`valid_to`,
referencia a la norma y estado de verificación. Los parámetros de negocio (ventanas de demanda, niveles de
servicio, umbrales de crédito) son configuración por tenant con historial. Los documentos guardan **snapshot**
de lo aplicado. Los motores de cálculo son puros y reciben la fecha como parámetro.

**Consecuencias.** (+) Un cambio normativo es una migración de datos más casos de prueba. (+) Reproducibilidad.
(−) Hay que gobernar quién puede modificar esas tablas (permiso especial y auditoría) y evitar ventanas
solapadas ambiguas.

---

## ADR-0006 · Transacción única para el evento comercial; *outbox* para lo externo

**Decisión.** Numeración, estado del documento, impuestos, movimientos de inventario (y consumo/restitución de
capas), **efecto en cartera y cupo** y asiento contable se escriben en **una** transacción mediante el
`UnitOfWork` y manejadores de eventos de dominio síncronos en proceso. Los efectos externos (PTA, PDF, correo,
webhooks) se escriben como filas de `outbox_event` en la **misma** transacción y los procesa un trabajador con
reintentos idempotentes (cola respaldada por PostgreSQL al inicio).

**Aplica a:** venta, devolución de venta (nota crédito), compra, devolución a proveedor, recibo de caja y
ajuste de inventario.

**Corrección de documentos rechazados.** El asiento y el movimiento de inventario se registran en la emisión
local. Si la DIAN rechaza, el documento queda en `REJECTED` y se corrige conservando el número; los cambios que
alteren valores generan una **revisión** (`document_revision`) con **contraasiento** y nuevo asiento
(principio I). *Alternativa:* contabilizar solo al ser aceptada; se descarta por ahora porque deja inventario,
cartera y período sin reflejar ventas ya entregadas; **a validar con el contador**.

**Consecuencias.** (+) Sin estados intermedios inconsistentes. (−) La cola en PostgreSQL tiene un techo de
rendimiento; se revisa con métricas y puede pasar a Redis sin cambiar el contrato del *outbox*.

---

## ADR-0007 · Dinero como decimal exacto

**Decisión.** En la base: `NUMERIC(18,2)` para importes, `NUMERIC(18,6)` para costos unitarios, `NUMERIC(18,4)`
para cantidades. En el dominio: objetos de valor `Money`/`Quantity` sobre `decimal.js`; lint que prohíbe
`number` en cálculos monetarios (G-09). En la API: importes y cantidades como **cadenas decimales** validadas
con Zod. Redondeo *half-up* por línea (R-CON-009).

---

## ADR-0008 · Documentos PDF: puerto `DocumentRenderer`; motores externos en fase futura

**Estado.** Aceptada. **Cambia** la propuesta de la Fase 1 (SIFCA llamando a Asia-POP).

**Contexto.** Q-03: Asia-POP pasa a **fase futura / experimental** y no debe acoplarse al núcleo. Se revisó su
código: es una aplicación local de catálogo, de un solo tenant, con sesión de navegador (`05-integracion-asia-pop.md`).

**Decisión.**

1. El núcleo **no depende** de ningún motor externo de documentos. El módulo `documents` define el puerto
   `DocumentRenderer` con **dos** adaptadores del núcleo: (a) el PDF que entregue el PTA, si lo hay (S-02), y
   (b) un renderizador mínimo propio con una plantilla fija para la representación gráfica obligatoria.
2. SIFCA expone **contratos OpenAPI limpios y webhooks estándar** para que cualquier motor externo
   (Asia-POP u otro) consuma datos cuando esté listo: `GET …/render-data` (documento canónico),
   `PUT …/rendered-documents/{kind}` (devolver un PDF), `GET /integrations/catalog-feed/items`, y los eventos
   `invoice.accepted`, `stock.changed`, etc.
3. El sentido de la integración es **el motor consume a SIFCA** (extracción y suscripción), nunca SIFCA
   invocando al motor en el camino crítico.
4. La fachada de compatibilidad con Alegra **sale del núcleo**: si se quiere, será un paquete opcional
   separado en la fase experimental.

**Consecuencias.** (+) Ningún repositorio externo en el camino de facturación; (+) contratos reutilizables
por cualquier integrador. (−) El PDF de la factura sale con la plantilla mínima hasta que exista un motor
externo; se acepta para el MVP.

---

## ADR-0009 · Zod como única fuente de contratos y validación

**Contexto.** Se quiere una sola definición para validar entradas, compartir tipos con el frontend y generar
documentación, garantizando que **nada negativo ni inconsistente llegue a la capa Application**.

**Decisión.** Esquemas Zod en `packages/contracts`; validación en el borde de cada caso de uso (`schema.parse`);
Zod **no** se importa en Domain; los invariantes del dominio los protegen sus objetos de valor; el OpenAPI se
**deriva** de los esquemas (Zod 4 incluye `z.toJSONSchema` ✅); `ZodError` → `422 Problem`; formularios del
frontend con los mismos esquemas.

**Consecuencias.** (+) Contrato único y verificable; (+) reutilización cliente/servidor. (−) Los refinamientos
no se reflejan en el JSON Schema (se describen en `description`); (−) hay que elegir la herramienta de
derivación del OpenAPI (spike S-ZOD). **Sustituye** a `class-validator`/`class-transformer`.

---

## ADR-0010 · Valuación de inventario por ítem: PEPS o promedio; UEPS solo como despacho

**Contexto.** Se exige: PEPS obligatorio en perecederos (lotes con vencimiento), promedio ponderado por defecto
en mercancía general y UEPS solo como política logística de despacho físico, dejando explícito que el costeo
financiero oficial es PEPS o promedio (NIC 2 / Sección 13 de las NIIF para las Pymes, y el Estatuto Tributario,
cuyo art. 65 remite a la técnica contable ⚠️).

**Decisión.**

1. `costing_method ∈ {WEIGHTED_AVERAGE, FIFO}` **por ítem** (por defecto, el del tenant/categoría; `FIFO`
   obligatorio si `tracks_expiry`). `LIFO` no es un valor válido (R-INV-001).
2. `picking_policy ∈ {FEFO, FIFO, LIFO, MANUAL}` decide la unidad física a despachar y **no afecta el costeo**
   (R-INV-017). `LIFO` muestra la advertencia obligatoria.
3. PEPS usa **capas** (`cost_layer`) y consumos de solo inserción (`cost_layer_consumption`); las devoluciones
   restituyen sobre las **capas exactas** consumidas (R-INV-016, R-INV-042). El promedio guarda **valor total**,
   no promedio (R-INV-003).
4. El método es inmutable con movimientos existentes (R-INV-018).

**Consecuencias.** (+) Cumplimiento contable explícito y probable. (−) Dos algoritmos de costeo que mantener;
se aíslan como servicios de dominio (`WeightedAverageCosting`, `FifoCosting`) tras una interfaz común
(`CostingStrategy`).

---

## ADR-0011 · Ventas a crédito y cartera en lugar de préstamos

**Contexto.** Q-11: SIFCA no será entidad crediticia ni gestionará préstamos de dinero.

**Decisión.** Se **elimina** el módulo de préstamos (modelo, API y reglas `R-PRE`). Se especifica el módulo de
**cartera y ventas a crédito** (`receivables-payables`): `credit_limit` y `payment_term_days` por cliente
(`parties`), exposición y cupo disponible, edades de cartera (corriente, 30, 60, 90+), recibos y abonos, mora,
estado de crédito, **bloqueo de despacho** por cupo excedido o mora y alertas (`02-…/05-…`). `sales` consulta el
cupo por el puerto `CreditPolicyPort`. Los intereses de mora **no** se calculan automáticamente.

**Consecuencias.** (+) Alcance acotado y sin implicaciones regulatorias de actividad crediticia. (−) Quien
necesite financiar a sus clientes con intereses lo hace fuera de SIFCA o con notas débito manuales.

---

## ADR-0012 · Inmutabilidad contable por privilegios y *triggers*

**Decisión.** Las tablas de registro inmutable (lista en la constitución, principio I) se protegen en tres
niveles: el dominio no expone edición, el rol de la aplicación **no tiene** `UPDATE`/`DELETE` y *triggers*
rechazan la mutación. Las correcciones son contraasientos y movimientos inversos. Los saldos derivados
(`item_cost`, `remaining_quantity`, `customer_credit_snapshot`) son la excepción acotada: se mantienen
**solo** por el código del caso de uso bajo bloqueo y se concilian a diario (INV-13, INV-14).

**Consecuencias.** (+) Evidencia contable y de auditoría robusta. (−) Operaciones de mantenimiento
(corrección de errores de carga) requieren un procedimiento de reversión, no un `UPDATE`.

---

## ADR-0013 · Gobernanza con Spec Kit: constitución y specs en `docs/`

**Contexto.** Se adopta Spec Kit (skills `speckit-*` y andamiaje `.specify/`) y `clean-architecture`.

**Decisión.**

1. La constitución canónica es `docs/constitution.md`; `.specify/memory/constitution.md` es un **espejo
   exacto** (las skills de Spec Kit lo leen ahí) que sincroniza `node scripts/docs.mjs sync` y verifica
   `check`.
2. Las especificaciones viven en `docs/specs/NNN-caso-de-uso/` (no en `specs/`). Para que las skills las
   encuentren se define `SPECIFY_FEATURE_DIRECTORY=docs/specs/NNN-…` (Spec Kit lo admite expresamente) o se
   escribe en `.specify/feature.json`.
3. Cada spec tiene `spec.md` (formato de la plantilla de Spec Kit) y escenarios Gherkin ejecutables en
   `acceptance/*.feature`, etiquetados con las reglas que ejercen; la **matriz de trazabilidad** se genera y se
   verifica en CI.
4. Flujo: `/speckit-constitution` → `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` →
   `/speckit-tasks` → `/speckit-implement`; `/speckit-analyze` y `/speckit-checklist` como control.

**Consecuencias.** (+) Una sola fuente de gobernanza visible en `docs/`. (−) Un espejo que sincronizar; se
automatiza y el CI lo verifica.
