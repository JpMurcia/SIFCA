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
}

export const ACCOUNTING = Symbol('AccountingUseCases');
