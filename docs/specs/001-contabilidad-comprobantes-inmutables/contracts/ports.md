# Puertos, eventos y permisos del módulo `accounting`

**Spec**: [`../spec.md`](../spec.md) · **Plan**: [`../plan.md`](../plan.md) · Contrato HTTP:
[`accounting.v1.openapi.yaml`](accounting.v1.openapi.yaml)

Solo se describen **firmas y contratos** (no implementación). Todos los puertos los **define** la capa que los
usa (`domain/` o `application/`) y los implementa `infrastructure/` o `platform/` (G-02). Los importes son
`Money`; las fechas, `LocalDate`; los instantes, `Instant` (nunca `number` ni `Date` en el dominio).

## 1. Puertos de `shared-kernel` (los usan todos los módulos)

| Puerto | Firma | Adaptador | Notas |
|---|---|---|---|
| `UnitOfWork` | `run<T>(fn: () => Promise<T>, options?: { timeoutMs?, maxWaitMs?, isolation? }): Promise<T>` | `platform/persistence/prisma-unit-of-work.ts` | **Reentrante**: si ya hay transacción en el contexto asíncrono, se une a ella. Fija `app.tenant_id` con `set_config(…, true)` |
| `Clock` | `now(): Instant` · `toLocalDate(instant: Instant): LocalDate` (zona `America/Bogota`) · `today(): LocalDate` | `platform/time/system-clock.ts`; `FixedClock` en pruebas | El dominio nunca llama a `Date.now()` |
| `RequestContext` | `tenantId: TenantId` · `userId: UserId` · `permissions: ReadonlySet<string>` · `requestId: string` | `platform/http/request-context.middleware.ts` (provisional, ver IAM) | |
| `PermissionChecker` | `assert(permission: string): void` (lanza `Forbidden`) | `platform/http` (provisional) | |
| `DomainEventPublisher` | `publish(events: readonly DomainEvent[]): void` | En memoria hoy; *outbox* en la spec 011 | Se publica **después** del *commit* (G-05) |

## 2. Puertos propios de `accounting` (`application/ports/`)

| Puerto | Operaciones | Adaptador (`infrastructure/persistence/`) |
|---|---|---|
| `JournalEntryRepository` | `add(entry: JournalEntry): Promise<void>` · `findById(id): Promise<JournalEntry \| null>` · `findByIdempotencyKey(key): Promise<{ entry, requestHash } \| null>` · `findReversalOf(id): Promise<JournalEntry \| null>` · **sin** `update` ni `delete` | `prisma-journal-entry.repository.ts` |
| `JournalDraftRepository` | `save(draft)` · `findById(id)` · `discard(id)` · `list(filter, page)` · `countByPeriod(periodId): Promise<number>` | `prisma-journal-draft.repository.ts` |
| `AccountRepository` | `findByCodes(codes: AccountCode[]): Promise<Map<AccountCode, Account>>` · `findByIds(ids)` · `list(filter, page)` | `prisma-account.repository.ts` |
| `FiscalPeriodRepository` | `findByDate(date: LocalDate, mode: 'share' \| 'plain'): Promise<FiscalPeriod \| null>` · `findById(id, lock: 'update' \| 'none')` · `list(year?)` · `addAll(periods)` · `save(period)` (solo cierre/apertura) | `prisma-fiscal-period.repository.ts` |
| `VoucherTypeRepository` | `findByCode(code)` · `list()` | `prisma-voucher-type.repository.ts` |
| `VoucherSequence` | `next(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber>` (bloquea la fila hasta el *commit*) · `peek(typeId, scopeYear)` | `prisma-voucher-sequence.ts` |
| `TrialBalanceReader` | `read(query: { from, to, level? }): Promise<TrialBalanceRaw>` (acumulados por cuenta) | `prisma-trial-balance.reader.ts` |
| `LedgerReader` | `journal(query, page)` · `generalLedger(query, page)` | `prisma-ledger.reader.ts` |
| `AuditLog` | `record(entry: { action, entityType, entityId, reason?, before?, after? }): Promise<void>` | `platform/audit/prisma-audit-log.ts` |
| `PeriodCloseCheck` (multi-implementación) | `check(period: FiscalPeriod): Promise<readonly CloseBlocker[]>` | Aquí: `BalancedTrialBalanceCheck`, `NoDraftsCheck`. Otras specs registran las suyas (INV-10, INV-13, INV-14) |

