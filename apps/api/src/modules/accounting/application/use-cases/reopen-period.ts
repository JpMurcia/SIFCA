import { type Clock, type DomainEventPublisher, type PermissionChecker, type RequestContextPort, type UnitOfWork, NotFoundError } from '../../../../shared-kernel/index.js';
import { ReopenPeriodRequestSchema } from '../schemas/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import { periodReopened } from '../../domain/events/period-events.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { FiscalPeriodRepository } from '../ports/fiscal-period-repository.js';
import { parsePeriodId } from './close-period.js';

export const REOPEN_PERIOD_PERMISSION = 'accounting.period.reopen';

/** Reapertura excepcional (R-CON-004): permiso propio, motivo obligatorio y bitácora en la misma transacción. */
export class ReopenPeriod {
  constructor(
    private readonly d: {
      uow: UnitOfWork; permissions: PermissionChecker; requestContext: RequestContextPort; clock: Clock;
      periods: FiscalPeriodRepository; audit: AuditLog; events: DomainEventPublisher;
    },
  ) {}

  async execute(periodId: string, rawInput: unknown): Promise<FiscalPeriod> {
    this.d.permissions.assert(REOPEN_PERIOD_PERMISSION);
    const { reason } = ReopenPeriodRequestSchema.parse(rawInput);
    const id = parsePeriodId(periodId);
    const { reopened, by } = await this.d.uow.run(async () => {
      const period = await this.d.periods.findById(id, 'update');
      if (!period) throw new NotFoundError('El período');
      const next = period.reopen(); // CONFLICT si ya está abierto
      await this.d.periods.save(next);
      await this.d.audit.record({
        action: 'accounting.period.reopened', entityType: 'fiscal_period', entityId: next.id, reason,
        before: { status: period.status, closedAt: period.closedAt, closedBy: period.closedBy }, after: { status: next.status },
      });
      return { reopened: next, by: this.d.requestContext.current().userId };
    });
    await this.d.events.publish([periodReopened(reopened, by, reason, this.d.clock.now().toISOString())]);
    return reopened;
  }
}
