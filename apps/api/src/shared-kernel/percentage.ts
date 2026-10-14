import { Decimal } from './decimal.js';

/** Porcentaje no negativo, p. ej. `Percentage.of('19')` = 19 %. Nunca desde `number`. */
export class Percentage {
  private constructor(private readonly value: Decimal) {}

  static of(value: string): Percentage {
    if (typeof value !== 'string') throw new TypeError('Percentage solo se construye desde una cadena decimal');
    if (!/^\d+(\.\d+)?$/.test(value)) throw new RangeError(`Porcentaje inválido: «${value}»`);
    return new Percentage(new Decimal(value));
  }

  /** Fracción (0,19 para 19 %). */
  get ratio(): Decimal {
    return this.value.dividedBy(100);
  }

  toString(): string {
    return this.value.toString();
  }
}
