import type { LocalDate, PeriodId } from '../../../../shared-kernel/index.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';

export interface FiscalPeriodRepository {
  /**
   * Período que contiene la fecha. Con `share` toma `SELECT … FOR SHARE` para serializar contra el cierre
   * (research §6); con `plain` es una lectura simple.
   */
  findByDate(date: LocalDate, mode: 'share' | 'plain'): Promise<FiscalPeriod | null>;
  /** Con `update` toma `SELECT … FOR UPDATE` (cierre y reapertura). */
  findById(id: PeriodId, lock: 'update' | 'none'): Promise<FiscalPeriod | null>;
  list(year?: number): Promise<readonly FiscalPeriod[]>;
  addAll(periods: readonly FiscalPeriod[]): Promise<void>;
  /** Persiste solo cambios de estado (cierre/reapertura). */
  save(period: FiscalPeriod): Promise<void>;
}

export const FISCAL_PERIOD_REPOSITORY = Symbol('FiscalPeriodRepository');
