import { Prisma } from '../../../../generated/prisma/client.js';
import { decodeCursor, encodeCursor, LocalDate, Money, type Page, type PageRequest } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { GeneralLedgerView, JournalBookRowView, LedgerReader, LedgerMovementView } from '../../application/ports/ledger-reader.js';

interface Key { d: string; t: string; n: string; l: number }
interface BookRow { entry_id: string; accounting_date: string; voucher_type: string; number: string; line_no: number; code: string; name: string; party_id: string | null; debit: string; credit: string; description: string | null }
interface MovRow { entry_id: string; accounting_date: string; voucher_type: string; number: string; line_no: number; debit: string; credit: string; running: string; description: string | null }

const cursorSql = (k: Key | undefined) =>
  k ? Prisma.sql`AND (l.accounting_date, vt.code, e.number, l.line_no) > (${k.d}::date, ${k.t}, ${k.n}::bigint, ${k.l}::int)` : Prisma.empty;
const keyOf = (r: { accounting_date: string; voucher_type: string; number: string; line_no: number }): Key => ({ d: r.accounting_date, t: r.voucher_type, n: r.number, l: r.line_no });

/** Diario y mayor: orden determinista `(fecha, tipo, número, línea)` y paginación por cursor sobre esa clave. */
export class PrismaLedgerReader implements LedgerReader {
  async journal(range: { from: LocalDate; to: LocalDate }, page: PageRequest): Promise<Page<JournalBookRowView>> {
    const after = decodeCursor<Key>(page.cursor);
    const rows = await currentTx().$queryRaw<BookRow[]>`
      SELECT l.entry_id::text AS entry_id, l.accounting_date::text AS accounting_date, vt.code AS voucher_type, e.number::text AS number, l.line_no,
             a.code, a.name, l.party_id::text AS party_id, round(l.debit, 2)::text AS debit, round(l.credit, 2)::text AS credit, l.description
        FROM acc.journal_line l
        JOIN acc.journal_entry e ON e.id = l.entry_id
        JOIN acc.voucher_type vt ON vt.id = e.voucher_type_id
        JOIN acc.account a ON a.id = l.account_id
       WHERE l.accounting_date BETWEEN ${range.from.toString()}::date AND ${range.to.toString()}::date ${cursorSql(after)}
       ORDER BY l.accounting_date, vt.code, e.number, l.line_no
       LIMIT ${page.limit + 1}`;
    const slice = rows.slice(0, page.limit);
    const items = slice.map((r): JournalBookRowView => ({
      entryId: r.entry_id, accountingDate: LocalDate.of(r.accounting_date), voucherType: r.voucher_type, number: Number(r.number), lineNo: r.line_no,
      accountCode: r.code, accountName: r.name, partyId: r.party_id, debit: Money.of(r.debit), credit: Money.of(r.credit), description: r.description,
    }));
    return { items, nextCursor: rows.length > page.limit ? encodeCursor(keyOf(slice.at(-1)!)) : null };
  }

  async generalLedger(q: { accountCode: string; from: LocalDate; to: LocalDate }, page: PageRequest): Promise<GeneralLedgerView | null> {
    const tx = currentTx();
    const account = await tx.account.findFirst({ where: { code: q.accountCode } });
    if (!account) return null;
    const sign = account.nature === 'CREDIT' ? -1 : 1;
    const from = q.from.toString();
    const to = q.to.toString();
    const [tot] = await tx.$queryRaw<{ opening: string; total: string }[]>`
      SELECT round(COALESCE(SUM(l.debit - l.credit) FILTER (WHERE l.accounting_date < ${from}::date), 0) * ${sign}, 2)::text AS opening,
             round(COALESCE(SUM(l.debit - l.credit) FILTER (WHERE l.accounting_date BETWEEN ${from}::date AND ${to}::date), 0) * ${sign}, 2)::text AS total
        FROM acc.journal_line l WHERE l.account_id = ${account.id}::uuid AND l.accounting_date <= ${to}::date`;
    const opening = Money.ofSigned(tot!.opening);
    const after = decodeCursor<Key>(page.cursor);
    const rows = await tx.$queryRaw<MovRow[]>`
      SELECT * FROM (
        SELECT l.entry_id::text AS entry_id, l.accounting_date::text AS accounting_date, vt.code AS voucher_type, e.number::text AS number, l.line_no,
               round(l.debit, 2)::text AS debit, round(l.credit, 2)::text AS credit, l.description,
               round((${opening.toString()}::numeric + SUM((l.debit - l.credit) * ${sign}) OVER (ORDER BY l.accounting_date, vt.code, e.number, l.line_no ROWS UNBOUNDED PRECEDING)), 2)::text AS running,
               l.accounting_date AS d_, vt.code AS t_, e.number AS n_, l.line_no AS l_
          FROM acc.journal_line l
          JOIN acc.journal_entry e ON e.id = l.entry_id
          JOIN acc.voucher_type vt ON vt.id = e.voucher_type_id
         WHERE l.account_id = ${account.id}::uuid AND l.accounting_date BETWEEN ${from}::date AND ${to}::date
      ) m
       WHERE ${after ? Prisma.sql`(m.d_, m.t_, m.n_, m.l_) > (${after.d}::date, ${after.t}, ${after.n}::bigint, ${after.l}::int)` : Prisma.sql`TRUE`}
       ORDER BY m.d_, m.t_, m.n_, m.l_
       LIMIT ${page.limit + 1}`;
    const slice = rows.slice(0, page.limit);
    const items = slice.map((r): LedgerMovementView => ({
      entryId: r.entry_id, accountingDate: LocalDate.of(r.accounting_date), voucherType: r.voucher_type, number: Number(r.number),
      debit: Money.of(r.debit), credit: Money.of(r.credit), runningBalance: Money.ofSigned(r.running), description: r.description,
    }));
    return {
      accountCode: account.code, accountName: account.name, nature: account.nature === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      openingBalance: opening, closingBalance: opening.add(Money.ofSigned(tot!.total)),
      movements: { items, nextCursor: rows.length > page.limit ? encodeCursor(keyOf(slice.at(-1)!)) : null },
    };
  }
}
