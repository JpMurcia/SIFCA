import { describe, expect, it } from 'vitest';
import { asId } from '../../../../src/shared-kernel/index.js';
import { AccountCode } from '../../../../src/modules/accounting/domain/value-objects/account-code.js';
import { Account, type AccountProps } from '../../../../src/modules/accounting/domain/entities/account.js';
import { VoucherType } from '../../../../src/modules/accounting/domain/entities/voucher-type.js';
import { LocalDate } from '../../../../src/shared-kernel/index.js';

const id = () => asId<'AccountId'>('0195f3a0-0000-7000-8000-000000000001');
const account = (o: Partial<AccountProps> = {}) =>
  Account.restore({ id: id(), code: AccountCode.of('1105'), name: 'Caja', level: 4, nature: 'DEBIT', allowsPosting: true, requiresParty: false, requiresCostCenter: false, isActive: true, ...o });

describe('AccountCode', () => {
  it('acepta 1 a 12 dígitos y rechaza el resto', () => {
    expect(AccountCode.of('130505').value).toBe('130505');
    for (const bad of ['', 'abc', '1'.repeat(13), '13 05', '-1']) expect(() => AccountCode.of(bad)).toThrow();
  });
  it('calcula el prefijo por nivel para acumular', () => {
    expect(AccountCode.of('130505').prefix(2)).toBe('13');
    expect(AccountCode.of('13').prefix(4)).toBe('13');
  });
});

describe('Account (R-CON-003, R-CON-008, R-CON-013)', () => {
  it('recibe movimientos solo si es de movimiento y está activa', () => {
    expect(account().canReceivePostings()).toBe(true);
    expect(account({ allowsPosting: false }).canReceivePostings()).toBe(false);
    expect(account({ isActive: false }).canReceivePostings()).toBe(false);
  });
});

describe('VoucherType', () => {
  it('el año de numeración es 0 si numera por TENANT y el año contable si numera por YEAR', () => {
    const base = { id: asId<'VoucherTypeId'>('0195f3a0-0000-7000-8000-000000000002'), code: 'AJ', name: 'Ajuste' };
    expect(VoucherType.restore({ ...base, numberingScope: 'TENANT' }).scopeYearFor(LocalDate.of('2026-10-14'))).toBe(0);
    expect(VoucherType.restore({ ...base, numberingScope: 'YEAR' }).scopeYearFor(LocalDate.of('2026-10-14'))).toBe(2026);
  });
});
