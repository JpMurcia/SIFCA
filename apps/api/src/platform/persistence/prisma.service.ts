import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

/** Cliente de Prisma sobre `@prisma/adapter-pg`. Solo `platform/persistence` e `infrastructure/persistence` lo usan (G-03). */
export class PrismaService {
  readonly client: PrismaClient;

  constructor(connectionString: string) {
    this.client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async close(): Promise<void> {
    await this.client.$disconnect();
  }
}
