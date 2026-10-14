import { currentTx } from '../../../../platform/persistence/sql.js';
import type { VoucherTypeRepository } from '../../application/ports/voucher-type-repository.js';
import type { VoucherType } from '../../domain/entities/voucher-type.js';
import { toVoucherType } from './mappers/reference.mapper.js';

export class PrismaVoucherTypeRepository implements VoucherTypeRepository {
  async findByCode(code: string): Promise<VoucherType | null> {
    const row = await currentTx().voucher_type.findFirst({ where: { code } });
    return row ? toVoucherType(row) : null;
  }
  async list(): Promise<readonly VoucherType[]> {
    return (await currentTx().voucher_type.findMany({ orderBy: { code: 'asc' } })).map(toVoucherType);
  }
}
