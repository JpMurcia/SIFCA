import {
  asId, ConflictError, NotFoundError, type Clock, type DraftId, type IdGenerator, type Page, type PermissionChecker, type RequestContextPort, type UnitOfWork, type UserId,
  LocalDate,
} from '../../../../shared-kernel/index.js';
import { ListJournalDraftsQuerySchema, SaveJournalDraftRequestSchema } from '../schemas/index.js';
import { JournalDraft } from '../../domain/entities/journal-draft.js';
import { ValidationFailed } from '../../domain/errors/accounting-errors.js';
import type { FiscalPeriodRepository } from '../ports/fiscal-period-repository.js';
import type { JournalDraftRepository } from '../ports/journal-draft-repository.js';
import type { VoucherTypeRepository } from '../ports/voucher-type-repository.js';
import { POST_ENTRY_PERMISSION } from './post-journal-entry.js';
import { parsePeriodId } from './close-period.js';

const asDraftId = (raw: string): DraftId => {
  try {
    return asId<'DraftId'>(raw) as DraftId;
  } catch {
    throw new NotFoundError('El borrador');
  }
};

/** Guarda (crea o reemplaza) un borrador. Admite descuadre; no consume consecutivo ni afecta saldos. */
export class SaveJournalDraft {
  constructor(
    private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; requestContext: RequestContextPort; clock: Clock; ids: IdGenerator; voucherTypes: VoucherTypeRepository; drafts: JournalDraftRepository },
  ) {}

  async execute(rawInput: unknown, options: { draftId?: string | undefined } = {}): Promise<JournalDraft> {
    this.d.permissions.assert(POST_ENTRY_PERMISSION);
    const input = SaveJournalDraftRequestSchema.parse(rawInput);
    return this.d.uow.run(async () => {
      if (!(await this.d.voucherTypes.findByCode(input.voucherType))) {
        throw new ValidationFailed([{ field: 'voucherType', message: `El tipo de comprobante ${input.voucherType} no existe` }]);
      }
      const now = this.d.clock.now();
      const content = {
        voucherTypeCode: input.voucherType,
        accountingDate: input.accountingDate ? LocalDate.of(input.accountingDate) : null,
        description: input.description ?? null,
        lines: input.lines,
        now,
      };
      if (!options.draftId) {
        const draft = JournalDraft.create({
          id: asId<'DraftId'>(this.d.ids.next()) as DraftId, voucherTypeCode: content.voucherTypeCode, accountingDate: content.accountingDate,
          description: content.description, lines: content.lines, createdBy: this.d.requestContext.current().userId as UserId, createdAt: now, now,
        });
        await this.d.drafts.save(draft, null);
        return draft;
      }
      if (input.version === undefined) {
        throw new ValidationFailed([{ field: 'version', message: 'Al reemplazar un borrador se requiere la versión (bloqueo optimista)' }]);
      }
      const current = await this.d.drafts.findById(asDraftId(options.draftId));
      if (!current) throw new NotFoundError('El borrador');
      if (current.version !== input.version) throw new ConflictError(`El borrador cambió (versión ${current.version}); recárguelo antes de guardar`);
      const next = current.replace(content);
      await this.d.drafts.save(next, input.version);
      return next;
    });
  }
}

/** Único borrado permitido en contabilidad: el de un borrador, que no es registro contable. */
export class DiscardJournalDraft {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; drafts: JournalDraftRepository }) {}
  async execute(draftId: string): Promise<void> {
    this.d.permissions.assert(POST_ENTRY_PERMISSION);
    const id = asDraftId(draftId);
    const removed = await this.d.uow.run(() => this.d.drafts.discard(id));
    if (!removed) throw new NotFoundError('El borrador');
  }
}

export class ListJournalDrafts {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; periods: FiscalPeriodRepository; drafts: JournalDraftRepository }) {}
  async execute(rawQuery: unknown): Promise<Page<JournalDraft>> {
    this.d.permissions.assert(POST_ENTRY_PERMISSION);
    const q = ListJournalDraftsQuerySchema.parse(rawQuery);
    return this.d.uow.run(
      async () => {
        let range: { from?: LocalDate; to?: LocalDate } = {};
        if (q.periodId) {
          const p = await this.d.periods.findById(parsePeriodId(q.periodId), 'none');
          if (!p) throw new NotFoundError('El período');
          range = { from: p.startsOn, to: p.endsOn };
        }
        return this.d.drafts.list(range, { limit: q.limit, cursor: q.cursor });
      },
      { readOnly: true },
    );
  }
}
