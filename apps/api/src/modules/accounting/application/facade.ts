import type { PostJournalEntry } from './use-cases/post-journal-entry.js';

/** Referencia mínima de un comprobante contabilizado, para los consumidores de otros módulos. */
export interface PostedEntryRef {
  readonly id: string;
  readonly voucherType: string;
  readonly number: number;
  readonly accountingDate: string;
}

/**
 * Fachada pública (D-5, contracts/ports.md §3). Los módulos comerciales declaran su propio puerto y lo enlazan a
 * este. Ejecuta el mismo caso de uso que el HTTP y se une a la transacción ambiente (UnitOfWork reentrante).
 */
export interface PostJournalEntryPort {
  post(input: unknown, options?: { idempotencyKey?: string }): Promise<PostedEntryRef>;
}

export const POST_JOURNAL_ENTRY_PORT = Symbol('PostJournalEntryPort');

export class PostJournalEntryFacade implements PostJournalEntryPort {
  constructor(private readonly useCase: PostJournalEntry) {}
  async post(input: unknown, options: { idempotencyKey?: string } = {}): Promise<PostedEntryRef> {
    const { entry } = await this.useCase.execute(input, { idempotencyKey: options.idempotencyKey });
    return { id: entry.id, voucherType: entry.voucherTypeCode, number: entry.number.value, accountingDate: entry.accountingDate.toString() };
  }
}
