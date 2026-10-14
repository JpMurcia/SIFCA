export interface AuditEntry {
  /** Acción estable, p. ej. `accounting.period.closed`. */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason?: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

/** Bitácora de auditoría append-only. El adaptador escribe dentro de la transacción ambiente. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export const AUDIT_LOG = Symbol('AuditLog');
