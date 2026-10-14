import type { DomainEvent } from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../entities/fiscal-period.js';

export const PERIOD_CLOSED = 'accounting.period.closed.v1';
export const PERIOD_REOPENED = 'accounting.period.reopened.v1';

export const periodClosed = (p: FiscalPeriod, occurredAt: string): DomainEvent => ({
  name: PERIOD_CLOSED,
  occurredAt,
  payload: { periodId: p.id, year: p.year, month: p.month, closedBy: p.closedBy, closedAt: p.closedAt },
});

export const periodReopened = (p: FiscalPeriod, by: string, reason: string, occurredAt: string): DomainEvent => ({
  name: PERIOD_REOPENED,
  occurredAt,
  payload: { periodId: p.id, year: p.year, month: p.month, reopenedBy: by, reason },
});
