import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  asId, canonicalJson, Instant, LocalDate, Money,
  type Clock, type DomainEventPublisher, type EntryId, type IdGenerator, type PartyId, type PeriodId, type PermissionChecker,
  type RequestContextPort, type UnitOfWork, type UserId, type Violation, type VoucherTypeId,
} from '../../../../shared-kernel/index.js';
import { PostJournalEntryRequestSchema, type PostJournalEntryRequest } from '../schemas/index.js';
import type { CostCenter } from '../../domain/entities/cost-center.js';
import { JournalEntry, type LineInput } from '../../domain/entities/journal-entry.js';
import { IdempotencyConflict, PeriodClosed, PeriodNotFound, ValidationFailed } from '../../domain/errors/accounting-errors.js';
import { journalEntryPosted } from '../../domain/events/journal-entry-posted.js';
import { AccountCode } from '../../domain/value-objects/account-code.js';
import { EntrySource } from '../../domain/value-objects/entry-source.js';
import type { AccountRepository } from '../ports/account-repository.js';
import type { CostCenterRepository } from '../ports/cost-center-repository.js';
import type { FiscalPeriodRepository } from '../ports/fiscal-period-repository.js';
import type { JournalEntryRepository } from '../ports/journal-entry-repository.js';
import type { VoucherSequence } from '../ports/voucher-sequence.js';
import type { VoucherTypeRepository } from '../ports/voucher-type-repository.js';

const IdempotencyKeySchema = z.string().min(8).max(128);

export const POST_ENTRY_PERMISSION = 'accounting.entry.post';

export interface PostJournalEntryDeps {
  readonly uow: UnitOfWork;
  readonly permissions: PermissionChecker;
  readonly requestContext: RequestContextPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly accounts: AccountRepository;
  readonly costCenters: CostCenterRepository;
  readonly voucherTypes: VoucherTypeRepository;
  readonly periods: FiscalPeriodRepository;
  readonly entries: JournalEntryRepository;
  readonly sequence: VoucherSequence;
  readonly events: DomainEventPublisher;
}

export interface PostResult {
  readonly entry: JournalEntry;
  /** `false` si fue un reintento idempotente que devolvió un comprobante existente. */
  readonly created: boolean;
}

/**
 * Contabiliza un comprobante. Orden de validación determinista (contracts/ports.md §6):
 * permiso → esquema → idempotencia → tipo y cuentas → fecha y período (FOR SHARE) → reglas del dominio →
 * consecutivo (lo más tarde posible) → inserción. Todo en una sola transacción reentrante (G-04).
 */
export class PostJournalEntry {
  constructor(private readonly d: PostJournalEntryDeps) {}

  async execute(rawInput: unknown, options: { idempotencyKey?: string | undefined } = {}): Promise<PostResult> {
    this.d.permissions.assert(POST_ENTRY_PERMISSION);
    const input = PostJournalEntryRequestSchema.parse(rawInput);
    const key = options.idempotencyKey === undefined ? undefined : IdempotencyKeySchema.parse(options.idempotencyKey);
    const result = await this.d.uow.run(() => this.post(input, key));
    // G-05: hoy el publicador es en memoria (sin efectos externos); la spec 011 lo cambia por el outbox.
    if (result.created) await this.d.events.publish([journalEntryPosted(result.entry, this.d.requestContext.current().tenantId)]);
    return result;
  }

  private async post(input: PostJournalEntryRequest, idempotencyKey: string | undefined): Promise<PostResult> {
    const ctx = this.d.requestContext.current();

    let idempotency: { key: string; requestHash: string } | undefined;
    if (idempotencyKey) {
      const requestHash = createHash('sha256').update(canonicalJson(input)).digest('hex');
      const existing = await this.d.entries.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.idempotency?.requestHash !== requestHash) throw new IdempotencyConflict();
        return { entry: existing, created: false };
      }
      idempotency = { key: idempotencyKey, requestHash };
    }

    const violations: Violation[] = [];
    const voucherType = await this.d.voucherTypes.findByCode(input.voucherType);
    if (!voucherType) violations.push({ field: 'voucherType', message: `El tipo de comprobante ${input.voucherType} no existe` });

    const codes = [...new Set(input.lines.map((l) => l.accountCode))].map((c) => AccountCode.of(c));
    const accounts = await this.d.accounts.findByCodes(codes);
    const ccCodes = [...new Set(input.lines.flatMap((l) => (l.costCenterCode ? [l.costCenterCode] : [])))];
    const costCenters = await this.d.costCenters.findByCodes(ccCodes);

    const lines: LineInput[] = [];
    input.lines.forEach((l, i) => {
      const account = accounts.get(l.accountCode);
      if (!account) {
        violations.push({ field: `lines[${i}].accountCode`, message: `La cuenta ${l.accountCode} no existe`, rule: 'R-CON-003' });
        return;
      }
      let costCenter: CostCenter | null = null;
      if (l.costCenterCode) {
        costCenter = costCenters.get(l.costCenterCode) ?? null;
        if (!costCenter) violations.push({ field: `lines[${i}].costCenterCode`, message: `El centro de costo ${l.costCenterCode} no existe`, rule: 'R-CON-008' });
      }
      lines.push({
        account,
        partyId: (l.partyId as PartyId | null | undefined) ?? null,
        costCenter,
        debit: Money.of(l.debit ?? '0'),
        credit: Money.of(l.credit ?? '0'),
        description: l.description ?? null,
        documentRef: l.documentRef ?? null,
        dueDate: l.dueDate ? LocalDate.of(l.dueDate) : null,
      });
    });
    if (violations.length > 0 || !voucherType) throw new ValidationFailed(violations);

    const accountingDate = input.accountingDate
      ? LocalDate.of(input.accountingDate)
      : input.occurredAt
        ? this.d.clock.toLocalDate(Instant.fromISO(input.occurredAt))
        : this.d.clock.today();

    const period = await this.d.periods.findByDate(accountingDate, 'share');
    if (!period) throw new PeriodNotFound(accountingDate.toString());
    if (!period.isOpen()) throw new PeriodClosed(period.year, period.month);

    const pending = JournalEntry.prepare({
      voucherType,
      accountingDate,
      description: input.description,
      source: input.source ? EntrySource.of(input.source.type, input.source.id) : EntrySource.manual(),
      lines,
    });

    const scopeYear = voucherType.scopeYearFor(accountingDate);
    const number = await this.d.sequence.next(voucherType.id as VoucherTypeId, scopeYear);
    const entry = JournalEntry.post(pending, {
      id: asId<'EntryId'>(this.d.ids.next()) as EntryId,
      number,
      numberingYear: scopeYear,
      periodId: period.id as PeriodId,
      postedAt: this.d.clock.now(),
      postedBy: ctx.userId as UserId,
      nextLineId: () => this.d.ids.next(),
      idempotency,
    });
    await this.d.entries.add(entry);
    return { entry, created: true };
  }
}
