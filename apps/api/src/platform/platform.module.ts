import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import {
  AUDIT_LOG, CLOCK, DOMAIN_EVENT_PUBLISHER, ID_GENERATOR, PERMISSION_CHECKER, REQUEST_CONTEXT, UNIT_OF_WORK,
  type AuditLog, type Clock, type IdGenerator, type RequestContextPort,
} from '../shared-kernel/index.js';
import { PrismaAuditLog } from './persistence/prisma-audit-log.js';
import { loadEnv, type Env } from './config/env.schema.js';
import { InMemoryEventPublisher } from './events/in-memory-event-publisher.js';
import { AlsRequestContext, RequestContextPermissionChecker } from './http/request-context.js';
import { PrismaUnitOfWork } from './persistence/prisma-unit-of-work.js';
import { PrismaService } from './persistence/prisma.service.js';
import { SystemClock } from './time/system-clock.js';
import { SystemIdGenerator } from './time/system-id-generator.js';

export const ENV = Symbol('Env');
export const PRISMA = Symbol('PrismaService');

/** Cierra el pool de conexiones al apagar la aplicación (apagado ordenado; evita conexiones huérfanas). */
@Injectable()
class PrismaShutdown implements OnModuleDestroy {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaService) {}
  async onModuleDestroy(): Promise<void> {
    await this.prisma.close();
  }
}

/**
 * Composition root de los adaptadores transversales (D-7): implementa los puertos de `shared-kernel` una sola vez
 * para todos los módulos.
 */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    { provide: PRISMA, inject: [ENV], useFactory: (env: Env) => new PrismaService(env.DATABASE_URL) },
    PrismaShutdown,
    { provide: REQUEST_CONTEXT, useValue: AlsRequestContext },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: SystemIdGenerator },
    { provide: DOMAIN_EVENT_PUBLISHER, useClass: InMemoryEventPublisher },
    {
      provide: UNIT_OF_WORK,
      inject: [PRISMA, REQUEST_CONTEXT, ENV],
      useFactory: (prisma: PrismaService, ctx: RequestContextPort, env: Env) =>
        new PrismaUnitOfWork(prisma, ctx, { maxWaitMs: env.TX_MAX_WAIT_MS, timeoutMs: env.TX_TIMEOUT_MS }),
    },
    { provide: PERMISSION_CHECKER, inject: [REQUEST_CONTEXT], useFactory: (ctx: RequestContextPort) => new RequestContextPermissionChecker(ctx) },
    {
      provide: AUDIT_LOG,
      inject: [REQUEST_CONTEXT, CLOCK, ID_GENERATOR],
      useFactory: (ctx: RequestContextPort, clock: Clock, ids: IdGenerator): AuditLog => new PrismaAuditLog(ctx, clock, ids),
    },
  ],
  exports: [ENV, PRISMA, REQUEST_CONTEXT, CLOCK, ID_GENERATOR, DOMAIN_EVENT_PUBLISHER, UNIT_OF_WORK, PERMISSION_CHECKER, AUDIT_LOG],
})
export class PlatformModule {}
