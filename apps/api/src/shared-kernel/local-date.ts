const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] as number;
}

/**
 * Fecha de calendario sin zona horaria (R-CON-014). Representada por su cadena `YYYY-MM-DD`;
 * no usa `Date`, de modo que no depende del reloj ni de la zona del servidor.
 */
export class LocalDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  static of(value: string): LocalDate {
    const m = typeof value === 'string' ? PATTERN.exec(value) : null;
    if (!m) throw new RangeError(`Fecha inválida: «${String(value)}» (se espera YYYY-MM-DD)`);
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new RangeError(`Fecha inexistente: «${value}»`);
    return new LocalDate(y, mo, d);
  }

  static firstDayOf(year: number, month: number): LocalDate {
    return LocalDate.of(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`);
  }

  static lastDayOf(year: number, month: number): LocalDate {
    return LocalDate.of(
      `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
    );
  }

  compare(other: LocalDate): number {
    return this.toString() < other.toString() ? -1 : this.toString() > other.toString() ? 1 : 0;
  }

  equals(other: LocalDate): boolean {
    return this.compare(other) === 0;
  }

  isBefore(other: LocalDate): boolean {
    return this.compare(other) < 0;
  }

  isAfter(other: LocalDate): boolean {
    return this.compare(other) > 0;
  }

  /** Pertenencia inclusiva a [from, to]. */
  isBetween(from: LocalDate, to: LocalDate): boolean {
    return this.compare(from) >= 0 && this.compare(to) <= 0;
  }

  toString(): string {
    return `${String(this.year).padStart(4, '0')}-${String(this.month).padStart(2, '0')}-${String(this.day).padStart(2, '0')}`;
  }

  toJSON(): string {
    return this.toString();
  }
}
