import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entryBody, makePgUnit, type PgUnit } from '../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../integration/support/postgres-harness.js';

/**
 * Objetivos de diseño de plan.md → Performance Goals (🔶, se calibran con esta prueba):
 *   · 1.000 contabilizaciones simultáneas del mismo tipo en ≤ 60 s, sin saltos ni duplicados (SC-003)
 *   · comprobante de ≤ 50 líneas: p95 ≤ 200 ms en el servidor
 *   · balance de prueba de un mes con 1.000.000 de líneas: p95 ≤ 3 s
 * Se ejecuta con `pnpm test:perf` (no forma parte del CI normal). PERF_LINES reduce la carga del balance.
 */
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

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]!;
const report = (name: string, value: string) => console.log(`[perf] ${name}: ${value}`);

describe('rendimiento de la contabilización', () => {
  it('1.000 contabilizaciones simultáneas → 1…1000 en ≤ 60 s', async () => {
    const t0 = performance.now();
    const rs = await Promise.all(Array.from({ length: 1000 }, () => u.uc.postJournalEntry.execute(entryBody({ voucherType: 'FV' }))));
    const secs = (performance.now() - t0) / 1000;
    report('1.000 simultáneas', `${secs.toFixed(1)} s (${(1000 / secs).toFixed(0)} comprobantes/s)`);
    expect(rs.map((r) => r.entry.number.value).sort((a, b) => a - b)).toEqual(Array.from({ length: 1000 }, (_, i) => i + 1));
    expect(secs).toBeLessThanOrEqual(60);
  }, 120_000);

  it('comprobante de 50 líneas: p95 ≤ 200 ms', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? { accountCode: '1105', debit: '10.00' } : { accountCode: '4135', credit: '10.00' }));
    const samples: number[] = [];
    for (let i = 0; i < 150; i++) {
      const t0 = performance.now();
      await u.uc.postJournalEntry.execute(entryBody({ voucherType: 'NC', lines }));
      samples.push(performance.now() - t0);
    }
    report('comprobante de 50 líneas', `p95 ${p95(samples).toFixed(0)} ms, mediana ${[...samples].sort((a, b) => a - b)[75]!.toFixed(0)} ms`);
    expect(p95(samples)).toBeLessThanOrEqual(200);
  }, 120_000);
});

describe('rendimiento del balance de prueba', () => {
  it('balance de un mes con ~1.000.000 de líneas: p95 ≤ 3 s', async () => {
    const totalLines = Number(process.env.PERF_LINES ?? 1_000_000);
    const perEntry = 50;
    const entries = Math.floor(totalLines / perEntry);
    const t = u.tenantId;
    const refs = await db.admin.query(
      `SELECT (SELECT id FROM acc.account WHERE tenant_id = $1 AND code = '1105') AS caja, (SELECT id FROM acc.account WHERE tenant_id = $1 AND code = '4135') AS ing,
              (SELECT id FROM acc.voucher_type WHERE tenant_id = $1 AND code = 'RC') AS vt, (SELECT id FROM acc.fiscal_period WHERE tenant_id = $1 AND year = 2026 AND month = 10) AS p`,
      [t],
    );
    const { caja, ing, vt, p } = refs.rows[0];
    const c = await db.admin.connect();
    const t0 = performance.now();
    try {
      // Carga masiva con el superusuario y sin triggers: es un generador de datos, no una ruta de la aplicación.
      await c.query('BEGIN');
      await c.query("SET LOCAL session_replication_role = 'replica'");
      await c.query(
        `INSERT INTO acc.journal_entry (id, tenant_id, voucher_type_id, numbering_year, number, accounting_date, fiscal_period_id, description, source_type, status, total_debit, total_credit, posted_at, posted_by)
         SELECT gen_random_uuid(), $1::uuid, $2::uuid, 0, g, DATE '2026-10-01' + (g % 28), $3::uuid, 'carga', 'MANUAL', 'POSTED', ${perEntry / 2 * 10}, ${perEntry / 2 * 10}, now(), $4::uuid
           FROM generate_series(1, $5::int) g`,
        [t, vt, p, randomUUID(), entries],
      );
      await c.query(
        `INSERT INTO acc.journal_line (id, tenant_id, entry_id, accounting_date, line_no, account_id, debit, credit)
         SELECT gen_random_uuid(), e.tenant_id, e.id, e.accounting_date, n, CASE WHEN n % 2 = 1 THEN $2::uuid ELSE $3::uuid END,
                CASE WHEN n % 2 = 1 THEN 10 ELSE 0 END, CASE WHEN n % 2 = 0 THEN 10 ELSE 0 END
           FROM acc.journal_entry e CROSS JOIN generate_series(1, ${perEntry}) n WHERE e.description = 'carga' AND e.tenant_id = $1::uuid`,
        [t, caja, ing],
      );
      await c.query('COMMIT');
    } finally {
      c.release();
    }
    await db.admin.query('ANALYZE acc.journal_line');
    report('carga de datos', `${totalLines.toLocaleString('es-CO')} líneas en ${((performance.now() - t0) / 1000).toFixed(0)} s`);

    const samples: number[] = [];
    for (let i = 0; i < 12; i++) {
      const s = performance.now();
      const tb = await u.uc.getTrialBalance.execute({ from: '2026-10-01', to: '2026-10-31' });
      samples.push(performance.now() - s);
      expect(tb.balanced).toBe(true);
    }
    report('balance de prueba', `p95 ${p95(samples).toFixed(0)} ms, mediana ${[...samples].sort((a, b) => a - b)[6]!.toFixed(0)} ms`);
    expect(p95(samples)).toBeLessThanOrEqual(3000);
  }, 900_000);
});
