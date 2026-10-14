import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedFiscalYear } from '../../fixtures/plan-de-cuentas-de-prueba.js';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** SC-003 y R-CON-006: consecutivos contiguos y únicos incluso con contabilizaciones simultáneas. */
let db: TestDb;
let u: PgUnit;
beforeAll(async () => {
  db = await createTestDatabase();
  u = await makePgUnit(db);
});
afterAll(async () => {
  await u.close();
  await db.close();
});

describe('consecutivos', () => {
  it('1.000 contabilizaciones simultáneas del tipo AJ producen exactamente 1…1000 [SC-003]', async () => {
    const results = await Promise.all(Array.from({ length: 1000 }, (_, i) => u.uc.postJournalEntry.execute(entryBody({ description: `Concurrente ${i}` }))));
    const numbers = results.map((r) => r.entry.number.value).sort((a, b) => a - b);
    expect(numbers).toHaveLength(1000);
    expect(numbers[0]).toBe(1);
    expect(numbers.at(-1)).toBe(1000);
    expect(new Set(numbers).size).toBe(1000);
    // contiguos: cada uno es el anterior + 1
    expect(numbers.every((n, i) => n === i + 1)).toBe(true);
  }, 300_000);

  it('cada tipo numera por separado', async () => {
    const fv = await u.uc.postJournalEntry.execute(entryBody({ voucherType: 'FV' }));
    expect(fv.entry.number.value).toBe(1);
  });

  it('con numbering_scope = YEAR cada año reinicia en 1', async () => {
    await db.withTenant(u.tenantId, (c) => seedFiscalYear(c, u.tenantId, 2027), db.owner);
    const lines = [{ accountCode: '1105', debit: '10.00' }, { accountCode: '4135', credit: '10.00' }];
    const a = await u.uc.postJournalEntry.execute(entryBody({ voucherType: 'CE', accountingDate: '2026-10-14', lines }));
    const b = await u.uc.postJournalEntry.execute(entryBody({ voucherType: 'CE', accountingDate: '2026-10-15', lines }));
    const c = await u.uc.postJournalEntry.execute(entryBody({ voucherType: 'CE', accountingDate: '2027-01-05', lines }));
    expect([a.entry.number.value, b.entry.number.value, c.entry.number.value]).toEqual([1, 2, 1]);
    expect([a.entry.numberingYear, c.entry.numberingYear]).toEqual([2026, 2027]);
  });

  it('una contabilización que falla en el período no consume número aunque otras corran a la vez', async () => {
    const bad = Array.from({ length: 20 }, () => u.uc.postJournalEntry.execute(entryBody({ accountingDate: '2031-01-01' })).catch((e: { code: string }) => e.code));
    const good = Array.from({ length: 20 }, () => u.uc.postJournalEntry.execute(entryBody({ voucherType: 'NC' })));
    const [badRes, goodRes] = [await Promise.all(bad), await Promise.all(good)];
    expect(badRes.every((c) => c === 'PERIOD_NOT_FOUND')).toBe(true);
    expect(goodRes.map((r) => r.entry.number.value).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
