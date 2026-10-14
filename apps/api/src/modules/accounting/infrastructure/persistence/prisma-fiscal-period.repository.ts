import { Prisma } from '../../../../generated/prisma/client.js';
import { type LocalDate, type PeriodId, type RequestContextPort } from '../../../../shared-kernel/index.js';
import { currentTx } from '../../../../platform/persistence/sql.js';
import type { FiscalPeriodRepository } from '../../application/ports/fiscal-period-repository.js';
import type { FiscalPeriod } from '../../domain/entities/fiscal-period.js';
import { toPeriod, type PeriodRow } from './mappers/reference.mapper.js';

const COLS = Prisma.sql`id::text AS id, year, month, starts_on::text AS starts_on, ends_on::text AS ends_on, status,
  to_char(closed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS closed_at, closed_by::text AS closed_by, version`;

export class PrismaFiscalPeriodRepository implements FiscalPeriodRepository {
  constructor(private readonly ctx: RequestContextPort) {}

  async findByDate(date: LocalDate, mode: 'share' | 'plain'): Promise<FiscalPeriod | null> {
    const lock = mode === 'share' ? Prisma.sql`FOR SHARE` : Prisma.empty;
    const rows = await currentTx().$queryRaw<PeriodRow[]>(
      Prisma.sql`SELECT ${COLS} FROM acc.fiscal_period WHERE starts_on <= ${date.toString()}::date AND ends_on >= ${date.toString()}::date ${lock}`,
    );
    return rows[0] ? toPeriod(rows[0]) : null;
  }

  async findById(id: PeriodId, lock: 'update' | 'none'): Promise<FiscalPeriod | null> {
    const forUpdate = lock === 'update' ? Prisma.sql`FOR UPDATE` : Prisma.empty;
    const rows = await currentTx().$queryRaw<PeriodRow[]>(
      Prisma.sql`SELECT ${COLS} FROM acc.fiscal_period WHERE id = ${id}::uuid ${forUpdate}`,
    );
    return rows[0] ? toPeriod(rows[0]) : null;
  }

  async list(year?: number): Promise<readonly FiscalPeriod[]> {
    const where = year === undefined ? Prisma.empty : Prisma.sql`WHERE year = ${year}`;
    const rows = await currentTx().$queryRaw<PeriodRow[]>(
      Prisma.sql`SELECT ${COLS} FROM acc.fiscal_period ${where} ORDER BY year, month`,
    );
    return rows.map(toPeriod);
  }

  async addAll(periods: readonly FiscalPeriod[]): Promise<void> {
    const { tenantId } = this.ctx.current();
    for (const p of periods) {
      await currentTx().$executeRaw`INSERT INTO acc.fiscal_period (id, tenant_id, year, month, starts_on, ends_on, status)
        VALUES (${p.id}::uuid, ${tenantId}::uuid, ${p.year}, ${p.month}, ${p.startsOn.toString()}::date, ${p.endsOn.toString()}::date, 'OPEN')`;
    }
  }

  async save(p: FiscalPeriod): Promise<void> {
    const closedAt = p.closedAt ? Prisma.sql`${p.closedAt}::timestamptz` : Prisma.sql`NULL`;
    const closedBy = p.closedBy ? Prisma.sql`${p.closedBy}::uuid` : Prisma.sql`NULL`;
    await currentTx().$executeRaw(
      Prisma.sql`UPDATE acc.fiscal_period SET status = ${p.status}, closed_at = ${closedAt}, closed_by = ${closedBy}, version = version + 1 WHERE id = ${p.id}::uuid`,
    );
  }
}
