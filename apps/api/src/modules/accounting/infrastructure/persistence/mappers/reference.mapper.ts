import { asId, LocalDate, type UserId } from '../../../../../shared-kernel/index.js';
import { Account } from '../../../domain/entities/account.js';
import type { CostCenter } from '../../../domain/entities/cost-center.js';
import { FiscalPeriod } from '../../../domain/entities/fiscal-period.js';
import { VoucherType } from '../../../domain/entities/voucher-type.js';
import { AccountCode } from '../../../domain/value-objects/account-code.js';

export interface AccountRow {
  id: string; code: string; name: string; level: number; nature: string;
  allows_posting: boolean; requires_party: boolean; requires_cost_center: boolean; is_active: boolean;
}
export const toAccount = (r: AccountRow): Account =>
  Account.restore({
    id: asId<'AccountId'>(r.id), code: AccountCode.of(r.code), name: r.name, level: r.level,
    nature: r.nature === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    allowsPosting: r.allows_posting, requiresParty: r.requires_party, requiresCostCenter: r.requires_cost_center, isActive: r.is_active,
  });

export interface VoucherTypeRow { id: string; code: string; name: string; numbering_scope: string }
export const toVoucherType = (r: VoucherTypeRow): VoucherType =>
  VoucherType.restore({ id: asId<'VoucherTypeId'>(r.id), code: r.code, name: r.name, numberingScope: r.numbering_scope === 'YEAR' ? 'YEAR' : 'TENANT' });

export interface CostCenterRow { id: string; code: string; name: string; is_active: boolean }
export const toCostCenter = (r: CostCenterRow): CostCenter => ({ id: asId<'CostCenterId'>(r.id), code: r.code, name: r.name, isActive: r.is_active });

/** Fila cruda con fechas y marcas de tiempo como texto (evita pasar por `Date`). */
export interface PeriodRow {
  id: string; year: number; month: number; starts_on: string; ends_on: string; status: string;
  closed_at: string | null; closed_by: string | null; version: number;
}
export const toPeriod = (r: PeriodRow): FiscalPeriod =>
  FiscalPeriod.restore({
    id: asId<'PeriodId'>(r.id), year: r.year, month: r.month, startsOn: LocalDate.of(r.starts_on), endsOn: LocalDate.of(r.ends_on),
    status: r.status === 'CLOSED' ? 'CLOSED' : 'OPEN', closedAt: r.closed_at, closedBy: r.closed_by as UserId | null, version: r.version,
  });
