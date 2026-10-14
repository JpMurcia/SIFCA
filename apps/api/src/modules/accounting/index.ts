/** API pública del módulo `accounting` (D-5): otros módulos importan solo desde aquí. */
export { AccountingModule } from './accounting.module.js';
export { POST_JOURNAL_ENTRY_PORT, REVERSE_JOURNAL_ENTRY_PORT } from './application/facade.js';
export type { PostJournalEntryPort, ReverseJournalEntryPort, PostedEntryRef } from './application/facade.js';
