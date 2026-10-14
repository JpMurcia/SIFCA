import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** [001-06], SC-002: ninguna vía permite mutar un comprobante contabilizado. */
let db: TestDb;
let u: PgUnit;
let entryId: string;
beforeAll(async () => {
  db = await createTestDatabase();
  u = await makePgUnit(db);
  entryId = (await u.uc.postJournalEntry.execute(entryBody())).entry.id;
});
afterAll(async () => {
  await u.close();
  await db.close();
});

const asApp = (sql: string) => db.withTenant(u.tenantId, (c) => c.query(sql));
const asOwner = (sql: string) => db.withTenant(u.tenantId, (c) => c.query(sql), db.owner);

describe('con el usuario de base de datos de la aplicación (privilegios)', () => {
  for (const t of ['acc.journal_entry', 'acc.journal_line']) {
    it(`UPDATE, DELETE y TRUNCATE sobre ${t} fallan por privilegios`, async () => {
      await expect(asApp(`UPDATE ${t} SET ${t.endsWith('entry') ? "description = 'x'" : 'line_no = line_no + 10'}`)).rejects.toThrow(/permission denied/);
      await expect(asApp(`DELETE FROM ${t}`)).rejects.toThrow(/permission denied/);
      await expect(db.app.query(`TRUNCATE ${t}`)).rejects.toThrow(/permission denied/);
    });
  }
});

describe('con el propietario de las tablas (triggers)', () => {
  for (const t of ['acc.journal_entry', 'acc.journal_line']) {
    it(`UPDATE, DELETE y TRUNCATE sobre ${t} los rechaza el trigger IMMUTABLE_RECORD`, async () => {
      await expect(asOwner(`UPDATE ${t} SET ${t.endsWith('entry') ? "description = 'x'" : 'line_no = line_no + 10'}`)).rejects.toThrow(/IMMUTABLE_RECORD/);
      await expect(asOwner(`DELETE FROM ${t}`)).rejects.toThrow(/IMMUTABLE_RECORD/);
      await expect(db.owner.query(`TRUNCATE ${t} CASCADE`)).rejects.toThrow(/IMMUTABLE_RECORD/);
    });
  }

  it('el comprobante sigue intacto después de todos los intentos', async () => {
    const e = await u.uc.getJournalEntry.execute(entryId);
    expect(e.description).toBe('Venta de contado');
    expect(e.lines).toHaveLength(2);
  });
});

describe('reversión (la única forma de corregir)', () => {
  it('la base impide una segunda reversión del mismo comprobante incluso con SQL directo', async () => {
    const { entry: rev } = await u.uc.reverseJournalEntry.execute(entryId, { reason: 'Error de digitación' });
    expect(rev.reversalOf).toBe(entryId);
    // intento directo: otra cabecera que referencia al mismo original
    await expect(
      db.withTenant(u.tenantId, (c) =>
        c.query(
          `INSERT INTO acc.journal_entry (id, tenant_id, voucher_type_id, numbering_year, number, accounting_date, fiscal_period_id, description, source_type, source_id, status, reversal_of, reversal_reason, total_debit, total_credit, posted_at, posted_by)
           SELECT gen_random_uuid(), tenant_id, voucher_type_id, 0, 99999, accounting_date, fiscal_period_id, 'dup', 'REVERSAL', id, 'POSTED', id, 'dup', total_debit, total_credit, now(), posted_by
             FROM acc.journal_entry WHERE id = $1`,
          [entryId],
        ),
      ),
    ).rejects.toThrow(/uq_entry_reversal_of|ENTRY_NOT_BALANCED|violates/);
    await expect(u.uc.reverseJournalEntry.execute(entryId, { reason: 'Otra vez' })).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
  });

  it('el efecto neto del par sobre cada cuenta es cero (leído de la base)', async () => {
    const r = await db.withTenant(u.tenantId, (c) =>
      c.query(`SELECT a.code, round(sum(l.debit - l.credit), 2)::text AS net
                 FROM acc.journal_line l JOIN acc.account a ON a.id = l.account_id
                WHERE l.entry_id = $1 OR l.entry_id IN (SELECT id FROM acc.journal_entry WHERE reversal_of = $1)
                GROUP BY a.code ORDER BY a.code`, [entryId]),
    );
    expect(r.rows).toEqual([{ code: '1105', net: '0.00' }, { code: '4135', net: '0.00' }]);
  });

  it('reversedBy se calcula al leer y no se guarda en el original', async () => {
    const original = await u.uc.getJournalEntry.execute(entryId);
    expect(original.reversedBy).not.toBeNull();
    const cols = await db.admin.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='acc' AND table_name='journal_entry'`);
    expect(cols.rows.map((r) => r.column_name)).not.toContain('reversed_by');
  });
});
