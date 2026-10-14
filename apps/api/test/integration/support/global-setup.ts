import { bootstrapPostgres } from './postgres-harness.js';

/** Se ejecuta una vez por corrida de Vitest: prepara PostgreSQL y la base plantilla (ver `bootstrapPostgres`). */
export default async function setup(): Promise<() => Promise<void>> {
  return bootstrapPostgres();
}
