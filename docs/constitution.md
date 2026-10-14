# SIFCA Constitution

> Fuente canónica: **este archivo**. `.specify/memory/constitution.md` es un espejo exacto que usan las
> skills de Spec Kit; se sincroniza con `node scripts/docs.mjs sync` y el CI falla si difieren
> (ver [`specs/README.md`](specs/README.md)).

## Core Principles

### I. Inmutabilidad contable (NON-NEGOTIABLE)

La contabilidad de SIFCA es de **solo inserción** y de **partida doble**.

- Todo comprobante DEBE cuadrar: la suma de débitos es igual a la suma de créditos, en pesos y con 2
  decimales exactos, antes de contabilizarse (R-CON-001).
- `UPDATE` y `DELETE` están **prohibidos** sobre las tablas de registro inmutable: `acc.journal_entry`,
  `acc.journal_line`, `inventory.stock_movement`, `inventory.cost_layer_consumption`,
  `einv.einvoice_event`, `arap.receipt`, `arap.receipt_allocation` y `audit.audit_log`.
- Una corrección se hace **únicamente** con un contraasiento (reversión) que referencia al original,
  seguido, si procede, del comprobante correcto (R-CON-005, R-INV-004). Un documento fiscal aceptado por la DIAN
  se corrige con nota crédito o nota débito, nunca con edición (R-FE-009).
- La prohibición DEBE imponerse en **tres niveles**: (1) el dominio no expone operaciones de edición,
  (2) el rol de base de datos de la aplicación NO tiene privilegios `UPDATE`/`DELETE` sobre esas tablas,
  (3) *triggers* de PostgreSQL rechazan la mutación aunque el rol cambie.

*Razón:* la contabilidad es evidencia legal y de auditoría; lo que puede editarse no es evidencia.

### II. Clean Architecture estricta (NON-NEGOTIABLE)

El código se organiza en capas concéntricas y **las dependencias de código fuente apuntan solo hacia
adentro**: `Domain ← Application ← Infrastructure / Presentation`.

- **Domain:** entidades, objetos de valor, servicios de dominio y eventos. DEBE ser TypeScript puro. NO DEBE
  importar NestJS, Prisma, Zod, el sistema de archivos, la red ni el reloj del sistema (el tiempo entra por
  un puerto `Clock`). No conoce la base de datos.
- **Application:** casos de uso (un caso de uso por operación de negocio) y **puertos** (interfaces de
  repositorios, unidad de trabajo, relojes, proveedores externos). Depende solo de Domain. Define los
  contratos que la capa exterior implementa (**inversión de dependencias obligatoria en cada módulo**).
- **Infrastructure:** adaptadores que implementan los puertos: persistencia con Prisma, cliente del Proveedor
  Tecnológico Autorizado, almacenamiento, cola. Los tipos generados por Prisma NO DEBEN salir de esta capa:
  los repositorios devuelven objetos del dominio y reciben objetos del dominio.
- **Presentation:** controladores HTTP de NestJS, consumidores de cola, manejadores de webhooks. Traducen
  entrada/salida y llaman casos de uso; NO contienen reglas de negocio.
- **Composición:** los módulos de NestJS son la *composition root*; solo allí se enlazan puertos con
  adaptadores.
- Un módulo solo importa de otro a través de su fachada pública (`index.ts`); el grafo de módulos es un DAG
  sin ciclos.
- Las reglas se verifican en CI con una herramienta de reglas de arquitectura (p. ej. `dependency-cruiser`):
  un `import` que viole la regla de dependencia rompe la compilación.

*Razón:* el dominio contable debe poder probarse sin base de datos ni framework y sobrevivir al cambio de
cualquiera de ellos.

### III. Transaccionalidad ACID de los eventos comerciales (NON-NEGOTIABLE)

Todo evento comercial (venta, devolución de venta, compra, devolución de compra, recibo de caja, ajuste de
inventario) DEBE ejecutar **inventario, cartera/cuentas por pagar, impuestos y contabilidad —y la asignación de
consecutivos— en una única transacción atómica de base de datos**.

- Si cualquier paso falla, TODA la operación se revierte: no puede existir una factura sin su asiento, su
  movimiento de inventario o su consecutivo, ni un consecutivo consumido sin documento.
- El caso de uso define la frontera transaccional mediante el puerto `UnitOfWork`; la implementación usa
  `prisma.$transaction` (transacción interactiva) con `timeout`, `maxWait` y nivel de aislamiento **explícitos**
  (el valor por defecto no se acepta).
- Los bloqueos de fila (`SELECT … FOR UPDATE`) se toman en orden determinista para evitar *deadlocks*.
- Los efectos externos (DIAN, correo, webhooks, PDF) NO ocurren dentro de la transacción: se registran en
  `jobs.outbox_event` **en la misma transacción** y se procesan después, de forma idempotente y con reintentos.

*Razón:* una venta parcialmente registrada descuadra inventario, cartera y libros a la vez.

### IV. Aislamiento multiempresa por `tenant_id` con RLS (NON-NEGOTIABLE)

