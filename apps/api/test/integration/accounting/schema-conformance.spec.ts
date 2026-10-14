import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/**
 * Conformidad del esquema con docs/specs/001-…/data-model.md §2–§4 (T021).
 * Si una migración regenerada pierde RLS, REVOKE, triggers o restricciones, esta prueba falla.
 */
let db: TestDb;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db.close();
});

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await db.admin.query(sql, params)).rows as T[];

const ACC_TABLES = ['account', 'cost_center', 'voucher_type', 'voucher_sequence', 'fiscal_period', 'journal_entry', 'journal_line', 'journal_draft'];

describe('tablas y propietario', () => {
  it('existen todas las tablas de acc y audit.audit_log, propiedad de sifca_owner', async () => {
    const rows = await q<{ schemaname: string; tablename: string; tableowner: string }>(
      `SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname IN ('acc','audit')`,
    );
    const names = rows.map((r) => `${r.schemaname}.${r.tablename}`).sort();
    expect(names).toEqual([...ACC_TABLES.map((t) => `acc.${t}`), 'audit.audit_log'].sort());
    for (const r of rows) expect(r.tableowner).toBe('sifca_owner');
  });

  it('sifca_app no es superusuario, ni BYPASSRLS, ni propietario', async () => {
    const [role] = await q<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>(
      `SELECT rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = 'sifca_app'`,
    );
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  });
});

describe('restricciones (CHECK / UNIQUE / EXCLUDE / FK)', () => {
  const expected: Record<string, Array<[string, string]>> = {
    journal_entry: [
      ['ck_entry_balanced', 'c'], ['ck_entry_status', 'c'], ['ck_entry_source_id', 'c'], ['ck_entry_reversal_reason', 'c'],
      ['ck_entry_reversal_source', 'c'], ['ck_entry_total_positive', 'c'], ['ck_entry_number_positive', 'c'],
      ['uq_entry_number', 'u'], ['uq_entry_id_tenant_date', 'u'], ['fk_entry_voucher_type', 'f'], ['fk_entry_period', 'f'], ['fk_entry_reversal_of', 'f'],
    ],
    journal_line: [
      ['ck_line_one_side', 'c'], ['ck_line_non_negative', 'c'], ['ck_line_scale', 'c'], ['uq_line_entry_lineno', 'u'],
      ['fk_line_entry', 'f'], ['fk_line_account', 'f'], ['fk_line_cost_center', 'f'],
    ],
    fiscal_period: [['uq_period_tenant_year_month', 'u'], ['ex_period_no_overlap', 'x'], ['ck_period_closed_at', 'c'], ['ck_period_month', 'c'], ['ck_period_range', 'c']],
    voucher_type: [['uq_voucher_type_code', 'u'], ['ck_voucher_scope', 'c']],
    voucher_sequence: [['ck_sequence_non_negative', 'c']],
    account: [['uq_account_tenant_code', 'u'], ['ck_account_nature', 'c'], ['ck_account_code', 'c']],
  };
  for (const [table, list] of Object.entries(expected)) {
    it(`${table} tiene sus restricciones`, async () => {
      const rows = await q<{ conname: string; contype: string }>(
        `SELECT conname, contype FROM pg_constraint WHERE conrelid = ('acc.' || $1)::regclass`,
        [table],
      );
      const have = new Map(rows.map((r) => [r.conname, r.contype]));
      for (const [name, type] of list) expect(have.get(name), `${table}.${name}`).toBe(type);
    });
  }

  it('índices únicos parciales (reversal_of e idempotency_key)', async () => {
    const rows = await q<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='acc' AND tablename='journal_entry'`,
    );
    const by = new Map(rows.map((r) => [r.indexname, r.indexdef]));
    expect(by.get('uq_entry_reversal_of')).toMatch(/UNIQUE.*\(reversal_of\).*WHERE.*reversal_of IS NOT NULL/s);
    expect(by.get('uq_entry_idempotency')).toMatch(/UNIQUE.*\(tenant_id, idempotency_key\).*WHERE/s);
  });
});

describe('triggers de inmutabilidad y de reglas', () => {
  const expected: Record<string, string[]> = {
    'acc.journal_entry': ['trg_entry_immutable', 'trg_entry_no_truncate', 'trg_entry_balanced_h', 'trg_entry_period'],
    'acc.journal_line': ['trg_line_immutable', 'trg_line_no_truncate', 'trg_entry_balanced_l', 'trg_line_validate'],
    'acc.voucher_sequence': ['trg_sequence_guard'],
    'acc.fiscal_period': ['trg_period_guard'],
    'acc.account': ['trg_account_guard'],
    'audit.audit_log': ['trg_audit_immutable', 'trg_audit_no_truncate'],
  };
  for (const [table, names] of Object.entries(expected)) {
    it(`${table} tiene ${names.join(', ')}`, async () => {
      const rows = await q<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE tgrelid = $1::regclass AND NOT tgisinternal`, [table]);
      for (const n of names) expect(rows.map((r) => r.tgname)).toContain(n);
    });
  }

  it('el cuadre y la coherencia son constraint triggers DIFERIDOS', async () => {
    const rows = await q<{ tgname: string; tgdeferrable: boolean; tginitdeferred: boolean }>(
      `SELECT tgname, tgdeferrable, tginitdeferred FROM pg_trigger WHERE tgname IN ('trg_entry_balanced_h','trg_entry_balanced_l')`,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect([r.tgdeferrable, r.tginitdeferred]).toEqual([true, true]);
  });
});

