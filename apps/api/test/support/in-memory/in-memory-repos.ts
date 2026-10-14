import { EntryNumber } from '../../../src/modules/accounting/domain/value-objects/entry-number.js';
import type { Account } from '../../../src/modules/accounting/domain/entities/account.js';
import type { AccountFilter, AccountRepository } from '../../../src/modules/accounting/application/ports/account-repository.js';
import type { CostCenterRepository } from '../../../src/modules/accounting/application/ports/cost-center-repository.js';
import type { FiscalPeriodRepository } from '../../../src/modules/accounting/application/ports/fiscal-period-repository.js';
import type { JournalEntryFilter, JournalEntryRepository, JournalEntrySummary } from '../../../src/modules/accounting/application/ports/journal-entry-repository.js';
import type { VoucherSequence } from '../../../src/modules/accounting/application/ports/voucher-sequence.js';
import type { VoucherTypeRepository } from '../../../src/modules/accounting/application/ports/voucher-type-repository.js';
import type { AccountCode } from '../../../src/modules/accounting/domain/value-objects/account-code.js';
import type { CostCenter } from '../../../src/modules/accounting/domain/entities/cost-center.js';
import type { FiscalPeriod } from '../../../src/modules/accounting/domain/entities/fiscal-period.js';
import type { JournalEntry } from '../../../src/modules/accounting/domain/entities/journal-entry.js';
import type { VoucherType } from '../../../src/modules/accounting/domain/entities/voucher-type.js';
import type { EntryId, LocalDate, Page, PageRequest, PeriodId, VoucherTypeId } from '../../../src/shared-kernel/index.js';
import type { InMemoryDb } from './in-memory-db.js';
import type { JournalDraftRepository } from '../../../src/modules/accounting/application/ports/journal-draft-repository.js';
import type { TrialBalanceReader } from '../../../src/modules/accounting/application/ports/trial-balance-reader.js';
import type { AuditEntry, AuditLog, DraftId } from '../../../src/shared-kernel/index.js';
import { ConflictError, Money } from '../../../src/shared-kernel/index.js';
import type { JournalDraft } from '../../../src/modules/accounting/domain/entities/journal-draft.js';
import type { AccountBalanceRaw } from '../../../src/modules/accounting/domain/services/trial-balance-calculator.js';

export class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly db: InMemoryDb) {}
  async findByCodes(codes: readonly AccountCode[]): Promise<Map<string, Account>> {
    return new Map(codes.flatMap((c) => (this.db.accounts.has(c.value) ? [[c.value, this.db.accounts.get(c.value)!] as const] : [])));
  }
  async findByIds(ids: readonly string[]): Promise<Map<string, Account>> {
    return new Map([...this.db.accounts.values()].filter((a) => ids.includes(a.id)).map((a) => [a.id, a] as const));
  }
  async list(filter: AccountFilter, page: PageRequest): Promise<Page<Account>> {
    const all = [...this.db.accounts.values()]
      .filter((a) => (!filter.postableOnly || a.canReceivePostings()) && (!filter.q || a.code.value.startsWith(filter.q) || a.name.toLowerCase().includes(filter.q.toLowerCase())))
      .sort((a, b) => a.code.value.localeCompare(b.code.value));
    return { items: all.slice(0, page.limit), nextCursor: null };
  }
}

export class InMemoryCostCenterRepository implements CostCenterRepository {
  constructor(private readonly db: InMemoryDb) {}
  async findByCodes(codes: readonly string[]): Promise<Map<string, CostCenter>> {
    return new Map(codes.flatMap((c) => (this.db.costCenters.has(c) ? [[c, this.db.costCenters.get(c)!] as const] : [])));
  }
}

export class InMemoryVoucherTypeRepository implements VoucherTypeRepository {
  constructor(private readonly db: InMemoryDb) {}
  async findByCode(code: string): Promise<VoucherType | null> {
    return this.db.voucherTypes.get(code) ?? null;
  }
  async list(): Promise<readonly VoucherType[]> {
    return [...this.db.voucherTypes.values()];
  }
}

