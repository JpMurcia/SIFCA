import { z } from 'zod';

export const CreateFiscalYearRequestSchema = z.object({ year: z.number().int().min(2000).max(2100) }).strict();

export const ReopenPeriodRequestSchema = z.object({ reason: z.string().min(5).max(500) }).strict();

/** Cierre anual (R-CON-012, 🔶): las cuentas de destino se parametrizan por empresa. */
export const CloseFiscalYearRequestSchema = z
  .object({
    profitAndLossAccountId: z.uuid(),
    yearResultAccountId: z.uuid(),
    accountingDate: z.iso.date(),
    voucherType: z.string().regex(/^[A-Z]{1,5}$/).default('CI'),
  })
  .strict();

export const ListPeriodsQuerySchema = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });

export const FiscalPeriodSchema = z.object({
  id: z.uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  status: z.enum(['OPEN', 'CLOSED']),
  closedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  closedBy: z.uuid().nullable().optional(),
});
