import type { LocalDate, Money, Page, PageRequest } from '../../../../shared-kernel/index.js';
import type { Nature } from '../../domain/entities/account.js';

export interface JournalBookRowView {
  readonly entryId: string;
  readonly accountingDate: LocalDate;
  readonly voucherType: string;
  readonly number: number;
  readonly lineNo: number;
  readonly accountCode: string;
  readonly accountName: string;
  readonly partyId: string | null;
  readonly debit: Money;
  readonly credit: Money;
  readonly description: string | null;
}

export interface LedgerMovementView {
  readonly entryId: string;
  readonly accountingDate: LocalDate;
  readonly voucherType: string;
  readonly number: number;
  readonly debit: Money;
  readonly credit: Money;
  /** Saldo acumulado en la naturaleza de la cuenta (positivo = saldo normal). */
  readonly runningBalance: Money;
  readonly description: string | null;
}

export interface GeneralLedgerView {
  readonly accountCode: string;
  readonly accountName: string;
  readonly nature: Nature;
  readonly openingBalance: Money;
  readonly closingBalance: Money;
  readonly movements: Page<LedgerMovementView>;
}

export interface LedgerReader {
  /** Libro diario: líneas en orden cronológico `(fecha, tipo, número, línea)`. */
  journal(range: { from: LocalDate; to: LocalDate }, page: PageRequest): Promise<Page<JournalBookRowView>>;
  /** Libro mayor de una cuenta; `null` si la cuenta no existe. */
  generalLedger(q: { accountCode: string; from: LocalDate; to: LocalDate }, page: PageRequest): Promise<GeneralLedgerView | null>;
}

export const LEDGER_READER = Symbol('LedgerReader');
