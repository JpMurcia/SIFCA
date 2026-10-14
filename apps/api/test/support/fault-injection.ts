import { PostJournalEntry } from '../../src/modules/accounting/application/use-cases/post-journal-entry.js';
import { PrismaAccountRepository } from '../../src/modules/accounting/infrastructure/persistence/prisma-account.repository.js';
import { PrismaCostCenterRepository } from '../../src/modules/accounting/infrastructure/persistence/prisma-cost-center.repository.js';
import { PrismaFiscalPeriodRepository } from '../../src/modules/accounting/infrastructure/persistence/prisma-fiscal-period.repository.js';
import { PrismaJournalEntryRepository } from '../../src/modules/accounting/infrastructure/persistence/prisma-journal-entry.repository.js';
import { PrismaVoucherSequence } from '../../src/modules/accounting/infrastructure/persistence/prisma-voucher-sequence.js';
import { PrismaVoucherTypeRepository } from '../../src/modules/accounting/infrastructure/persistence/prisma-voucher-type.repository.js';
import { RequestContextPermissionChecker } from '../../src/platform/http/request-context.js';
import { PrismaUnitOfWork } from '../../src/platform/persistence/prisma-unit-of-work.js';
import { SystemIdGenerator } from '../../src/platform/time/system-id-generator.js';
import type { UnitOfWork } from '../../src/shared-kernel/index.js';
import type { PgUnit } from './compose-pg.js';

export type FaultStep = 'after-sequence' | 'after-header-and-lines' | 'before-commit';
export const FAULT_STEPS: readonly FaultStep[] = ['after-sequence', 'after-header-and-lines', 'before-commit'];

/** Construye el caso de uso REAL (adaptadores Prisma) con una falla inyectada en el paso indicado (G-04, INV-15). */
export function makeFailingPost(u: PgUnit, step: FaultStep): PostJournalEntry {
  const uow = new PrismaUnitOfWork(u.prisma, u.requestContext, { maxWaitMs: 10_000, timeoutMs: 30_000 });
  const realSeq = new PrismaVoucherSequence(u.requestContext);
  const realEntries = new PrismaJournalEntryRepository(u.requestContext);
  const boom = new Error(`falla inyectada en ${step}`);
  const sequence =
    step === 'after-sequence'
      ? { next: async (...a: Parameters<typeof realSeq.next>) => { await realSeq.next(...a); throw boom; }, peek: realSeq.peek.bind(realSeq) }
      : realSeq;
  const entries =
    step === 'after-header-and-lines'
      ? Object.assign(Object.create(realEntries) as PrismaJournalEntryRepository, {
          add: async (e: Parameters<typeof realEntries.add>[0]) => { await realEntries.add(e); throw boom; },
        })
      : realEntries;
  const failingUow: UnitOfWork = step === 'before-commit' ? { run: (fn, o) => uow.run(async () => { await fn(); throw boom; }, o) } : uow;
  return new PostJournalEntry({
    uow: failingUow, permissions: new RequestContextPermissionChecker(u.requestContext), requestContext: u.requestContext, clock: u.clock,
    ids: new SystemIdGenerator(), accounts: new PrismaAccountRepository(), costCenters: new PrismaCostCenterRepository(), voucherTypes: new PrismaVoucherTypeRepository(),
    periods: new PrismaFiscalPeriodRepository(u.requestContext), entries: entries as PrismaJournalEntryRepository, sequence, events: u.events,
  });
}
