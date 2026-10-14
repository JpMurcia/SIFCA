import type { Violation } from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import type { JournalDraftRepository } from '../ports/journal-draft-repository.js';
import type { PeriodCloseCheck } from '../ports/period-close-check.js';

/** R-CON-011: no pueden quedar borradores con fecha en el período que se cierra. */
export class NoDraftsCheck implements PeriodCloseCheck {
  constructor(private readonly drafts: JournalDraftRepository) {}

  async check(period: FiscalPeriod): Promise<readonly Violation[]> {
    const n = await this.drafts.countInRange({ from: period.startsOn, to: period.endsOn });
    return n === 0 ? [] : [{ field: 'drafts', message: `Hay ${n} borrador(es) con fecha en el período: contabilícelos o descártelos`, rule: 'R-CON-011' }];
  }
}
