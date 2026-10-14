import type { DomainEvent } from '../../../../shared-kernel/index.js';
import type { JournalEntry } from '../entities/journal-entry.js';

export const JOURNAL_ENTRY_POSTED = 'accounting.journal_entry.posted.v1';

export function journalEntryPosted(entry: JournalEntry, tenantId: string): DomainEvent {
  return {
    name: JOURNAL_ENTRY_POSTED,
    occurredAt: entry.postedAt.toISOString(),
    payload: {
      entryId: entry.id,
      tenantId,
      voucherType: entry.voucherTypeCode,
      number: entry.number.value,
      accountingDate: entry.accountingDate.toString(),
      totalDebit: entry.totalDebit.toString(),
      totalCredit: entry.totalCredit.toString(),
      source: { type: entry.source.type, id: entry.source.id },
      postedAt: entry.postedAt.toISOString(),
    },
  };
}
