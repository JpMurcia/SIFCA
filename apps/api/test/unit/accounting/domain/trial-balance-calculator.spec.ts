import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared-kernel/index.js';
import { TrialBalanceCalculator, type AccountBalanceRaw } from '../../../../src/modules/accounting/domain/services/trial-balance-calculator.js';

const raw = (code: string, nature: 'DEBIT' | 'CREDIT', opening: string, d: string, c: string, name = `Cuenta ${code}`): AccountBalanceRaw => ({
  code, name, nature, openingNet: Money.ofSigned(opening), movementDebit: Money.of(d), movementCredit: Money.of(c),
});

describe('TrialBalanceCalculator (R-CON-010, R-CON-013)', () => {
  it('calcula saldo inicial, movimiento y saldo final por lado', () => {
    const tb = TrialBalanceCalculator.calculate([raw('1105', 'DEBIT', '500.00', '300.00', '100.00'), raw('4135', 'CREDIT', '-500.00', '0', '300.00')]);
    const [caja, ingresos] = tb.rows;
    expect([caja!.openingDebit, caja!.openingCredit, caja!.movementDebit, caja!.movementCredit, caja!.closingDebit, caja!.closingCredit].map(String))
      .toEqual(['500.00', '0.00', '300.00', '100.00', '700.00', '0.00']);
    expect([ingresos!.openingCredit, ingresos!.closingCredit, ingresos!.closingDebit].map(String)).toEqual(['500.00', '800.00', '0.00']);
    expect(tb.totals.closingDebit.toString()).toBe('700.00');
    expect(tb.totals.closingCredit.toString()).toBe('800.00');
    expect(tb.balanced).toBe(false); // el ejemplo no es un libro completo: se informa, no se oculta
  });

  it('presenta el saldo en la columna donde queda positivo y marca contraNature sin ocultarlo', () => {
    const tb = TrialBalanceCalculator.calculate([
      raw('4175', 'DEBIT', '0', '200000.00', '0'),   // naturaleza débito, saldo débito → normal
      raw('1105', 'DEBIT', '0', '0', '50.00'),         // activo con saldo crédito → alerta
      raw('2408', 'CREDIT', '0', '10.00', '0'),        // pasivo con saldo débito → alerta
    ]);
    const by = Object.fromEntries(tb.rows.map((r) => [r.accountCode, r]));
    expect(by['4175']!.contraNature).toBe(false);
    expect(by['1105']!.closingCredit.toString()).toBe('50.00');
    expect(by['1105']!.contraNature).toBe(true);
    expect(by['2408']!.closingDebit.toString()).toBe('10.00');
    expect(by['2408']!.contraNature).toBe(true);
  });

  it('el balance de referencia da 2.152.000 en débito y en crédito [001-11]', () => {
    const tb = TrialBalanceCalculator.calculate([
      raw('1110', 'DEBIT', '0', '952000.00', '0'),
      raw('130505', 'DEBIT', '0', '1190000.00', '1190000.00'),
      raw('1435', 'DEBIT', '0', '1120000.00', '600000.00'),
      raw('2408', 'CREDIT', '0', '38000.00', '190000.00'),
      raw('3115', 'CREDIT', '0', '0', '1000000.00'),
      raw('4135', 'CREDIT', '0', '0', '1000000.00'),
      raw('4175', 'DEBIT', '0', '200000.00', '0'),
      raw('6135', 'DEBIT', '0', '600000.00', '120000.00'),
    ]);
    expect(tb.totals.closingDebit.toString()).toBe('2152000.00');
    expect(tb.totals.closingCredit.toString()).toBe('2152000.00');
    expect(tb.balanced).toBe(true);
    const nonZero = tb.rows.filter((r) => !r.closingDebit.isZero() || !r.closingCredit.isZero()).map((r) => [r.accountCode, r.closingDebit.toString(), r.closingCredit.toString()]);
    expect(nonZero).toEqual([
      ['1110', '952000.00', '0.00'], ['1435', '520000.00', '0.00'], ['2408', '0.00', '152000.00'],
      ['3115', '0.00', '1000000.00'], ['4135', '0.00', '1000000.00'], ['4175', '200000.00', '0.00'], ['6135', '480000.00', '0.00'],
    ]);
  });

  it('acumula por nivel de código (prefijo) con la naturaleza de la clase', () => {
    const tb = TrialBalanceCalculator.calculate(
      [raw('110505', 'DEBIT', '0', '100.00', '0'), raw('110510', 'DEBIT', '0', '50.00', '0'), raw('1435', 'DEBIT', '0', '70.00', '0'), raw('4135', 'CREDIT', '0', '0', '220.00')],
      2,
    );
    expect(tb.rows.map((r) => [r.accountCode, r.closingDebit.toString(), r.closingCredit.toString()])).toEqual([
      ['11', '150.00', '0.00'], ['14', '70.00', '0.00'], ['41', '0.00', '220.00'],
    ]);
    expect(tb.balanced).toBe(true);
    expect(TrialBalanceCalculator.calculate([raw('4135', 'CREDIT', '0', '0', '1.00')], 1).rows[0]!.accountCode).toBe('4');
  });

  it('es determinista: ordena por código y repite el mismo resultado', () => {
    const input = [raw('4135', 'CREDIT', '0', '0', '1.00'), raw('1105', 'DEBIT', '0', '1.00', '0')];
    const a = JSON.stringify(TrialBalanceCalculator.calculate(input));
    const b = JSON.stringify(TrialBalanceCalculator.calculate([...input].reverse()));
    expect(a).toBe(b);
    expect(JSON.parse(a).rows.map((r: { accountCode: string }) => r.accountCode)).toEqual(['1105', '4135']);
  });

  it('propiedad: para cualquier conjunto de saldos que cuadra, Σ closingDebit = Σ closingCredit', () => {
    const cents = fc.integer({ min: 1, max: 10 ** 7 });
    const fmt = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom('1105', '1110', '1435', '6135'), cents), { minLength: 1, maxLength: 10 }), (debits) => {
        // cada débito tiene su contrapartida a crédito en 4135 / 3115: el libro cuadra por construcción
        const rows = debits.map(([code, c]) => raw(code, 'DEBIT', '0', fmt(c), '0'));
        const total = debits.reduce((a, [, c]) => a + c, 0);
        rows.push(raw('4135', 'CREDIT', '0', '0', fmt(total)));
        const tb = TrialBalanceCalculator.calculate(rows);
        return tb.balanced && tb.totals.closingDebit.equals(tb.totals.closingCredit) && tb.totals.movementDebit.equals(tb.totals.movementCredit);
      }),
    );
  });
});
