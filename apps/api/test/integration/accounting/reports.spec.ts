import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { EXPECTED_TRIAL_BALANCE, postReferenceLedger } from '../../support/reference-ledger.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** T073 · US3: libros y balance sobre PostgreSQL real con el libro de referencia. */
let db: TestDb;
let u: PgUnit;
beforeAll(async () => {
  db = await createTestDatabase();
  u = await makePgUnit(db);
  await postReferenceLedger((b) => u.uc.postJournalEntry.execute(b));
});
afterAll(async () => {
  await u.close();
  await db.close();
});

const sha = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const tb = (level?: number) => u.uc.getTrialBalance.execute({ from: '2026-10-01', to: '2026-10-31', ...(level ? { level } : {}) });

describe('balance de prueba de referencia [001-11]', () => {
  it('da los saldos esperados y los totales 2.152.000 / 2.152.000', async () => {
    const t = await tb();
    const nonZero = t.rows.filter((r) => !r.closingDebit.isZero() || !r.closingCredit.isZero()).map((r) => [r.accountCode, r.closingDebit.toString(), r.closingCredit.toString()]);
    expect(nonZero).toEqual(EXPECTED_TRIAL_BALANCE.map((r) => [...r]));
    expect(t.totals.closingDebit.toString()).toBe('2152000.00');
    expect(t.totals.closingCredit.toString()).toBe('2152000.00');
    expect(t.balanced).toBe(true);
    expect(t.rows.find((r) => r.accountCode === '130505')!.closingDebit.isZero()).toBe(true);
  });

  it('el saldo inicial arrastra lo anterior al rango: noviembre abre con los saldos de octubre', async () => {
    const t = await u.uc.getTrialBalance.execute({ from: '2026-11-01', to: '2026-11-30' });
    expect(t.rows.find((r) => r.accountCode === '1110')!.openingDebit.toString()).toBe('952000.00');
    expect(t.rows.find((r) => r.accountCode === '1110')!.movementDebit.toString()).toBe('0.00');
    expect(t.totals.closingDebit.toString()).toBe('2152000.00');
  });

  it('acumula por nivel: clase y grupo', async () => {
    const byClass = await tb(1);
    expect(byClass.rows.map((r) => [r.accountCode, r.closingDebit.toString(), r.closingCredit.toString()])).toEqual([
      ['1', '1472000.00', '0.00'], ['2', '0.00', '152000.00'], ['3', '0.00', '1000000.00'], ['4', '0.00', '800000.00'], ['6', '480000.00', '0.00'],
    ]);
    expect(byClass.balanced).toBe(true);
  });

  it('es reproducible: dos ejecuciones dan el mismo SHA-256 [001-16]', async () => {
    expect(sha((await tb()).rows)).toBe(sha((await tb()).rows));
    const a = await u.uc.getJournalBook.execute({ from: '2026-10-01', to: '2026-10-31', limit: 100 });
    const b = await u.uc.getJournalBook.execute({ from: '2026-10-01', to: '2026-10-31', limit: 100 });
    expect(sha(a)).toBe(sha(b));
  });
});

describe('libro diario', () => {
  it('es cronológico y se pagina por cursor sin repetir ni omitir líneas', async () => {
    const all = await u.uc.getJournalBook.execute({ from: '2026-10-01', to: '2026-10-31', limit: 100 });
    expect(all.items).toHaveLength(14); // 2+3+2+3+2+2 líneas del libro de referencia
    const keys = all.items.map((r) => `${r.accountingDate}|${r.voucherType}|${String(r.number).padStart(6, '0')}|${r.lineNo}`);
    expect(keys).toEqual([...keys].sort());
    const collected: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await u.uc.getJournalBook.execute({ from: '2026-10-01', to: '2026-10-31', limit: 4, cursor });
      collected.push(...p.items.map((r) => `${r.entryId}:${r.lineNo}`));
      cursor = p.nextCursor ?? undefined;
    } while (cursor);
    expect(collected).toEqual(all.items.map((r) => `${r.entryId}:${r.lineNo}`));
  });
});

