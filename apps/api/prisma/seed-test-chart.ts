/**
 * `pnpm --filter @sifca/api seed:test-chart` — siembra el plan de cuentas de PRUEBA, tipos de comprobante y el año
 * fiscal 2026 para el tenant indicado (SIFCA_TENANT_ID). NO es el PUC de producción. Usa el rol sifca_owner.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { seedFiscalYear, seedTestChart } from '../test/fixtures/plan-de-cuentas-de-prueba.js';

const url = process.env.DATABASE_MIGRATION_URL ?? 'postgresql://sifca_owner:sifca_owner_dev@127.0.0.1:5432/sifca';
const tenantId = process.env.SIFCA_TENANT_ID ?? randomUUID();
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await seedTestChart(client, tenantId);
  await seedFiscalYear(client, tenantId, 2026);
  await client.query('COMMIT');
  console.log(`Sembrado el tenant ${tenantId}`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