SIFCA es SaaS multiempresa con **esquema compartido y discriminador `tenant_id`**.

- Toda tabla de negocio DEBE tener `tenant_id uuid NOT NULL` y *Row-Level Security* habilitada y forzada.
- Cada transacción DEBE fijar el tenant (`set_config('app.tenant_id', …, true)`) antes de cualquier consulta.
- El rol de base de datos de la aplicación NO DEBE ser propietario de las tablas ni tener `BYPASSRLS`.
- Toda tabla nueva DEBE llegar con una prueba automática que intente leer y escribir datos de otro tenant y
  falle.
- Las claves únicas y los índices de negocio incluyen `tenant_id`.

*Razón:* una fuga entre empresas es un incidente de seguridad y de confidencialidad fiscal.

### V. Contratos y validación únicos con Zod

Los esquemas **Zod** son la única fuente de verdad de los contratos de datos.

- Los esquemas viven en el paquete compartido `packages/contracts` y los usan el backend y el frontend.
- La validación ocurre en el **borde de la capa Application**: cada caso de uso valida su entrada con su
  esquema antes de ejecutar (de modo que HTTP, worker, webhook y pruebas reciban la misma garantía). Los
  controladores no reimplementan validación.
- Ningún dato negativo, importe con más decimales de los permitidos, cantidad no positiva, estado ilegal o
  identificador malformado DEBE llegar a la capa Application ni al dominio.
- Los invariantes del dominio se protegen además en el propio dominio (objetos de valor y entidades que no
  pueden construirse inválidos); Zod NO se importa en Domain.
- Los contratos externos (respuestas del proveedor tecnológico, cuerpos de webhooks entrantes, variables de
  entorno) también se validan con Zod en el adaptador que los recibe.
- El OpenAPI se **deriva** de los esquemas Zod; no se mantiene a mano.

*Razón:* una sola definición evita contratos divergentes entre cliente, servidor y documentación.

### VI. Dinero y cantidades exactos

- Todo importe, cantidad, costo y porcentaje DEBE usar aritmética decimal exacta: `NUMERIC` en base de datos,
  `Decimal` en el dominio y **cadenas decimales** en la API. Se PROHÍBE `number` (punto flotante) en cálculos
  monetarios (lo verifica una regla de lint).
- La política de redondeo es única y se define en R-CON-009 (mitad hacia arriba, por línea; el total es la suma
  de líneas redondeadas).

*Razón:* los totales deben coincidir al centavo con lo que valida la DIAN.

### VII. Reglas normativas como datos, trazables y validadas

- UVT, tarifas, bases, topes y reglas de costeo parametrizables se almacenan como **datos con vigencia**
  (`valid_from`/`valid_to`, referencia a la norma), nunca como constantes (ADR-0005).
- Toda regla del catálogo (`docs/02-normativa-y-reglas/`) lleva un estado de verificación: ✅ contrastada,
  ⚠️ fuente secundaria, 🔶 sin contrastar. **Una regla ⚠️ o 🔶 NO DEBE pasar a código de producción** sin que un
  contador la marque ✅.
- Cada prueba automatizada nombra la(s) regla(s) que cubre; la matriz de trazabilidad se genera y se verifica
  en CI (principio VIII).

*Razón:* el costo de una norma mal implementada lo asume el cliente.

### VIII. Desarrollo guiado por especificaciones y por pruebas

- Ninguna funcionalidad se implementa sin una especificación aprobada en `docs/specs/<NNN-caso-de-uso>/spec.md`
  con criterios de aceptación **ejecutables** (Gherkin) etiquetados con las reglas que ejercen.
- El flujo es: constitución → especificar → aclarar → planificar → tareas → implementar (skills de Spec Kit).
  Cada `plan.md` DEBE pasar la **verificación de constitución** (§ Gates) antes y después del diseño.
- Pruebas primero en el dominio: los invariantes contables se prueban con pruebas basadas en propiedades y los
  escenarios de aceptación con pruebas de integración sobre PostgreSQL real (no *mocks* de base de datos).
- El CI ejecuta `node scripts/docs.mjs check`: enlaces, reglas definidas, etiquetas Gherkin válidas, espejo de
  la constitución y matriz de trazabilidad actualizada.

*Razón:* la especificación y la prueba son el mismo artefacto visto desde dos lados.

### IX. API primero, versionada y desacoplada

- Todo lo que hace la interfaz lo hace la API pública (con permisos distintos). Contrato OpenAPI y **webhooks
  estándar** firmados son el único mecanismo de integración con sistemas externos.
- El núcleo NO DEBE depender de ningún motor externo de documentos, catálogos o reportes (p. ej. Asia-POP):
  esos sistemas consumen los contratos de SIFCA, nunca al revés.
- La emisión ante la DIAN usa el puerto `EInvoiceProvider`; el primer adaptador es un **Proveedor Tecnológico
  Autorizado (PTA)** y debe poder reemplazarse por facturación directa sin tocar el dominio.
