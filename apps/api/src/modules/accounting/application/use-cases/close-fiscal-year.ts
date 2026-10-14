import { LocalDate, Money, NotFoundError, type Clock, type IdGenerator, type PermissionChecker, type RequestContextPort, type UnitOfWork, ConflictError } from '../../../../shared-kernel/index.js';
import { CloseFiscalYearRequestSchema } from '../schemas/index.js';
import type { JournalEntry } from '../../domain/entities/journal-entry.js';
import { ValidationFailed } from '../../domain/errors/accounting-errors.js';
import type { AccountRepository } from '../ports/account-repository.js';
import type { JournalEntryRepository } from '../ports/journal-entry-repository.js';
import type { TrialBalanceReader } from '../ports/trial-balance-reader.js';
import type { PostJournalEntry } from './post-journal-entry.js';

export const CLOSE_YEAR_PERMISSION = 'accounting.year.close';

/**
 * Cierre anual (R-CON-012, 🔶): cancela las cuentas de resultado (clases 4–7) contra «Ganancias y pérdidas» y traslada
 * el resultado a la cuenta de utilidad/pérdida del ejercicio, en UN comprobante `YEAR_CLOSING` que sigue las mismas
 * reglas que cualquiera (cuadra, período abierto, consecutivo) y por eso es reversible.
 * Las cuentas de destino se parametrizan por empresa: el PUC fija grupo 59 y 36, pero depende del plan de cada una.
 */
export class CloseFiscalYear {
  constructor(
    private readonly d: {
      uow: UnitOfWork; permissions: PermissionChecker; requestContext: RequestContextPort; clock: Clock; ids: IdGenerator;
      accounts: AccountRepository; trialBalance: TrialBalanceReader; entries: JournalEntryRepository; post: PostJournalEntry;
    },
  ) {}

  async execute(year: number, rawInput: unknown): Promise<{ entry: JournalEntry }> {
    this.d.permissions.assert(CLOSE_YEAR_PERMISSION);
    const input = CloseFiscalYearRequestSchema.parse(rawInput);
    const date = LocalDate.of(input.accountingDate);
    if (date.year !== year) throw new ValidationFailed([{ field: 'accountingDate', message: `La fecha del cierre debe estar en ${year}`, rule: 'R-CON-012' }]);
    const from = LocalDate.of(`${year}-01-01`);

    return this.d.uow.run(async () => {
      const existing = await this.d.entries.list({ sourceType: 'YEAR_CLOSING', from, to: LocalDate.of(`${year}-12-31`) }, { limit: 50 });
      if (existing.items.some((e) => e.reversedBy === null)) throw new ConflictError(`El ejercicio ${year} ya tiene un cierre anual vigente; reverse ese comprobante antes de repetirlo`);

      const targets = await this.d.accounts.findByIds([input.profitAndLossAccountId, input.yearResultAccountId]);
      const pnl = targets.get(input.profitAndLossAccountId);
      const result = targets.get(input.yearResultAccountId);
      if (!pnl || !result) throw new NotFoundError('La cuenta de ganancias y pérdidas o de resultado del ejercicio');

      const raw = await this.d.trialBalance.read({ from, to: date });
      const lines: Array<Record<string, string>> = [];
      let debits = Money.zero();
      let credits = Money.zero();
      for (const r of raw) {
        if (!['4', '5', '6', '7'].includes(r.code[0] ?? '')) continue;
        const net = r.openingNet.add(r.movementDebit).subtract(r.movementCredit);
        if (net.isZero()) continue;
        if (net.isNegative()) { lines.push({ accountCode: r.code, debit: net.negate().toString() }); debits = debits.add(net.negate()); }
        else { lines.push({ accountCode: r.code, credit: net.toString() }); credits = credits.add(net); }
      }
      if (lines.length === 0) throw new ValidationFailed([{ field: 'year', message: `No hay saldos de resultado que cerrar en ${year}`, rule: 'R-CON-012' }]);

      const pnlCode = pnl.code.value;
      const resultCode = result.code.value;
      const diff = debits.subtract(credits);
      if (diff.isPositive()) {
        // Utilidad: los débitos (ingresos cancelados) exceden a los créditos → ganancias y pérdidas al crédito, luego al resultado.
        lines.push({ accountCode: pnlCode, credit: diff.toString() }, { accountCode: pnlCode, debit: diff.toString() }, { accountCode: resultCode, credit: diff.toString() });
      } else if (diff.isNegative()) {
        const loss = diff.negate();
        lines.push({ accountCode: pnlCode, debit: loss.toString() }, { accountCode: pnlCode, credit: loss.toString() }, { accountCode: resultCode, debit: loss.toString() });
      }
      return this.d.post.executeAuthorized({
        voucherType: input.voucherType,
        accountingDate: input.accountingDate,
        description: `Cierre anual del ejercicio ${year}`,
        source: { type: 'YEAR_CLOSING', id: this.d.ids.next() },
        lines,
      });
    });
  }
}
