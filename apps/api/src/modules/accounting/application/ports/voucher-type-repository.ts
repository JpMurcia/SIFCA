import type { VoucherType } from '../../domain/entities/voucher-type.js';

export interface VoucherTypeRepository {
  findByCode(code: string): Promise<VoucherType | null>;
  list(): Promise<readonly VoucherType[]>;
}

export const VOUCHER_TYPE_REPOSITORY = Symbol('VoucherTypeRepository');
