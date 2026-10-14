import { Prisma } from '../../generated/prisma/client.js';
import type { AuditEntry, AuditLog, Clock, IdGenerator, RequestContextPort } from '../../shared-kernel/index.js';
import { currentTx } from './sql.js';

/** Inserta en `audit.audit_log` dentro de la transacción en curso (misma atomicidad que la operación auditada). */
export class PrismaAuditLog implements AuditLog {
  constructor(
    private readonly ctx: RequestContextPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const { tenantId, userId, requestId } = this.ctx.current();
    const json = (v: unknown) => (v === undefined ? Prisma.DbNull : JSON.stringify(v));
    await currentTx().$executeRaw`
      INSERT INTO audit.audit_log (id, tenant_id, actor_id, action, entity_type, entity_id, reason, before, after, request_id, occurred_at)
      VALUES (${this.ids.next()}::uuid, ${tenantId}::uuid, ${userId}::uuid, ${entry.action}, ${entry.entityType},
              ${entry.entityId}::uuid, ${entry.reason ?? null}, ${json(entry.before)}::jsonb, ${json(entry.after)}::jsonb,
              ${requestId}, ${this.clock.now().toDate()})`;
  }
}
