/** Número consecutivo de un comprobante dentro de su tipo y año de numeración (R-CON-006). */
export class EntryNumber {
  private constructor(readonly value: number) {}
  static of(value: number): EntryNumber {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`Número de comprobante inválido: ${value}`);
    return new EntryNumber(value);
  }
  toString(): string {
    return String(this.value);
  }
}
