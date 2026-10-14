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

export class InMemoryAccountRepository implements AccountRepository {
  constructor(private readonly db: InMemoryDb) {}
  async findByCodes(codes: readonly AccountCode[]): Promise<Map<string, Account>> {
    return new Map(codes.flatMap((c) => (this.db.accounts.has(c.value) ? [[c.value, this.db.accounts.get(c.value)!] as const] : [])));
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
