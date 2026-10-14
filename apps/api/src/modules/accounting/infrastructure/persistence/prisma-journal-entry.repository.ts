import { Prisma } from '../../../../generated/prisma/client.js';
import { decodeCursor, encodeCursor, type EntryId, type Page, type PageRequest, type RequestContextPort } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { JournalEntry } from '../../domain/entities/journal-entry.js';
import type { SourceType } from '../../domain/value-objects/entry-source.js';
import type { JournalEntryFilter, JournalEntryRepository, JournalEntrySummary } from '../../application/ports/journal-entry-repository.js';
import { entryInsertData, fromDbDate, toDbDate, toJournalEntry } from './mappers/journal-entry.mapper.js';

const INCLUDE = { voucher_type: true, journal_line: { include: { account: true, cost_center: true } } } as const;

/**
 * Solo inserta y lee: no hay `update` ni `delete` (principio I). Los errores de la base de datos que llegan por
 * los triggers (`ENTRY_NOT_BALANCED:`, `PERIOD_CLOSED:`…) los traduce `toProblem` como red de seguridad.
 */
export class PrismaJournalEntryRepository implements JournalEntryRepository {
  constructor(private readonly ctx: RequestContextPort) {}

  async add(entry: JournalEntry): Promise<void> {
    const tx = currentTx();
    const { header, lines } = entryInsertData(entry, this.ctx.current().tenantId);
    await tx.journal_entry.create({ data: header });
    await tx.journal_line.createMany({ data: lines });
  }

  private async reversalIdOf(id: string): Promise<string | null> {
    const r = await currentTx().journal_entry.findFirst({ where: { reversal_of: id }, select: { id: true } });
    return r?.id ?? null;
  }

  async findById(id: EntryId): Promise<JournalEntry | null> {
    const row = await currentTx().journal_entry.findUnique({ where: { id }, include: INCLUDE });
    return row ? toJournalEntry(row, await this.reversalIdOf(row.id)) : null;
  }

  async findByIdempotencyKey(key: string): Promise<JournalEntry | null> {
    const row = await currentTx().journal_entry.findFirst({ where: { idempotency_key: key }, include: INCLUDE });
    return row ? toJournalEntry(row, await this.reversalIdOf(row.id)) : null;
  }

  async findReversalOf(id: EntryId): Promise<JournalEntry | null> {
    const row = await currentTx().journal_entry.findFirst({ where: { reversal_of: id }, include: INCLUDE });
    return row ? toJournalEntry(row, null) : null;
  }

  async list(filter: JournalEntryFilter, page: PageRequest): Promise<Page<JournalEntrySummary>> {
    const cur = decodeCursor<{ d: string; t: string; n: number }>(page.cursor);
    // Más recientes primero: (fecha, tipo, número) descendente.
    const where: Prisma.journal_entryWhereInput = {
      ...(filter.from || filter.to ? { accounting_date: { ...(filter.from ? { gte: toDbDate(filter.from) } : {}), ...(filter.to ? { lte: toDbDate(filter.to) } : {}) } } : {}),
      ...(filter.voucherType ? { voucher_type: { code: filter.voucherType } } : {}),
      ...(filter.sourceType ? { source_type: filter.sourceType } : {}),
      ...(filter.accountCode ? { journal_line: { some: { account: { code: filter.accountCode } } } } : {}),
      ...(cur
        ? { OR: [{ accounting_date: { lt: new Date(`${cur.d}T00:00:00.000Z`) } }, { accounting_date: new Date(`${cur.d}T00:00:00.000Z`), id: { lt: cur.t } }] }
        : {}),
    };
    const rows = await currentTx().journal_entry.findMany({
      where, include: { voucher_type: true }, orderBy: [{ accounting_date: 'desc' }, { id: 'desc' }], take: page.limit + 1,
    });
    const slice = rows.slice(0, page.limit);
    const reversals = await currentTx().journal_entry.findMany({ where: { reversal_of: { in: slice.map((r) => r.id) } }, select: { id: true, reversal_of: true } });
    const reversedBy = new Map(reversals.map((r) => [r.reversal_of!, r.id]));
    const items = slice.map((r): JournalEntrySummary => ({
      id: r.id as EntryId, voucherType: r.voucher_type.code, number: Number(r.number), numberingYear: r.numbering_year,
      accountingDate: fromDbDate(r.accounting_date), fiscalPeriodId: r.fiscal_period_id, description: r.description,
      sourceType: r.source_type as SourceType, sourceId: r.source_id, reversalOf: (r.reversal_of as EntryId | null) ?? null,
      reversedBy: (reversedBy.get(r.id) as EntryId | undefined) ?? null, totalDebit: r.total_debit.toFixed(2), totalCredit: r.total_credit.toFixed(2),
      postedAt: r.posted_at.toISOString(), postedBy: r.posted_by,
    }));
    const last = slice.at(-1);
    return { items, nextCursor: rows.length > page.limit && last ? encodeCursor({ d: last.accounting_date.toISOString().slice(0, 10), t: last.id, n: Number(last.number) }) : null };
  }
}