export class InMemoryFiscalPeriodRepository implements FiscalPeriodRepository {
  constructor(private readonly db: InMemoryDb) {}
  async findByDate(date: LocalDate): Promise<FiscalPeriod | null> {
    return this.db.periods.find((p) => p.contains(date)) ?? null;
  }
  async findById(id: PeriodId): Promise<FiscalPeriod | null> {
    return this.db.periods.find((p) => p.id === id) ?? null;
  }
  async list(year?: number): Promise<readonly FiscalPeriod[]> {
    return this.db.periods.filter((p) => year === undefined || p.year === year);
  }
  async addAll(periods: readonly FiscalPeriod[]): Promise<void> {
    this.db.periods = [...this.db.periods, ...periods];
  }
  async save(period: FiscalPeriod): Promise<void> {
    this.db.periods = this.db.periods.map((p) => (p.id === period.id ? period : p));
  }
}

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  /** Si se define, `add` lanza este error DESPUÉS de insertar (simula una falla en el último paso). */
  failAfterAdd: Error | undefined;
  constructor(private readonly db: InMemoryDb) {}
  async add(entry: JournalEntry): Promise<void> {
    this.db.entries.set(entry.id, entry);
    if (this.failAfterAdd) throw this.failAfterAdd;
  }
  private withReversedBy(e: JournalEntry): JournalEntry {
    const rev = [...this.db.entries.values()].find((x) => x.reversalOf === e.id);
    return rev ? e.withReversedBy(rev.id) : e;
  }
  async findById(id: EntryId): Promise<JournalEntry | null> {
    const e = this.db.entries.get(id);
    return e ? this.withReversedBy(e) : null;
  }
  async findByIdempotencyKey(key: string): Promise<JournalEntry | null> {
    return [...this.db.entries.values()].find((e) => e.idempotency?.key === key) ?? null;
  }
  async findReversalOf(id: EntryId): Promise<JournalEntry | null> {
    return [...this.db.entries.values()].find((e) => e.reversalOf === id) ?? null;
  }
  async list(filter: JournalEntryFilter, page: PageRequest): Promise<Page<JournalEntrySummary>> {
    const items = [...this.db.entries.values()]
      .filter((e) => (!filter.from || !e.accountingDate.isBefore(filter.from)) && (!filter.to || !e.accountingDate.isAfter(filter.to)) && (!filter.voucherType || e.voucherTypeCode === filter.voucherType) && (!filter.sourceType || e.source.type === filter.sourceType))
      .map((e): JournalEntrySummary => ({
        id: e.id, voucherType: e.voucherTypeCode, number: e.number.value, numberingYear: e.numberingYear, accountingDate: e.accountingDate,
        fiscalPeriodId: e.periodId, description: e.description, sourceType: e.source.type, sourceId: e.source.id, reversalOf: e.reversalOf,
        reversedBy: this.withReversedBy(e).reversedBy, totalDebit: e.totalDebit.toString(), totalCredit: e.totalCredit.toString(),
        postedAt: e.postedAt.toISOString(), postedBy: e.postedBy,
      }));
    return { items: items.slice(0, page.limit), nextCursor: null };
  }
}

export class InMemoryVoucherSequence implements VoucherSequence {
  /** Lanza al pedir el siguiente número (simula una falla). */
  failOnNext: Error | undefined;
  constructor(private readonly db: InMemoryDb) {}
  private key(t: VoucherTypeId, y: number) { return `${t}:${y}`; }
  async next(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber> {
    if (this.failOnNext) throw this.failOnNext;
    const n = (this.db.sequences.get(this.key(typeId, scopeYear)) ?? 0) + 1;
    this.db.sequences.set(this.key(typeId, scopeYear), n);
    return EntryNumber.of(n);
  }
  async peek(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber> {
    return EntryNumber.of((this.db.sequences.get(this.key(typeId, scopeYear)) ?? 0) + 1);
  }
}

export class InMemoryJournalDraftRepository implements JournalDraftRepository {
  constructor(private readonly db: InMemoryDb) {}
  async save(draft: JournalDraft, expectedVersion: number | null): Promise<void> {
    const current = this.db.drafts.get(draft.id) as JournalDraft | undefined;
    if (expectedVersion !== null && current?.version !== expectedVersion) throw new ConflictError('El borrador cambió: versión desactualizada');
    this.db.drafts.set(draft.id, draft);
  }
  async findById(id: DraftId): Promise<JournalDraft | null> {
    return (this.db.drafts.get(id) as JournalDraft | undefined) ?? null;
  }
  async discard(id: DraftId): Promise<boolean> {
    return this.db.drafts.delete(id);
  }
  async list(filter: { from?: LocalDate | undefined; to?: LocalDate | undefined }, page: PageRequest): Promise<Page<JournalDraft>> {
    const items = ([...this.db.drafts.values()] as JournalDraft[]).filter((d) => !!d.accountingDate && (!filter.from || !d.accountingDate.isBefore(filter.from)) && (!filter.to || !d.accountingDate.isAfter(filter.to)) || (!filter.from && !filter.to));
    return { items: items.slice(0, page.limit), nextCursor: null };
  }
  async countInRange(range: { from: LocalDate; to: LocalDate }): Promise<number> {
    return ([...this.db.drafts.values()] as JournalDraft[]).filter((d) => d.accountingDate?.isBetween(range.from, range.to)).length;
  }
}

export class InMemoryAuditLog implements AuditLog {
  constructor(private readonly db: InMemoryDb) {}
  async record(entry: AuditEntry): Promise<void> {
    this.db.audit.push({ ...entry });
  }
}

export class InMemoryTrialBalanceReader implements TrialBalanceReader {
  constructor(private readonly db: InMemoryDb) {}
  async read(range: { from: LocalDate; to: LocalDate }): Promise<readonly AccountBalanceRaw[]> {
    const acc = new Map<string, { opening: Money; d: Money; c: Money }>();
    for (const e of this.db.entries.values()) {
      if (e.accountingDate.isAfter(range.to)) continue;
      for (const l of e.lines) {
        const a = acc.get(l.accountCode) ?? { opening: Money.zero(), d: Money.zero(), c: Money.zero() };
        if (e.accountingDate.isBefore(range.from)) a.opening = a.opening.add(l.debit).subtract(l.credit);
        else { a.d = a.d.add(l.debit); a.c = a.c.add(l.credit); }
        acc.set(l.accountCode, a);
      }
    }
    return [...acc.entries()].map(([code, a]) => ({
      code, name: this.db.accounts.get(code)?.name ?? code, nature: this.db.accounts.get(code)?.nature ?? null,
      openingNet: a.opening, movementDebit: a.d, movementCredit: a.c,
    }));
  }
}
