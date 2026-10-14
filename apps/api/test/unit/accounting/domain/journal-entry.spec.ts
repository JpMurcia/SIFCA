import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asId, Instant, LocalDate, Money, type UserId } from '../../../../src/shared-kernel/index.js';
import { JournalEntry, type LineInput } from '../../../../src/modules/accounting/domain/entities/journal-entry.js';
import { EntrySource } from '../../../../src/modules/accounting/domain/value-objects/entry-source.js';
import { EntryNumber } from '../../../../src/modules/accounting/domain/value-objects/entry-number.js';
import { EntryNotBalanced, ValidationFailed } from '../../../../src/modules/accounting/domain/errors/accounting-errors.js';
import { VoucherType } from '../../../../src/modules/accounting/domain/entities/voucher-type.js';
import { acct, costCenter, cr, dr, uuid } from '../../../support/builders.js';

const voucherType = VoucherType.restore({ id: asId<'VoucherTypeId'>(uuid()), code: 'AJ', name: 'Ajuste', numberingScope: 'TENANT' });
const caja = acct('1105');
const ingresos = acct('4135', { nature: 'CREDIT' });

const prepare = (lines: LineInput[], description = 'Prueba') =>
  JournalEntry.prepare({ voucherType, accountingDate: LocalDate.of('2026-10-14'), description, source: EntrySource.manual(), lines });

const post = (lines: LineInput[]) =>
  JournalEntry.post(prepare(lines), {
    id: asId<'EntryId'>(uuid()), number: EntryNumber.of(1), numberingYear: 0, periodId: asId<'PeriodId'>(uuid()),
    postedAt: Instant.fromISO('2026-10-14T15:00:00Z'), postedBy: uuid() as UserId, nextLineId: uuid,
  });

describe('JournalEntry — cuadre (R-CON-001)', () => {
  it('acepta un comprobante cuadrado y calcula los totales', () => {
    const e = post([dr(caja, '100000'), cr(ingresos, '100000')]);
    expect(e.totalDebit.toString()).toBe('100000.00');
    expect(e.totalCredit.toString()).toBe('100000.00');
    expect(e.lines.map((l) => l.lineNo)).toEqual([1, 2]);
    expect(e.status).toBe('POSTED');
  });

  it.each([
    ['100000.00', '99999.99'],
    ['100000.00', '100000.01'],
    ['1190000', '1000000'],
  ])('rechaza el descuadre %s vs %s con ENTRY_NOT_BALANCED', (d, c) => {
    expect(() => prepare([dr(caja, d), cr(ingresos, c)])).toThrow(EntryNotBalanced);
  });

  it('propiedad: prepare() tiene éxito SI Y SOLO SI Σ débitos = Σ créditos', () => {
    const cents = fc.integer({ min: 1, max: 10 ** 9 });
    const fmt = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
    const lineArb = fc.record({ side: fc.boolean(), cents });
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 2, maxLength: 12 }), (ls) => {
        const lines = ls.map((l) => (l.side ? dr(caja, fmt(l.cents)) : cr(ingresos, fmt(l.cents))));
        const d = ls.filter((l) => l.side).reduce((a, l) => a + l.cents, 0);
        const c = ls.filter((l) => !l.side).reduce((a, l) => a + l.cents, 0);
        let ok = true;
        try { prepare(lines); } catch (e) { ok = false; if (!(e instanceof EntryNotBalanced)) throw e; }
        return ok === (d === c);
      }),
    );
  });
});

describe('JournalEntry — líneas (R-CON-002, R-CON-003, R-CON-008)', () => {
  it('exige al menos dos líneas', () => {
    expect(() => prepare([dr(caja, '100')])).toThrow(ValidationFailed);
    expect(() => prepare([])).toThrow(ValidationFailed);
  });

  it('rechaza una línea con ambos lados, con valor cero o negativa', () => {
    const both = { account: caja, debit: Money.of('100'), credit: Money.of('100') };
    const zero = { account: caja, debit: Money.zero(), credit: Money.zero() };
    const neg = { account: caja, debit: Money.ofSigned('-100'), credit: Money.zero() };
    for (const bad of [both, zero, neg]) {
      try {
        prepare([bad, cr(ingresos, '100')]);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationFailed);
        expect((e as ValidationFailed).violations[0]?.rule).toBe('R-CON-002');
      }
    }
  });

  it('rechaza cuentas acumuladoras o inactivas (R-CON-003)', () => {
    const grupo = acct('13', { allowsPosting: false });
    const inactiva = acct('1199', { isActive: false });
    for (const a of [grupo, inactiva]) {
      try {
        prepare([dr(a, '100'), cr(ingresos, '100')]);
        expect.unreachable();
      } catch (e) {
        expect((e as ValidationFailed).violations[0]).toMatchObject({ field: 'lines[0].accountCode', rule: 'R-CON-003' });
      }
    }
  });

  it('exige tercero cuando la cuenta lo pide y centro de costo cuando lo pide (R-CON-008)', () => {
    const clientes = acct('130505', { requiresParty: true });
    const gasto = acct('5105', { requiresCostCenter: true });
    expect(() => prepare([dr(clientes, '100'), cr(ingresos, '100')])).toThrow(ValidationFailed);
    expect(() => prepare([dr(gasto, '100'), cr(caja, '100')])).toThrow(ValidationFailed);
    expect(() => prepare([dr(clientes, '100', { partyId: asId<'PartyId'>(uuid()) }), cr(ingresos, '100')])).not.toThrow();
    expect(() => prepare([dr(gasto, '100', { costCenter: costCenter() }), cr(caja, '100')])).not.toThrow();
  });

  it('informa TODAS las violaciones de línea juntas', () => {
    const grupo = acct('13', { allowsPosting: false });
    try {
      prepare([dr(grupo, '100'), { account: caja, debit: Money.zero(), credit: Money.zero() }]);
      expect.unreachable();
    } catch (e) {
      expect((e as ValidationFailed).violations.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('exige descripción de 1 a 500 caracteres', () => {
    expect(() => prepare([dr(caja, '1'), cr(ingresos, '1')], '')).toThrow(ValidationFailed);
    expect(() => prepare([dr(caja, '1'), cr(ingresos, '1')], 'x'.repeat(501))).toThrow(ValidationFailed);
  });
});

describe('EntrySource (R-CON-007)', () => {
  it('un origen distinto de MANUAL exige el id del documento fuente', () => {
    expect(() => EntrySource.of('SALES_DOCUMENT', undefined)).toThrow();
    expect(EntrySource.of('SALES_DOCUMENT', uuid()).type).toBe('SALES_DOCUMENT');
    expect(EntrySource.manual().id).toBeNull();
  });
});

describe('EntryNumber', () => {
  it('es un entero ≥ 1', () => {
    expect(() => EntryNumber.of(0)).toThrow();
    expect(() => EntryNumber.of(1.5)).toThrow();
    expect(EntryNumber.of(5).value).toBe(5);
  });
});
