import type { Violation } from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import { TrialBalanceCalculator } from '../../domain/services/trial-balance-calculator.js';
import type { PeriodCloseCheck } from '../ports/period-close-check.js';
import type { TrialBalanceReader } from '../ports/trial-balance-reader.js';

/** R-CON-011: el balance de prueba al cierre del período debe cuadrar. */
export class BalancedTrialBalanceCheck implements PeriodCloseCheck {
  constructor(private readonly reader: TrialBalanceReader) {}

  async check(period: FiscalPeriod): Promise<readonly Violation[]> {
    const raw = await this.reader.read({ from: period.startsOn, to: period.endsOn });
    const tb = TrialBalanceCalculator.calculate(raw);
    return tb.balanced
      ? []
      : [{ field: 'trialBalance', message: `El balance de prueba no cuadra: débito ${tb.totals.closingDebit} ≠ crédito ${tb.totals.closingCredit}`, rule: 'R-CON-011' }];
  }
}