- Un cambio incompatible exige nueva versión mayor; el CI detecta rupturas comparando el OpenAPI.

*Razón:* el producto se integra con ecosistemas que no controlamos y cambian a su ritmo.

## Restricciones técnicas y de alcance

### Stack definitivo

| Capa | Decisión |
|---|---|
| Backend | NestJS (Node.js, TypeScript estricto) en capas Domain → Application → Infrastructure → Presentation |
| Base de datos | PostgreSQL (RLS, *constraint triggers*, esquema por módulo) |
| ORM | **Prisma ORM** (reemplaza a TypeORM). Solo en Infrastructure. SQL explícito (`$queryRaw`) dentro de la transacción donde Prisma no ofrece la operación (p. ej. `FOR UPDATE`) |
| Validación y contratos | **Zod** (principio V) |
| Frontend | React; back-office con Vite, vitrina con Next.js |
| Móvil | React Native / Expo, mismo contrato |
| Contrato | OpenAPI derivado de Zod + webhooks firmados |

### Límites de alcance (decisiones vigentes)

- SIFCA **NO** es una entidad crediticia ni gestiona préstamos de dinero. NO existen módulo, tablas ni
  endpoints de préstamos, amortización ni intereses crediticios.
- En su lugar, SIFCA gestiona **ventas a crédito y cartera**: límite de crédito por cliente (`credit_limit`),
  plazos de pago, edades de cartera, recibos de caja y abonos, y control de mora con alertas y bloqueo de
  despacho por cupo excedido.
- La integración con Asia-POP es **fase futura / experimental** y queda fuera del núcleo (principio IX).
- Inventario: costeo financiero **solo** en PEPS (FIFO) o Promedio Ponderado; UEPS (LIFO) existe solo como
  política de despacho físico (R-INV-001, R-INV-017).

## Flujo de desarrollo y puertas de calidad

### Gates de la verificación de constitución

Todo `plan.md` DEBE responder a estas puertas con evidencia; una respuesta «no» exige una justificación
aprobada en la tabla de *Complexity Tracking* del plan.

| Gate | Pregunta | Principio |
|---|---|---|
| G-01 | ¿Algún archivo de `domain/` importa NestJS, Prisma, Zod, `fs`, `http` o `Date.now()`? (debe ser no) | II |
| G-02 | ¿Todo puerto está definido en `domain/` o `application/` y su implementación en `infrastructure/`? | II |
| G-03 | ¿Los tipos de Prisma aparecen fuera de `infrastructure/`? (debe ser no) | II |
| G-04 | ¿El evento comercial ejecuta inventario + cartera + impuestos + contabilidad + consecutivo en una sola transacción? | III |
| G-05 | ¿Hay efectos externos dentro de la transacción? (debe ser no; usar *outbox*) | III |
| G-06 | ¿Alguna operación hace `UPDATE`/`DELETE` sobre tablas de registro inmutable? (debe ser no) | I |
| G-07 | ¿Las tablas nuevas tienen `tenant_id`, RLS y su prueba de aislamiento? | IV |
| G-08 | ¿Las entradas del caso de uso están validadas con un esquema Zod de `packages/contracts`? | V |
| G-09 | ¿Hay algún `number` en cálculos monetarios? (debe ser no) | VI |
| G-10 | ¿Toda regla usada está ✅ o se marcó explícitamente como provisional y fuera de producción? | VII |
| G-11 | ¿La spec tiene escenarios Gherkin etiquetados y la matriz de trazabilidad está al día? | VIII |
| G-12 | ¿El cambio añade acoplamiento del núcleo con un sistema externo? (debe ser no) | IX |

### Revisión de código

Toda revisión DEBE verificar los gates aplicables. Los cambios que toquen reglas contables o fiscales
requieren la aprobación explícita del contador de referencia (registrada en la spec) además de la del equipo.

## Governance

- Esta constitución **prevalece** sobre cualquier otra práctica o documento del repositorio. Si un ADR, una
  spec o un plan la contradice, se corrige el documento subordinado o se enmienda la constitución, nunca se
  ignora.
- **Enmiendas:** se proponen por *pull request* que modifica este archivo, con justificación, impacto en
  specs y ADRs existentes y plan de migración; requieren aprobación del arquitecto principal y del contador de
  referencia si afectan principios I, III, VI o VII.
- **Versionado semántico:** MAJOR = eliminar o redefinir un principio de forma incompatible; MINOR = añadir un
  principio o ampliar materialmente su guía; PATCH = aclaraciones sin cambio de significado.
- **Cumplimiento:** los gates se verifican en cada `plan.md` y en cada revisión; el CI automatiza los que
  pueden automatizarse (G-01, G-03, G-06, G-09, G-11). Se hace una auditoría de cumplimiento al cierre de cada
  fase del roadmap.
- Los ADRs de `docs/01-arquitectura/06-decisiones-adr.md` documentan **cómo** se cumplen estos principios; la
  guía operativa de desarrollo vive en `docs/README.md` y `docs/specs/README.md`.

**Version**: 1.0.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-14
