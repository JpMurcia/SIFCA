import type { Violation } from '../../../../shared-kernel/index.js';
import { PeriodCloseBlocked } from '../errors/accounting-errors.js';

/**
 * Política de cierre mensual (R-CON-011): solo se cierra si ninguna comprobación aporta causas de bloqueo
 * (balance cuadrado, sin borradores y las comprobaciones que registren otros módulos).
 */
export const PeriodClosePolicy = {
  assertCanClose(blockers: readonly Violation[]): void {
    if (blockers.length > 0) throw new PeriodCloseBlocked(blockers);
  },
};
