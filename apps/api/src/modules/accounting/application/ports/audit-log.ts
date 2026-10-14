/** La bitácora es transversal: el puerto vive en `shared-kernel` y el módulo solo lo reexporta. */
export type { AuditEntry, AuditLog } from '../../../../shared-kernel/index.js';
export { AUDIT_LOG } from '../../../../shared-kernel/index.js';