describe('RLS forzada con política de tenant', () => {
  it('todas las tablas tienen ENABLE + FORCE y la política tenant_isolation', async () => {
    const rows = await q<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('acc','audit') AND c.relkind = 'r'`,
    );
    expect(rows).toHaveLength(ACC_TABLES.length + 1);
    for (const r of rows) expect([r.relrowsecurity, r.relforcerowsecurity], r.relname).toEqual([true, true]);
    const pol = await q<{ tablename: string; policyname: string }>(`SELECT tablename, policyname FROM pg_policies WHERE schemaname IN ('acc','audit')`);
    expect(pol.filter((p) => p.policyname === 'tenant_isolation')).toHaveLength(ACC_TABLES.length + 1);
  });
});

describe('privilegios del rol de la aplicación (data-model §4)', () => {
  const priv = async (table: string, p: string) =>
    (await q<{ ok: boolean }>(`SELECT has_table_privilege('sifca_app', $1, $2) AS ok`, [table, p]))[0]!.ok;

  it('journal_entry y journal_line: solo SELECT e INSERT', async () => {
    for (const t of ['acc.journal_entry', 'acc.journal_line']) {
      expect(await priv(t, 'SELECT')).toBe(true);
      expect(await priv(t, 'INSERT')).toBe(true);
      expect(await priv(t, 'UPDATE')).toBe(false);
      expect(await priv(t, 'DELETE')).toBe(false);
      expect(await priv(t, 'TRUNCATE')).toBe(false);
    }
  });
  it('audit_log: SELECT e INSERT', async () => {
    expect(await priv('audit.audit_log', 'INSERT')).toBe(true);
    expect(await priv('audit.audit_log', 'UPDATE')).toBe(false);
    expect(await priv('audit.audit_log', 'DELETE')).toBe(false);
    expect(await priv('audit.audit_log', 'TRUNCATE')).toBe(false);
  });
  it('voucher_sequence: UPDATE solo de last_number y sin DELETE', async () => {
    expect(await priv('acc.voucher_sequence', 'DELETE')).toBe(false);
    const cols = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.column_privileges
        WHERE grantee='sifca_app' AND table_schema='acc' AND table_name='voucher_sequence' AND privilege_type='UPDATE'`,
    );
    expect(cols.map((c) => c.column_name)).toEqual(['last_number']);
  });
  it('maestros sin DELETE; borradores con DELETE', async () => {
    for (const t of ['acc.account', 'acc.cost_center', 'acc.voucher_type', 'acc.fiscal_period']) expect(await priv(t, 'DELETE'), t).toBe(false);
    expect(await priv('acc.journal_draft', 'DELETE')).toBe(true);
  });
});
