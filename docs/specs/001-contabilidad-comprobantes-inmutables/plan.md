# Implementation Plan: Contabilidad con comprobantes inmutables

**Branch**: `001-contabilidad-comprobantes-inmutables` | **Date**: 2026-10-14 | **Spec**: [`spec.md`](spec.md)

**Input**: Feature specification from `docs/specs/001-contabilidad-comprobantes-inmutables/spec.md`

**Note**: Este plan lo genera `/speckit-plan`. Las decisiones y sus alternativas están en [`research.md`](research.md);
el modelo de datos en [`data-model.md`](data-model.md); el contrato HTTP en
[`contracts/accounting.v1.openapi.yaml`](contracts/accounting.v1.openapi.yaml); cómo probarlo en
[`quickstart.md`](quickstart.md).

## Summary

El contador registra comprobantes de partida doble que cuadran, se corrigen **solo** con reversiones, solo
se contabilizan en períodos abiertos y producen diario, mayor y balance de prueba (spec 001: US1 y US2 en P1,
US3 en P2; FR-001…FR-014).

Enfoque técnico, en una línea por capa:

- **Domain** (TypeScript puro): el agregado `JournalEntry` solo se construye válido (cuadre, un lado por
  línea, mínimo dos líneas, importes en decimal exacto); `ReversalFactory`, `TrialBalanceCalculator` y la
  política de cierre son servicios de dominio sin framework (G-01, G-09).
- **Application**: un caso de uso por operación (`PostJournalEntry`, `ReverseJournalEntry`,
  `ClosePeriod`, `ReopenPeriod`, `GetTrialBalance`…), cada uno valida su entrada con un esquema Zod de
  `packages/contracts` y corre dentro de `UnitOfWork.run` (G-04, G-08).
- **Infrastructure**: Prisma 7 sobre PostgreSQL con migraciones SQL escritas a mano que imponen **tres
  niveles de inmutabilidad** (dominio, privilegios del rol de la aplicación, *triggers*), RLS forzada por
  `tenant_id` y un *constraint trigger* diferido que valida el cuadre aunque falle el código (G-06, G-07).
- **Presentation**: controladores NestJS delgados; `PUT/PATCH/DELETE` sobre un comprobante responden `405`
  con `code = ENTRY_IMMUTABLE` y los errores salen como `application/problem+json`.
- **Consecutivo sin saltos**: contador por tipo y año actualizado con `UPDATE … RETURNING` en la misma
  transacción que contabiliza; si algo falla se revierte también el número (R-CON-006, SC-003).

Como es la primera spec de la Fase 2, este plan también **arranca el monorepo** (pnpm + Turborepo,
`apps/api`, `packages/contracts`, `packages/config`, `shared-kernel` y la plataforma de persistencia). Esa
base la heredan las specs 002–011; se separa en la fase *Foundational* de `tasks.md`.

## Technical Context

**Language/Version**: TypeScript 5.9.x (estricto: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) sobre Node.js ≥ 22.18 LTS

**Primary Dependencies**: NestJS 12.1.x (solo `presentation/` y `*.module.ts`); Prisma 7.10.x con `@prisma/adapter-pg` (solo `infrastructure/persistence`); Zod 4.6.x (`packages/contracts`, validación en `application/`); decimal.js 10.6.x (detrás de `Money`/`Decimal` de `shared-kernel`); `@nestjs/swagger` para el OpenAPI generado; `pino` para registro; `dependency-cruiser` para reglas D-1…D-7

**Storage**: PostgreSQL 16+ con esquemas `acc` y `audit`; RLS forzada; tres roles (`sifca_owner`, `sifca_app`, `sifca_readonly`); importes `NUMERIC(18,2)`; fechas contables `DATE`; instantes `TIMESTAMPTZ`

