import type { Violation } from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';

/**
 * Punto de extensión del cierre (research §6): cada comprobación aporta causas de bloqueo. Otros módulos registran
 * las suyas (conciliaciones INV-10, INV-13, INV-14) sin cambiar `ClosePeriod`.
 */
export interface PeriodCloseCheck {
  check(period: FiscalPeriod): Promise<readonly Violation[]>;
}

export const PERIOD_CLOSE_CHECKS = Symbol('PeriodCloseChecks');
