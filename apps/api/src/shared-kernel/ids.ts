/** Identificadores con marca de tipo: evitan mezclar, p. ej., un `AccountId` con un `EntryId`. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TenantId = Brand<string, 'TenantId'>;
export type UserId = Brand<string, 'UserId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type CostCenterId = Brand<string, 'CostCenterId'>;
export type PartyId = Brand<string, 'PartyId'>;
export type VoucherTypeId = Brand<string, 'VoucherTypeId'>;
export type EntryId = Brand<string, 'EntryId'>;
export type EntryLineId = Brand<string, 'EntryLineId'>;
export type PeriodId = Brand<string, 'PeriodId'>;
export type DraftId = Brand<string, 'DraftId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asId<B extends string>(value: string): Brand<string, B> {
  if (!UUID.test(value)) throw new RangeError(`Identificador inválido: «${value}»`);
  return value as Brand<string, B>;
}
