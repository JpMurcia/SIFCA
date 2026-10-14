import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Cliente de Prisma sobre `@prisma/adapter-pg`. Solo `platform/persistence` e `infrastructure/persistence` lo usan (G-03).
 * El pool lo creamos nosotros para registrar `error`: sin ese manejador, una conexión inactiva que el servidor corta
 * (reinicio, failover) tumbaría el proceso con una excepción no capturada.
 */
export class PrismaService {
  readonly client: PrismaClient;
  private readonly pool: pg.Pool;

  constructor(connectionString: string, options: { max?: number; onPoolError?: (e: Error) => void } = {}) {
    this.pool = new pg.Pool({ connectionString, max: options.max ?? 20 });
    this.pool.on('error', (e) => options.onPoolError?.(e));
    this.client = new PrismaClient({ adapter: new PrismaPg(this.pool) });
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
    if (!this.pool.ended) await this.pool.end().catch(() => undefined);
  }
}
