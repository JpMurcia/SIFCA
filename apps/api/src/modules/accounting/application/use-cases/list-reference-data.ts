import { type Page, type PermissionChecker, type UnitOfWork, type VoucherTypeId } from '../../../../shared-kernel/index.js';
import { z } from 'zod';
import type { Account } from '../../domain/entities/account.js';
import type { VoucherType } from '../../domain/entities/voucher-type.js';
import type { AccountRepository } from '../ports/account-repository.js';
import type { VoucherSequence } from '../ports/voucher-sequence.js';
import type { VoucherTypeRepository } from '../ports/voucher-type-repository.js';
import { READ_PERMISSION } from './get-journal-entry.js';

const AccountsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  q: z.string().max(100).optional(),
  postableOnly: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export class ListAccounts {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; accounts: AccountRepository }) {}
  async execute(raw: unknown): Promise<Page<Account>> {
    this.d.permissions.assert(READ_PERMISSION);
    const q = AccountsQuery.parse(raw);
    return this.d.uow.run(() => this.d.accounts.list({ q: q.q, postableOnly: q.postableOnly }, { limit: q.limit, cursor: q.cursor }), { readOnly: true });
  }
}

export interface VoucherTypeView {
  readonly type: VoucherType;
  readonly nextNumber: number;
}

export class ListVoucherTypes {
  constructor(private readonly d: { uow: UnitOfWork; permissions: PermissionChecker; voucherTypes: VoucherTypeRepository; sequence: VoucherSequence; today: () => number }) {}
  async execute(): Promise<VoucherTypeView[]> {
    this.d.permissions.assert(READ_PERMISSION);
    return this.d.uow.run(
      async () => {
        const types = await this.d.voucherTypes.list();
        const year = this.d.today();
        return Promise.all(
          types.map(async (type) => ({
            type,
            nextNumber: (await this.d.sequence.peek(type.id as VoucherTypeId, type.numberingScope === 'YEAR' ? year : 0)).value,
          })),
        );
      },
      { readOnly: true },
    );
  }
}
