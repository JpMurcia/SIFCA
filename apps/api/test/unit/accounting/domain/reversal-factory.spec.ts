import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { asId, Instant, LocalDate, Money, type UserId } from '../../../../src/shared-kernel/index.js';
import { JournalEntry, type LineInput } from '../../../../src/modules/accounting/domain/entities/journal-entry.js';
import { VoucherType } from '../../../../src/modules/accounting/domain/entities/voucher-type.js';
import { ReversalFactory } from '../../../../src/modules/accounting/domain/services/reversal-factory.js';
import type { ValidationFailed } from '../../../../src/modules/accounting/domain/errors/accounting-errors.js';
import { EntryNumber } from '../../../../src/modules/accounting/domain/value-objects/entry-number.js';
import { EntrySource } from '../../../../src/modules/accounting/domain/value-objects/entry-source.js';
import { acct, costCenter, cr, dr, uuid } from '../../../support/builders.js';

const vt = VoucherType.restore({ id: asId<'VoucherTypeId'>(uuid()), code: 'AJ', name: 'Ajuste', numberingScope: 'TENANT' });
const caja = acct('1105');
const clientes = acct('130505', { requiresParty: true });
const ingresos = acct('4135', { nature: 'CREDIT' });
const gasto = acct('5105', { requiresCostCenter: true });
const party = asId<'PartyId'>(uuid());
const adm = costCenter('ADM');

function posted(lines: LineInput[], n = 1): JournalEntry {
  return JournalEntry.post(
    JournalEntry.prepare({ voucherType: vt, accountingDate: LocalDate.of('2026-10-14'), description: 'Original', source: EntrySource.manual(), lines }),
    { id: asId<'EntryId'>(uuid()), number: EntryNumber.of(n), numberingYear: 0, periodId: asId<'PeriodId'>(uuid()), postedAt: Instant.fromISO('2026-10-14T15:00:00Z'), postedBy: uuid() as UserId, nextLineId: uuid },
  );
}

const accountsOf = (...as: ReturnType<typeof acct>[]) => new Map(as.map((a) => [a.code.value, a]));

function reverse(original: JournalEntry, accounts: Map<string, ReturnType<typeof acct>>, ccs = new Map<string, typeof adm>()) {
  return ReversalFactory.build({ original, voucherType: vt, accounts, costCenters: ccs, accountingDate: LocalDate.of('2026-10-20'), reason: 'Error de digitación' });
}

describe('ReversalFactory (R-CON-005)', () => {
  it('invierte cada línea conservando tercero, centro de costo, referencia y vencimiento', () => {
    const original = posted([
      dr(clientes, '1190000', { partyId: party, documentRef: 'FV-1', dueDate: LocalDate.of('2026-11-13') }),
      cr(ingresos, '1000000'),
      cr(acct('2408', { nature: 'CREDIT' }), '190000'),
    ]);
    const rev = reverse(original, accountsOf(clientes, ingresos, acct('2408', { nature: 'CREDIT' })));
    expect(rev.lines).toHaveLength(3);
    expect(rev.lines[0]!.credit.toString()).toBe('1190000.00');
    expect(rev.lines[0]!.debit.isZero()).toBe(true);
    expect(rev.lines[0]!.partyId).toBe(party);
    expect(rev.lines[0]!.documentRef).toBe('FV-1');
    expect(rev.lines[0]!.dueDate?.toString()).toBe('2026-11-13');
    expect(rev.lines[1]!.debit.toString()).toBe('1000000.00');
    expect(rev.totalDebit.toString()).toBe('1190000.00');
  });

  it('referencia al original, usa el origen REVERSAL y exige el motivo', () => {
    const original = posted([dr(caja, '100'), cr(ingresos, '100')]);
    const rev = reverse(original, accountsOf(caja, ingresos));
    expect(rev.reversalOf?.id).toBe(original.id);
    expect(rev.reversalOf?.reason).toBe('Error de digitación');
    expect(rev.source.type).toBe('REVERSAL');
    expect(rev.source.id).toBe(original.id);
    expect(rev.description).toContain('Reversión');
    expect(rev.description.length).toBeLessThanOrEqual(500);
  });

  it('conserva el centro de costo de la línea original', () => {
    const original = posted([dr(gasto, '100', { costCenter: adm }), cr(caja, '100')]);
    const rev = reverse(original, accountsOf(gasto, caja), new Map([['ADM', adm]]));
    expect(rev.lines[0]!.costCenter?.code).toBe('ADM');
  });

  it('propiedad: la suma por cuenta de original + reversión es cero', () => {
    const cents = fc.integer({ min: 1, max: 10 ** 8 });
    const fmt = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
    fc.assert(
      fc.property(fc.array(cents, { minLength: 1, maxLength: 8 }), (amounts) => {
        const total = amounts.reduce((a, b) => a + b, 0);
        const original = posted([...amounts.map((a) => dr(caja, fmt(a))), cr(ingresos, fmt(total))]);
        const rev = reverse(original, accountsOf(caja, ingresos));
        const net = new Map<string, Money>();
        for (const l of original.lines) net.set(l.accountCode, (net.get(l.accountCode) ?? Money.zero()).add(l.debit).subtract(l.credit));
        for (const l of rev.lines) net.set(l.account.code.value, (net.get(l.account.code.value) ?? Money.zero()).add(l.debit).subtract(l.credit));
        return [...net.values()].every((m) => m.isZero()) && rev.totalDebit.equals(original.totalCredit);
      }),
    );
  });

  it('falla con VALIDATION_FAILED si una cuenta ya no admite movimientos', () => {
    const original = posted([dr(caja, '100'), cr(ingresos, '100')]);
    const inactive = acct('1105', { isActive: false });
    try {
      reverse(original, accountsOf(inactive, ingresos));
      expect.unreachable();
    } catch (e) {
      expect((e as ValidationFailed).code).toBe('VALIDATION_FAILED');
      expect((e as ValidationFailed).violations[0]?.message).toMatch(/movimiento|inactiva/);
    }
  });
});
