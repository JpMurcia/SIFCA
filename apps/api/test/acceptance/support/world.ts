import { setWorldConstructor, World } from '@cucumber/cucumber';
import { makePgUnit, type PgUnit } from '../../support/compose-pg.js';
import { createTestDatabase, type TestDb } from '../../integration/support/postgres-harness.js';
import { toProblem } from '../../../src/platform/http/problem-details.js';

/** Estado compartido por los pasos de un escenario. Se crea una base nueva (clon de la plantilla) por escenario. */
export class SifcaWorld extends World {
  db!: TestDb;
  unit!: PgUnit;
  /** Cuerpo del comprobante que se va a contabilizar (lo arman los pasos «Dado»). */
  body: Record<string, unknown> = {};
  /** Resultado de la última operación. */
  result: unknown;
  error: unknown;
  /** Datos libres del escenario. */
  ctx: Record<string, unknown> = {};

  async init(): Promise<void> {
    this.db = await createTestDatabase();
  }
  /** Compone el módulo y siembra plan de cuentas + año fiscal 2026 (paso de «Antecedentes»). */
  async seedCompany(): Promise<void> {
    this.unit = await makePgUnit(this.db);
  }
  async dispose(): Promise<void> {
    await this.unit?.close();
    await this.db?.close();
  }
  /** Código estable del último error (el mismo que vería el cliente HTTP). */
  get errorCode(): string | undefined {
    return this.error ? toProblem(this.error, 'acceptance').code : undefined;
  }
  /** Ejecuta una operación guardando resultado o error. */
  async attempt<T>(fn: () => Promise<T>): Promise<void> {
    this.result = undefined;
    this.error = undefined;
    try {
      this.result = await fn();
    } catch (e) {
      this.error = e;
    }
  }
}
setWorldConstructor(SifcaWorld);
