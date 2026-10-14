import type { EntryId, LocalDate, Page, PageRequest } from '../../../../shared-kernel/index.js';
import type { JournalEntry } from '../../domain/entities/journal-entry.js';
import type { SourceType } from '../../domain/value-objects/entry-source.js';

/** Vista de lista: comprobante sin líneas. */
export interface JournalEntrySummary {
  readonly id: EntryId;
  readonly voucherType: string;
  readonly number: number;
  readonly numberingYear: number;
  readonly accountingDate: LocalDate;
  readonly fiscalPeriodId: string;
  readonly description: string;
  readonly sourceType: SourceType;
  readonly sourceId: string | null;
  readonly reversalOf: EntryId | null;
  readonly reversedBy: EntryId | null;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly postedAt: string;
  readonly postedBy: string;
}

export interface JournalEntryFilter {
  readonly from?: LocalDate | undefined;
  readonly to?: LocalDate | undefined;
  readonly voucherType?: string | undefined;
  readonly accountCode?: string | undefined;
  readonly sourceType?: SourceType | undefined;
}

/**
 * Repositorio del comprobante: SOLO inserta y lee. No existe `update` ni `delete` (principio I, G-06):
 * lo impide el puerto, el rol de la aplicación y los triggers.
 */
export interface JournalEntryRepository {
  add(entry: JournalEntry): Promise<void>;
  findById(id: EntryId): Promise<JournalEntry | null>;
  /** Comprobante creado antes con esa clave de idempotencia (incluye `idempotency.requestHash`). */
  findByIdempotencyKey(key: string): Promise<JournalEntry | null>;
  /** Comprobante que reversa al indicado, si existe. */
  findReversalOf(id: EntryId): Promise<JournalEntry | null>;
  list(filter: JournalEntryFilter, page: PageRequest): Promise<Page<JournalEntrySummary>>;
}

export const JOURNAL_ENTRY_REPOSITORY = Symbol('JournalEntryRepository');
