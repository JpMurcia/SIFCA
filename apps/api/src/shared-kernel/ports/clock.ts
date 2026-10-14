import type { Instant } from '../instant.js';
import type { LocalDate } from '../local-date.js';

/** El dominio nunca llama a `Date.now()`: el tiempo entra por este puerto (G-01). */
export interface Clock {
  now(): Instant;
  /** Fecha de calendario del instante en la zona America/Bogota (R-CON-014). */
  toLocalDate(instant: Instant): LocalDate;
  today(): LocalDate;
}

export const CLOCK = Symbol('Clock');
