import { Prisma } from '../../../../../generated/prisma/client.js';
import { asId, Instant, LocalDate, Money, type EntryId, type PartyId, type PeriodId, type UserId, type CostCenterId } from '../../../../../shared-kernel/index.js';
import { JournalEntry } from '../../../domain/entities/journal-entry.js';
import { JournalLine } from '../../../domain/entities/journal-line.js';
import { EntryNumber } from '../../../domain/value-objects/entry-number.js';
import { EntrySource, type SourceType } from '../../../domain/value-objects/entry-source.js';

/** Prisma entrega `@db.Date` como `Date` UTC a medianoche: se convierte a/desde `YYYY-MM-DD` sin zona. */
export const toDbDate = (d: LocalDate): Date => new Date(`${d.toString()}T00:00:00.000Z`);
export const fromDbDate = (d: Date): LocalDate => LocalDate.of(d.toISOString().slice(0, 10));
export const toDecimal = (m: Money): Prisma.Decimal => new Prisma.Decimal(m.toString());
export const fromDecimal = (d: Prisma.Decimal): Money => Money.of(d.toFixed(2));

export function entryInsertData(e: JournalEntry, tenantId: string) {
  return {
    header: {
      id: e.id, tenant_id: tenantId, voucher_type_id: e.voucherTypeId, numbering_year: e.numberingYear, number: BigInt(e.number.value),
      accounting_date: toDbDate(e.accountingDate), fiscal_period_id: e.periodId, description: e.description,
      source_type: e.source.type, source_id: e.source.id, status: e.status, reversal_of: e.reversalOf, reversal_reason: e.reversalReason,
      total_debit: toDecimal(e.totalDebit), total_credit: toDecimal(e.totalCredit),
      idempotency_key: e.idempotency?.key ?? null, request_hash: e.idempotency?.requestHash ?? null,
      posted_at: e.postedAt.toDate(), posted_by: e.postedBy,
    },
    lines: e.lines.map((l) => ({
      id: l.id, tenant_id: tenantId, entry_id: e.id, accounting_date: toDbDate(e.accountingDate), line_no: l.lineNo,
      account_id: l.accountId, party_id: l.partyId, cost_center_id: l.costCenterId,
      debit: toDecimal(l.debit), credit: toDecimal(l.credit),
      description: l.description, document_ref: l.documentRef, due_date: l.dueDate ? toDbDate(l.dueDate) : null,
    })),
  };
}

export type EntryRow = Prisma.journal_entryGetPayload<{
  include: { voucher_type: true; journal_line: { include: { account: true; cost_center: true } } };
}>;

export function toJournalEntry(r: EntryRow, reversedBy: string | null): JournalEntry {
  return JournalEntry.restore({
    id: asId<'EntryId'>(r.id) as EntryId,
    voucherTypeId: r.voucher_type_id,
    voucherTypeCode: r.voucher_type.code,
    numberingYear: r.numbering_year,
    number: EntryNumber.of(Number(r.number)),
    accountingDate: fromDbDate(r.accounting_date),
    periodId: r.fiscal_period_id as PeriodId,
    description: r.description,
    source: EntrySource.of(r.source_type as SourceType, r.source_id),
    reversalOf: (r.reversal_of as EntryId | null) ?? null,
    reversalReason: r.reversal_reason,
    reversedBy: (reversedBy as EntryId | null) ?? null,
    totalDebit: fromDecimal(r.total_debit),
    totalCredit: fromDecimal(r.total_credit),
    lines: [...r.journal_line]
      .sort((a, b) => a.line_no - b.line_no)
      .map((l) =>
        JournalLine.restore({
          id: l.id, lineNo: l.line_no, accountId: l.account_id, accountCode: l.account.code, accountName: l.account.name,
          partyId: (l.party_id as PartyId | null) ?? null, costCenterId: (l.cost_center_id as CostCenterId | null) ?? null,
          costCenterCode: l.cost_center?.code ?? null, debit: fromDecimal(l.debit), credit: fromDecimal(l.credit),
          description: l.description, documentRef: l.document_ref, dueDate: l.due_date ? fromDbDate(l.due_date) : null,
        }),
      ),
    postedAt: Instant.fromEpochMs(r.posted_at.getTime()),
    postedBy: r.posted_by as UserId,
    idempotency: r.idempotency_key && r.request_hash ? { key: r.idempotency_key, requestHash: r.request_hash } : null,
  });
}
