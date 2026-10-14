const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Instante en UTC (R-CON-014). Solo entra al sistema por el puerto `Clock` o por entradas con zona explícita. */
export class Instant {
  private constructor(private readonly epochMs: number) {}

  static fromISO(value: string): Instant {
    if (typeof value !== 'string' || !ISO_WITH_ZONE.test(value)) {
      throw new RangeError(`Instante inválido: «${String(value)}» (se espera ISO 8601 con zona, p. ej. 2026-11-01T04:30:00Z)`);
    }
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) throw new RangeError(`Instante inválido: «${value}»`);
    return new Instant(ms);
  }

  /** Solo para adaptadores de infraestructura (reloj del sistema, base de datos). */
  static fromEpochMs(ms: number): Instant {
    return new Instant(ms);
  }

  toEpochMs(): number {
    return this.epochMs;
  }

  toISOString(): string {
    return new Date(this.epochMs).toISOString();
  }

  toDate(): Date {
    return new Date(this.epochMs);
  }

  equals(other: Instant): boolean {
    return this.epochMs === other.epochMs;
  }

  isBefore(other: Instant): boolean {
    return this.epochMs < other.epochMs;
  }

  toJSON(): string {
    return this.toISOString();
  }
}
