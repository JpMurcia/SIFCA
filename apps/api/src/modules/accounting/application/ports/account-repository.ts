import type { Page, PageRequest } from '../../../../shared-kernel/index.js';
import type { Account } from '../../domain/entities/account.js';
import type { AccountCode } from '../../domain/value-objects/account-code.js';

export interface AccountFilter {
  readonly q?: string | undefined;
  readonly postableOnly?: boolean | undefined;
}

export interface AccountRepository {
  /** Devuelve un mapa código → cuenta con las que existen (las inexistentes no aparecen). */
  findByCodes(codes: readonly AccountCode[]): Promise<Map<string, Account>>;
  /** Devuelve un mapa id → cuenta con las que existen. */
  findByIds(ids: readonly string[]): Promise<Map<string, Account>>;
  list(filter: AccountFilter, page: PageRequest): Promise<Page<Account>>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');
