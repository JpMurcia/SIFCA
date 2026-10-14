import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** G-07: aislamiento por tenant con RLS forzada (T022). */
let db: TestDb;
const A = randomUUID();
const B = randomUUID();

beforeAll(async () => {
  db = await createTestDatabase();
  for (const t of [A, B]) {
    await db.withTenant(t, async (c) => {
      await c.query(`INSERT INTO acc.cost_center (id, tenant_id, code, name) VALUES ($1, $2, 'CC1', 'Centro ' || $3::text)`, [randomUUID(), t, t]);
      await c.query(
        `INSERT INTO acc.voucher_type (id, tenant_id, code, name, numbering_scope) VALUES ($1, $2, 'AJ', 'Ajuste', 'TENANT')`,
        [randomUUID(), t],
      );
      await c.query(
        `INSERT INTO audit.audit_log (id, tenant_id, actor_id, action, entity_type, entity_id, occurred_at)
         VALUES ($1, $2, $3, 'test', 'x', $4, now())`,
        [randomUUID(), t, randomUUID(), randomUUID()],
      );
    });
  }
});
afterAll(async () => {
  await db.close();
});

describe('aislamiento por tenant', () => {
  it('el contexto de A solo ve filas de A en tablas de acc y de audit', async () => {
    await db.withTenant(A, async (c) => {
      for (const t of ['acc.cost_center', 'acc.voucher_type', 'audit.audit_log']) {
        const r = await c.query(`SELECT DISTINCT tenant_id FROM ${t}`);
        expect(r.rows, t).toEqual([{ tenant_id: A }]);
      }
    });
  });

  it('un INSERT con el tenant_id de B desde el contexto de A falla', async () => {
    await expect(
      db.withTenant(A, (c) =>
        c.query(`INSERT INTO acc.cost_center (id, tenant_id, code, name) VALUES ($1, $2, 'CCX', 'Intruso')`, [randomUUID(), B]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('sin app.tenant_id no se ve ni se escribe nada (fallo seguro)', async () => {
    const r = await db.app.query('SELECT * FROM acc.cost_center');
    expect(r.rows).toHaveLength(0);
    await expect(
      db.app.query(`INSERT INTO acc.cost_center (id, tenant_id, code, name) VALUES ($1, $2, 'CCY', 'Sin contexto')`, [randomUUID(), A]),
    ).rejects.toThrow(/row-level security/i);
  });

  it('FORCE: tampoco el propietario ve filas de otro tenant ni sin contexto', async () => {
    const r = await db.owner.query('SELECT * FROM acc.cost_center');
    expect(r.rows).toHaveLength(0);
  });
});
