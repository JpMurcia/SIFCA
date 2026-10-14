import { Module } from '@nestjs/common';
import {
  AUDIT_LOG, CLOCK, DOMAIN_EVENT_PUBLISHER, ID_GENERATOR, PERMISSION_CHECKER, REQUEST_CONTEXT, UNIT_OF_WORK,
  type AuditLog, type Clock, type DomainEventPublisher, type IdGenerator, type PermissionChecker, type RequestContextPort, type UnitOfWork,
} from '../../shared-kernel/index.js';
import { ACCOUNTING, type AccountingUseCases } from './application/accounting-use-cases.js';
import { POST_JOURNAL_ENTRY_PORT, PostJournalEntryFacade, REVERSE_JOURNAL_ENTRY_PORT, ReverseJournalEntryFacade } from './application/facade.js';
import { ReverseJournalEntry } from './application/use-cases/reverse-journal-entry.js';
import { BalancedTrialBalanceCheck } from './application/period-checks/balanced-trial-balance-check.js';
import { NoDraftsCheck } from './application/period-checks/no-drafts-check.js';
import type { PeriodCloseCheck } from './application/ports/period-close-check.js';
import { CloseFiscalYear } from './application/use-cases/close-fiscal-year.js';
import { ClosePeriod } from './application/use-cases/close-period.js';
import { CreateFiscalYear, ListPeriods } from './application/use-cases/create-fiscal-year.js';
import { GetGeneralLedger, GetJournalBook, GetTrialBalance } from './application/use-cases/get-reports.js';
import { DiscardJournalDraft, ListJournalDrafts, SaveJournalDraft } from './application/use-cases/journal-drafts.js';
import { ReopenPeriod } from './application/use-cases/reopen-period.js';
import { PrismaJournalDraftRepository } from './infrastructure/persistence/prisma-journal-draft.repository.js';
import { PrismaLedgerReader } from './infrastructure/persistence/prisma-ledger.reader.js';
import { PrismaTrialBalanceReader } from './infrastructure/persistence/prisma-trial-balance.reader.js';
import { JournalDraftsController } from './presentation/http/journal-drafts.controller.js';
import { PeriodsController } from './presentation/http/periods.controller.js';
import { ReportsController } from './presentation/http/reports.controller.js';
import { GetJournalEntry } from './application/use-cases/get-journal-entry.js';
import { ListJournalEntries } from './application/use-cases/list-journal-entries.js';
import { ListAccounts, ListVoucherTypes } from './application/use-cases/list-reference-data.js';
import { PostJournalEntry } from './application/use-cases/post-journal-entry.js';
import { PrismaAccountRepository } from './infrastructure/persistence/prisma-account.repository.js';
import { PrismaCostCenterRepository } from './infrastructure/persistence/prisma-cost-center.repository.js';
import { PrismaFiscalPeriodRepository } from './infrastructure/persistence/prisma-fiscal-period.repository.js';
import { PrismaJournalEntryRepository } from './infrastructure/persistence/prisma-journal-entry.repository.js';
import { PrismaVoucherSequence } from './infrastructure/persistence/prisma-voucher-sequence.js';
import { PrismaVoucherTypeRepository } from './infrastructure/persistence/prisma-voucher-type.repository.js';
import { JournalEntriesController } from './presentation/http/journal-entries.controller.js';
import { LookupsController } from './presentation/http/lookups.controller.js';

/** Puertos transversales que el módulo necesita (los implementa `platform/`). */
export interface PlatformPorts {
  readonly uow: UnitOfWork;
  readonly permissions: PermissionChecker;
  readonly requestContext: RequestContextPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events: DomainEventPublisher;
  readonly audit: AuditLog;
}

/**
 * Composition root del módulo (D-7): crea los adaptadores concretos y enlaza los casos de uso. Lo usan el módulo
 * de Nest y las pruebas de integración/aceptación (sin HTTP).
 */
