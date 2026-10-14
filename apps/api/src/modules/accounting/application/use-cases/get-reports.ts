import { LocalDate, NotFoundError, type Page, type PermissionChecker, type UnitOfWork } from '../../../../shared-kernel/index.js';
import { GeneralLedgerQuerySchema, JournalBookQuerySchema, TrialBalanceQuerySchema } from '../schemas/index.js';
import { TrialBalanceCalculator, type TrialBalanceResult } from '../../domain/services/trial-balance-calculator.js';
import type { GeneralLedgerView, JournalBookRowView, LedgerReader } from '../ports/ledger-reader.js';
import type { TrialBalanceReader } from '../ports/trial-balance-reader.js';
import { READ_PERMISSION } from './get-journal-entry.js';

export interface TrialBalanceReport extends TrialBalanceResult {
  readonly from: LocalDate;
  readonly to: LocalDate;
  readonly level: number | null;
}

/** Balance de prueba (R-CON-010, R-CON-013): reproducible para un mismo rango. */
export class GetTrialBalance {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; trialBalance: TrialBalanceReader }) {}

  async execute(rawQuery: unknown): Promise<TrialBalanceReport> {
    this.d.permissions.assert(READ_PERMISSION);
    const q = TrialBalanceQuerySchema.parse(rawQuery);
    const [from, to] = [LocalDate.of(q.from), LocalDate.of(q.to)];
    const raw = await this.d.uow.run(() => this.d.trialBalance.read({ from, to }), { readOnly: true, isolation: 'RepeatableRead' });
    return { ...TrialBalanceCalculator.calculate(raw, q.level), from, to, level: q.level ?? null };
  }
}

export class GetJournalBook {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; ledger: LedgerReader }) {}
  async execute(rawQuery: unknown): Promise<Page<JournalBookRowView>> {
    this.d.permissions.assert(READ_PERMISSION);
    const q = JournalBookQuerySchema.parse(rawQuery);
    return this.d.uow.run(() => this.d.ledger.journal({ from: LocalDate.of(q.from), to: LocalDate.of(q.to) }, { limit: q.limit, cursor: q.cursor }), { readOnly: true, isolation: 'RepeatableRead' });
  }
}

export class GetGeneralLedger {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; ledger: LedgerReader }) {}
  async execute(rawQuery: unknown): Promise<GeneralLedgerView & { from: LocalDate; to: LocalDate }> {
    this.d.permissions.assert(READ_PERMISSION);
    const q = GeneralLedgerQuerySchema.parse(rawQuery);
    const [from, to] = [LocalDate.of(q.from), LocalDate.of(q.to)];
    const view = await this.d.uow.run(() => this.d.ledger.generalLedger({ accountCode: q.accountCode, from, to }, { limit: q.limit, cursor: q.cursor }), { readOnly: true, isolation: 'RepeatableRead' });
    if (!view) throw new NotFoundError(`La cuenta ${q.accountCode}`);
    return { ...view, from, to };
  }
}
