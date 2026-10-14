import { decodeCursor, encodeCursor, type Page, type PageRequest } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { AccountFilter, AccountRepository } from '../../application/ports/account-repository.js';
import type { Account } from '../../domain/entities/account.js';
import type { AccountCode } from '../../domain/value-objects/account-code.js';
import { toAccount } from './mappers/reference.mapper.js';

export class PrismaAccountRepository implements AccountRepository {
  async findByCodes(codes: readonly AccountCode[]): Promise<Map<string, Account>> {
    const rows = await currentTx().account.findMany({ where: { code: { in: codes.map((c) => c.value) } } });
    return new Map(rows.map((r) => [r.code, toAccount(r)]));
  }

  async findByIds(ids: readonly string[]): Promise<Map<string, Account>> {
    if (ids.length === 0) return new Map();
    const rows = await currentTx().account.findMany({ where: { id: { in: [...ids] } } });
    return new Map(rows.map((r) => [r.id, toAccount(r)]));
  }

  async list(filter: AccountFilter, page: PageRequest): Promise<Page<Account>> {
    const after = decodeCursor<{ code: string }>(page.cursor)?.code;
    const rows = await currentTx().account.findMany({
      where: {
        ...(filter.postableOnly ? { allows_posting: true, is_active: true } : {}),
        ...(filter.q ? { OR: [{ code: { startsWith: filter.q } }, { name: { contains: filter.q, mode: 'insensitive' as const } }] } : {}),
        ...(after ? { code: { gt: after } } : {}),
      },
      orderBy: { code: 'asc' },
      take: page.limit + 1,
    });
    const items = rows.slice(0, page.limit).map(toAccount);
    return { items, nextCursor: rows.length > page.limit ? encodeCursor({ code: items.at(-1)!.code.value }) : null };
  }
}
