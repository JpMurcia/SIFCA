import type { DomainEvent, DomainEventPublisher } from '../../shared-kernel/index.js';

/**
 * Publicador provisional (G-05): conserva los eventos en memoria. La spec 011 lo reemplaza por el outbox
 * transaccional; no hay efectos externos dentro de la transacción.
 */
export class InMemoryEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];
  publish(events: readonly DomainEvent[]): void {
    this.published.push(...events);
  }
}
