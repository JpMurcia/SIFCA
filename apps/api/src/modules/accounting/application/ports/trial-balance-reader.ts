import type { LocalDate } from '../../../../shared-kernel/index.js';
import type { AccountBalanceRaw } from '../../domain/services/trial-balance-calculator.js';

export interface TrialBalanceReader {
  /**
   * Acumulados por cuenta: saldo inicial (movimientos antes de `from`) y movimientos de [from, to].
   * Solo cuentas con saldo inicial o movimiento. Determinista.
   */
  read(range: { from: LocalDate; to: LocalDate }): Promise<readonly AccountBalanceRaw[]>;
}

export const TRIAL_BALANCE_READER = Symbol('TrialBalanceReader');
