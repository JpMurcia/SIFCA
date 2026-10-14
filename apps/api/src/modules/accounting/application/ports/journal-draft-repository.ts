import type { DraftId, LocalDate, Page, PageRequest } from '../../../../shared-kernel/index.js';
import type { JournalDraft } from '../../domain/entities/journal-draft.js';

export interface JournalDraftRepository {
  /** Inserta (versión 1) o reemplaza con bloqueo optimista: `expectedVersion` debe coincidir o lanza `ConflictError`. */
  save(draft: JournalDraft, expectedVersion: number | null): Promise<void>;
  findById(id: DraftId): Promise<JournalDraft | null>;
  /** Único borrado permitido en contabilidad: el de un borrador (no es registro contable). */
  discard(id: DraftId): Promise<boolean>;
  list(filter: { from?: LocalDate | undefined; to?: LocalDate | undefined }, page: PageRequest): Promise<Page<JournalDraft>>;
  /** Cuántos borradores tienen fecha contable en el rango (bloquean el cierre, R-CON-011). */
  countInRange(range: { from: LocalDate; to: LocalDate }): Promise<number>;
}

export const JOURNAL_DRAFT_REPOSITORY = Symbol('JournalDraftRepository');
