import { Instant, LocalDate, type Clock } from '../../shared-kernel/index.js';

const BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de calendario de un instante en America/Bogota (R-CON-014). */
export function toBogotaDate(instant: Instant): LocalDate {
  const parts = Object.fromEntries(BOGOTA.formatToParts(instant.toDate()).map((p) => [p.type, p.value]));
  return LocalDate.of(`${parts.year}-${parts.month}-${parts.day}`);
}

export class SystemClock implements Clock {
  now(): Instant {
    return Instant.fromEpochMs(Date.now());
  }
  toLocalDate(instant: Instant): LocalDate {
    return toBogotaDate(instant);
  }
  today(): LocalDate {
    return this.toLocalDate(this.now());
  }
}
