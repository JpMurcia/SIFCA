import type { Account } from '../../../src/modules/accounting/domain/entities/account.js';
import type { CostCenter } from '../../../src/modules/accounting/domain/entities/cost-center.js';
import type { FiscalPeriod } from '../../../src/modules/accounting/domain/entities/fiscal-period.js';
import type { JournalEntry } from '../../../src/modules/accounting/domain/entities/journal-entry.js';
import type { VoucherType } from '../../../src/modules/accounting/domain/entities/voucher-type.js';
import type { EntryId, UnitOfWork, UnitOfWorkOptions } from '../../../src/shared-kernel/index.js';

/** Estado en memoria con instantáneas, para simular transacciones en las pruebas de casos de uso. */
export class InMemoryDb {
  accounts = new Map<string, Account>();
  costCenters = new Map<string, CostCenter>();
  voucherTypes = new Map<string, VoucherType>();
  periods: FiscalPeriod[] = [];
  entries = new Map<string, JournalEntry>();
  sequences = new Map<string, number>();
  drafts = new Map<string, unknown>();
  audit: Array<Record<string, unknown>> = [];

  snapshot() {
    return {
      entries: new Map(this.entries), sequences: new Map(this.sequences), periods: [...this.periods],
      drafts: new Map(this.drafts), audit: [...this.audit],
    };
  }
  restore(s: ReturnType<InMemoryDb['snapshot']>): void {
    this.entries = s.entries; this.sequences = s.sequences; this.periods = s.periods; this.drafts = s.drafts; this.audit = s.audit;
  }
  entryById(id: EntryId): JournalEntry | undefined {
    return this.entries.get(id);
  }
}

/** UoW falso: reentrante, con rollback a la instantánea si `fn` lanza. */
export class FakeUnitOfWork implements UnitOfWork {
  depth = 0;
  constructor(private readonly db: InMemoryDb) {}
  async run<T>(fn: () => Promise<T>, _options?: UnitOfWorkOptions): Promise<T> {
    if (this.depth > 0) return fn();
    const snap = this.db.snapshot();
    this.depth++;
    try {
      return await fn();
    } catch (e) {
      this.db.restore(snap);
      throw e;
    } finally {
      this.depth--;
    }
  }
}
