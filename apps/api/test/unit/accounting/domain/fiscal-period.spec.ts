import { describe, expect, it } from 'vitest';
import { asId, LocalDate } from '../../../../src/shared-kernel/index.js';
import { FiscalPeriod } from '../../../../src/modules/accounting/domain/entities/fiscal-period.js';

const oct = (status: 'OPEN' | 'CLOSED' = 'OPEN') =>
  FiscalPeriod.restore({ id: asId<'PeriodId'>('0195f3a0-0000-7000-8000-000000000003'), year: 2026, month: 10, startsOn: LocalDate.of('2026-10-01'), endsOn: LocalDate.of('2026-10-31'), status, closedAt: null, closedBy: null, version: 1 });

describe('FiscalPeriod', () => {
  it('contiene fechas inclusive en sus límites', () => {
    expect(oct().contains(LocalDate.of('2026-10-01'))).toBe(true);
    expect(oct().contains(LocalDate.of('2026-10-31'))).toBe(true);
    expect(oct().contains(LocalDate.of('2026-11-01'))).toBe(false);
  });
  it('isOpen refleja el estado', () => {
    expect(oct().isOpen()).toBe(true);
    expect(oct('CLOSED').isOpen()).toBe(false);
  });
  it('crea los 12 períodos mensuales de un año con límites correctos', () => {
    const ids = Array.from({ length: 12 }, (_, i) => asId<'PeriodId'>(`0195f3a0-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`));
    const ps = FiscalPeriod.openYear(2028, ids);
    expect(ps).toHaveLength(12);
    expect(ps[1]!.endsOn.toString()).toBe('2028-02-29');
    expect(ps[11]!.endsOn.toString()).toBe('2028-12-31');
    expect(ps.every((p) => p.isOpen())).toBe(true);
  });
});
