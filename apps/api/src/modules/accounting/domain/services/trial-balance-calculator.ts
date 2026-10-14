import { Money } from '../../../../shared-kernel/index.js';
import type { Nature } from '../entities/account.js';

/** Acumulado crudo por cuenta que entrega el lector (saldo inicial neto = Σ débito − Σ crédito antes del rango). */
export interface AccountBalanceRaw {
  readonly code: string;
  readonly name: string;
  /** Naturaleza de la cuenta; `null` al acumular por nivel (se usa la de la clase). */
  readonly nature: Nature | null;
  readonly openingNet: Money;
  readonly movementDebit: Money;
  readonly movementCredit: Money;
}

export interface TrialBalanceRow {
  readonly accountCode: string;
  readonly accountName: string;
  readonly nature: Nature;
  readonly openingDebit: Money;
  readonly openingCredit: Money;
  readonly movementDebit: Money;
  readonly movementCredit: Money;
  readonly closingDebit: Money;
  readonly closingCredit: Money;
  /** El saldo final tiene el lado contrario a la naturaleza (R-CON-013): alerta, no se oculta. */
  readonly contraNature: boolean;
}

export interface TrialBalanceTotals {
  readonly openingDebit: Money;
  readonly openingCredit: Money;
  readonly movementDebit: Money;
  readonly movementCredit: Money;
  readonly closingDebit: Money;
  readonly closingCredit: Money;
}

export interface TrialBalanceResult {
  readonly rows: readonly TrialBalanceRow[];
  readonly totals: TrialBalanceTotals;
  readonly balanced: boolean;
}

/** Naturaleza por clase del PUC: 1,5,6,7,8 débito; 2,3,4,9 crédito. */
const classNature = (code: string): Nature => (['2', '3', '4', '9'].includes(code[0] ?? '') ? 'CREDIT' : 'DEBIT');

const side = (net: Money): { debit: Money; credit: Money } =>
  net.isNegative() ? { debit: Money.zero(), credit: net.negate() } : { debit: net, credit: Money.zero() };

/**
 * Balance de prueba (R-CON-010, R-CON-013): saldo inicial, movimiento y saldo final por cuenta. Puro y determinista:
 * mismas entradas ⇒ misma salida, ordenada por código. El saldo se presenta en la columna donde queda positivo.
 */
export const TrialBalanceCalculator = {
  calculate(raw: readonly AccountBalanceRaw[], level?: number): TrialBalanceResult {
    const grouped = new Map<string, AccountBalanceRaw>();
    for (const r of raw) {
      const code = level !== undefined ? r.code.slice(0, level) : r.code;
      const prev = grouped.get(code);
      grouped.set(
        code,
        prev
          ? { ...prev, openingNet: prev.openingNet.add(r.openingNet), movementDebit: prev.movementDebit.add(r.movementDebit), movementCredit: prev.movementCredit.add(r.movementCredit) }
          : { code, name: level !== undefined ? `Nivel ${code}` : r.name, nature: level !== undefined ? null : r.nature, openingNet: r.openingNet, movementDebit: r.movementDebit, movementCredit: r.movementCredit },
      );
    }
    const rows: TrialBalanceRow[] = [...grouped.values()]
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
      .map((g) => {
        const nature = g.nature ?? classNature(g.code);
        const closingNet = g.openingNet.add(g.movementDebit).subtract(g.movementCredit);
        const opening = side(g.openingNet);
        const closing = side(closingNet);
        const contra = !closingNet.isZero() && ((nature === 'DEBIT' && closingNet.isNegative()) || (nature === 'CREDIT' && !closingNet.isNegative()));
        return {
          accountCode: g.code, accountName: g.name, nature,
          openingDebit: opening.debit, openingCredit: opening.credit,
          movementDebit: g.movementDebit, movementCredit: g.movementCredit,
          closingDebit: closing.debit, closingCredit: closing.credit, contraNature: contra,
        };
      });
    const sum = (f: (r: TrialBalanceRow) => Money) => Money.sum(rows.map(f));
    const totals: TrialBalanceTotals = {
      openingDebit: sum((r) => r.openingDebit), openingCredit: sum((r) => r.openingCredit),
      movementDebit: sum((r) => r.movementDebit), movementCredit: sum((r) => r.movementCredit),
      closingDebit: sum((r) => r.closingDebit), closingCredit: sum((r) => r.closingCredit),
    };
    return { rows, totals, balanced: totals.closingDebit.equals(totals.closingCredit) };
  },
};