**Testing**: Vitest (dominio y aplicación con dobles en memoria); `fast-check` (propiedades de R-CON-001/002/009); Testcontainers PostgreSQL (triggers, privilegios, RLS, concurrencia, atomicidad); `@cucumber/cucumber` con `# language: es` ejecutando **los mismos `.feature` de `acceptance/`**; `supertest` (HTTP y contrato); `dependency-cruiser` (arquitectura); `openapi-spec-validator` (contrato)

**Target Platform**: Servidor Linux en contenedor (API NestJS); PostgreSQL gestionado o contenedor

**Project Type**: Servicio web (API de un monolito modular; módulo `accounting`) dentro de un monorepo

**Performance Goals** *(objetivos de diseño 🔶, se validan con la prueba de carga T085 de `tasks.md`)*: contabilizar un comprobante de ≤ 50 líneas p95 ≤ 200 ms en el servidor; 1.000 contabilizaciones simultáneas del mismo tipo terminan sin saltos ni duplicados (SC-003) en ≤ 60 s; balance de prueba de un mes con 1.000.000 de líneas p95 ≤ 3 s

**Constraints**: ningún `number` en cálculos monetarios; el dominio no importa NestJS/Prisma/Zod ni usa `Date.now()`; transacción interactiva corta y con `timeout`, `maxWait` e `isolationLevel` explícitos, sin llamadas de red dentro; ninguna regla 🔶/⚠️ llega a producción sin ✅ del contador (G-10); tablas de comprobantes inmutables por dominio, privilegios y *triggers*

**Scale/Scope**: MVP = una empresa por *tenant* (S-01); hasta ~10⁷ líneas contables por *tenant* antes de considerar particionamiento; 12 períodos por año; 3 historias de usuario, 14 requisitos, 13 escenarios, ~13 endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Fuente: [`docs/constitution.md`](../../constitution.md) v1.0.0 (gates G-01…G-12).

| Gate | Pregunta | Evaluación **antes** de la investigación | Evaluación **después** del diseño (Fase 1) |
|---|---|---|---|
| G-01 | ¿Dominio con imports de framework o `Date.now()`? | ✅ Diseño: `domain/` solo recibe `LocalDate`, `Instant` y `Money` como valores; el reloj es el puerto `Clock` | ✅ Confirmado: `ReversalFactory` y `TrialBalanceCalculator` reciben fechas ya resueltas; regla `no-framework-in-domain` de `dependency-cruiser` (T007, T086) |
| G-02 | ¿Puertos en domain/application e implementaciones en infrastructure? | ✅ `JournalEntryRepository`, `FiscalPeriodRepository`, `VoucherSequence`, `TrialBalanceReader`, `AuditLog`, `PermissionChecker` definidos por `application/` | ✅ Lista final en [`contracts/ports.md`](contracts/ports.md) |
| G-03 | ¿Tipos de Prisma fuera de `infrastructure/`? | ✅ Prisma solo en `infrastructure/persistence` y `platform/persistence` | ✅ Mappers fila↔dominio; regla D-4 en CI |
| G-04 | ¿Evento en una sola transacción (consecutivo + líneas + auditoría)? | ✅ `PostJournalEntry` corre en `UnitOfWork.run`; `UnitOfWork` es reentrante para que los módulos comerciales (specs 002+) contabilicen **dentro de su propia transacción** | ✅ Prueba de atomicidad con falla inyectada en cada paso ([001-08]) |
| G-05 | ¿Efectos externos dentro de la transacción? | ✅ Ninguno; el evento `JournalEntryPosted` va a la tabla *outbox* (prevista en spec 011) y se publica después del *commit* | ⚠️ **Dependencia**: el *outbox* aún no existe. Este feature publica el evento por un puerto `DomainEventPublisher` con adaptador en memoria; se cambia a *outbox* en la spec 011. Sin efectos externos hoy ⇒ no hay violación |
| G-06 | ¿`UPDATE`/`DELETE` sobre tablas inmutables? | ✅ Ninguna operación; la corrección es reversión | ✅ `REVOKE UPDATE, DELETE, TRUNCATE` al rol de la aplicación + *triggers* `BEFORE UPDATE OR DELETE` y `BEFORE TRUNCATE`; pruebas con el rol de la aplicación |
| G-07 | ¿Tablas nuevas con `tenant_id`, RLS y prueba de aislamiento? | ✅ Todas las tablas de `acc` llevan `tenant_id` | ✅ `ENABLE` + `FORCE ROW LEVEL SECURITY` y política `tenant_id = current_setting('app.tenant_id')::uuid`; prueba con dos *tenants* |
| G-08 | ¿Entradas validadas con Zod de `packages/contracts`? | ✅ | ✅ Esquemas en `packages/contracts/src/accounting/`; `execute()` hace `schema.parse` |
| G-09 | ¿`number` en cálculos monetarios? | ✅ | ✅ `Money` sobre `decimal.js`; API con cadenas decimales; regla de lint que prohíbe `number` en campos monetarios del dominio; `Prisma.Decimal` se convierte en el mapper |
| G-10 | ¿Reglas ✅ o marcadas como provisionales? | ⚠️ R-CON-001…009 y 013 son 🔶 | ⚠️ **Provisional declarado**: la implementación puede construirse y probarse, pero **no se despliega a producción** hasta que el contador marque ✅ las reglas del registro (tarea de cierre T092). Un *script* de CI (`scripts/check-rules-verified.mjs`, T088) falla el *release* de producción mientras alguna regla citada por la spec siga 🔶/⚠️ en el registro |
| G-11 | ¿Escenarios etiquetados y matriz al día? | ✅ 13 escenarios `[001-01]…[001-13]` | ✅ `node scripts/docs.mjs check --strict` en CI; cada tarea de prueba cita su escenario |
| G-12 | ¿Acoplamiento del núcleo con un sistema externo? | ✅ Ninguno | ✅ Ninguno: no hay clientes externos en este feature |

