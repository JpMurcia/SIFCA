/** Detalle de una violación de regla (se serializa en `errors[]` del Problem). */
export interface Violation {
  readonly field: string;
  readonly message: string;
  /** Regla del catálogo incumplida, p. ej. `R-CON-001`. */
  readonly rule?: string;
}

/**
 * Error base del dominio: lleva un `code` estable (lo traduce la capa de presentación a HTTP)
 * y el detalle de violaciones. No conoce HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(
    message: string,
    readonly violations: readonly Violation[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** El recurso pedido no existe (o no es visible para el tenant). */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  constructor(what: string) {
    super(`${what} no existe`);
  }
}

/** Conflicto de estado no cubierto por un código más específico. */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  constructor(message: string, violations: readonly Violation[] = []) {
    super(message, violations);
  }
}
