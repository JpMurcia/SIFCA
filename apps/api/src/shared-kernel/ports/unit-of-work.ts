export interface UnitOfWorkOptions {
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
  readonly isolation?: 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  /** Transacción de solo lectura (consultas y reportes). */
  readonly readOnly?: boolean;
}

/**
 * Unidad de trabajo reentrante (research §9): si ya hay una transacción en el contexto asíncrono,
 * `fn` se une a ella; si no, abre una nueva. Fija el contexto del tenant para RLS.
 */
export interface UnitOfWork {
  run<T>(fn: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
