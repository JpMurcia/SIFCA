import { Module } from '@nestjs/common';
import {
  AUDIT_LOG, CLOCK, DOMAIN_EVENT_PUBLISHER, ID_GENERATOR, PERMISSION_CHECKER, REQUEST_CONTEXT, UNIT_OF_WORK,
  type AuditLog, type Clock, type DomainEventPublisher, type IdGenerator, type PermissionChecker, type RequestContextPort, type UnitOfWork,
} from '../../shared-kernel/index.js';
import { ACCOUNTING, type AccountingUseCases } from './application/accounting-use-cases.js';
import { POST_JOURNAL_ENTRY_PORT, PostJournalEntryFacade, REVERSE_JOURNAL_ENTRY_PORT, ReverseJournalEntryFacade } from './application/facade.js';
import { ReverseJournalEntry } from './application/use-cases/reverse-journal-entry.js';
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
export function composeAccounting(p: PlatformPorts): AccountingUseCases {
  const accounts = new PrismaAccountRepository();
  const costCenters = new PrismaCostCenterRepository();
  const voucherTypes = new PrismaVoucherTypeRepository();
  const periods = new PrismaFiscalPeriodRepository(p.requestContext);
  const entries = new PrismaJournalEntryRepository(p.requestContext);
  const sequence = new PrismaVoucherSequence(p.requestContext);
  const base = { uow: p.uow, permissions: p.permissions };
  const postDeps = { ...base, requestContext: p.requestContext, clock: p.clock, ids: p.ids, accounts, costCenters, voucherTypes, periods, entries, sequence, events: p.events };
  return {
    postJournalEntry: new PostJournalEntry(postDeps),
    reverseJournalEntry: new ReverseJournalEntry(postDeps),
    getJournalEntry: new GetJournalEntry({ ...base, entries }),
    listJournalEntries: new ListJournalEntries({ ...base, entries }),
    listAccounts: new ListAccounts({ ...base, accounts }),
    listVoucherTypes: new ListVoucherTypes({ ...base, voucherTypes, sequence, today: () => p.clock.today().year }),
  };
}

@Module({
  controllers: [JournalEntriesController, LookupsController],
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
