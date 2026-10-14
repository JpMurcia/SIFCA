import type { VoucherTypeId } from '../../../../shared-kernel/index.js';
import type { EntryNumber } from '../../domain/value-objects/entry-number.js';

export interface VoucherSequence {
  /**
   * Siguiente consecutivo del tipo en el año de numeración. Bloquea la fila hasta el commit: si la transacción
   * falla, el número NO se consume (R-CON-006).
   */
  next(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber>;
  /** Siguiente número orientativo (sin bloquear ni consumir). */
  peek(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber>;
}

export const VOUCHER_SEQUENCE = Symbol('VoucherSequence');