**Resultado**: sin violaciones. Dos puntos quedan **abiertos y rastreados** (no son violaciones): G-05 (outbox, spec 011)
y G-10 (validación del contador). Ver *Complexity Tracking*.

### Diagnóstico de Clean Architecture (skill `clean-architecture`) para este feature

| # | Pregunta | Cómo la cubre este plan |
|---|---|---|
| 1 | ¿Reglas de negocio probables sin BD/web/framework? | Pruebas unitarias del dominio y de los casos de uso con repositorios en memoria |
| 2 | ¿Dependencias hacia adentro? | `dependency-cruiser` D-1…D-3 |
| 3 | ¿Cambiar la BD sin tocar la lógica? | Repositorios y `TrialBalanceReader` como puertos; SQL explícito solo en `infrastructure/persistence` |
| 4 | ¿Casos de uso independientes de la entrega? | `execute(input)` valida con Zod; el controlador solo traduce |
| 5 | ¿Framework confinado al círculo exterior? | NestJS solo en `presentation/` y `accounting.module.ts` |
| 6 | ¿Sin ciclos entre componentes? | `accounting` no depende de ningún otro módulo; los demás lo consumen por `index.ts` (puerto `PostJournalEntryPort`) |
| 7 | ¿*Composition root* único? | `accounting.module.ts` enlaza puertos↔adaptadores |

## Project Structure

### Documentation (this feature)

```text
docs/specs/001-contabilidad-comprobantes-inmutables/
├── plan.md                              # Este archivo (/speckit-plan)
├── research.md                          # Fase 0: decisiones, alternativas, preguntas resueltas
├── data-model.md                        # Fase 1: tablas, restricciones, roles, RLS, triggers
├── quickstart.md                        # Fase 1: cómo levantar y probar el feature
├── contracts/
│   ├── accounting.v1.openapi.yaml       # Fase 1: contrato HTTP del módulo
│   └── ports.md                         # Fase 1: puertos y eventos del módulo
├── acceptance/
│   └── comprobantes.feature             # Escenarios ejecutables (ya existe)
└── tasks.md                             # Fase 2: /speckit-tasks (no lo crea /speckit-plan)
```

