import { asId, LocalDate, NotFoundError, type EntryId, type PeriodId, type UserId, type VoucherTypeId } from '../../../../shared-kernel/index.js';
import { ReverseJournalEntryRequestSchema } from '../schemas/index.js';
import { JournalEntry } from '../../domain/entities/journal-entry.js';
import { AlreadyReversed, PeriodClosed, PeriodNotFound, ValidationFailed } from '../../domain/errors/accounting-errors.js';
import { journalEntryReversed } from '../../domain/events/journal-entry-reversed.js';
import { ReversalFactory } from '../../domain/services/reversal-factory.js';
import { AccountCode } from '../../domain/value-objects/account-code.js';
import type { PostJournalEntryDeps, PostResult } from './post-journal-entry.js';

export const REVERSE_ENTRY_PERMISSION = 'accounting.entry.reverse';

/**
 * Reversa un comprobante creando un contraasiento (R-CON-005). El original no se toca: «reversado» se deduce de
 * la existencia de otro comprobante con `reversal_of` (índice único parcial: se reversa una sola vez).
 * Un comprobante reversado puede a su vez reversarse (restituye el efecto original).
 */
export class ReverseJournalEntry {
  constructor(private readonly d: PostJournalEntryDeps) {}

  async execute(entryId: string, rawInput: unknown): Promise<PostResult> {
    this.d.permissions.assert(REVERSE_ENTRY_PERMISSION);
    const input = ReverseJournalEntryRequestSchema.parse(rawInput);
    let id: EntryId;
    try {
      id = asId<'EntryId'>(entryId) as EntryId;
    } catch {
      throw new NotFoundError('El comprobante');
    }
    const result = await this.d.uow.run(() => this.reverse(id, input));
    await this.d.events.publish([journalEntryReversed(result.entry, this.d.requestContext.current().tenantId)]);
    return result;
  }

  private async reverse(id: EntryId, input: { reason: string; accountingDate?: string | undefined }): Promise<PostResult> {
    const ctx = this.d.requestContext.current();
    const original = await this.d.entries.findById(id);
    if (!original) throw new NotFoundError('El comprobante');
    if (await this.d.entries.findReversalOf(id)) throw new AlreadyReversed();

    const accountingDate = input.accountingDate ? LocalDate.of(input.accountingDate) : this.d.clock.today();
    const period = await this.d.periods.findByDate(accountingDate, 'share');
    if (!period) throw new PeriodNotFound(accountingDate.toString());
    if (!period.isOpen()) throw new PeriodClosed(period.year, period.month);

    const voucherType = await this.d.voucherTypes.findByCode(original.voucherTypeCode);
    if (!voucherType) throw new ValidationFailed([{ field: 'voucherType', message: `El tipo ${original.voucherTypeCode} ya no existe` }]);
    const accounts = await this.d.accounts.findByCodes([...new Set(original.lines.map((l) => l.accountCode))].map((c) => AccountCode.of(c)));
    const costCenters = await this.d.costCenters.findByCodes([...new Set(original.lines.flatMap((l) => (l.costCenterCode ? [l.costCenterCode] : [])))]);

    const pending = ReversalFactory.build({ original, voucherType, accounts, costCenters, accountingDate, reason: input.reason });
    const scopeYear = voucherType.scopeYearFor(accountingDate);
    const number = await this.d.sequence.next(voucherType.id as VoucherTypeId, scopeYear);
    const entry = JournalEntry.post(pending, {
      id: asId<'EntryId'>(this.d.ids.next()) as EntryId,
      number,
      numberingYear: scopeYear,
      periodId: period.id as PeriodId,
      postedAt: this.d.clock.now(),
      postedBy: ctx.userId as UserId,
      nextLineId: () => this.d.ids.next(),
    });
    await this.d.entries.add(entry);
    return { entry, created: true };
  }
}
