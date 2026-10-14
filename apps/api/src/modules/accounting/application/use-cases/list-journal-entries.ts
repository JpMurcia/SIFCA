import { LocalDate, type Page, type PermissionChecker, type UnitOfWork } from '../../../../shared-kernel/index.js';
import { ListJournalEntriesQuerySchema } from '../schemas/index.js';
import type { SourceType } from '../../domain/value-objects/entry-source.js';
import type { JournalEntryRepository, JournalEntrySummary } from '../ports/journal-entry-repository.js';
import { READ_PERMISSION } from './get-journal-entry.js';

export class ListJournalEntries {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; entries: JournalEntryRepository }) {}

  async execute(rawQuery: unknown): Promise<Page<JournalEntrySummary>> {
    this.d.permissions.assert(READ_PERMISSION);
    const q = ListJournalEntriesQuerySchema.parse(rawQuery);
    return this.d.uow.run(
      () =>
        this.d.entries.list(
          {
            from: q.from ? LocalDate.of(q.from) : undefined,
            to: q.to ? LocalDate.of(q.to) : undefined,
            voucherType: q.voucherType,
            accountCode: q.accountCode,
            sourceType: q.sourceType as SourceType | undefined,
          },
          { limit: q.limit, cursor: q.cursor },
        ),
      { readOnly: true },
    );
  }
}
