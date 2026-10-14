import type { RequestContextPort, VoucherTypeId } from '../../../../shared-kernel/index.js';
import { EntryNumber } from '../../domain/value-objects/entry-number.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { VoucherSequence } from '../../application/ports/voucher-sequence.js';

/**
 * Consecutivo sin saltos ni duplicados (R-CON-006, research §5): `UPDATE … RETURNING` bloquea la fila hasta el
 * commit. Si la transacción falla, el incremento se revierte con ella y el número no se consume.
 */
export class PrismaVoucherSequence implements VoucherSequence {
  constructor(private readonly ctx: RequestContextPort) {}

  async next(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber> {
    const tx = currentTx();
    const { tenantId } = this.ctx.current();
    await tx.$executeRaw`INSERT INTO acc.voucher_sequence (tenant_id, voucher_type_id, scope_year, last_number)
      VALUES (${tenantId}::uuid, ${typeId}::uuid, ${scopeYear}, 0) ON CONFLICT DO NOTHING`;
    const rows = await tx.$queryRaw<{ last_number: string }[]>`UPDATE acc.voucher_sequence SET last_number = last_number + 1
      WHERE tenant_id = ${tenantId}::uuid AND voucher_type_id = ${typeId}::uuid AND scope_year = ${scopeYear}
      RETURNING last_number::text AS last_number`;
    return EntryNumber.of(Number(rows[0]!.last_number));
  }

  async peek(typeId: VoucherTypeId, scopeYear: number): Promise<EntryNumber> {
    const rows = await currentTx().$queryRaw<{ n: string }[]>`SELECT (last_number + 1)::text AS n FROM acc.voucher_sequence
      WHERE voucher_type_id = ${typeId}::uuid AND scope_year = ${scopeYear}`;
    return EntryNumber.of(rows[0] ? Number(rows[0].n) : 1);
  }
}
