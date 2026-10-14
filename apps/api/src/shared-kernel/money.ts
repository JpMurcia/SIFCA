import { Decimal } from './decimal.js';

const UNSIGNED_MONEY = /^\d+(\.\d{1,2})?$/;
const SIGNED_MONEY = /^-?\d+(\.\d{1,2})?$/;
const RAW_DECIMAL = /^-?\d+(\.\d+)?$/;

function assertString(value: unknown, what: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${what} solo se construye desde una cadena decimal, nunca desde ${typeof value} (R-CON-009)`);
  }
}

/**
 * Importe en COP con escala fija de 2 decimales (R-CON-009). Inmutable.
 * Nunca se construye desde `number`.
 */
export class Money {
  private constructor(private readonly value: Decimal) {}

  /** Importe no negativo con hasta 2 decimales exactos (lo que entra por la API). */
  static of(value: string): Money {
    assertString(value, 'Money');
    if (!UNSIGNED_MONEY.test(value)) throw new RangeError(`Importe inválido: «${value}» (se esperan ≤ 2 decimales y sin signo)`);
    return new Money(new Decimal(value));
  }

  /** Importe con signo (saldos y diferencias), con hasta 2 decimales exactos. */
  static ofSigned(value: string): Money {
    assertString(value, 'Money');
    if (!SIGNED_MONEY.test(value)) throw new RangeError(`Importe inválido: «${value}»`);
    return new Money(new Decimal(value));
  }

  /** Redondea mitad hacia arriba (sobre el valor absoluto) a 2 decimales un valor calculado. */
  static round(value: string | Decimal): Money {
    if (typeof value === 'string') {
      if (!RAW_DECIMAL.test(value)) throw new RangeError(`Decimal inválido: «${value}»`);
      return new Money(new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    }
    return new Money(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  /** Suma de líneas ya redondeadas (R-CON-009.3): el total NO se recalcula desde la base total. */
  static sum(items: readonly Money[]): Money {
    let acc = new Decimal(0);
    for (const m of items) acc = acc.plus(m.value);
    return new Money(acc);
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  negate(): Money {
    return new Money(this.value.negated());
  }

  /** Porcentaje del importe, redondeado a 2 decimales (mitad hacia arriba) por línea. */
  percentOf(rate: { readonly ratio: Decimal }): Money {
    return Money.round(this.value.times(rate.ratio));
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  compare(other: Money): number {
    return this.value.comparedTo(other.value);
  }

  /** Cadena con exactamente 2 decimales («1190000.00»). */
  toString(): string {
    return this.value.toFixed(2);
  }

  toJSON(): string {
    return this.toString();
  }
}
