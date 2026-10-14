import { Money, type LocalDate } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { TrialBalanceReader } from '../../application/ports/trial-balance-reader.js';
import type { AccountBalanceRaw } from '../../domain/services/trial-balance-calculator.js';

interface Row { code: string; name: string; nature: string; opening_net: string; mov_debit: string; mov_credit: string }

/**
 * Agregación SQL determinista sobre `journal_line` (con `accounting_date` denormalizado: sin join a la cabecera).
 * Los importes salen como texto con 2 decimales exactos (nunca pasan por `number`). Orden por código (R-CON-010).
 */
export class PrismaTrialBalanceReader implements TrialBalanceReader {
  async read(range: { from: LocalDate; to: LocalDate }): Promise<readonly AccountBalanceRaw[]> {
    const from = range.from.toString();
    const to = range.to.toString();
    const rows = await currentTx().$queryRaw<Row[]>`
      SELECT a.code, a.name, a.nature,
             round(COALESCE(SUM(l.debit - l.credit) FILTER (WHERE l.accounting_date < ${from}::date), 0), 2)::text AS opening_net,
             round(COALESCE(SUM(l.debit)  FILTER (WHERE l.accounting_date >= ${from}::date), 0), 2)::text AS mov_debit,
             round(COALESCE(SUM(l.credit) FILTER (WHERE l.accounting_date >= ${from}::date), 0), 2)::text AS mov_credit
        FROM acc.journal_line l
        JOIN acc.account a ON a.id = l.account_id
       WHERE l.accounting_date <= ${to}::date
       GROUP BY a.code, a.name, a.nature
      HAVING COALESCE(SUM(l.debit - l.credit) FILTER (WHERE l.accounting_date < ${from}::date), 0) <> 0
          OR COUNT(*) FILTER (WHERE l.accounting_date >= ${from}::date) > 0
       ORDER BY a.code`;
    return rows.map((r) => ({
      code: r.code, name: r.name, nature: r.nature === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      openingNet: Money.ofSigned(r.opening_net), movementDebit: Money.of(r.mov_debit), movementCredit: Money.of(r.mov_credit),
    }));
  }
}
