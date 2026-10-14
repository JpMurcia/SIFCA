import { describe, expect, it } from 'vitest';
import { LocalDate } from '../../../src/shared-kernel/local-date.js';
import { Instant } from '../../../src/shared-kernel/instant.js';

describe('LocalDate (R-CON-014)', () => {
  it('acepta YYYY-MM-DD válidas y rechaza el resto', () => {
    expect(LocalDate.of('2026-10-31').toString()).toBe('2026-10-31');
    expect(() => LocalDate.of('2026-02-30')).toThrow();
    expect(() => LocalDate.of('2026-13-01')).toThrow();
    expect(() => LocalDate.of('2026-10-31T00:00:00Z')).toThrow();
    expect(() => LocalDate.of('31/10/2026')).toThrow();
    expect(LocalDate.of('2028-02-29').day).toBe(29); // bisiesto
    expect(() => LocalDate.of('2026-02-29')).toThrow();
  });

  it('compara y pertenece a un rango (inclusive)', () => {
    const a = LocalDate.of('2026-10-01');
    const b = LocalDate.of('2026-10-31');
    const x = LocalDate.of('2026-10-31');
    expect(x.isBetween(a, b)).toBe(true);
    expect(LocalDate.of('2026-11-01').isBetween(a, b)).toBe(false);
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
    expect(a.compare(a)).toBe(0);
    expect(x.equals(b)).toBe(true);
  });

  it('expone año, mes y día; primer y último día del mes', () => {
    const d = LocalDate.of('2026-10-14');
    expect([d.year, d.month, d.day]).toEqual([2026, 10, 14]);
    expect(LocalDate.firstDayOf(2026, 2).toString()).toBe('2026-02-01');
    expect(LocalDate.lastDayOf(2026, 2).toString()).toBe('2026-02-28');
    expect(LocalDate.lastDayOf(2028, 2).toString()).toBe('2028-02-29');
    expect(LocalDate.lastDayOf(2026, 12).toString()).toBe('2026-12-31');
  });
});

describe('Instant', () => {
  it('se construye desde ISO 8601 con zona y expone UTC', () => {
    const i = Instant.fromISO('2026-11-01T04:30:00Z');
    expect(i.toISOString()).toBe('2026-11-01T04:30:00.000Z');
    expect(Instant.fromISO('2026-10-31T23:30:00-05:00').toISOString()).toBe('2026-11-01T04:30:00.000Z');
  });
  it('rechaza cadenas sin zona horaria o inválidas', () => {
    expect(() => Instant.fromISO('2026-10-31T23:30:00')).toThrow();
    expect(() => Instant.fromISO('nope')).toThrow();
  });
});
