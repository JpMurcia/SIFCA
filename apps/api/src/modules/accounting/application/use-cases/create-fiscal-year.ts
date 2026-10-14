import { asId, ConflictError, type IdGenerator, type PeriodId, type PermissionChecker, type UnitOfWork } from '../../../../shared-kernel/index.js';
import { CreateFiscalYearRequestSchema, ListPeriodsQuerySchema } from '../schemas/index.js';
import { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import type { FiscalPeriodRepository } from '../ports/fiscal-period-repository.js';

export const MANAGE_PERIOD_PERMISSION = 'accounting.period.manage';

export class CreateFiscalYear {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; ids: IdGenerator; periods: FiscalPeriodRepository }) {}

  async execute(rawInput: unknown): Promise<readonly FiscalPeriod[]> {
    this.d.permissions.assert(MANAGE_PERIOD_PERMISSION);
    const { year } = CreateFiscalYearRequestSchema.parse(rawInput);
    return this.d.uow.run(async () => {
      if ((await this.d.periods.list(year)).length > 0) throw new ConflictError(`El año fiscal ${year} ya tiene períodos`);
      const periods = FiscalPeriod.openYear(year, Array.from({ length: 12 }, () => asId<'PeriodId'>(this.d.ids.next()) as PeriodId));
      await this.d.periods.addAll(periods);
      return periods;
    });
  }
}

export class ListPeriods {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; periods: FiscalPeriodRepository }) {}
  async execute(rawQuery: unknown): Promise<readonly FiscalPeriod[]> {
    this.d.permissions.assert('accounting.report.read');
    const { year } = ListPeriodsQuerySchema.parse(rawQuery);
    return this.d.uow.run(() => this.d.periods.list(year), { readOnly: true });
  }
}
