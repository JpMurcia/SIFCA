import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { FAULT_STEPS, makeFailingPost } from '../../support/fault-injection.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** [001-08] / G-04 / INV-15: una falla en CUALQUIER paso no deja líneas, cabecera ni número consumido. */
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

const counts = () =>
  db.withTenant(u.tenantId, async (c) => ({
    entries: Number((await c.query('SELECT count(*) AS n FROM acc.journal_entry')).rows[0].n),
    lines: Number((await c.query('SELECT count(*) AS n FROM acc.journal_line')).rows[0].n),
    last: (await c.query(`SELECT COALESCE(max(last_number), 0) AS n FROM acc.voucher_sequence`)).rows[0].n as string,
  }));

describe('atomicidad de la contabilización', () => {
  it('el siguiente consecutivo del tipo AJ es 5 y una falla no lo consume', async () => {
    for (let i = 0; i < 4; i++) await u.uc.postJournalEntry.execute(entryBody());
    const before = await counts();
    expect(before.entries).toBe(4);
    for (const step of FAULT_STEPS) {
      await expect(makeFailingPost(u, step).execute(entryBody())).rejects.toThrow(/falla inyectada/);
      const after = await counts();
      expect(after, step).toEqual(before);
    }
    const ok = await u.uc.postJournalEntry.execute(entryBody());
    expect(ok.entry.number.value).toBe(5);
  });

  it('no se publican eventos de una contabilización fallida', async () => {
    const published = u.events.published.length;
    await expect(makeFailingPost(u, 'before-commit').execute(entryBody())).rejects.toThrow();
    expect(u.events.published.length).toBe(published);
  });
});
