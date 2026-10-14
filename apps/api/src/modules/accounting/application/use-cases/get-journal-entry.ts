import { asId, NotFoundError, type EntryId, type PermissionChecker, type UnitOfWork } from '../../../../shared-kernel/index.js';
import type { JournalEntry } from '../../domain/entities/journal-entry.js';
import type { JournalEntryRepository } from '../ports/journal-entry-repository.js';

export const READ_PERMISSION = 'accounting.report.read';

export class GetJournalEntry {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; entries: JournalEntryRepository }) {}

  async execute(entryId: string): Promise<JournalEntry> {
    this.d.permissions.assert(READ_PERMISSION);
    let id: EntryId;
    try {
      id = asId<'EntryId'>(entryId) as EntryId;
    } catch {
      throw new NotFoundError('El comprobante');
    }
    const entry = await this.d.uow.run(() => this.d.entries.findById(id), { readOnly: true });
    if (!entry) throw new NotFoundError('El comprobante');
    return entry;
  }
}
