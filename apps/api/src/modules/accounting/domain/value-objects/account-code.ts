const PATTERN = /^[0-9]{1,12}$/;

/** Código de cuenta del plan: 1 a 12 dígitos (clase 1, grupo 2, cuenta 4, subcuenta 6, auxiliar 8+). */
export class AccountCode {
  private constructor(readonly value: string) {}

  static of(value: string): AccountCode {
    if (typeof value !== 'string' || !PATTERN.test(value)) throw new RangeError(`Código de cuenta inválido: «${String(value)}»`);
    return new AccountCode(value);
  }

  /** Prefijo de `level` dígitos (acumula por nivel en el balance). */
  prefix(level: number): string {
    return this.value.slice(0, level);
  }

  equals(other: AccountCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
