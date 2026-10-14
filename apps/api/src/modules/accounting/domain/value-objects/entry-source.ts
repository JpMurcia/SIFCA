export type SourceType =
  | 'MANUAL' | 'SALES_DOCUMENT' | 'RECEIPT' | 'PURCHASE_DOCUMENT' | 'STOCK_ADJUSTMENT' | 'YEAR_CLOSING' | 'REVERSAL';

export const SOURCE_TYPES: readonly SourceType[] = ['MANUAL', 'SALES_DOCUMENT', 'RECEIPT', 'PURCHASE_DOCUMENT', 'STOCK_ADJUSTMENT', 'YEAR_CLOSING', 'REVERSAL'];

/** Documento fuente del comprobante (R-CON-007): obligatorio salvo para los manuales. */
export class EntrySource {
  private constructor(
    readonly type: SourceType,
    readonly id: string | null,
  ) {}

  static manual(): EntrySource {
    return new EntrySource('MANUAL', null);
  }

  static of(type: SourceType, id: string | null | undefined): EntrySource {
    if (!SOURCE_TYPES.includes(type)) throw new RangeError(`Tipo de origen desconocido: ${type}`);
    if (type === 'MANUAL') return EntrySource.manual();
    if (!id) throw new RangeError(`El origen ${type} exige el id del documento fuente (R-CON-007)`);
    return new EntrySource(type, id);
  }
}