export function composeAccounting(p: PlatformPorts, extraCloseChecks: readonly PeriodCloseCheck[] = []): AccountingUseCases {
  const accounts = new PrismaAccountRepository();
  const costCenters = new PrismaCostCenterRepository();
  const voucherTypes = new PrismaVoucherTypeRepository();
  const periods = new PrismaFiscalPeriodRepository(p.requestContext);
  const entries = new PrismaJournalEntryRepository(p.requestContext);
  const sequence = new PrismaVoucherSequence(p.requestContext);
  const drafts = new PrismaJournalDraftRepository(p.requestContext);
  const trialBalance = new PrismaTrialBalanceReader();
  const ledger = new PrismaLedgerReader();
  const base = { uow: p.uow, permissions: p.permissions };
  const postDeps = { ...base, requestContext: p.requestContext, clock: p.clock, ids: p.ids, accounts, costCenters, voucherTypes, periods, entries, sequence, events: p.events };
  const postJournalEntry = new PostJournalEntry(postDeps);
  return {
    postJournalEntry,
    reverseJournalEntry: new ReverseJournalEntry(postDeps),
    getJournalEntry: new GetJournalEntry({ ...base, entries }),
    listJournalEntries: new ListJournalEntries({ ...base, entries }),
    listAccounts: new ListAccounts({ ...base, accounts }),
    listVoucherTypes: new ListVoucherTypes({ ...base, voucherTypes, sequence, today: () => p.clock.today().year }),
    createFiscalYear: new CreateFiscalYear({ ...base, ids: p.ids, periods }),
    listPeriods: new ListPeriods({ ...base, periods }),
    closePeriod: new ClosePeriod({
      ...base, requestContext: p.requestContext, clock: p.clock, periods, audit: p.audit, events: p.events,
      // Otros módulos registran aquí sus comprobaciones de cierre (conciliaciones INV-10, INV-13, INV-14).
      checks: [new BalancedTrialBalanceCheck(trialBalance), new NoDraftsCheck(drafts), ...extraCloseChecks],
    }),
    reopenPeriod: new ReopenPeriod({ ...base, requestContext: p.requestContext, clock: p.clock, periods, audit: p.audit, events: p.events }),
    closeFiscalYear: new CloseFiscalYear({ ...base, requestContext: p.requestContext, clock: p.clock, ids: p.ids, accounts, trialBalance, entries, post: postJournalEntry }),
    saveJournalDraft: new SaveJournalDraft({ ...base, requestContext: p.requestContext, clock: p.clock, ids: p.ids, voucherTypes, drafts }),
    discardJournalDraft: new DiscardJournalDraft({ ...base, drafts }),
    listJournalDrafts: new ListJournalDrafts({ ...base, periods, drafts }),
    getTrialBalance: new GetTrialBalance({ ...base, trialBalance }),
    getJournalBook: new GetJournalBook({ ...base, ledger }),
    getGeneralLedger: new GetGeneralLedger({ ...base, ledger }),
  };
}

@Module({
  controllers: [JournalEntriesController, LookupsController, PeriodsController, JournalDraftsController, ReportsController],
  providers: [
    {
      provide: ACCOUNTING,
      inject: [UNIT_OF_WORK, PERMISSION_CHECKER, REQUEST_CONTEXT, CLOCK, ID_GENERATOR, DOMAIN_EVENT_PUBLISHER, AUDIT_LOG],
      useFactory: (uow: UnitOfWork, permissions: PermissionChecker, requestContext: RequestContextPort, clock: Clock, ids: IdGenerator, events: DomainEventPublisher, audit: AuditLog) =>
        composeAccounting({ uow, permissions, requestContext, clock, ids, events, audit }),
    },
    { provide: REVERSE_JOURNAL_ENTRY_PORT, inject: [ACCOUNTING], useFactory: (uc: AccountingUseCases) => new ReverseJournalEntryFacade(uc.reverseJournalEntry) },
    { provide: POST_JOURNAL_ENTRY_PORT, inject: [ACCOUNTING], useFactory: (uc: AccountingUseCases) => new PostJournalEntryFacade(uc.postJournalEntry) },
  ],
  exports: [POST_JOURNAL_ENTRY_PORT, REVERSE_JOURNAL_ENTRY_PORT],
})
export class AccountingModule {}
