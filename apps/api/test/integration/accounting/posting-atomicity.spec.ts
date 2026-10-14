import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostJournalEntry } from '../../../src/modules/accounting/application/use-cases/post-journal-entry.js';
import { PrismaAccountRepository } from '../../../src/modules/accounting/infrastructure/persistence/prisma-account.repository.js';
import { PrismaCostCenterRepository } from '../../../src/modules/accounting/infrastructure/persistence/prisma-cost-center.repository.js';
import { PrismaFiscalPeriodRepository } from '../../../src/modules/accounting/infrastructure/persistence/prisma-fiscal-period.repository.js';
import { PrismaJournalEntryRepository } from '../../../src/modules/accounting/infrastructure/persistence/prisma-journal-entry.repository.js';
import { PrismaVoucherSequence } from '../../../src/modules/accounting/infrastructure/persistence/prisma-voucher-sequence.js';
import { PrismaVoucherTypeRepository } from '../../../src/modules/accounting/infrastructure/persistence/prisma-voucher-type.repository.js';
import { PrismaUnitOfWork } from '../../../src/platform/persistence/prisma-unit-of-work.js';
import { RequestContextPermissionChecker } from '../../../src/platform/http/request-context.js';
import { SystemIdGenerator } from '../../../src/platform/time/system-id-generator.js';
import type { UnitOfWork } from '../../../src/shared-kernel/index.js';
import { entryBody, makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

/** [001-08] / G-04 / INV-15: una falla en CUALQUIER paso no deja líneas, cabecera ni número consumido. */
let db: TestDb;
let u: PgUnit;
beforeAll(async () => {
  db = await createTestDatabase();
  u = await makePgUnit(db);
});
afterAll(async () => {
  await u.close();
  await db.close();
});

type Step = 'after-sequence' | 'after-header-and-lines' | 'before-commit';

/** Construye el caso de uso real con una falla inyectada en el paso indicado. */
function failingAt(step: Step): PostJournalEntry {
  const uow = new PrismaUnitOfWork(u.prisma, u.requestContext, { maxWaitMs: 10_000, timeoutMs: 30_000 });
  const realSeq = new PrismaVoucherSequence(u.requestContext);
  const realEntries = new PrismaJournalEntryRepository(u.requestContext);
  const boom = new Error(`falla inyectada en ${step}`);
  const sequence = step === 'after-sequence' ? { next: async (...a: Parameters<typeof realSeq.next>) => { await realSeq.next(...a); throw boom; }, peek: realSeq.peek.bind(realSeq) } : realSeq;
  const entries = step === 'after-header-and-lines'
    ? Object.assign(Object.create(realEntries) as PrismaJournalEntryRepository, { add: async (e: Parameters<typeof realEntries.add>[0]) => { await realEntries.add(e); throw boom; } })
    : realEntries;
  const failingUow: UnitOfWork = step === 'before-commit' ? { run: (fn, o) => uow.run(async () => { await fn(); throw boom; }, o) } : uow;
  return new PostJournalEntry({
    uow: failingUow, permissions: new RequestContextPermissionChecker(u.requestContext), requestContext: u.requestContext, clock: u.clock,
    ids: new SystemIdGenerator(), accounts: new PrismaAccountRepository(), costCenters: new PrismaCostCenterRepository(), voucherTypes: new PrismaVoucherTypeRepository(),
    periods: new PrismaFiscalPeriodRepository(u.requestContext), entries: entries as PrismaJournalEntryRepository, sequence, events: u.events,
  });
}

const counts = () =>
  db.withTenant(u.tenantId, async (c) => ({
    entries: Number((await c.query('SELECT count(*) AS n FROM acc.journal_entry')).rows[0].n),
    lines: Number((await c.query('SELECT count(*) AS n FROM acc.journal_line')).rows[0].n),
    last: (await c.query(`SELECT COALESCE(max(last_number), 0) AS n FROM acc.voucher_sequence`)).rows[0].n as string,
  }));

describe('atomicidad de la contabilización', () => {
  it('el siguiente consecutivo del tipo AJ es 5 y una falla no lo consume', async () => {
    for (let i = 0; i < 4; i++) await u.uc.postJournalEntry.execute(entryBody());
    const before = await counts();
    expect(before.entries).toBe(4);
    for (const step of ['after-sequence', 'after-header-and-lines', 'before-commit'] as const) {
      await expect(failingAt(step).execute(entryBody())).rejects.toThrow(/falla inyectada/);
      const after = await counts();
      expect(after, step).toEqual(before);
    }
    const ok = await u.uc.postJournalEntry.execute(entryBody());
    expect(ok.entry.number.value).toBe(5);
  });

  it('no se publican eventos de una contabilización fallida', async () => {
    const published = u.events.published.length;
    await expect(failingAt('before-commit').execute(entryBody())).rejects.toThrow();
    expect(u.events.published.length).toBe(published);
  });
});
