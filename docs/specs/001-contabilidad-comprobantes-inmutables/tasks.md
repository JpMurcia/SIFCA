---

description: "Task list for Contabilidad con comprobantes inmutables"
---

# Tasks: Contabilidad con comprobantes inmutables

**Input**: Design documents from `docs/specs/001-contabilidad-comprobantes-inmutables/`

**Prerequisites**: [`plan.md`](plan.md), [`spec.md`](spec.md), [`research.md`](research.md), [`data-model.md`](data-model.md), [`contracts/`](contracts/), [`quickstart.md`](quickstart.md)

**Tests**: **Incluidas y obligatorias.** La constitución (principio VIII) exige desarrollo guiado por la spec y pruebas primero: en cada historia las pruebas se escriben antes, **deben fallar** y solo entonces se implementa. Los `.feature` de `acceptance/` se ejecutan tal cual (no se copian).

**Organization**: Las tareas se agrupan por historia de usuario para poder implementarlas y probarlas de forma independiente. US1 y US2 son P1; US3 es P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: historia a la que pertenece (US1, US2, US3); las fases Setup, Foundational y Polish no llevan etiqueta
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Monorepo definido en `plan.md` → *Project Structure*: API en `apps/api/` (código en `apps/api/src/`, pruebas en `apps/api/test/`), esquemas en `packages/contracts/src/`, configuración en `packages/config/`, infraestructura de desarrollo en `infra/`.

> **Convención de verificación:** las tareas citan las restricciones **tal como están** en `data-model.md` y en el catálogo de reglas. Ninguna regla 🔶/⚠️ llega a producción sin ✅ del contador (G-10; tarea de cierre en la fase Polish).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Arranque del monorepo y de las herramientas. Lo heredan las specs 002–011.

