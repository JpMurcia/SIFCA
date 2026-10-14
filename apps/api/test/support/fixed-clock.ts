import { Instant, type Clock, type LocalDate } from '../../src/shared-kernel/index.js';
import { toBogotaDate } from '../../src/platform/time/system-clock.js';

/** Reloj fijo para pruebas. */
export class FixedClock implements Clock {
  constructor(private current: Instant) {}
  static at(iso: string): FixedClock {
    return new FixedClock(Instant.fromISO(iso));
  }
  set(iso: string): void {
    this.current = Instant.fromISO(iso);
  }
  now(): Instant {
    return this.current;
  }
  toLocalDate(instant: Instant): LocalDate {
    return toBogotaDate(instant);
  }
  today(): LocalDate {
    return toBogotaDate(this.current);
  }
}
