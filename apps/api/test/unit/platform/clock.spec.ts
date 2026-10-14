import { describe, expect, it } from 'vitest';
import { Instant } from '../../../src/shared-kernel/index.js';
import { SystemClock, toBogotaDate } from '../../../src/platform/time/system-clock.js';
import { SystemIdGenerator } from '../../../src/platform/time/system-id-generator.js';

describe('toBogotaDate (R-CON-014, [001-13])', () => {
  it('23:30 hora Colombia del 31 de octubre (04:30 UTC del 1 de noviembre) es 2026-10-31', () => {
    expect(toBogotaDate(Instant.fromISO('2026-11-01T04:30:00Z')).toString()).toBe('2026-10-31');
    expect(toBogotaDate(Instant.fromISO('2026-10-31T23:30:00-05:00')).toString()).toBe('2026-10-31');
  });
  it('00:10 hora Colombia ya es el día siguiente', () => {
    expect(toBogotaDate(Instant.fromISO('2026-11-01T05:10:00Z')).toString()).toBe('2026-11-01');
  });
  it('el reloj del sistema devuelve una fecha válida', () => {
    expect(new SystemClock().today().toString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('SystemIdGenerator', () => {
  it('genera UUID v7 únicos y ordenables por tiempo', () => {
    const g = new SystemIdGenerator();
    const a = g.next();
    const b = g.next();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
    expect(a < b).toBe(true);
  });
});
