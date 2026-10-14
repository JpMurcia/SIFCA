export interface DomainEvent {
  /** Nombre estable y versionado, p. ej. `accounting.journal_entry.posted.v1`. */
  readonly name: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Se publica DESPUÉS del commit (G-05). Hoy el adaptador es en memoria; la spec 011 lo reemplaza por el outbox.
 */
export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): void | Promise<void>;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DomainEventPublisher');
