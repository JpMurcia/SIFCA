import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaAuditLog } from '../../../src/platform/persistence/prisma-audit-log.js';
import { PrismaService } from '../../../src/platform/persistence/prisma.service.js';
import { PrismaUnitOfWork } from '../../../src/platform/persistence/prisma-unit-of-work.js';
import { SystemIdGenerator } from '../../../src/platform/time/system-id-generator.js';
import type { RequestContextPort, TenantId, UserId } from '../../../src/shared-kernel/index.js';
import { FixedClock } from '../../support/fixed-clock.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

let db: TestDb;
let prisma: PrismaService;
const tenant = randomUUID() as TenantId;
const user = randomUUID() as UserId;
const ctx: RequestContextPort = { current: () => ({ tenantId: tenant, userId: user, permissions: new Set(), requestId: 'req-9' }) };

beforeAll(async () => {
  db = await createTestDatabase();
  prisma = new PrismaService(db.urls.app);
});
afterAll(async () => {
  await prisma.close();
  await db.close();
});

describe('PrismaAuditLog', () => {
  it('registra la acción con actor, motivo, antes/después dentro de la transacción', async () => {
    const uow = new PrismaUnitOfWork(prisma, ctx, { maxWaitMs: 5_000, timeoutMs: 15_000 });
    const audit = new PrismaAuditLog(ctx, FixedClock.at('2026-10-14T15:00:00Z'), new SystemIdGenerator());
    const entityId = randomUUID();
    await uow.run(() =>
      audit.record({ action: 'accounting.period.reopened', entityType: 'fiscal_period', entityId, reason: 'Ajuste', before: { status: 'CLOSED' }, after: { status: 'OPEN' } }),
    );
    const rows = await db.withTenant(tenant, async (c) => (await c.query('SELECT * FROM audit.audit_log WHERE entity_id = $1', [entityId])).rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'accounting.period.reopened', reason: 'Ajuste', actor_id: user, request_id: 'req-9', before: { status: 'CLOSED' }, after: { status: 'OPEN' } });
  });

  it('si la operación falla, la auditoría se revierte con ella', async () => {
    const uow = new PrismaUnitOfWork(prisma, ctx, { maxWaitMs: 5_000, timeoutMs: 15_000 });
    const audit = new PrismaAuditLog(ctx, FixedClock.at('2026-10-14T15:00:00Z'), new SystemIdGenerator());
    const entityId = randomUUID();
    await expect(
      uow.run(async () => {
        await audit.record({ action: 'x', entityType: 'y', entityId });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await db.withTenant(tenant, async (c) => (await c.query('SELECT 1 FROM audit.audit_log WHERE entity_id = $1', [entityId])).rows);
    expect(rows).toHaveLength(0);
  });

  it('la bitácora es append-only: UPDATE/DELETE/TRUNCATE fallan con sifca_app y con sifca_owner', async () => {
    const id = randomUUID();
    await db.withTenant(tenant, (c) =>
      c.query(`INSERT INTO audit.audit_log (id, tenant_id, actor_id, action, entity_type, entity_id, occurred_at) VALUES ($1,$2,$3,'a','b',$4,now())`, [id, tenant, user, randomUUID()]),
    );
    await expect(db.withTenant(tenant, (c) => c.query(`UPDATE audit.audit_log SET action = 'z'`))).rejects.toThrow(/permission denied/);
    await expect(db.withTenant(tenant, (c) => c.query('DELETE FROM audit.audit_log'))).rejects.toThrow(/permission denied/);
    await expect(db.withTenant(tenant, (c) => c.query('TRUNCATE audit.audit_log'))).rejects.toThrow(/permission denied/);
    await expect(db.withTenant(tenant, (c) => c.query(`UPDATE audit.audit_log SET action = 'z'`), db.owner)).rejects.toThrow(/IMMUTABLE_RECORD/);
    await expect(db.withTenant(tenant, (c) => c.query('DELETE FROM audit.audit_log'), db.owner)).rejects.toThrow(/IMMUTABLE_RECORD/);
    await expect(db.owner.query('TRUNCATE audit.audit_log')).rejects.toThrow(/IMMUTABLE_RECORD/);
  });
});
