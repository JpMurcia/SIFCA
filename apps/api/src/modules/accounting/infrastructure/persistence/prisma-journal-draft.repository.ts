import type { Prisma } from '../../../../generated/prisma/client.js';
import { asId, ConflictError, decodeCursor, encodeCursor, Instant, LocalDate, type DraftId, type Page, type PageRequest, type RequestContextPort, type UserId } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import { JournalDraft, type DraftLine } from '../../domain/entities/journal-draft.js';
import type { JournalDraftRepository } from '../../application/ports/journal-draft-repository.js';
import { fromDbDate, toDbDate } from './mappers/journal-entry.mapper.js';

type Row = Prisma.journal_draftGetPayload<{ include: { voucher_type: true } }>;

const toDraft = (r: Row): JournalDraft =>
  JournalDraft.restore({
    id: asId<'DraftId'>(r.id) as DraftId,
    voucherTypeCode: r.voucher_type.code,
    accountingDate: r.accounting_date ? fromDbDate(r.accounting_date) : null,
    description: r.description,
    lines: r.lines as unknown as DraftLine[],
    version: r.version,
    createdBy: r.created_by as UserId,
    createdAt: Instant.fromEpochMs(r.created_at.getTime()),
    updatedAt: Instant.fromEpochMs(r.updated_at.getTime()),
  });

/** Los borradores SÍ son mutables (no son registro contable): se reemplazan con bloqueo optimista por versión. */
export class PrismaJournalDraftRepository implements JournalDraftRepository {
  constructor(private readonly ctx: RequestContextPort) {}

  async save(draft: JournalDraft, expectedVersion: number | null): Promise<void> {
    const tx = currentTx();
    const type = await tx.voucher_type.findFirstOrThrow({ where: { code: draft.voucherTypeCode } });
    const data = {
      voucher_type_id: type.id,
      accounting_date: draft.accountingDate ? toDbDate(draft.accountingDate) : null,
      description: draft.description,
      lines: draft.lines as unknown as Prisma.InputJsonValue,
      updated_at: draft.updatedAt.toDate(),
      version: draft.version,
    };
    if (expectedVersion === null) {
      await tx.journal_draft.create({
        data: { id: draft.id, tenant_id: this.ctx.current().tenantId, created_by: draft.createdBy, created_at: draft.createdAt.toDate(), ...data },
      });
      return;
    }
    const res = await tx.journal_draft.updateMany({ where: { id: draft.id, version: expectedVersion }, data });
    if (res.count !== 1) throw new ConflictError('El borrador cambió: versión desactualizada');
  }

  async findById(id: DraftId): Promise<JournalDraft | null> {
    const r = await currentTx().journal_draft.findUnique({ where: { id }, include: { voucher_type: true } });
    return r ? toDraft(r) : null;
  }

  async discard(id: DraftId): Promise<boolean> {
    return (await currentTx().journal_draft.deleteMany({ where: { id } })).count === 1;
  }

  async list(filter: { from?: LocalDate | undefined; to?: LocalDate | undefined }, page: PageRequest): Promise<Page<JournalDraft>> {
    const after = decodeCursor<{ id: string }>(page.cursor)?.id;
    const rows = await currentTx().journal_draft.findMany({
      where: {
        ...(filter.from || filter.to ? { accounting_date: { ...(filter.from ? { gte: toDbDate(filter.from) } : {}), ...(filter.to ? { lte: toDbDate(filter.to) } : {}) } } : {}),
        ...(after ? { id: { lt: after } } : {}),
      },
      include: { voucher_type: true },
      orderBy: { id: 'desc' },
      take: page.limit + 1,
    });
    const items = rows.slice(0, page.limit).map(toDraft);
    return { items, nextCursor: rows.length > page.limit ? encodeCursor({ id: items.at(-1)!.id }) : null };
  }

  async countInRange(range: { from: LocalDate; to: LocalDate }): Promise<number> {
    return currentTx().journal_draft.count({ where: { accounting_date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } } });
  }
}
