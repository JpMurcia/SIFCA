import type { DomainEvent } from '../../../../shared-kernel/index.js';
import type { JournalEntry } from '../entities/journal-entry.js';

export const JOURNAL_ENTRY_REVERSED = 'accounting.journal_entry.reversed.v1';

export function journalEntryReversed(reversal: JournalEntry, tenantId: string): DomainEvent {
  return {
    name: JOURNAL_ENTRY_REVERSED,
    occurredAt: reversal.postedAt.toISOString(),
    payload: {
      entryId: reversal.id,
      tenantId,
      reversalOf: reversal.reversalOf,
      reason: reversal.reversalReason,
      voucherType: reversal.voucherTypeCode,
      number: reversal.number.value,
      accountingDate: reversal.accountingDate.toString(),
    },
  };
}
