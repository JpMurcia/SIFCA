import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RequestContextPort, TenantId, UserId } from '../../../src/shared-kernel/index.js';
import { PrismaService } from '../../../src/platform/persistence/prisma.service.js';
import { PrismaUnitOfWork } from '../../../src/platform/persistence/prisma-unit-of-work.js';
import { TransactionContext } from '../../../src/platform/persistence/tenant-context.js';
import { createTestDatabase, type TestDb } from '../support/postgres-harness.js';

let db: TestDb;
let prisma: PrismaService;
const tenantA = randomUUID() as TenantId;
const tenantB = randomUUID() as TenantId;
let current: TenantId = tenantA;

const ctx: RequestContextPort = {
  current: () => ({ tenantId: current, userId: randomUUID() as UserId, permissions: new Set(), requestId: 'test' }),
};

let uow: PrismaUnitOfWork;

const insertLog = async (action: string) => {
  const tx = TransactionContext.client();
  await tx.$executeRaw`INSERT INTO audit.audit_log (id, tenant_id, actor_id, action, entity_type, entity_id, occurred_at)
    VALUES (${randomUUID()}::uuid, ${current}::uuid, ${randomUUID()}::uuid, ${action}, 'test', ${randomUUID()}::uuid, now())`;
};
const countLogs = async (action: string, tenant = tenantA) =>
  db.withTenant(tenant, async (c) => Number((await c.query('SELECT count(*) AS n FROM audit.audit_log WHERE action = $1', [action])).rows[0].n));

beforeAll(async () => {
  db = await createTestDatabase();
  prisma = new PrismaService(db.urls.app);
  uow = new PrismaUnitOfWork(prisma, ctx, { maxWaitMs: 5_000, timeoutMs: 15_000 });
});
afterAll(async () => {
  await prisma.close();
  await db.close();
});

describe('UnitOfWork', () => {
  it('hace commit al terminar y persiste', async () => {
    await uow.run(() => insertLog('uow-commit'));
    expect(await countLogs('uow-commit')).toBe(1);
  });

  it('revierte todo si fn lanza', async () => {
    await expect(
      uow.run(async () => {
        await insertLog('uow-rollback');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await countLogs('uow-rollback')).toBe(0);
  });

  it('es reentrante: la llamada anidada se une a la transacción y comparte el rollback', async () => {
    await expect(
      uow.run(async () => {
        await uow.run(() => insertLog('uow-nested'));
        await uow.run(() => insertLog('uow-nested'));
        throw new Error('fallo del exterior');
      }),
    ).rejects.toThrow('fallo del exterior');
    expect(await countLogs('uow-nested')).toBe(0);

    await uow.run(async () => {
      await uow.run(() => insertLog('uow-nested-ok'));
      await uow.run(() => insertLog('uow-nested-ok'));
    });
    expect(await countLogs('uow-nested-ok')).toBe(2);
  });

  it('fija app.tenant_id antes de la primera consulta y no lo filtra fuera de la transacción', async () => {
    const inside = await uow.run(async () => {
      const r = await TransactionContext.client().$queryRaw<{ v: string }[]>`SELECT current_setting('app.tenant_id', true) AS v`;
      return r[0]!.v;
    });
    expect(inside).toBe(tenantA);
    const outside = await prisma.client.$queryRaw<{ v: string | null }[]>`SELECT current_setting('app.tenant_id', true) AS v`;
    expect(outside[0]!.v === null || outside[0]!.v === '').toBe(true);
  });

  it('RLS: dentro de la unidad de trabajo solo se ven las filas del tenant del contexto', async () => {
    current = tenantB;
    await uow.run(() => insertLog('uow-tenant'));
    current = tenantA;
    const seen = await uow.run(async () => {
      const r = await TransactionContext.client().$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM audit.audit_log WHERE action = 'uow-tenant'`;
      return Number(r[0]!.n);
    });
    expect(seen).toBe(0);
    expect(await countLogs('uow-tenant', tenantB)).toBe(1);
  });

  it('respeta el timeout explícito: la transacción que lo excede se revierte por completo', async () => {
    await expect(
      uow.run(
        async () => {
          await insertLog('uow-timeout');
          await new Promise((r) => setTimeout(r, 1_200));
          await insertLog('uow-timeout');
        },
        { timeoutMs: 300 },
      ),
    ).rejects.toThrow();
    expect(await countLogs('uow-timeout')).toBe(0);
  });

  it('readOnly: las escrituras fallan', async () => {
    await expect(uow.run(() => insertLog('uow-readonly'), { readOnly: true })).rejects.toThrow(/read-only/i);
  });

  it('el cliente transaccional no está disponible fuera de una unidad de trabajo', () => {
    expect(() => TransactionContext.client()).toThrow(/UnitOfWork/);
  });
});
