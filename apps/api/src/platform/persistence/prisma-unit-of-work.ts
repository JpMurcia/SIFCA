import { Prisma } from '../../generated/prisma/client.js';
import type { RequestContextPort, UnitOfWork, UnitOfWorkOptions } from '../../shared-kernel/index.js';
import type { PrismaService } from './prisma.service.js';
import { setTenant } from './sql.js';
import { TransactionContext } from './tenant-context.js';

export interface UnitOfWorkDefaults {
  readonly maxWaitMs: number;
  readonly timeoutMs: number;
}

const ISOLATION = {
  ReadCommitted: Prisma.TransactionIsolationLevel.ReadCommitted,
  RepeatableRead: Prisma.TransactionIsolationLevel.RepeatableRead,
  Serializable: Prisma.TransactionIsolationLevel.Serializable,
} as const;

/**
 * Implementa `UnitOfWork` sobre `prisma.$transaction` con valores EXPLÍCITOS de `maxWait`, `timeout` e
 * `isolationLevel` (ADR-0004). Es reentrante (research §9): dentro de una transacción activa, `run` se une a ella.
 */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextPort,
    private readonly defaults: UnitOfWorkDefaults,
  ) {}

  async run<T>(fn: () => Promise<T>, options: UnitOfWorkOptions = {}): Promise<T> {
    if (TransactionContext.active()) return fn();
    const { tenantId } = this.requestContext.current();
    return this.prisma.client.$transaction(
      async (tx) => {
        // SET TRANSACTION debe ser lo primero de la transacción.
        if (options.readOnly) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await setTenant(tx, tenantId);
        return TransactionContext.run(tx, fn);
      },
      {
        maxWait: options.maxWaitMs ?? this.defaults.maxWaitMs,
        timeout: options.timeoutMs ?? this.defaults.timeoutMs,
        isolationLevel: ISOLATION[options.isolation ?? 'ReadCommitted'],
      },
    );
  }
}
