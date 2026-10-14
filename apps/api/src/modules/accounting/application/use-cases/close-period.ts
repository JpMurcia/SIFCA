import {
  asId, NotFoundError, type Clock, type DomainEventPublisher, type PeriodId, type PermissionChecker, type RequestContextPort, type UnitOfWork, type UserId, type Violation,
} from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import { periodClosed } from '../../domain/events/period-events.js';
import { PeriodClosePolicy } from '../../domain/services/period-close-policy.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { FiscalPeriodRepository } from '../ports/fiscal-period-repository.js';
import type { PeriodCloseCheck } from '../ports/period-close-check.js';

export const CLOSE_PERIOD_PERMISSION = 'accounting.period.close';

export interface ClosePeriodDeps {
  readonly uow: UnitOfWork;
  readonly permissions: PermissionChecker;
  readonly requestContext: RequestContextPort;
  readonly clock: Clock;
  readonly periods: FiscalPeriodRepository;
  readonly checks: readonly PeriodCloseCheck[];
  readonly audit: AuditLog;
  readonly events: DomainEventPublisher;
}

export function parsePeriodId(raw: string): PeriodId {
  try {
    return asId<'PeriodId'>(raw) as PeriodId;
  } catch {
    throw new NotFoundError('El período');
  }
}

/**
 * Cierra un período (R-CON-011): toma el bloqueo `FOR UPDATE` del período (espera a que terminen las
 * contabilizaciones en curso y bloquea las nuevas), ejecuta las comprobaciones y deja bitácora, todo en una transacción.
 */
export class ClosePeriod {
  constructor(private readonly d: ClosePeriodDeps) {}

  async execute(periodId: string): Promise<FiscalPeriod> {
    this.d.permissions.assert(CLOSE_PERIOD_PERMISSION);
    const id = parsePeriodId(periodId);
    const closed = await this.d.uow.run(async () => {
      const period = await this.d.periods.findById(id, 'update');
      if (!period) throw new NotFoundError('El período');
      const next = period.close(this.d.requestContext.current().userId as UserId, this.d.clock.now()); // CONFLICT si ya está cerrado
      const blockers: Violation[] = [];
      for (const check of this.d.checks) blockers.push(...(await check.check(period)));
      PeriodClosePolicy.assertCanClose(blockers);
      await this.d.periods.save(next);
      await this.d.audit.record({
        action: 'accounting.period.closed', entityType: 'fiscal_period', entityId: next.id,
        before: { status: period.status }, after: { status: next.status, closedAt: next.closedAt },
      });
      return next;
    });
    await this.d.events.publish([periodClosed(closed, this.d.clock.now().toISOString())]);
    return closed;
  }
}
