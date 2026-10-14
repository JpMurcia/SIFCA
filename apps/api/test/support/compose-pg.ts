import { randomUUID } from 'node:crypto';
import { composeAccounting } from '../../src/modules/accounting/accounting.module.js';
import type { AccountingUseCases } from '../../src/modules/accounting/application/accounting-use-cases.js';
import { PrismaAuditLog } from '../../src/platform/persistence/prisma-audit-log.js';
import { PrismaUnitOfWork } from '../../src/platform/persistence/prisma-unit-of-work.js';
import { PrismaService } from '../../src/platform/persistence/prisma.service.js';
import { InMemoryEventPublisher } from '../../src/platform/events/in-memory-event-publisher.js';
import { RequestContextPermissionChecker } from '../../src/platform/http/request-context.js';
import { SystemIdGenerator } from '../../src/platform/time/system-id-generator.js';
import type { Clock, RequestContextPort, TenantId, UserId } from '../../src/shared-kernel/index.js';
import { seedFiscalYear, seedTestChart } from '../fixtures/plan-de-cuentas-de-prueba.js';
import type { TestDb } from '../integration/support/postgres-harness.js';
import { FixedClock } from './fixed-clock.js';

export const ALL_PERMISSIONS = [
  'accounting.entry.post', 'accounting.entry.reverse', 'accounting.report.read', 'accounting.period.manage',
  'accounting.period.close', 'accounting.period.reopen', 'accounting.year.close',
];

export interface PgUnit {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly uc: AccountingUseCases;
  readonly clock: FixedClock;
  readonly events: InMemoryEventPublisher;
  readonly prisma: PrismaService;
  readonly requestContext: RequestContextPort;
  /** Cambia los permisos del usuario de la prueba. */
  setPermissions(perms: string[]): void;
  close(): Promise<void>;
}

/**
 * Compone el módulo con los adaptadores REALES sobre una base de pruebas (sin HTTP). Siembra el plan de cuentas de
 * prueba y el año fiscal 2026 para un tenant nuevo (con el rol propietario).
 */
export async function makePgUnit(db: TestDb, o: { perms?: string[]; seed?: boolean; clock?: Clock } = {}): Promise<PgUnit> {
  const tenantId = randomUUID() as TenantId;
  const userId = randomUUID() as UserId;
  let perms = new Set(o.perms ?? ALL_PERMISSIONS);
  const requestContext: RequestContextPort = { current: () => ({ tenantId, userId, permissions: perms, requestId: 'test' }) };
  if (o.seed !== false) {
    await db.withTenant(tenantId, async (c) => {
      await seedTestChart(c, tenantId);
      await seedFiscalYear(c, tenantId, 2026);
    }, db.owner);
  }
  const prisma = new PrismaService(db.urls.app);
  const clock = (o.clock as FixedClock | undefined) ?? FixedClock.at('2026-10-14T15:00:00Z');
  const ids = new SystemIdGenerator();
  const events = new InMemoryEventPublisher();
  const uc = composeAccounting({
    uow: new PrismaUnitOfWork(prisma, requestContext, { maxWaitMs: 30_000, timeoutMs: 60_000 }),
    permissions: new RequestContextPermissionChecker(requestContext),
    requestContext, clock, ids, events, audit: new PrismaAuditLog(requestContext, clock, ids),
  });
  return { tenantId, userId, uc, clock, events, prisma, requestContext, setPermissions: (p) => { perms = new Set(p); }, close: () => prisma.close() };
}

export const entryBody = (over: Record<string, unknown> = {}) => ({
  voucherType: 'AJ', accountingDate: '2026-10-14', description: 'Venta de contado',
  lines: [{ accountCode: '1105', debit: '100000.00' }, { accountCode: '4135', credit: '100000.00' }], ...over,
});
