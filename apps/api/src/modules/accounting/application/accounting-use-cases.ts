import type { ClosePeriod } from './use-cases/close-period.js';
import type { CloseFiscalYear } from './use-cases/close-fiscal-year.js';
import type { CreateFiscalYear, ListPeriods } from './use-cases/create-fiscal-year.js';
import type { GetGeneralLedger, GetJournalBook, GetTrialBalance } from './use-cases/get-reports.js';
import type { DiscardJournalDraft, ListJournalDrafts, SaveJournalDraft } from './use-cases/journal-drafts.js';
import type { ReopenPeriod } from './use-cases/reopen-period.js';
import type { GetJournalEntry } from './use-cases/get-journal-entry.js';
import type { ListJournalEntries } from './use-cases/list-journal-entries.js';
import type { ListAccounts, ListVoucherTypes } from './use-cases/list-reference-data.js';
import type { ReverseJournalEntry } from './use-cases/reverse-journal-entry.js';
import type { PostJournalEntry } from './use-cases/post-journal-entry.js';

/** Conjunto de casos de uso del módulo: lo que la presentación (HTTP, colas) puede invocar. */
export interface AccountingUseCases {
  readonly postJournalEntry: PostJournalEntry;
  readonly reverseJournalEntry: ReverseJournalEntry;
  readonly getJournalEntry: GetJournalEntry;
  readonly listJournalEntries: ListJournalEntries;
  readonly listAccounts: ListAccounts;
  readonly listVoucherTypes: ListVoucherTypes;
  readonly createFiscalYear: CreateFiscalYear;
  readonly listPeriods: ListPeriods;
  readonly closePeriod: ClosePeriod;
  readonly reopenPeriod: ReopenPeriod;
  readonly closeFiscalYear: CloseFiscalYear;
  readonly saveJournalDraft: SaveJournalDraft;
  readonly discardJournalDraft: DiscardJournalDraft;
  readonly listJournalDrafts: ListJournalDrafts;
  readonly getTrialBalance: GetTrialBalance;
  readonly getJournalBook: GetJournalBook;
  readonly getGeneralLedger: GetGeneralLedger;
}

export const ACCOUNTING = Symbol('AccountingUseCases');
