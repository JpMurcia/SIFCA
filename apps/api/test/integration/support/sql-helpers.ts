import { randomUUID } from 'node:crypto';
import type pg from 'pg';

export interface Refs {
  accounts: Map<string, string>;
  voucherTypes: Map<string, string>;
  periodByMonth: (year: number, month: number) => Promise<string>;
}

export async function loadRefs(c: pg.PoolClient): Promise<Refs> {
  const a = await c.query('SELECT id, code FROM acc.account');
  const v = await c.query('SELECT id, code FROM acc.voucher_type');
  return {
    accounts: new Map(a.rows.map((r) => [r.code, r.id])),
    voucherTypes: new Map(v.rows.map((r) => [r.code, r.id])),
    periodByMonth: async (year, month) => (await c.query('SELECT id FROM acc.fiscal_period WHERE year = $1 AND month = $2', [year, month])).rows[0].id,
  };
}

export interface RawLine { account: string; debit?: string; credit?: string; partyId?: string | null }

/** Inserta cabecera + líneas con SQL directo (como lo haría un acceso a la base con el usuario de la aplicación). */
export async function insertRawEntry(
  c: pg.PoolClient,
  refs: Refs,
  tenant: string,
  o: { type?: string; number: number; date?: string; month?: number; lines: RawLine[]; totalDebit?: string; totalCredit?: string; id?: string; numberingYear?: number },
): Promise<string> {
  const id = o.id ?? randomUUID();
  const date = o.date ?? '2026-10-14';
  const month = o.month ?? Number(date.slice(5, 7));
  const sum = (k: 'debit' | 'credit') => o.lines.reduce((a, l) => a + Number(l[k] ?? 0), 0).toFixed(2);
  await c.query(
    `INSERT INTO acc.journal_entry (id, tenant_id, voucher_type_id, numbering_year, number, accounting_date, fiscal_period_id, description,
       source_type, status, total_debit, total_credit, posted_at, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'raw','MANUAL','POSTED',$8,$9,now(),$10)`,
    [id, tenant, refs.voucherTypes.get(o.type ?? 'AJ'), o.numberingYear ?? 0, o.number, date, await refs.periodByMonth(Number(date.slice(0, 4)), month), o.totalDebit ?? sum('debit'), o.totalCredit ?? sum('credit'), randomUUID()],
  );
  let n = 0;
  for (const l of o.lines) {
    await c.query(
      `INSERT INTO acc.journal_line (id, tenant_id, entry_id, accounting_date, line_no, account_id, party_id, debit, credit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [randomUUID(), tenant, id, date, ++n, refs.accounts.get(l.account), l.partyId ?? null, l.debit ?? '0', l.credit ?? '0'],
    );
  }
  return id;
}
