import type { Account } from '../../domain/entities/account.js';
import type { JournalEntry } from '../../domain/entities/journal-entry.js';
import type { JournalEntrySummary } from '../../application/ports/journal-entry-repository.js';
import type { VoucherTypeView } from '../../application/use-cases/list-reference-data.js';

/** Respuesta HTTP de un comprobante (contracts/accounting.v1.openapi.yaml → JournalEntry). */
export function toEntryDto(e: JournalEntry) {
  return {
    id: e.id,
    voucherType: e.voucherTypeCode,
    number: e.number.value,
    numberingYear: e.numberingYear,
    accountingDate: e.accountingDate.toString(),
    fiscalPeriodId: e.periodId,
    description: e.description,
    sourceType: e.source.type,
    sourceId: e.source.id,
    status: e.status,
    reversalOf: e.reversalOf,
    reversalReason: e.reversalReason,
    reversedBy: e.reversedBy,
    totalDebit: e.totalDebit.toString(),
    totalCredit: e.totalCredit.toString(),
    postedAt: e.postedAt.toISOString(),
    postedBy: e.postedBy,
    lines: e.lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountName: l.accountName,
      partyId: l.partyId,
      costCenterCode: l.costCenterCode,
      debit: l.debit.toString(),
      credit: l.credit.toString(),
      description: l.description,
      documentRef: l.documentRef,
      dueDate: l.dueDate?.toString() ?? null,
    })),
  };
}

export const toSummaryDto = (s: JournalEntrySummary) => ({
  id: s.id, voucherType: s.voucherType, number: s.number, numberingYear: s.numberingYear, accountingDate: s.accountingDate.toString(),
  fiscalPeriodId: s.fiscalPeriodId, description: s.description, sourceType: s.sourceType, sourceId: s.sourceId, status: 'POSTED' as const,
  reversalOf: s.reversalOf, reversedBy: s.reversedBy, totalDebit: s.totalDebit, totalCredit: s.totalCredit, postedAt: s.postedAt, postedBy: s.postedBy,
});

export const toAccountDto = (a: Account) => ({
  id: a.id, code: a.code.value, name: a.name, level: a.level, nature: a.nature, parentId: null,
  allowsPosting: a.allowsPosting, requiresParty: a.requiresParty, requiresCostCenter: a.requiresCostCenter, isActive: a.isActive,
});

export const toVoucherTypeDto = (v: VoucherTypeView) => ({
  id: v.type.id, code: v.type.code, name: v.type.name, numberingScope: v.type.numberingScope, nextNumber: v.nextNumber,
});

export const pageOf = <T>(items: readonly T[], nextCursor: string | null) => ({ data: items, page: { nextCursor, hasMore: nextCursor !== null } });
