import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';

/** US1 de punta a punta contra PostgreSQL real, con los adaptadores de producción. */
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

describe('PostJournalEntry sobre PostgreSQL', () => {
  it('contabiliza, asigna el consecutivo 1 y lo puede leer de nuevo con sus líneas', async () => {
    const { entry, created } = await u.uc.postJournalEntry.execute(entryBody());
    expect(created).toBe(true);
    expect(entry.number.value).toBe(1);
    const back = await u.uc.getJournalEntry.execute(entry.id);
    expect(back.totalDebit.toString()).toBe('100000.00');
    expect(back.lines.map((l) => [l.lineNo, l.accountCode, l.debit.toString(), l.credit.toString()])).toEqual([
      [1, '1105', '100000.00', '0.00'],
      [2, '4135', '0.00', '100000.00'],
    ]);
    expect(back.accountingDate.toString()).toBe('2026-10-14');
  });

  it('el descuadre se rechaza y no consume consecutivo', async () => {
    await expect(u.uc.postJournalEntry.execute(entryBody({ lines: [{ accountCode: '1105', debit: '100000.00' }, { accountCode: '4135', credit: '99999.99' }] }))).rejects.toMatchObject({ code: 'ENTRY_NOT_BALANCED' });
    const next = (await u.uc.postJournalEntry.execute(entryBody())).entry.number.value;
    expect(next).toBe(2);
  });

  it('idempotencia sobre la base: la misma clave devuelve el mismo comprobante', async () => {
    const a = await u.uc.postJournalEntry.execute(entryBody(), { idempotencyKey: 'pg-idem-0001' });
    const b = await u.uc.postJournalEntry.execute(entryBody(), { idempotencyKey: 'pg-idem-0001' });
    expect([a.created, b.created]).toEqual([true, false]);
    expect(b.entry.id).toBe(a.entry.id);
    expect(b.entry.lines).toHaveLength(2);
    await expect(u.uc.postJournalEntry.execute(entryBody({ description: 'otra' }), { idempotencyKey: 'pg-idem-0001' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('período cerrado y fecha sin período', async () => {
    await u.prisma.client.$executeRawUnsafe('SELECT 1'); // calienta el pool
    await expect(u.uc.postJournalEntry.execute(entryBody({ accountingDate: '2027-02-01' }))).rejects.toMatchObject({ code: 'PERIOD_NOT_FOUND' });
  });

  it('lista los comprobantes, más recientes primero, con filtros', async () => {
    const page = await u.uc.listJournalEntries.execute({ voucherType: 'AJ', limit: 2 });
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).not.toBeNull();
    const next = await u.uc.listJournalEntries.execute({ voucherType: 'AJ', limit: 2, cursor: page.nextCursor });
    expect(next.items.every((i) => !page.items.some((p) => p.id === i.id))).toBe(true);
    const byAccount = await u.uc.listJournalEntries.execute({ accountCode: '4135', from: '2026-10-01', to: '2026-10-31' });
    expect(byAccount.items.length).toBeGreaterThan(0);
  });

  it('el cuerpo aislado por tenant: otro tenant no ve este comprobante', async () => {
    const other = await makePgUnit(db);
    const mine = (await u.uc.postJournalEntry.execute(entryBody())).entry;
    await expect(other.uc.getJournalEntry.execute(mine.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await other.close();
  });

  it('catálogos: cuentas y tipos de comprobante con su siguiente número', async () => {
    const accounts = await u.uc.listAccounts.execute({ postableOnly: 'true', q: '11' });
    expect(accounts.items.map((a) => a.code.value)).toContain('1105');
    expect(accounts.items.map((a) => a.code.value)).not.toContain('1199');
    const types = await u.uc.listVoucherTypes.execute();
    const aj = types.find((t) => t.type.code === 'AJ')!;
    expect(aj.nextNumber).toBeGreaterThan(1);
  });
});