- [X] T001 Crear la raíz del monorepo en `package.json` (`engines.node` = `>=22.18`, `packageManager` pnpm 12.x), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json`, `.nvmrc` (22), `.editorconfig` y ampliar `.gitignore` (`node_modules`, `dist`, `.turbo`, `coverage`)
- [X] T002 [P] Crear `packages/config` con `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `eslint.config.mjs` y `.prettierrc` compartidos
- [X] T003 Crear `apps/api/package.json` con versiones **exactas** de research §1 (TypeScript 5.9.3, NestJS 12.1.3, Prisma y `@prisma/adapter-pg` 7.10.0, Zod 4.6.7, decimal.js 10.6.0, Vitest 5.0.4, fast-check 4.10.2, @cucumber/cucumber 13.3.0, testcontainers y @testcontainers/postgresql 12.2.1, dependency-cruiser 18.6.0, `pino`), `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `apps/api/src/main.ts` y `apps/api/src/app.module.ts`; ejecutar `pnpm install` y versionar `pnpm-lock.yaml`
- [X] T004 [P] Crear `packages/contracts/package.json` (Zod 4.6.7), `packages/contracts/tsconfig.json` y `packages/contracts/src/index.ts` vacío exportable
- [X] T005 [P] Configurar `apps/api/vitest.config.ts` con proyectos `unit` (`test/unit/**`), `integration` (`test/integration/**`, `hookTimeout` amplio) y `contract`, y los *scripts* `test:unit`, `test:integration`, `test:contract`, `test:perf` en `apps/api/package.json`
- [X] T006 [P] Configurar `apps/api/cucumber.mjs` (paths `../../docs/specs/*/acceptance/*.feature`, `requireModule` para TypeScript, `import` de `test/acceptance/**/*.ts`, formato `progress` y `strict: true` para que un escenario `undefined` o `pending` falle) y el *script* `test:acceptance`
- [X] T007 [P] Crear `apps/api/.dependency-cruiser.cjs` con una regla por cada fila D-1…D-7 de `docs/01-arquitectura/01-vision-general-y-modulos.md` (dominio sin NestJS/Prisma/Zod/`fs`/`http`; `application` sin `infrastructure`; `infrastructure` y `presentation` no se importan entre sí; Prisma solo en `infrastructure/persistence` y `platform/persistence`) más la regla `no-circular`; *script* `test:arch`
- [X] T008 [P] Crear `infra/docker-compose.dev.yml` (PostgreSQL 16) y `infra/postgres/init/00-roles.sql` que crea `sifca_owner`, `sifca_app` (`LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`) y `sifca_readonly` según `data-model.md` §4; el mismo SQL lo reutiliza el arnés de integración
- [X] T009 [P] Crear `.github/workflows/ci.yml` con *jobs* para `node scripts/docs.mjs check --strict`, lint, `tsc --noEmit`, `test:unit`, `test:arch`, `test:integration` (servicio PostgreSQL), `test:acceptance` y `test:contract`
- [X] T010 **Spike S-PRISMA-1**: en `apps/api/prisma/schema.prisma` y `apps/api/prisma.config.ts` verificar contra PostgreSQL real con Prisma 7.10.0 + `@prisma/adapter-pg`: (a) `@@schema("acc")`/`@@schema("audit")` con `schemas = ["acc","audit"]`; (b) `$transaction` con `maxWait`, `timeout` e `isolationLevel` explícitos; (c) `set_config('app.tenant_id', $1, true)` y `SELECT … FOR UPDATE` vía `$queryRaw` dentro de la misma transacción; (d) `Decimal` ↔ cadena sin pasar por `number`. Registrar el resultado y, si (a) falla, activar el **plan B** (prefijo `acc_`) en `docs/specs/001-contabilidad-comprobantes-inmutables/research.md` §2 y en `docs/01-arquitectura/03-evaluacion-de-librerias.md` §1.5
- [X] T011 [P] **Spike S-ZOD**: en `packages/contracts/src/` verificar con Zod 4.6.7 que `z.toJSONSchema()` produce JSON Schema compatible con OpenAPI 3.1 para el esquema `Money` (regex `^\d+(\.\d{1,2})?$`), `minItems: 2`/`maxItems: 500` y uniones discriminadas; registrar el resultado en `docs/01-arquitectura/03-evaluacion-de-librerias.md` §4

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Base compartida: núcleo sin framework, plataforma de persistencia, migraciones con inmutabilidad y RLS, arnés de pruebas. **Ninguna historia puede empezar hasta terminar esta fase.**

**⚠️ CRITICAL**: no se puede empezar ninguna historia hasta completar esta fase.

- [X] T012 [P] Escribir pruebas de `Money`/`Decimal`/`Percentage` en `apps/api/test/unit/shared-kernel/money.spec.ts`: rechaza construir desde `number`; escala 2; redondeo mitad hacia arriba (`333.33 × 19 %` = `63.33`); suma de líneas ya redondeadas (3 × `63.33` = `189.99`, no `190.00`); propiedad `fast-check` de que `a + b − b = a` para cualquier par (R-CON-009)
- [X] T013 [P] Escribir pruebas de `LocalDate` en `apps/api/test/unit/shared-kernel/local-date.spec.ts`: formato `YYYY-MM-DD`, comparación, pertenencia a un rango, ausencia de zona horaria (R-CON-014)
- [X] T014 Implementar `apps/api/src/shared-kernel/decimal.ts` (`Decimal.clone({ precision: 40, rounding: ROUND_HALF_UP })` local, sin tocar el estado global), `apps/api/src/shared-kernel/money.ts` y `apps/api/src/shared-kernel/percentage.ts` hasta que pasen las pruebas de T012 (nunca aceptan `number`)
- [X] T015 [P] Implementar `apps/api/src/shared-kernel/local-date.ts` y `apps/api/src/shared-kernel/instant.ts` hasta que pasen las pruebas de T013
- [X] T016 [P] Crear `apps/api/src/shared-kernel/result.ts`, `apps/api/src/shared-kernel/ids.ts` (tipos de marca `TenantId`, `UserId`, `AccountId`, `EntryId`, `PeriodId`…) y `apps/api/src/shared-kernel/domain-error.ts` (clase base con `code`, `message` y `violations[]` con `field`, `message`, `rule`)
- [X] T017 Definir los puertos de `apps/api/src/shared-kernel/ports/` según `docs/specs/001-contabilidad-comprobantes-inmutables/contracts/ports.md` §1: `unit-of-work.ts`, `clock.ts`, `request-context.ts`, `permission-checker.ts`, `id-generator.ts`, `domain-event-publisher.ts`
- [X] T018 [P] Crear los esquemas comunes en `packages/contracts/src/common/` (`decimal.ts` con `Money` = `/^\d+(\.\d{1,2})?$/` y `SignedMoney`, `problem.ts` con el `code` enumerado de `docs/specs/001-contabilidad-comprobantes-inmutables/contracts/accounting.v1.openapi.yaml`, `page.ts`) y exportarlos desde `packages/contracts/src/index.ts`
- [X] T019 [P] Crear `apps/api/src/platform/config/env.schema.ts` (Zod): `DATABASE_URL` (rol `sifca_app`), `DATABASE_MIGRATION_URL` (rol `sifca_owner`), `TX_MAX_WAIT_MS`, `TX_TIMEOUT_MS`, `JWT_DEV_SECRET`; falla al arrancar si falta alguno
- [X] T020 Crear el arnés de integración en `apps/api/test/integration/support/postgres-harness.ts`: levanta PostgreSQL con Testcontainers, ejecuta `infra/postgres/init/00-roles.sql`, aplica las migraciones como `sifca_owner` y expone pools para `sifca_owner` y `sifca_app`, más `withTenant(tenantId, fn)` que fija `app.tenant_id` por transacción
- [X] T021 Escribir la prueba de conformidad del esquema en `apps/api/test/integration/accounting/schema-conformance.spec.ts`: consulta `pg_catalog`/`information_schema` y verifica que existen **todas** las tablas, `CHECK`, `UNIQUE`, `EXCLUDE`, índices, *triggers* (incluidos `BEFORE TRUNCATE`), políticas RLS con `FORCE` y privilegios de `data-model.md` §2–§4; debe fallar hasta aplicar las migraciones
- [X] T022 [P] Escribir la prueba de aislamiento por *tenant* en `apps/api/test/integration/accounting/tenant-isolation.spec.ts` (G-07): con datos de los *tenants* A y B, el contexto de A no ve filas de B en ninguna tabla de `acc` ni de `audit`; un `INSERT` con `tenant_id` de B falla; **sin** `app.tenant_id` no se ve ni se escribe nada
- [X] T023 Crear la migración `apps/api/prisma/migrations/20261014000100_platform_roles_audit/migration.sql` (con `prisma migrate dev --create-only` y edición a mano): extensión `btree_gist`, esquemas `acc` y `audit`, función `audit.reject_mutation()` (excepción `IMMUTABLE_RECORD`, `SQLSTATE 'P0001'`), tabla `audit.audit_log` con sus columnas de `data-model.md` §5, *triggers* `BEFORE UPDATE OR DELETE` y `BEFORE TRUNCATE`, RLS `ENABLE` + `FORCE` con la política `tenant_isolation` y `GRANT SELECT, INSERT` a `sifca_app`
- [X] T024 Crear la migración `apps/api/prisma/migrations/20261014000200_accounting_core/migration.sql` (parte 1, tablas): `acc.account`, `acc.cost_center`, `acc.voucher_type`, `acc.voucher_sequence`, `acc.fiscal_period` (con `EXCLUDE USING gist (tenant_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)` y `CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL))`), `acc.journal_entry` (con `UNIQUE (tenant_id, voucher_type_id, numbering_year, number)`, `CHECK (total_debit = total_credit)`, `CHECK (source_type = 'MANUAL' OR source_id IS NOT NULL)`, `CHECK (status = 'POSTED')`, índice único parcial `UNIQUE (reversal_of) WHERE reversal_of IS NOT NULL`, `UNIQUE (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL` y `UNIQUE (id, tenant_id, accounting_date)`), `acc.journal_line` (con `CHECK ((debit > 0) <> (credit > 0))`, `CHECK (debit >= 0 AND credit >= 0)`, `CHECK (scale(debit) <= 2 AND scale(credit) <= 2)`, `UNIQUE (entry_id, line_no)` y la FK compuesta `(entry_id, tenant_id, accounting_date)`) y `acc.journal_draft`, todos con los tipos e índices de `data-model.md` §2
- [X] T025 En la misma migración (parte 2, funciones y *triggers*): `acc.assert_entry_consistent()` como *constraint trigger* `DEFERRABLE INITIALLY DEFERRED` sobre `acc.journal_entry` y `acc.journal_line`; `acc.validate_line()` (`BEFORE INSERT`); `acc.assert_period_open()` con `FOR SHARE` (`BEFORE INSERT` en `journal_entry`); `acc.guard_sequence()` (solo `last_number = last_number + 1`, sin `DELETE`); `acc.guard_fiscal_period()` (solo `OPEN ↔ CLOSED`, sin `DELETE`); `acc.guard_account()`; y los *triggers* `audit.reject_mutation()` (`BEFORE UPDATE OR DELETE` y `BEFORE TRUNCATE`) sobre `acc.journal_entry` y `acc.journal_line`
- [X] T026 En la misma migración (parte 3, seguridad): `ENABLE` + `FORCE ROW LEVEL SECURITY` y la política `tenant_isolation` (`USING`/`WITH CHECK` con `NULLIF(current_setting('app.tenant_id', true), '')::uuid`) en **todas** las tablas de `acc`; `REVOKE UPDATE, DELETE, TRUNCATE` sobre `acc.journal_entry` y `acc.journal_line` a `sifca_app`; `GRANT` por tabla según `data-model.md` §4 (incluido `UPDATE (last_number)` en `acc.voucher_sequence`); `GRANT SELECT` a `sifca_readonly`
- [X] T027 Declarar en `apps/api/prisma/schema.prisma` los modelos de `acc` y `audit` (con `@@schema` o el plan B de T010), ejecutar `prisma generate`, y comprobar que T021 y T022 pasan contra la base migrada
- [X] T028 Escribir pruebas de `UnitOfWork` en `apps/api/test/integration/platform/unit-of-work.spec.ts`: hace *commit*; revierte todo si `fn` lanza; es **reentrante** (la segunda llamada se une a la transacción existente y comparte el rollback); fija `app.tenant_id` antes de la primera consulta; usa `maxWait`, `timeout` e `isolationLevel` explícitos
- [X] T029 Implementar `apps/api/src/platform/persistence/prisma.service.ts` (cliente con `@prisma/adapter-pg`), `apps/api/src/platform/persistence/tenant-context.ts` (`AsyncLocalStorage` con el cliente transaccional actual) y `apps/api/src/platform/persistence/prisma-unit-of-work.ts` hasta que pasen las pruebas de T028; añadir `apps/api/src/platform/persistence/sql.ts` con las utilidades auditadas `setTenant`, `lockRows` y `queryText` (devuelve decimales como `::text`)
- [X] T030 [P] Implementar `apps/api/src/platform/time/system-clock.ts` (`toLocalDate` con `Intl.DateTimeFormat` y zona `America/Bogota`), `apps/api/src/platform/time/system-id-generator.ts` (UUID v7) y el doble `FixedClock` en `apps/api/test/support/fixed-clock.ts`, con pruebas en `apps/api/test/unit/platform/clock.spec.ts` (23:30 hora Colombia del 2026-10-31 ⇒ 2026-10-31 aunque en UTC sea el 1 de noviembre)
- [X] T031 [P] Escribir pruebas del filtro de errores en `apps/api/test/unit/platform/problem-details.filter.spec.ts` que fijen la tabla de `research.md` §14 (`ENTRY_NOT_BALANCED` 422, `VALIDATION_FAILED` 422 con `errors[]`, `PERIOD_CLOSED` 409, `ALREADY_REVERSED` 409, `ENTRY_IMMUTABLE` 405, `FORBIDDEN` 403, `ZodError` → `VALIDATION_FAILED`) y que ninguna respuesta filtra trazas ni SQL
- [X] T032 Implementar `apps/api/src/platform/http/problem-details.filter.ts`, `apps/api/src/platform/http/request-context.middleware.ts` y `apps/api/src/platform/http/permission-checker.ts` (adaptador **provisional** con JWT de desarrollo, claims `tid`, `sub`, `perms`; comentado como pendiente de la spec de IAM) hasta que pasen las pruebas de T031
- [X] T033 [P] Escribir la prueba de integración y luego implementar `apps/api/src/platform/persistence/prisma-audit-log.ts` (puerto `AuditLog.record` que inserta en `audit.audit_log` dentro de la transacción ambiente) en `apps/api/test/integration/platform/audit-log.spec.ts`; verificar que `UPDATE`/`DELETE` sobre la bitácora fallan con `sifca_app` y con `sifca_owner`
- [X] T034 [P] Escribir pruebas del dominio base en `apps/api/test/unit/accounting/domain/account.spec.ts` y `fiscal-period.spec.ts`: `AccountCode` válido (`^[0-9]{1,12}$`), `Account.canReceivePostings()` exige `allowsPosting` e `isActive`, `FiscalPeriod.contains(date)` y `isOpen()`
- [X] T035 Implementar `apps/api/src/modules/accounting/domain/value-objects/account-code.ts`, `apps/api/src/modules/accounting/domain/entities/account.ts`, `apps/api/src/modules/accounting/domain/entities/voucher-type.ts`, `apps/api/src/modules/accounting/domain/entities/fiscal-period.ts` y `apps/api/src/modules/accounting/domain/errors/accounting-errors.ts` (`EntryNotBalanced`, `ValidationFailed`, `PeriodClosed`, `PeriodNotFound`, `AlreadyReversed`, `EntryImmutable`, `PeriodCloseBlocked`, `IdempotencyConflict`) hasta que pasen las pruebas de T034
- [X] T036 Definir los puertos `account-repository.ts`, `fiscal-period-repository.ts` y `voucher-type-repository.ts` en `apps/api/src/modules/accounting/application/ports/` y sus adaptadores de lectura en `apps/api/src/modules/accounting/infrastructure/persistence/` (`prisma-account.repository.ts`, `prisma-fiscal-period.repository.ts` con `findByDate(date, 'share')` = `SELECT … FOR SHARE`, `prisma-voucher-type.repository.ts`) con *mappers* fila↔dominio; crear además los dobles en memoria en `apps/api/test/support/in-memory/`
- [X] T037 [P] Crear `apps/api/test/fixtures/plan-de-cuentas-de-prueba.ts` (cuentas 1105, 1110, 1435, 2408, 3115, 4135, 4175 y 6135 como cuentas de movimiento; `13` como grupo acumulador; `130505` auxiliar con `requires_party = true`), los tipos `AJ`, `FV`, `NC`, `RC` y el *script* `apps/api/prisma/seed-test-chart.ts` (*script* `seed:test-chart`), que inserta con el rol `sifca_owner`; **no es el PUC de producción**
- [X] T038 Crear el esqueleto `apps/api/src/modules/accounting/accounting.module.ts` (*composition root*), `apps/api/src/modules/accounting/index.ts` (exporta solo `PostJournalEntryPort`, `ReverseJournalEntryPort` y los tipos públicos) y registrarlo en `apps/api/src/app.module.ts`
- [X] T039 Crear el soporte de Cucumber en `apps/api/test/acceptance/support/world.ts` y `hooks.ts` (base limpia por escenario, `FixedClock` en 2026-10-14 America/Bogota, *tenant* de prueba) y el paso del *Antecedentes* de `acceptance/comprobantes.feature` («Dado una empresa con el plan de cuentas cargado y el período de octubre de 2026 abierto») en `apps/api/test/acceptance/accounting/steps/background.steps.ts`
- [X] T040 [P] Escribir la prueba de arquitectura base en `apps/api/test/architecture/layers.spec.ts` que ejecuta `dependency-cruiser` con las reglas de T007 y falla ante cualquier violación de D-1…D-7 o ciclo (G-01, G-02, G-03)

**Checkpoint**: la base migrada pasa la conformidad y el aislamiento, `UnitOfWork` es reentrante y los *steps* de fondo de Cucumber compilan. Ya se pueden implementar las historias.

---

## Phase 3: User Story 1 - Contabilizar un comprobante que cuadra (Priority: P1) 🎯 MVP

**Goal**: el contador registra un comprobante manual con varias líneas y el sistema solo lo acepta si cuadra, asignándole su consecutivo.

**Independent Test**: contabilizar comprobantes válidos e inválidos; solo los válidos quedan guardados, con número consecutivo, y un fallo no consume número. Escenarios [001-01]…[001-05], [001-09], [001-10], [001-13]; FR-001, FR-002, FR-003, FR-006, FR-007, FR-008, FR-009, FR-013; SC-001, SC-003.

### Tests for User Story 1 ⚠️

> **NOTA: escribir estas pruebas PRIMERO y comprobar que FALLAN antes de implementar.**

- [X] T041 [P] [US1] Escribir pruebas del agregado en `apps/api/test/unit/accounting/domain/journal-entry.spec.ts` (R-CON-001/002/003/008): rechaza descuadre con `ENTRY_NOT_BALANCED`; rechaza línea con ambos lados, negativa o en cero; exige ≥ 2 líneas; rechaza cuenta acumuladora o inactiva; exige tercero o centro de costo cuando la cuenta lo pide; propiedad `fast-check`: para cualquier lista de líneas válidas, `JournalEntry.post()` tiene éxito **si y solo si** Σ débitos = Σ créditos
- [X] T042 [P] [US1] Escribir pruebas del caso de uso con dobles en memoria en `apps/api/test/unit/accounting/application/post-journal-entry.spec.ts`: orden de validación de `contracts/ports.md` §6; `PERIOD_CLOSED` y `PERIOD_NOT_FOUND`; un fallo **no** consume consecutivo; fecha derivada de `occurredAt` en hora de Colombia ([001-13]); reintento con la misma `Idempotency-Key` devuelve el comprobante y con otro cuerpo da `IDEMPOTENCY_CONFLICT`; `FORBIDDEN` sin permiso
- [X] T043 [P] [US1] Escribir pruebas de integración en `apps/api/test/integration/accounting/posting-constraints.spec.ts` conectadas como `sifca_app` con SQL directo: la base rechaza (a) un comprobante descuadrado al confirmar, (b) una cabecera con menos de 2 líneas, (c) `(debit > 0) <> (credit > 0)` violado, (d) cuenta no auxiliar, (e) cuenta que exige tercero sin tercero, (f) fecha en período cerrado, (g) número duplicado
- [X] T044 [P] [US1] Escribir pruebas de consecutivo en `apps/api/test/integration/accounting/sequence-concurrency.spec.ts`: 1.000 contabilizaciones simultáneas del tipo `AJ` producen exactamente los números 1…1000, sin saltos ni duplicados (SC-003); una transacción que falla no consume número; dos años distintos numeran por separado cuando `numbering_scope = 'YEAR'`
- [X] T045 [P] [US1] Escribir la prueba de atomicidad [001-08] en `apps/api/test/integration/accounting/posting-atomicity.spec.ts`: con una falla inyectada en cada paso (tras la cabecera, tras las líneas, tras el consecutivo, antes del *commit*) no queda ninguna línea ni cabecera y el siguiente consecutivo sigue igual (G-04, INV-15)
- [X] T046 [P] [US1] Escribir pruebas de contrato en `apps/api/test/contract/accounting/journal-entries.post.spec.ts` (supertest): `POST /accounting/journal-entries` cumple `contracts/accounting.v1.openapi.yaml` para `201`, `200` (idempotente), `403`, `409`, `422`; `GET /accounting/journal-entries`, `GET /accounting/journal-entries/{entryId}`, `GET /accounting/accounts` y `GET /accounting/voucher-types`
- [X] T047 [P] [US1] Escribir los *step definitions* de [001-01], [001-02], [001-03], [001-04], [001-05], [001-09], [001-10] y [001-13] en `apps/api/test/acceptance/accounting/steps/posting.steps.ts` (ejecutan el caso de uso contra PostgreSQL real; [001-10] usa `Money.percentOf`); deben quedar rojos hasta implementar

### Implementation for User Story 1

- [X] T048 [P] [US1] Crear los esquemas Zod en `packages/contracts/src/accounting/journal-entry.ts` (`PostJournalEntryRequest`: `lines` `minItems: 2` y `maxItems: 500`, `description` 1–500, `voucherType` `^[A-Z]{1,5}$`, importes con `Money`; `JournalEntry` y `JournalEntrySummary` de respuesta) y exportarlos desde `packages/contracts/src/index.ts`
- [X] T049 [P] [US1] Crear los objetos de valor `apps/api/src/modules/accounting/domain/value-objects/entry-number.ts` (entero ≥ 1) y `apps/api/src/modules/accounting/domain/value-objects/entry-source.ts` (`type` + `id`, obligatorio salvo `MANUAL`) y `apps/api/src/modules/accounting/domain/entities/journal-line.ts` (un solo lado, positivo)
- [X] T050 [US1] Implementar `apps/api/src/modules/accounting/domain/entities/journal-entry.ts`: agregado sin *setters* cuya única fábrica es `JournalEntry.post(...)`; valida ≥ 2 líneas, un lado por línea, cuentas de movimiento activas, tercero/centro de costo y cuadre exacto con `Money`; y `apps/api/src/modules/accounting/domain/events/journal-entry-posted.ts`, hasta que pasen las pruebas de T041
- [X] T051 [P] [US1] Definir `apps/api/src/modules/accounting/application/ports/journal-entry-repository.ts` (`add`, `findById`, `findByIdempotencyKey`, `findReversalOf`; **sin** `update` ni `delete`) y `apps/api/src/modules/accounting/application/ports/voucher-sequence.ts` (`next`, `peek`)
- [X] T052 [US1] Implementar `apps/api/src/modules/accounting/application/use-cases/post-journal-entry.ts` (valida con `PostJournalEntryRequest.parse`, corre dentro de `UnitOfWork.run`, orden de `contracts/ports.md` §6, consecutivo al final, publica `JournalEntryPosted` tras el *commit*), `apps/api/src/modules/accounting/application/use-cases/get-journal-entry.ts` y `apps/api/src/modules/accounting/application/use-cases/list-journal-entries.ts`, hasta que pasen las pruebas de T042
- [X] T053 [P] [US1] Implementar `apps/api/src/modules/accounting/infrastructure/persistence/prisma-voucher-sequence.ts`: `INSERT … ON CONFLICT DO NOTHING` y `UPDATE acc.voucher_sequence SET last_number = last_number + 1 … RETURNING last_number` con `$queryRaw` dentro de la transacción ambiente; `scope_year = 0` si el tipo numera por `TENANT`
- [X] T054 [US1] Implementar `apps/api/src/modules/accounting/infrastructure/persistence/prisma-journal-entry.repository.ts` y `apps/api/src/modules/accounting/infrastructure/persistence/mappers/journal-entry.mapper.ts`: inserta cabecera y líneas (con `tenant_id` y `accounting_date` denormalizados), calcula el *hash* SHA-256 del cuerpo canónico para la idempotencia, y traduce los errores `P0001` de la base (`ENTRY_NOT_BALANCED`, `PERIOD_CLOSED`, `ACCOUNT_NOT_POSTABLE`, `PARTY_REQUIRED`…) al error de dominio equivalente
- [X] T055 [US1] Implementar `apps/api/src/modules/accounting/presentation/http/journal-entries.controller.ts` (`POST`, `GET` lista, `GET` por id; cabecera `Idempotency-Key`; `Location` en `201`), `apps/api/src/modules/accounting/presentation/http/lookups.controller.ts` (`GET /accounting/accounts`, `GET /accounting/voucher-types`) y `apps/api/src/modules/accounting/presentation/http/error-mapping.ts`; enlazar todo en `apps/api/src/modules/accounting/accounting.module.ts` y exponer `PostJournalEntryPort` en `apps/api/src/modules/accounting/index.ts`
- [X] T056 [US1] Ejecutar hasta verde `test:unit`, `test:integration` (incluye T044 y T045), `test:contract` y `test:acceptance` para [001-01]…[001-05], [001-09], [001-10] y [001-13]; correr `node scripts/docs.mjs check --strict`

**Checkpoint**: US1 funciona y se prueba sola: solo se guardan comprobantes válidos, con consecutivo contiguo, o se rechazan sin dejar rastro.

---

## Phase 4: User Story 2 - Corregir sin borrar (Priority: P1)

**Goal**: corregir un error con un contraasiento que referencia al original, sin editar ni borrar nunca un comprobante.

**Independent Test**: intentar editar y borrar un comprobante (debe fallar por API, por privilegios y por *trigger*) y reversarlo (el efecto neto por cuenta es cero). Escenarios [001-06], [001-07], [001-08]; FR-005, FR-014; SC-002.

### Tests for User Story 2 ⚠️

> **NOTA: escribir estas pruebas PRIMERO y comprobar que FALLAN antes de implementar.**

- [X] T057 [P] [US2] Escribir pruebas de `ReversalFactory` en `apps/api/test/unit/accounting/domain/reversal-factory.spec.ts`: invierte cada línea (mismo tercero, centro de costo, referencia y vencimiento), referencia al original, `source_type = 'REVERSAL'`; propiedad `fast-check`: la suma por cuenta de original + reversión es 0 (R-CON-005)
- [X] T058 [P] [US2] Escribir pruebas de `ReverseJournalEntry` en `apps/api/test/unit/accounting/application/reverse-journal-entry.spec.ts`: `ALREADY_REVERSED` al reversar dos veces; reversar una reversión es válido; `reason` obligatorio (mínimo 5 caracteres); fecha por defecto = hoy en hora de Colombia; `PERIOD_CLOSED` si cae en período cerrado; `NOT_FOUND`; `FORBIDDEN` sin `accounting.entry.reverse`
- [X] T059 [P] [US2] Escribir pruebas de inmutabilidad en `apps/api/test/integration/accounting/immutability.spec.ts` ([001-06], SC-002): con `sifca_app`, `UPDATE`, `DELETE` y `TRUNCATE` sobre `acc.journal_entry` y `acc.journal_line` fallan por privilegios; con `sifca_owner` fallan por el *trigger* con `IMMUTABLE_RECORD`; el índice único parcial sobre `reversal_of` impide una segunda reversión incluso con SQL directo
- [X] T060 [P] [US2] Escribir pruebas de contrato en `apps/api/test/contract/accounting/journal-entries.reversal.spec.ts`: `PUT`, `PATCH` y `DELETE` sobre `/accounting/journal-entries/{entryId}` devuelven `405` con `code = ENTRY_IMMUTABLE`; `POST …/reversal` cumple `201`, `404`, `409`, `422`, `403`
- [X] T061 [P] [US2] Escribir los *step definitions* de [001-06], [001-07] y [001-08] en `apps/api/test/acceptance/accounting/steps/immutability.steps.ts`; [001-08] reutiliza la inyección de fallas de T045
- [X] T062 [P] [US2] Escribir la prueba de arquitectura `apps/api/test/architecture/immutable-ports.spec.ts` que falla si algún puerto o repositorio de `apps/api/src/modules/accounting/application/ports/` expone un método `update*`, `delete*`, `remove*` o `save*` sobre `JournalEntry`/`JournalLine` (G-06)

### Implementation for User Story 2

- [X] T063 [P] [US2] Implementar `apps/api/src/modules/accounting/domain/services/reversal-factory.ts` hasta que pasen las pruebas de T057
- [X] T064 [US2] Implementar `apps/api/src/modules/accounting/application/use-cases/reverse-journal-entry.ts` (mismo `UnitOfWork`, mismo orden de validación, consecutivo del tipo del original, evento `accounting.journal_entry.reversed.v1`) y exponer `ReverseJournalEntryPort` en `apps/api/src/modules/accounting/index.ts`; `reversedBy` se **calcula** con `findReversalOf`, no se guarda
- [X] T065 [P] [US2] Crear los esquemas Zod `ReverseJournalEntryRequest` en `packages/contracts/src/accounting/journal-entry.ts` y el evento `JournalEntryReversed` en `packages/contracts/src/accounting/events.ts`
- [X] T066 [US2] Añadir a `apps/api/src/modules/accounting/presentation/http/journal-entries.controller.ts` la ruta `POST /accounting/journal-entries/:entryId/reversal` y los manejadores `PUT`, `PATCH` y `DELETE` que lanzan `EntryImmutable` (405); completar el mapeo en `apps/api/src/modules/accounting/presentation/http/error-mapping.ts`
- [X] T067 [US2] Ejecutar hasta verde las pruebas de las tareas T057–T062 y los escenarios [001-06], [001-07], [001-08]; correr `node scripts/docs.mjs check --strict`

**Checkpoint**: US1 y US2 funcionan; ningún camino (API, aplicación o acceso directo con el usuario de la aplicación) permite mutar un comprobante.

---

## Phase 5: User Story 3 - Períodos y balance de prueba (Priority: P2)

**Goal**: cerrar períodos con control, reabrirlos de forma auditada y producir diario, mayor y balance de prueba.

**Independent Test**: con el conjunto de referencia, el balance de prueba da 2.152.000 en débito y en crédito, y el cierre de mes bloquea nuevas contabilizaciones. Escenarios [001-11], [001-12] y los nuevos [001-14], [001-15], [001-16]; FR-004, FR-010, FR-011, FR-012; SC-004.

### Tests for User Story 3 ⚠️

> **NOTA: escribir estas pruebas PRIMERO y comprobar que FALLAN antes de implementar.**

- [X] T068 [US3] Ampliar `docs/specs/001-contabilidad-comprobantes-inmutables/acceptance/comprobantes.feature` con escenarios etiquetados que hoy no existen: [001-14] reabrir un período exige permiso y motivo y queda en la bitácora (`@R-CON-004`); [001-15] el cierre anual cancela las cuentas de resultado con un comprobante reversible (`@R-CON-012`); [001-16] el balance de prueba y el diario son reproducibles: mismos datos y rango ⇒ mismo resultado (`@R-CON-010`); luego `node scripts/docs.mjs matrix` y `check --strict`
- [X] T069 [P] [US3] Escribir pruebas de `TrialBalanceCalculator` en `apps/api/test/unit/accounting/domain/trial-balance-calculator.spec.ts`: saldo inicial, movimiento y final; saldo en la columna donde queda positivo; `contraNature` si es contrario a la naturaleza (R-CON-013); acumulación por `level` (1, 2, 4, 6, 8); propiedad `fast-check`: para cualquier conjunto de comprobantes cuadrados, Σ `closingDebit` = Σ `closingCredit`
- [X] T070 [P] [US3] Escribir pruebas de `PeriodClosePolicy` y de los casos de uso `CreateFiscalYear`, `ClosePeriod`, `ReopenPeriod`, `CloseFiscalYear` y borradores en `apps/api/test/unit/accounting/application/periods.spec.ts` y `drafts.spec.ts`: no cierra con borradores o balance descuadrado (`PERIOD_CLOSE_BLOCKED` con las causas en `errors[]`); reabrir exige `accounting.period.reopen` y `reason`; ambas acciones llaman a `AuditLog.record`; el cierre anual genera un comprobante normal reversible; el borrador admite descuadre, no consume consecutivo y su descarte es la única eliminación permitida
- [X] T071 [P] [US3] Escribir la prueba de carrera en `apps/api/test/integration/accounting/period-close-race.spec.ts`: un `ClosePeriod` concurrente con 50 `PostJournalEntry` en el mismo mes nunca deja un comprobante en un período `CLOSED` y los que llegan después reciben `PERIOD_CLOSED` (bloqueo `FOR SHARE` / `FOR UPDATE`)
- [X] T072 [P] [US3] Escribir la prueba del libro de referencia en `apps/api/test/integration/accounting/reports.spec.ts`: contabiliza (por el caso de uso) los comprobantes de venta, nota crédito y recibo de `docs/02-normativa-y-reglas/01-contabilidad-partida-doble-y-puc.md` y verifica el balance de [001-11] (1110 débito 952000; 1435 débito 520000; 2408 crédito 152000; 3115 crédito 1000000; 4135 crédito 1000000; 4175 débito 200000; 6135 débito 480000; totales 2152000 / 2152000); dos ejecuciones sucesivas dan el mismo SHA-256 (R-CON-010); libro mayor con saldo acumulado y diario cronológico paginado por cursor
- [X] T073 [P] [US3] Escribir pruebas de contrato en `apps/api/test/contract/accounting/periods-reports-drafts.spec.ts`: `/accounting/fiscal-years`, `/accounting/fiscal-years/{year}/closing`, `/accounting/periods`, `…/close`, `…/reopen`, `/accounting/journal-drafts` (+ `{draftId}`) y `/accounting/reports/{journal,general-ledger,trial-balance}` cumplen `contracts/accounting.v1.openapi.yaml`
- [X] T074 [P] [US3] Escribir los *step definitions* de [001-11], [001-12], [001-14], [001-15] y [001-16] en `apps/api/test/acceptance/accounting/steps/periods.steps.ts` y `reports.steps.ts`

### Implementation for User Story 3

- [X] T075 [P] [US3] Crear los esquemas Zod en `packages/contracts/src/accounting/period.ts` (`CreateFiscalYearRequest`, `ReopenPeriodRequest` con `reason` 5–500, `CloseFiscalYearRequest`, `FiscalPeriod`), `packages/contracts/src/accounting/reports.ts` (`TrialBalanceQuery`, `TrialBalance`, `GeneralLedger`, `JournalBookRow`), `packages/contracts/src/accounting/draft.ts` (`SaveJournalDraftRequest`, `JournalDraft`) y los eventos `PeriodClosed`/`PeriodReopened` en `packages/contracts/src/accounting/events.ts`
- [X] T076 [P] [US3] Implementar `apps/api/src/modules/accounting/domain/services/trial-balance-calculator.ts` hasta que pasen las pruebas de T069
- [X] T077 [P] [US3] Implementar `apps/api/src/modules/accounting/domain/services/period-close-policy.ts`, las transiciones `close()`/`reopen()` en `apps/api/src/modules/accounting/domain/entities/fiscal-period.ts`, `apps/api/src/modules/accounting/domain/entities/journal-draft.ts` y `apps/api/src/modules/accounting/domain/events/period-closed.ts`
- [X] T078 [US3] Definir los puertos `apps/api/src/modules/accounting/application/ports/trial-balance-reader.ts`, `ledger-reader.ts`, `journal-draft-repository.ts`, `audit-log.ts` y `period-close-check.ts`, e implementar las comprobaciones `BalancedTrialBalanceCheck` y `NoDraftsCheck` en `apps/api/src/modules/accounting/application/period-checks/`
- [X] T079 [US3] Implementar los casos de uso `apps/api/src/modules/accounting/application/use-cases/create-fiscal-year.ts` (12 períodos `OPEN`), `close-period.ts` (toma `FOR UPDATE` del período, ejecuta los `PeriodCloseCheck`, escribe en la bitácora), `reopen-period.ts` (permiso, `reason`, bitácora) y `close-fiscal-year.ts` (comprobante `YEAR_CLOSING` por el mismo camino de `PostJournalEntry`)
- [X] T080 [P] [US3] Implementar los casos de uso `apps/api/src/modules/accounting/application/use-cases/get-trial-balance.ts`, `get-journal-book.ts` y `get-general-ledger.ts`, y los de borradores `save-journal-draft.ts`, `discard-journal-draft.ts` y `list-journal-drafts.ts`
- [X] T081 [US3] Ampliar `apps/api/src/modules/accounting/infrastructure/persistence/prisma-fiscal-period.repository.ts` con `findById(id, 'update')` (`SELECT … FOR UPDATE`), `addAll` y `save` (solo cierre/apertura, con `version`); implementar `apps/api/src/modules/accounting/infrastructure/persistence/prisma-journal-draft.repository.ts` con bloqueo optimista por `version`
- [X] T082 [P] [US3] Implementar `apps/api/src/modules/accounting/infrastructure/persistence/prisma-trial-balance.reader.ts` (agregación por `account_id` con saldo inicial `< from`, movimiento en `[from, to]` y saldo final; `$queryRaw` con importes `::text`; `ORDER BY` por código para reproducibilidad) y `apps/api/src/modules/accounting/infrastructure/persistence/prisma-ledger.reader.ts` (diario y mayor con paginación por cursor sobre `(accounting_date, voucher_type, number, line_no)` y saldo acumulado por ventana SQL)
- [X] T083 [US3] Implementar `apps/api/src/modules/accounting/presentation/http/periods.controller.ts` (`fiscal-years`, `closing`, `periods`, `close`, `reopen`), `apps/api/src/modules/accounting/presentation/http/journal-drafts.controller.ts` y `apps/api/src/modules/accounting/presentation/http/reports.controller.ts`; enlazar en `apps/api/src/modules/accounting/accounting.module.ts`
- [X] T084 [US3] Ejecutar hasta verde las pruebas de las tareas T069–T074 y los escenarios [001-11], [001-12], [001-14], [001-15], [001-16]; correr `node scripts/docs.mjs check --strict`

**Checkpoint**: las tres historias funcionan de forma independiente; el balance de referencia da 2.152.000 / 2.152.000.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre del feature: rendimiento, arquitectura, documentación derivada y validación contable.

- [ ] T085 [P] Escribir y ejecutar la prueba de carga `apps/api/test/performance/accounting.perf.ts` (`test:perf`): 1.000 contabilizaciones simultáneas del mismo tipo en ≤ 60 s sin saltos ni duplicados (SC-003); comprobante de ≤ 50 líneas con p95 ≤ 200 ms; balance de un mes con 1.000.000 de líneas con p95 ≤ 3 s; ajustar `TX_MAX_WAIT_MS` y `TX_TIMEOUT_MS` y registrar los resultados en `docs/specs/001-contabilidad-comprobantes-inmutables/research.md` §5 y §15
- [ ] T086 [P] Completar las pruebas de arquitectura en `apps/api/test/architecture/`: `no-money-number.spec.ts` (ningún `number` en campos monetarios de `apps/api/src/modules/accounting/domain/`, G-09), `no-prisma-outside-infra.spec.ts` (G-03), `no-framework-in-domain.spec.ts` (G-01, incluye `Date.now()`), `no-cycles.spec.ts` y `module-facade-only.spec.ts` (D-5)
- [ ] T087 [P] Escribir `apps/api/test/contract/accounting/openapi-parity.spec.ts`: el OpenAPI generado por `@nestjs/swagger` coincide en rutas, métodos, códigos de estado y esquemas con `docs/specs/001-contabilidad-comprobantes-inmutables/contracts/accounting.v1.openapi.yaml`; añadirla a `.github/workflows/ci.yml` y validar el contrato con `openapi-spec-validator`
- [ ] T088 [P] Crear `scripts/check-rules-verified.mjs` que lee `docs/02-normativa-y-reglas/README.md` y las reglas citadas por las specs, y sale con error si alguna regla usada sigue 🔶/⚠️; cablearlo en el *job* de *release* de producción de `.github/workflows/ci.yml` (no bloquea el desarrollo; G-10)
- [ ] T089 [P] Actualizar `docs/01-arquitectura/02-modelo-de-datos-preliminar.md`: quitar `reversed_by` de `JOURNAL_ENTRY`, reescribir **INV-05** (sin excepción de `reversed_by`), añadir `numbering_year`, `reversal_reason`, `idempotency_key`, `request_hash`, `accounting_date` en `JOURNAL_LINE`, las entidades `COST_CENTER` y `JOURNAL_DRAFT`, ajustar **INV-06** (`numbering_year`) y sustituir en §4 «`SERIALIZABLE` solo para cierre» por el bloqueo `FOR SHARE`/`FOR UPDATE` del período; validar los diagramas Mermaid modificados
- [ ] T090 [P] Actualizar `docs/01-arquitectura/01-vision-general-y-modulos.md` §5 con la carpeta `apps/api/src/platform/` (adaptadores transversales del *composition root*) y `docs/specs/README.md` con las dependencias pendientes: **spec 012 — Identidad, roles y permisos (IAM)**, *outbox* (spec 011) y «contabilizar desde un borrador»
- [ ] T091 [P] Revisión de seguridad: confirmar que `sifca_app` no es propietario ni `BYPASSRLS`, que ningún *log* imprime importes con terceros ni el JWT, y que `PermissionChecker` provisional no se activa con `NODE_ENV=production` (arranque falla hasta que exista la spec de IAM)
- [ ] T092 Entregar al contador la hoja de validación de R-CON-001…009 y R-CON-013 (con las ambigüedades de `research.md` §14: fecha de la reversión; y la elección de cuentas de cierre anual) y, cuando las marque ✅, actualizar `docs/02-normativa-y-reglas/README.md` y la sección «Verificación de constitución» de `spec.md` (G-10)
- [ ] T093 [P] Repetir el diagnóstico de 7 preguntas de la skill `clean-architecture` sobre el código real, registrar la puntuación en `docs/01-arquitectura/01-vision-general-y-modulos.md` y confirmar que se mantiene en la banda 9–10
- [ ] T094 Ejecutar de principio a fin `docs/specs/001-contabilidad-comprobantes-inmutables/quickstart.md` en un entorno limpio y corregir las discrepancias entre el documento y el comportamiento real

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sin dependencias; T010 (S-PRISMA-1) **decide** si se usan esquemas `acc`/`audit` o el plan B con prefijo y debe cerrarse antes de T023.
- **Foundational (Fase 2)**: depende de Setup y **bloquea** todas las historias.
- **User Stories (Fase 3+)**: dependen de Foundational. US1 y US2 son P1; US3 es P2.
- **Polish (Fase 6)**: depende de las historias que se quieran entregar; T092 (validación del contador) bloquea solo el despliegue a producción.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational; no depende de otra historia. **Es el MVP.**
- **US2 (P1)**: arranca tras Foundational. Para probarse necesita comprobantes contabilizados: usa el caso de uso de US1 (o su fábrica de pruebas), así que en la práctica se implementa después de T052; sigue siendo verificable por sí sola.
- **US3 (P2)**: arranca tras Foundational. El balance usa comprobantes de US1 en las pruebas; el cierre anual usa T052.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Esquemas Zod y dominio antes que casos de uso; casos de uso antes que repositorios y controladores.
- Dominio → aplicación → infraestructura → presentación (la regla de dependencia apunta hacia adentro).
- Una historia termina (su tarea de verificación `v*`) antes de pasar a la siguiente prioridad.

### Dependencias puntuales entre tareas

| Tarea | Depende de |
|---|---|
| T014 | T012 (pruebas primero) |
| T017 | T014, T015, T016 |
| T020 | T008, T005 |
| T023 | T010, T008, T021 |
| T024 → T025 → T026 | T023 (misma migración, en este orden) |
| T027 | T026 |
| T029 | T028, T027, T017 |
| T036 | T035, T029 |
| T038 | T017, T032, T036 |
| T050 | T041, T014, T049, T035 |
| T052 | T042, T048, T050, T051 |
| T054 | T051, T029 |
| T055 | T052, T054, T053, T032 |
| T064 | T058, T063, T052 |
| T066 | T064, T055 |
| T079 | T070, T077, T078, T033 |
| T083 | T079, T080, T081, T082 |

### Parallel Opportunities

- Setup: T002, T004, T005, T006, T007, T008, T009 y T011 son archivos distintos.
- Foundational: las pruebas del núcleo (T012, T013, T022, T031, T034) y las implementaciones T015, T016, T018, T019, T030, T033, T037, T040.
- Cada historia: todas sus pruebas `[P]`, los esquemas Zod y los objetos de dominio de archivos distintos.
- Con equipo: tras Foundational, US1 y US3 (esquemas, dominio y pruebas) pueden avanzar en paralelo; US2 espera a T052.

---

## Parallel Example: User Story 1

```text
# Todas las pruebas de US1 en paralelo (deben fallar al principio):
Task: T041  pruebas del agregado          → apps/api/test/unit/accounting/domain/journal-entry.spec.ts
Task: T042  pruebas del caso de uso       → apps/api/test/unit/accounting/application/post-journal-entry.spec.ts
Task: T043  restricciones en la base         → apps/api/test/integration/accounting/posting-constraints.spec.ts
Task: T044  1.000 consecutivos simultáneos  → apps/api/test/integration/accounting/sequence-concurrency.spec.ts
Task: T045  atomicidad [001-08]             → apps/api/test/integration/accounting/posting-atomicity.spec.ts
Task: T046  contrato HTTP                   → apps/api/test/contract/accounting/journal-entries.post.spec.ts
Task: T047  steps de Cucumber               → apps/api/test/acceptance/accounting/steps/posting.steps.ts

# Después, en paralelo (archivos distintos):
Task: T048  esquemas Zod                    → packages/contracts/src/accounting/journal-entry.ts
Task: T049  objetos de valor y línea          → apps/api/src/modules/accounting/domain/
Task: T051  puertos del repositorio           → apps/api/src/modules/accounting/application/ports/
Task: T053  contador de consecutivos          → apps/api/src/modules/accounting/infrastructure/persistence/prisma-voucher-sequence.ts
```

## Parallel Example: User Story 3

```text
Task: T069  Task: T070  Task: T071  Task: T072  Task: T073  Task: T074   # pruebas
Task: T075  Task: T076  Task: T077  Task: T080  Task: T082            # implementación de archivos distintos
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Fase 1 (Setup), incluidos los *spikes* T010 y T011.
2. Fase 2 (Foundational): núcleo, plataforma, migraciones con inmutabilidad y RLS, arnés de pruebas.
3. Fase 3 (US1): contabilizar un comprobante que cuadra.
4. **PARAR y VALIDAR**: probar US1 sola (`quickstart.md` §3, escenarios [001-01]…[001-05], [001-09], [001-10], [001-13]).
5. Mostrar el MVP; *no* se despliega a producción hasta T092.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. + US1 → MVP (comprobantes que cuadran con consecutivo).
3. + US2 → inmutabilidad y corrección por reversión (completa el principio I).
4. + US3 → períodos, libros y balance de prueba.
5. Polish → rendimiento, arquitectura, documentación y validación del contador.

### Estrategia con varios desarrolladores

1. El equipo completa Setup y Foundational junto (la fase de migraciones T023–T026 es secuencial).
2. Después: A → US1; B → US3 (esquemas, dominio, pruebas); C → arnés de pruebas y Polish; US2 entra cuando exista T052.

## Notes

- `[P]` = archivos distintos y sin dependencias entre sí.
- La etiqueta `[Story]` traza cada tarea con su historia.
- Verificar que las pruebas **fallan** antes de implementar; confirmar en cada *checkpoint*.
- Una tarea (o grupo lógico) por *commit*; los mensajes citan el identificador `T###`.
- Evitar tareas vagas, conflictos en el mismo archivo y dependencias entre historias que rompan su independencia.
- Las migraciones T023–T026 son SQL escrito a mano y se revisan como código (ADR-0004).
- Este plan cubre **solo la spec 001**; las specs 002–011 siguen el mismo método (`/speckit-plan` → `/speckit-tasks`) y heredan Setup y Foundational.