## 3. Fachada pública del módulo (`index.ts`)

Es lo **único** que otros módulos pueden importar (D-5). Los consumidores (ventas, inventario, cartera…)
declaran su propio puerto y lo enlazan a esta fachada en su `*.module.ts`.

| Export | Contrato |
|---|---|
| `PostJournalEntryPort` | `post(input: PostJournalEntryInput): Promise<PostedEntryRef>` — mismo caso de uso que el HTTP; se une a la transacción ambiente |
| `ReverseJournalEntryPort` | `reverse(entryId, input): Promise<PostedEntryRef>` |
| `PostedEntryRef` | `{ id, voucherType, number, accountingDate }` |
| Tipos de eventos | `JournalEntryPosted`, `JournalEntryReversed`, `PeriodClosed`, `PeriodReopened` (los esquemas viven en `packages/contracts`) |

## 4. Eventos de dominio

Esquemas Zod en `packages/contracts/src/accounting/events.ts`; el nombre del evento es estable y versionado.

| Evento | Cuándo | Carga útil (resumen) |
|---|---|---|
| `accounting.journal_entry.posted.v1` | Tras contabilizar | `entryId, tenantId, voucherType, number, accountingDate, totalDebit, totalCredit, source{type,id}, postedAt` |
| `accounting.journal_entry.reversed.v1` | Tras reversar | `entryId` (la reversión), `reversalOf`, `reason`, `accountingDate` |
| `accounting.period.closed.v1` | Tras cerrar un período | `periodId, year, month, closedBy, closedAt` |
| `accounting.period.reopened.v1` | Tras reabrir | `periodId, year, month, reopenedBy, reason` |

## 5. Permisos que usa este feature

El adaptador de permisos es provisional (research §11); la lista queda como contrato para la spec de IAM.

| Permiso | Operación |
|---|---|
| `accounting.entry.post` | Contabilizar; guardar y descartar borradores |
| `accounting.entry.reverse` | Reversar un comprobante |
| `accounting.period.manage` | Crear el año fiscal (12 períodos) |
| `accounting.period.close` | Cerrar período |
| `accounting.period.reopen` | Reabrir período (con motivo) |
| `accounting.year.close` | Cierre anual |
| `accounting.report.read` | Consultar comprobantes, libros, balance, cuentas y períodos |

## 6. Orden de validación de `PostJournalEntry` (determinista)

1. Permiso `accounting.entry.post` → `FORBIDDEN`.
2. Esquema Zod de la entrada → `VALIDATION_FAILED` (`errors[]` con `field`, `message`, `rule`).
3. `Idempotency-Key`: si existe y el *hash* coincide, devolver el comprobante; si no coincide, `IDEMPOTENCY_CONFLICT`.
4. Resolver el tipo de comprobante y las cuentas (`findByCodes`) → `VALIDATION_FAILED` si no existen.
5. Fecha contable (`accountingDate` o `Clock.toLocalDate(occurredAt)` o `today`) y período con `FOR SHARE`:
   `PERIOD_NOT_FOUND` / `PERIOD_CLOSED`.
6. Construir `JournalEntry` (dominio): un lado por línea (R-CON-002), ≥ 2 líneas y cuentas de movimiento activas
   (R-CON-003), tercero/centro de costo (R-CON-008), cuadre (R-CON-001 → `ENTRY_NOT_BALANCED`).
7. Asignar consecutivo (`VoucherSequence.next`) **al final** para minimizar el bloqueo.
8. Insertar cabecera y líneas; el *constraint trigger* diferido valida al *commit*.
9. Recoger eventos y publicarlos tras el *commit*.
