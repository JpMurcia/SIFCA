import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared-kernel/money.js';
import { Percentage } from '../../../src/shared-kernel/percentage.js';

describe('Money (R-CON-009)', () => {
  it('rechaza construirse desde number', () => {
    // @ts-expect-error — el tipo ya lo impide
    expect(() => Money.of(100)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => Money.of(0.1 + 0.2)).toThrow(TypeError);
  });

  it('acepta cadenas con hasta 2 decimales y rechaza más', () => {
    expect(Money.of('100000').toString()).toBe('100000.00');
    expect(Money.of('99999.99').toString()).toBe('99999.99');
    expect(() => Money.of('1.005')).toThrow();
    expect(() => Money.of('abc')).toThrow();
    expect(() => Money.of('')).toThrow();
    expect(() => Money.of('1e3')).toThrow();
  });

  it('permite negativos solo con ofSigned (saldos), no con of', () => {
    expect(() => Money.of('-1.00')).toThrow();
    expect(Money.ofSigned('-1.00').toString()).toBe('-1.00');
  });

  it('redondea mitad hacia arriba sobre el valor absoluto', () => {
    expect(Money.round('0.005').toString()).toBe('0.01');
    expect(Money.round('2.675').toString()).toBe('2.68');
    expect(Money.round('-0.005').toString()).toBe('-0.01');
    expect(Money.round('63.3327').toString()).toBe('63.33');
  });

  it('IVA 19 % sobre 333,33 = 63,33 por línea y 3 líneas suman 189,99 (no 190,00) [001-10]', () => {
    const base = Money.of('333.33');
    const iva = base.percentOf(Percentage.of('19'));
    expect(iva.toString()).toBe('63.33');
    expect(Money.sum([iva, iva, iva]).toString()).toBe('189.99');
    expect(Money.sum([base, base, base]).toString()).toBe('999.99');
  });

  it('suma sin error de punto flotante', () => {
    expect(Money.of('0.10').add(Money.of('0.20')).toString()).toBe('0.30');
  });

  it('compara con equals/compare', () => {
    expect(Money.of('1.10').equals(Money.of('1.1'))).toBe(true);
    expect(Money.of('1.10').compare(Money.of('1.11'))).toBeLessThan(0);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.of('0.01').isPositive()).toBe(true);
  });

  it('propiedad: (a + b) − b = a para cualquier par', () => {
    const cents = fc.integer({ min: 0, max: 10 ** 13 });
    const toMoney = (c: number) => Money.of(`${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`);
    fc.assert(
      fc.property(cents, cents, (a, b) => {
        const ma = toMoney(a);
        const mb = toMoney(b);
        return ma.add(mb).subtract(mb).equals(ma);
      }),
    );
  });

  it('propiedad: la suma es asociativa y conmutativa (exacta)', () => {
    const cents = fc.integer({ min: 0, max: 10 ** 12 });
    const toMoney = (c: number) => Money.of(`${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`);
    fc.assert(
      fc.property(cents, cents, cents, (a, b, c) => {
        const [x, y, z] = [toMoney(a), toMoney(b), toMoney(c)];
        return x.add(y).add(z).equals(x.add(y.add(z))) && x.add(y).equals(y.add(x));
      }),
    );
  });
});

describe('Percentage', () => {
  it('se construye desde cadena y rechaza number', () => {
    expect(Percentage.of('19').toString()).toBe('19');
    // @ts-expect-error
    expect(() => Percentage.of(19)).toThrow(TypeError);
    expect(() => Percentage.of('-1')).toThrow();
  });
});
