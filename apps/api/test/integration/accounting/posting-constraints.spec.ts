import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedFiscalYear, seedTestChart } from '../../fixtures/plan-de-cuentas-de-prueba.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';
import { insertRawEntry, loadRefs, type Refs } from '../support/sql-helpers.js';

/** La base rechaza por sí sola lo que el dominio ya atajaría (T043; INV-01…INV-04, INV-06). Conectado como sifca_app. */
let db: TestDb;
let tenant: string;
let n = 100;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  tenant = randomUUID();
  await db.withTenant(tenant, async (c) => {
    await seedTestChart(c, tenant);
    await seedFiscalYear(c, tenant, 2026);
  }, db.owner);
});

const run = <T>(fn: (c: import('pg').PoolClient, r: Refs) => Promise<T>) =>
  db.withTenant(tenant, async (c) => fn(c, await loadRefs(c)));

describe('constraint triggers y CHECK de la base', () => {
  it('acepta un comprobante válido (control)', async () => {
    await expect(run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }] }))).resolves.toBeTruthy();
  });

  it('rechaza al confirmar un comprobante descuadrado (INV-01)', async () => {
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '100.00', totalCredit: '100.00', lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '99.99' }] })),
    ).rejects.toThrow(/ENTRY_NOT_BALANCED/);
  });

  it('rechaza una cabecera con totales que no coinciden con las líneas', async () => {
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '200.00', totalCredit: '200.00', lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }] })),
    ).rejects.toThrow(/ENTRY_NOT_BALANCED/);
  });

  it('rechaza una cabecera con menos de dos líneas (R-CON-003)', async () => {
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '100.00', totalCredit: '100.00', lines: [{ account: '1105', debit: '100' }] })),
    ).rejects.toThrow(/ENTRY_NOT_BALANCED/);
  });

  it('rechaza una cabecera sin líneas', async () => {
    await expect(run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '100.00', totalCredit: '100.00', lines: [] }))).rejects.toThrow(/ENTRY_NOT_BALANCED/);
  });

  it('rechaza línea con ambos lados, en cero o negativa (R-CON-002)', async () => {
    for (const bad of [{ debit: '100', credit: '100' }, { debit: '0', credit: '0' }, { debit: '-5', credit: '0' }]) {
      await expect(
        run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '100.00', totalCredit: '100.00', lines: [{ account: '1105', ...bad }, { account: '4135', credit: '100' }] })),
      ).rejects.toThrow(/ck_line_(one_side|non_negative)/);
    }
  });

  it('rechaza más de 2 decimales en lugar de redondear en silencio (R-CON-009)', async () => {
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, totalDebit: '1.01', totalCredit: '1.01', lines: [{ account: '1105', debit: '1.005' }, { account: '4135', credit: '1.01' }] })),
    ).rejects.toThrow(/ck_line_scale/);
  });

  it('rechaza una cuenta acumuladora o inactiva (R-CON-003)', async () => {
    for (const code of ['13', '1199']) {
      await expect(
        run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: code, debit: '100' }, { account: '4135', credit: '100' }] })),
      ).rejects.toThrow(/ACCOUNT_NOT_POSTABLE/);
    }
  });

  it('rechaza una línea sin tercero en una cuenta que lo exige, o sin centro de costo (R-CON-008)', async () => {
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '130505', debit: '100' }, { account: '4135', credit: '100' }] })),
    ).rejects.toThrow(/PARTY_REQUIRED/);
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '5105', debit: '100' }, { account: '4135', credit: '100' }] })),
    ).rejects.toThrow(/COST_CENTER_REQUIRED/);
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '130505', debit: '100', partyId: randomUUID() }, { account: '4135', credit: '100' }] })),
    ).resolves.toBeTruthy();
  });

  it('rechaza una fecha en un período cerrado (R-CON-004) y fuera del período', async () => {
    await db.withTenant(tenant, (c) => c.query(`UPDATE acc.fiscal_period SET status='CLOSED', closed_at=now() WHERE year=2026 AND month=9`), db.owner);
    await expect(
      run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, date: '2026-09-30', lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }] })),
    ).rejects.toThrow(/PERIOD_CLOSED/);
    // período de octubre con fecha de septiembre (fuera del rango del período referenciado)
    await expect(
      run(async (c, r) => {
        const id = randomUUID();
        await c.query(
          `INSERT INTO acc.journal_entry (id, tenant_id, voucher_type_id, numbering_year, number, accounting_date, fiscal_period_id, description, source_type, status, total_debit, total_credit, posted_at, posted_by)
           VALUES ($1,$2,$3,0,$4,'2026-09-01',$5,'x','MANUAL','POSTED',1,1,now(),$6)`,
          [id, tenant, r.voucherTypes.get('AJ'), ++n, await r.periodByMonth(2026, 10), randomUUID()],
        );
      }),
    ).rejects.toThrow(/PERIOD_NOT_FOUND/);
  });

  it('rechaza un número duplicado del mismo tipo (R-CON-006)', async () => {
    const lines = [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }];
    await run((c, r) => insertRawEntry(c, r, tenant, { number: 9001, lines }));
    await expect(run((c, r) => insertRawEntry(c, r, tenant, { number: 9001, lines }))).rejects.toThrow(/uq_entry_number/);
    // otro tipo con el mismo número sí se permite
    await expect(run((c, r) => insertRawEntry(c, r, tenant, { type: 'FV', number: 9001, lines }))).resolves.toBeTruthy();
  });

  it('la FK compuesta impide una línea con fecha distinta a la de su cabecera', async () => {
    await expect(
      run(async (c, r) => {
        const id = await insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }] });
        await c.query(
          `INSERT INTO acc.journal_line (id, tenant_id, entry_id, accounting_date, line_no, account_id, debit) VALUES ($1,$2,$3,'2026-10-15',9,$4,1)`,
          [randomUUID(), tenant, id, r.accounts.get('1105')],
        );
      }),
    ).rejects.toThrow(/fk_line_entry/);
  });
});

