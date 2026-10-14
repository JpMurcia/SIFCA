import { asId, LocalDate, Money, type AccountId } from '../../src/shared-kernel/index.js';
import { Account } from '../../src/modules/accounting/domain/entities/account.js';
import { AccountCode } from '../../src/modules/accounting/domain/value-objects/account-code.js';
import type { CostCenter } from '../../src/modules/accounting/domain/entities/cost-center.js';
import type { LineInput } from '../../src/modules/accounting/domain/entities/journal-entry.js';

let seq = 0;
export const uuid = (): string => `0195f3a0-0000-7000-8000-${String(++seq).padStart(12, '0')}`;

export function acct(code: string, o: Partial<{ nature: 'DEBIT' | 'CREDIT'; allowsPosting: boolean; requiresParty: boolean; requiresCostCenter: boolean; isActive: boolean; name: string }> = {}): Account {
  return Account.restore({
    id: asId<'AccountId'>(uuid()) as AccountId,
    code: AccountCode.of(code),
    name: o.name ?? `Cuenta ${code}`,
    level: code.length,
    nature: o.nature ?? 'DEBIT',
    allowsPosting: o.allowsPosting ?? true,
    requiresParty: o.requiresParty ?? false,
    requiresCostCenter: o.requiresCostCenter ?? false,
    isActive: o.isActive ?? true,
  });
}

export const costCenter = (code = 'ADM'): CostCenter => ({ id: asId<'CostCenterId'>(uuid()), code, name: code, isActive: true });

export function dr(account: Account, amount: string, extra: Partial<LineInput> = {}): LineInput {
  return { account, debit: Money.of(amount), credit: Money.zero(), ...extra };
}
export function cr(account: Account, amount: string, extra: Partial<LineInput> = {}): LineInput {
  return { account, debit: Money.zero(), credit: Money.of(amount), ...extra };
}
export const day = (s: string): LocalDate => LocalDate.of(s);
