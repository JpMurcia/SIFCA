import { ZodError } from 'zod';
import { asId, LocalDate, type PermissionChecker, type RequestContextPort, type TenantId, type UserId, Forbidden, type DomainEvent, type DomainEventPublisher, type IdGenerator } from '../../src/shared-kernel/index.js';
import { FiscalPeriod } from '../../src/modules/accounting/domain/entities/fiscal-period.js';
import { VoucherType } from '../../src/modules/accounting/domain/entities/voucher-type.js';
import { FakeUnitOfWork, InMemoryDb } from './in-memory/in-memory-db.js';
import {
  InMemoryAccountRepository, InMemoryCostCenterRepository, InMemoryFiscalPeriodRepository, InMemoryJournalEntryRepository,
  InMemoryVoucherSequence, InMemoryVoucherTypeRepository,
} from './in-memory/in-memory-repos.js';
import { FixedClock } from './fixed-clock.js';
import { acct, costCenter, uuid } from './builders.js';

export { ZodError };

export const TENANT = asId<'TenantId'>('0195f3a0-0000-7000-8000-00000000aaaa') as TenantId;
export const USER = asId<'UserId'>('0195f3a0-0000-7000-8000-00000000bbbb') as UserId;

export class CapturingPublisher implements DomainEventPublisher {
  events: DomainEvent[] = [];
  publish(events: readonly DomainEvent[]): void { this.events.push(...events); }
}

class SeqIds implements IdGenerator {
  next(): string { return uuid(); }
}

/** Compone los puertos con dobles en memoria. `perms` define los permisos del usuario de la prueba. */
export function makeUnit(perms: string[] = ['accounting.entry.post', 'accounting.entry.reverse', 'accounting.report.read', 'accounting.period.manage', 'accounting.period.close', 'accounting.period.reopen', 'accounting.year.close']) {
  const db = new InMemoryDb();
  const accounts = [acct('1105'), acct('1110'), acct('130505', { requiresParty: true }), acct('1435'), acct('13', { allowsPosting: false }), acct('1199', { isActive: false }),
    acct('2408', { nature: 'CREDIT' }), acct('3115', { nature: 'CREDIT' }), acct('4135', { nature: 'CREDIT' }), acct('4175'), acct('5105', { requiresCostCenter: true }), acct('6135'),
    acct('5905', { nature: 'CREDIT' }), acct('3605', { nature: 'CREDIT' })];
  for (const a of accounts) db.accounts.set(a.code.value, a);
  const adm = costCenter('ADM');
  db.costCenters.set('ADM', adm);
  for (const [code, scope] of [['AJ', 'TENANT'], ['FV', 'TENANT'], ['NC', 'TENANT'], ['RC', 'TENANT'], ['CI', 'YEAR']] as const) {
    db.voucherTypes.set(code, VoucherType.restore({ id: asId<'VoucherTypeId'>(uuid()), code, name: code, numberingScope: scope }));
  }
  db.periods = FiscalPeriod.openYear(2026, Array.from({ length: 12 }, () => asId<'PeriodId'>(uuid())));
  const clock = FixedClock.at('2026-10-14T15:00:00Z');
  const requestContext: RequestContextPort = { current: () => ({ tenantId: TENANT, userId: USER, permissions: new Set(perms), requestId: 'test' }) };
  const permissions: PermissionChecker = { assert: (p) => { if (!requestContext.current().permissions.has(p)) throw new Forbidden(p); } };
  const publisher = new CapturingPublisher();
  const entries = new InMemoryJournalEntryRepository(db);
  const sequence = new InMemoryVoucherSequence(db);
  return {
    db, clock, publisher, entries, sequence, requestContext, permissions,
    uow: new FakeUnitOfWork(db),
    ids: new SeqIds(),
    accounts: new InMemoryAccountRepository(db),
    costCenters: new InMemoryCostCenterRepository(db),
    voucherTypes: new InMemoryVoucherTypeRepository(db),
    periods: new InMemoryFiscalPeriodRepository(db),
    closePeriod(year: number, month: number) {
      db.periods = db.periods.map((p) =>
        p.year === year && p.month === month
          ? FiscalPeriod.restore({ id: p.id, year: p.year, month: p.month, startsOn: p.startsOn, endsOn: p.endsOn, status: 'CLOSED', closedAt: '2026-10-01T00:00:00.000Z', closedBy: USER, version: 2 })
          : p,
      );
    },
  };
}
export type Unit = ReturnType<typeof makeUnit>;
export const date = (s: string) => LocalDate.of(s);
