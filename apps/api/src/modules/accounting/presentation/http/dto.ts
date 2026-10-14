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

import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import type { JournalDraft } from '../../domain/entities/journal-draft.js';
import type { GeneralLedgerView, JournalBookRowView } from '../../application/ports/ledger-reader.js';
import type { TrialBalanceReport } from '../../application/use-cases/get-reports.js';
import type { LocalDate } from '../../../../shared-kernel/index.js';

export const toPeriodDto = (p: FiscalPeriod) => ({
  id: p.id, year: p.year, month: p.month, startsOn: p.startsOn.toString(), endsOn: p.endsOn.toString(), status: p.status,
  closedAt: p.closedAt, closedBy: p.closedBy,
});

export const toDraftDto = (d: JournalDraft) => ({
  id: d.id, voucherType: d.voucherTypeCode, accountingDate: d.accountingDate?.toString() ?? null, description: d.description,
  lines: d.lines, version: d.version, createdBy: d.createdBy, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
});

export const toTrialBalanceDto = (t: TrialBalanceReport) => {
  const m = (x: { toString(): string }) => x.toString();
  return {
    from: t.from.toString(), to: t.to.toString(), level: t.level,
    rows: t.rows.map((r) => ({
      accountCode: r.accountCode, accountName: r.accountName, nature: r.nature,
      openingDebit: m(r.openingDebit), openingCredit: m(r.openingCredit), movementDebit: m(r.movementDebit), movementCredit: m(r.movementCredit),
      closingDebit: m(r.closingDebit), closingCredit: m(r.closingCredit), contraNature: r.contraNature,
    })),
    totals: {
      openingDebit: m(t.totals.openingDebit), openingCredit: m(t.totals.openingCredit), movementDebit: m(t.totals.movementDebit),
      movementCredit: m(t.totals.movementCredit), closingDebit: m(t.totals.closingDebit), closingCredit: m(t.totals.closingCredit),
    },
    balanced: t.balanced,
  };
};

export const toJournalBookDto = (r: JournalBookRowView) => ({
  entryId: r.entryId, accountingDate: r.accountingDate.toString(), voucherType: r.voucherType, number: r.number, lineNo: r.lineNo,
  accountCode: r.accountCode, accountName: r.accountName, partyId: r.partyId, debit: r.debit.toString(), credit: r.credit.toString(), description: r.description,
});

export const toLedgerDto = (v: GeneralLedgerView & { from: LocalDate; to: LocalDate }) => ({
  accountCode: v.accountCode, accountName: v.accountName, nature: v.nature, from: v.from.toString(), to: v.to.toString(),
  openingBalance: v.openingBalance.toString(), closingBalance: v.closingBalance.toString(),
  movements: v.movements.items.map((m) => ({
    entryId: m.entryId, accountingDate: m.accountingDate.toString(), voucherType: m.voucherType, number: m.number,
    debit: m.debit.toString(), credit: m.credit.toString(), runningBalance: m.runningBalance.toString(), description: m.description,
  })),
  page: { nextCursor: v.movements.nextCursor, hasMore: v.movements.nextCursor !== null },
});