describe('libro mayor', () => {
  it('muestra saldo inicial, movimientos con saldo acumulado y saldo final en la naturaleza de la cuenta', async () => {
    const l = await u.uc.getGeneralLedger.execute({ accountCode: '1435', from: '2026-10-01', to: '2026-10-31' });
    expect(l.nature).toBe('DEBIT');
    expect(l.openingBalance.toString()).toBe('0.00');
    expect(l.movements.items.map((m) => [m.voucherType, m.debit.toString(), m.credit.toString(), m.runningBalance.toString()])).toEqual([
      ['AJ', '1000000.00', '0.00', '1000000.00'],
      ['FV', '0.00', '600000.00', '400000.00'],
      ['NC', '120000.00', '0.00', '520000.00'],
    ]);
    expect(l.closingBalance.toString()).toBe('520000.00');
  });

  it('con un rango posterior, el saldo inicial arrastra lo anterior', async () => {
    const l = await u.uc.getGeneralLedger.execute({ accountCode: '1435', from: '2026-10-06', to: '2026-10-31' });
    expect(l.openingBalance.toString()).toBe('400000.00');
    expect(l.movements.items.map((m) => m.runningBalance.toString())).toEqual(['520000.00']);
    expect(l.closingBalance.toString()).toBe('520000.00');
  });

  it('en una cuenta de naturaleza crédito el saldo normal es positivo', async () => {
    const l = await u.uc.getGeneralLedger.execute({ accountCode: '4135', from: '2026-10-01', to: '2026-10-31' });
    expect(l.nature).toBe('CREDIT');
    expect(l.closingBalance.toString()).toBe('1000000.00');
    expect(l.movements.items.at(-1)!.runningBalance.toString()).toBe('1000000.00');
  });

  it('NOT_FOUND si la cuenta no existe', async () => {
    await expect(u.uc.getGeneralLedger.execute({ accountCode: '999999', from: '2026-10-01', to: '2026-10-31' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('borradores sobre PostgreSQL', () => {
  it('se guardan, se reemplazan con versión, se listan por período y se descartan', async () => {
    const d = await u.uc.saveJournalDraft.execute({ voucherType: 'AJ', accountingDate: '2026-11-10', description: 'x', lines: [{ accountCode: '1105', debit: '10' }] });
    expect(d.version).toBe(1);
    const v2 = await u.uc.saveJournalDraft.execute({ voucherType: 'AJ', accountingDate: '2026-11-10', lines: [], version: 1 }, { draftId: d.id });
    expect(v2.version).toBe(2);
    await expect(u.uc.saveJournalDraft.execute({ voucherType: 'AJ', lines: [], version: 1 }, { draftId: d.id })).rejects.toMatchObject({ code: 'CONFLICT' });
    const nov = (await u.uc.listPeriods.execute({ year: 2026 })).find((p) => p.month === 11)!;
    expect((await u.uc.listJournalDrafts.execute({ periodId: nov.id })).items.map((x) => x.id)).toContain(d.id);
    await u.uc.discardJournalDraft.execute(d.id);
    await expect(u.uc.discardJournalDraft.execute(d.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('cierre y reapertura sobre PostgreSQL', () => {
  it('[001-12] un borrador bloquea el cierre; descartado y con el balance cuadrado, cierra y queda en la bitácora', async () => {
    const oct = (await u.uc.listPeriods.execute({ year: 2026 })).find((p) => p.month === 10)!;
    const draft = await u.uc.saveJournalDraft.execute({ voucherType: 'AJ', accountingDate: '2026-10-25', lines: [{ accountCode: '1105', debit: '1' }] });
    await expect(u.uc.closePeriod.execute(oct.id)).rejects.toMatchObject({ code: 'PERIOD_CLOSE_BLOCKED' });
    await u.uc.discardJournalDraft.execute(draft.id);
    const closed = await u.uc.closePeriod.execute(oct.id);
    expect(closed.status).toBe('CLOSED');
    const log = await db.withTenant(u.tenantId, async (c) => (await c.query(`SELECT action, actor_id, before, after FROM audit.audit_log WHERE entity_id = $1`, [oct.id])).rows);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'accounting.period.closed', actor_id: u.userId, before: { status: 'OPEN' } });
    await expect(u.uc.postJournalEntry.execute(entryBody())).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
  });

  it('[001-14] la reapertura exige permiso y motivo y deja bitácora con el motivo', async () => {
    const oct = (await u.uc.listPeriods.execute({ year: 2026 })).find((p) => p.month === 10)!;
    u.setPermissions(['accounting.period.close']);
    await expect(u.uc.reopenPeriod.execute(oct.id, { reason: 'Corrección de una factura omitida' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    u.setPermissions(['accounting.period.reopen', 'accounting.entry.post', 'accounting.report.read']);
    await expect(u.uc.reopenPeriod.execute(oct.id, {})).rejects.toMatchObject({ name: 'ZodError' });
    const reopened = await u.uc.reopenPeriod.execute(oct.id, { reason: 'Corrección de una factura omitida' });
    expect(reopened.status).toBe('OPEN');
    const log = await db.withTenant(u.tenantId, async (c) => (await c.query(`SELECT reason, before, after FROM audit.audit_log WHERE action = 'accounting.period.reopened'`)).rows);
    expect(log).toEqual([{ reason: 'Corrección de una factura omitida', before: expect.objectContaining({ status: 'CLOSED' }), after: { status: 'OPEN' } }]);
    await expect(u.uc.postJournalEntry.execute(entryBody())).resolves.toBeTruthy();
  });
});

describe('cierre anual sobre PostgreSQL [001-15]', () => {
  it('cancela las cuentas de resultado, traslada 320.000 a la utilidad y es reversible', async () => {
    const u = await makePgUnit(db); // empresa propia: los otros bloques ya movieron saldos
    await postReferenceLedger((b) => u.uc.postJournalEntry.execute(b));
    const ids = await db.withTenant(u.tenantId, async (c) => Object.fromEntries((await c.query(`SELECT code, id FROM acc.account WHERE code IN ('5905','3605')`)).rows.map((r) => [r.code, r.id])));
    const body = { profitAndLossAccountId: ids['5905'], yearResultAccountId: ids['3605'], accountingDate: '2026-12-31', voucherType: 'CI' };
    const { entry } = await u.uc.closeFiscalYear.execute(2026, body);
    expect(entry.source.type).toBe('YEAR_CLOSING');
    const closing = await u.uc.getTrialBalance.execute({ from: '2026-01-01', to: '2026-12-31' });
    const by = Object.fromEntries(closing.rows.map((r) => [r.accountCode, r]));
    for (const c of ['4135', '4175', '6135', '5905']) expect(by[c]!.closingDebit.isZero() && by[c]!.closingCredit.isZero(), c).toBe(true);
    expect(by['3605']!.closingCredit.toString()).toBe('320000.00');
    expect(closing.balanced).toBe(true);
    await expect(u.uc.closeFiscalYear.execute(2026, body)).rejects.toMatchObject({ code: 'CONFLICT' });
    await u.uc.reverseJournalEntry.execute(entry.id, { reason: 'Reabrir el ejercicio', accountingDate: '2026-12-31' });
    const back = await u.uc.getTrialBalance.execute({ from: '2026-01-01', to: '2026-12-31' });
    const b = Object.fromEntries(back.rows.map((r) => [r.accountCode, r]));
    expect([b['4135']!.closingCredit.toString(), b['4175']!.closingDebit.toString(), b['6135']!.closingDebit.toString()]).toEqual(['1000000.00', '200000.00', '480000.00']);
    await u.close();
  });
});
