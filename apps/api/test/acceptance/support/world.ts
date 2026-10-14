import { randomUUID } from 'node:crypto';
import { setWorldConstructor, World } from '@cucumber/cucumber';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';

/** Estado compartido por los pasos de un escenario. Se crea una base nueva (clon de la plantilla) por escenario. */
export class SifcaWorld extends World {
  db!: TestDb;
  tenantId = randomUUID();
  /** Resultado de la última operación (para los pasos «Entonces»). */
  result: unknown;
  error: unknown;
  /** Datos libres del escenario. */
  ctx: Record<string, unknown> = {};

  async init(): Promise<void> {
    this.db = await createTestDatabase();
  }
  async dispose(): Promise<void> {
    await this.db?.close();
  }
}
setWorldConstructor(SifcaWorld);
