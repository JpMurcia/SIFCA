import { DomainError, type Violation } from '../../../../shared-kernel/index.js';

/** R-CON-001: débitos ≠ créditos. */
export class EntryNotBalanced extends DomainError {
  readonly code = 'ENTRY_NOT_BALANCED';
  constructor(readonly debit: string, readonly credit: string) {
    super(`El comprobante no cuadra: débitos ${debit} ≠ créditos ${credit}`, [
      { field: 'lines', message: `Σ débitos ${debit} ≠ Σ créditos ${credit}`, rule: 'R-CON-001' },
    ]);
  }
}

/** Entrada inválida respecto de las reglas del catálogo (línea, cuenta, tercero…). */
export class ValidationFailed extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  constructor(violations: readonly Violation[]) {
    super('La solicitud no cumple las reglas contables', violations);
  }
}

export class PeriodClosed extends DomainError {
  readonly code = 'PERIOD_CLOSED';
  constructor(year: number, month: number) {
    super(`El período ${year}-${String(month).padStart(2, '0')} está cerrado`, [
      { field: 'accountingDate', message: 'El período está cerrado', rule: 'R-CON-004' },
    ]);
  }
}

export class PeriodNotFound extends DomainError {
  readonly code = 'PERIOD_NOT_FOUND';
  constructor(date: string) {
    super(`No existe un período contable para la fecha ${date}`, [
      { field: 'accountingDate', message: 'No existe un período para esa fecha', rule: 'R-CON-004' },
    ]);
  }
}

export class AlreadyReversed extends DomainError {
  readonly code = 'ALREADY_REVERSED';
  constructor() {
    super('El comprobante ya tiene una reversión', [{ field: 'entryId', message: 'Ya reversado', rule: 'R-CON-005' }]);
  }
}

export class EntryImmutable extends DomainError {
  readonly code = 'ENTRY_IMMUTABLE';
  constructor() {
    super('Los comprobantes contabilizados no se editan ni se eliminan; use la reversión (POST …/reversal)', [
      { field: 'entryId', message: 'Inmutable', rule: 'R-CON-005' },
    ]);
  }
}

export class PeriodCloseBlocked extends DomainError {
  readonly code = 'PERIOD_CLOSE_BLOCKED';
  constructor(violations: readonly Violation[]) {
    super('El período no se puede cerrar', violations);
  }
}

export class IdempotencyConflict extends DomainError {
  readonly code = 'IDEMPOTENCY_CONFLICT';
  constructor() {
    super('La Idempotency-Key ya se usó con un cuerpo distinto', [{ field: 'Idempotency-Key', message: 'Clave reutilizada con otro cuerpo' }]);
  }
}
