import { TransactionContext, type TxClient } from './tenant-context.js';

/** Utilidades de SQL explícito auditadas (ADR-0004 §3). Todas operan dentro de la transacción ambiente. */

/** `set_config(…, true)`: la variable vive solo hasta el final de la transacción (RLS). */
export async function setTenant(tx: TxClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}

/** Atajo para repositorios: cliente de la transacción en curso. */
export const currentTx = (): TxClient => TransactionContext.client();