### Source Code (repository root)

```text
apps/api/
├── package.json · tsconfig.json · tsconfig.build.json · nest-cli.json
├── vitest.config.ts · cucumber.mjs · .dependency-cruiser.cjs
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma                                   # modelos de acc y audit
│   └── migrations/
│       ├── 20261014000100_platform_roles_audit/migration.sql   # roles, esquema audit, audit_log, reject_mutation()
│       └── 20261014000200_accounting_core/migration.sql        # tablas acc.*, CHECK, RLS, REVOKE, triggers, índices
├── src/
│   ├── main.ts · app.module.ts
│   ├── shared-kernel/                                  # TypeScript puro, sin framework
│   │   ├── decimal.ts · money.ts · percentage.ts · local-date.ts · instant.ts
│   │   ├── result.ts · ids.ts · domain-error.ts
│   │   └── ports/ (unit-of-work.ts · clock.ts · request-context.ts · permission-checker.ts)
│   ├── platform/                                       # adaptadores transversales (composition root)
│   │   ├── config/ (env.schema.ts)
│   │   ├── persistence/ (prisma.service.ts · prisma-unit-of-work.ts · tenant-context.ts · sql.ts)
│   │   ├── http/ (problem-details.filter.ts · idempotency.interceptor.ts · request-context.middleware.ts)
│   │   ├── time/ (system-clock.ts · system-id-generator.ts)
│   │   └── audit/ (prisma-audit-log.ts)
│   └── modules/accounting/
│       ├── domain/
│       │   ├── entities/ (journal-entry.ts · journal-line.ts · account.ts · fiscal-period.ts · voucher-type.ts · journal-draft.ts)
│       │   ├── value-objects/ (entry-number.ts · account-code.ts · entry-source.ts · period-key.ts)
│       │   ├── services/ (reversal-factory.ts · trial-balance-calculator.ts · period-close-policy.ts)
│       │   ├── errors/ (accounting-errors.ts)
│       │   └── events/ (journal-entry-posted.ts · period-closed.ts)
│       ├── application/
│       │   ├── use-cases/ (post-journal-entry.ts · reverse-journal-entry.ts · get-journal-entry.ts · list-journal-entries.ts
│       │   │              · save-journal-draft.ts · discard-journal-draft.ts · list-journal-drafts.ts
│       │   │              · create-fiscal-year.ts · close-period.ts · reopen-period.ts
│       │   │              · get-journal-book.ts · get-general-ledger.ts · get-trial-balance.ts)
│       │   ├── ports/ (journal-entry-repository.ts · journal-draft-repository.ts · account-repository.ts · fiscal-period-repository.ts
│       │   │          · voucher-sequence.ts · trial-balance-reader.ts · ledger-reader.ts · audit-log.ts
│       │   │          · voucher-type-repository.ts · period-close-check.ts)
│       │   ├── period-checks/ (balanced-trial-balance-check.ts · no-drafts-check.ts)
│       │   └── schemas/ (re-exporta y compone esquemas de packages/contracts)
│       ├── infrastructure/
│       │   └── persistence/ (prisma-journal-entry.repository.ts · prisma-journal-draft.repository.ts · prisma-account.repository.ts · prisma-voucher-type.repository.ts
│       │                    · prisma-fiscal-period.repository.ts · prisma-voucher-sequence.ts
│       │                    · prisma-trial-balance.reader.ts · prisma-ledger.reader.ts · mappers/)
│       ├── presentation/
│       │   └── http/ (journal-entries.controller.ts · lookups.controller.ts · journal-drafts.controller.ts · periods.controller.ts · reports.controller.ts · error-mapping.ts)
│       ├── accounting.module.ts                        # composition root del módulo
│       └── index.ts                                    # API pública: PostJournalEntryPort + tipos
└── test/
    ├── unit/accounting/ (dominio y casos de uso con dobles en memoria)
    ├── integration/accounting/ (Testcontainers: triggers, privilegios, RLS, concurrencia, atomicidad)
    ├── acceptance/accounting/ (steps/ · support/ · world.ts)   # Cucumber sobre ../../docs/specs/001-…/acceptance/*.feature
    ├── contract/accounting/ (supertest + validación contra contracts/accounting.v1.openapi.yaml)
    ├── architecture/ (reglas D-1…D-7 y ciclos)
    ├── performance/ (carga de contabilización y balance)
    └── fixtures/ (plan-de-cuentas-de-prueba.ts · libro-de-referencia.ts)

packages/
├── contracts/                                          # ESQUEMAS ZOD (fuente de verdad)
│   ├── package.json · tsconfig.json
│   └── src/ (index.ts · common/ (decimal.ts · problem.ts · page.ts) · accounting/ (journal-entry.ts · period.ts · reports.ts · events.ts))
└── config/                                             # tsconfig base, ESLint, Prettier, reglas de dependencia compartidas
    └── (tsconfig.base.json · eslint.config.mjs · dependency-cruiser.base.cjs)

infra/docker-compose.dev.yml                            # PostgreSQL de desarrollo con los tres roles
pnpm-workspace.yaml · turbo.json · package.json · .nvmrc · .github/workflows/ci.yml
```