describe('maestros y contador', () => {
  it('el contador solo avanza de uno en uno y no se borra', async () => {
    await run(async (c, r) => {
      await c.query(`INSERT INTO acc.voucher_sequence (tenant_id, voucher_type_id, scope_year, last_number) VALUES ($1,$2,0,0)`, [tenant, r.voucherTypes.get('AJ')]);
    });
    await expect(run((c) => c.query(`UPDATE acc.voucher_sequence SET last_number = last_number + 2`))).rejects.toThrow(/SEQUENCE_VIOLATION/);
    await expect(run((c) => c.query(`UPDATE acc.voucher_sequence SET last_number = last_number + 1`))).resolves.toBeTruthy();
    await expect(run((c) => c.query(`DELETE FROM acc.voucher_sequence`))).rejects.toThrow(/permission denied/);
  });

  it('un período solo cambia de estado y no se elimina; una cuenta con movimientos no cambia de código', async () => {
    await expect(run((c) => c.query(`UPDATE acc.fiscal_period SET ends_on = ends_on + 1 WHERE month = 3`))).rejects.toThrow(/PERIOD_VIOLATION/);
    await expect(db.withTenant(tenant, (c) => c.query('DELETE FROM acc.fiscal_period'), db.owner)).rejects.toThrow(/IMMUTABLE_RECORD/);
    await run((c, r) => insertRawEntry(c, r, tenant, { number: ++n, lines: [{ account: '1105', debit: '100' }, { account: '4135', credit: '100' }] }));
    await expect(run((c) => c.query(`UPDATE acc.account SET code = '9999' WHERE code = '1105'`))).rejects.toThrow(/ACCOUNT_IN_USE/);
    await expect(run((c) => c.query(`UPDATE acc.account SET name = 'Caja general' WHERE code = '1105'`))).resolves.toBeTruthy();
  });

  it('los períodos no se solapan', async () => {
    await expect(
      run((c) => c.query(`INSERT INTO acc.fiscal_period (id, tenant_id, year, month, starts_on, ends_on) VALUES ($1,$2,2026,13,'2026-10-15','2026-11-15')`, [randomUUID(), tenant])),
    ).rejects.toThrow(/ck_period_month|ex_period_no_overlap/);
    await expect(
      run((c) => c.query(`INSERT INTO acc.fiscal_period (id, tenant_id, year, month, starts_on, ends_on) VALUES ($1,$2,2027,1,'2026-10-15','2026-11-15')`, [randomUUID(), tenant])),
    ).rejects.toThrow(/ex_period_no_overlap/);
  });
});
