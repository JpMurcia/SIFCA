import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** T072 · research §6: el cierre (FOR UPDATE del período) y la contabilización (FOR SHARE) se serializan. */
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

describe('cierre de período concurrente con contabilizaciones', () => {
  it('nunca queda un comprobante dentro de un período CLOSED que se cerró antes de que él se confirmara', async () => {
    const periods = await u.uc.listPeriods.execute({ year: 2026 });
    const october = periods.find((p) => p.month === 10)!;
    const posts = Array.from({ length: 50 }, (_, i) =>
      u.uc.postJournalEntry.execute(entryBody({ description: `Carrera ${i}` })).then(
        (r) => ({ ok: true as const, number: r.entry.number.value }),
        (e: { code: string }) => ({ ok: false as const, code: e.code }),
      ),
    );
    const close = u.uc.closePeriod.execute(october.id).then(() => 'closed', (e: { code: string }) => e.code);
    const [results, closeResult] = [await Promise.all(posts), await close];
    expect(closeResult).toBe('closed');
    // los que llegaron después del cierre recibieron PERIOD_CLOSED; los demás se confirmaron antes
    for (const r of results) if (!r.ok) expect(r.code).toBe('PERIOD_CLOSED');
    const committed = results.filter((r) => r.ok).length;
    const rows = await db.withTenant(u.tenantId, async (c) => ({
      entries: Number((await c.query('SELECT count(*) AS n FROM acc.journal_entry')).rows[0].n),
      afterClose: Number(
        (await c.query(
          `SELECT count(*) AS n FROM acc.journal_entry e JOIN acc.fiscal_period p ON p.id = e.fiscal_period_id
            WHERE p.status = 'CLOSED' AND e.posted_at > p.closed_at`,
        )).rows[0].n,
      ),
    }));
    expect(rows.entries).toBe(committed);
    expect(rows.afterClose).toBe(0);
    // y el consecutivo de los que sí se confirmaron es contiguo
    const numbers = results.flatMap((r) => (r.ok ? [r.number] : [])).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: committed }, (_, i) => i + 1));
    // después del cierre ya nadie contabiliza
    await expect(u.uc.postJournalEntry.execute(entryBody())).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
  });
});