**Structure Decision**: aplicación web de tipo *monolito modular* en monorepo (ADR-0001). Este feature crea el
módulo `apps/api/src/modules/accounting` con las cuatro capas, el `shared-kernel` y la carpeta `platform/`
(adaptadores transversales que implementan los puertos de `shared-kernel`: Prisma `UnitOfWork`, reloj, filtro
de errores); `platform/` es parte del *composition root* (D-7). Los esquemas Zod viven en `packages/contracts`
y los `.feature` se **ejecutan desde `docs/`** (no se copian) para que la spec sea la única fuente.
`apps/admin`, `apps/storefront` y `apps/mobile` no se tocan en este feature.

## Complexity Tracking

> No hay violaciones de la constitución que justificar. Se dejan trazadas las **complejidades aceptadas** y los
> **puntos abiertos** para que no pasen inadvertidos.

| Elemento | Por qué es necesario | Alternativa más simple descartada porque |
|---|---|---|
| SQL escrito a mano en las migraciones (RLS, `REVOKE`, *triggers*, índices parciales) | Prisma no expresa privilegios, RLS ni *triggers*; la inmutabilidad en tres niveles (principio I) lo exige | Confiar solo en el dominio dejaría que cualquier acceso directo a la BD pudiera mutar comprobantes (SC-002) |
| `$queryRaw` en el contador y en los lectores de balance/mayor | `UPDATE … RETURNING` bajo bloqueo y agregaciones por rango no se expresan con la API tipada | El conteo en memoria o `findMany` + suma en JS rompe la atomicidad y la exactitud decimal |
| Denormalizar `tenant_id` y `accounting_date` en `journal_line` | RLS por fila y balance por rango sin *join*; son inmutables, así que no hay riesgo de desincronización; una FK compuesta garantiza la coherencia | *Join* a la cabecera en cada consulta de mayor degrada el rendimiento a escala |
| `platform/` como carpeta transversal | Implementar `UnitOfWork`, `Clock`, filtro de errores una sola vez para todos los módulos | Duplicar adaptadores por módulo violaría DRY y complicaría el control de transacciones |
| Puerto `DomainEventPublisher` con adaptador en memoria (G-05) | El *outbox* se construye con la spec 011; hoy no hay consumidores | Introducir el *outbox* aquí ampliaría el alcance de esta spec |
| Borradores mínimos (`acc.journal_draft`) | El escenario [001-12] exige un cierre bloqueado por borradores | Omitirlos dejaría sin ejercer R-CON-011 |
