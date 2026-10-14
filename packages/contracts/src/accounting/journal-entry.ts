import { z } from 'zod';
import { MoneySchema } from '../common/decimal.js';

export const SourceTypeSchema = z.enum(['MANUAL', 'SALES_DOCUMENT', 'RECEIPT', 'PURCHASE_DOCUMENT', 'STOCK_ADJUSTMENT', 'YEAR_CLOSING', 'REVERSAL']);
export type SourceTypeDto = z.infer<typeof SourceTypeSchema>;

const AccountCodeSchema = z.string().regex(/^[0-9]{1,12}$/);
const VoucherTypeCodeSchema = z.string().regex(/^[A-Z]{1,5}$/);

/** Línea de entrada. Exactamente un lado debe ser > 0 (R-CON-002; lo valida el dominio). */
export const JournalLineInputSchema = z
  .object({
    accountCode: AccountCodeSchema,
    partyId: z.uuid().nullish(),
    costCenterCode: z.string().min(1).max(20).nullish(),
    debit: MoneySchema.optional(),
    credit: MoneySchema.optional(),
    description: z.string().max(500).optional(),
    documentRef: z.string().max(60).optional(),
    dueDate: z.iso.date().nullish(),
  })
  .strict();
export type JournalLineInputDto = z.infer<typeof JournalLineInputSchema>;

/** Documento fuente: obligatorio salvo `MANUAL` (R-CON-007). */
export const EntrySourceInputSchema = z
  .object({ type: SourceTypeSchema, id: z.uuid().optional() })
  .strict()
  .refine((s) => s.type === 'MANUAL' || s.id !== undefined, { message: 'El origen distinto de MANUAL exige id (R-CON-007)', path: ['id'] });

export const MAX_LINES = 500;

export const PostJournalEntryRequestSchema = z
  .object({
    voucherType: VoucherTypeCodeSchema,
    /** Fecha contable. Si falta se usa `occurredAt` en hora de Colombia, o hoy. */
    accountingDate: z.iso.date().optional(),
    /** Instante del hecho (UTC con zona); de él se deriva la fecha contable en America/Bogota (R-CON-014). */
    occurredAt: z.iso.datetime({ offset: true }).optional(),
    description: z.string().min(1).max(500),
    source: EntrySourceInputSchema.optional(),
    lines: z.array(JournalLineInputSchema).min(2).max(MAX_LINES),
  })
  .strict();
export type PostJournalEntryRequest = z.infer<typeof PostJournalEntryRequestSchema>;

export const ReverseJournalEntryRequestSchema = z
  .object({ reason: z.string().min(5).max(500), accountingDate: z.iso.date().optional() })
  .strict();
export type ReverseJournalEntryRequest = z.infer<typeof ReverseJournalEntryRequestSchema>;

export const JournalLineSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int().min(1),
  accountCode: z.string(),
  accountName: z.string().optional(),
  partyId: z.uuid().nullable().optional(),
  costCenterCode: z.string().nullable().optional(),
  debit: MoneySchema,
  credit: MoneySchema,
  description: z.string().nullable().optional(),
  documentRef: z.string().nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
});

export const JournalEntrySummarySchema = z.object({
  id: z.uuid(),
  voucherType: z.string(),
  number: z.number().int().min(1),
  numberingYear: z.number().int().optional(),
  accountingDate: z.iso.date(),
  fiscalPeriodId: z.uuid().optional(),
  description: z.string(),
  sourceType: SourceTypeSchema,
  sourceId: z.uuid().nullable().optional(),
  status: z.literal('POSTED'),
  reversalOf: z.uuid().nullable().optional(),
  reversedBy: z.uuid().nullable().optional(),
  totalDebit: MoneySchema,
  totalCredit: MoneySchema,
  postedAt: z.iso.datetime({ offset: true }).optional(),
  postedBy: z.uuid().optional(),
});
export type JournalEntrySummaryDto = z.infer<typeof JournalEntrySummarySchema>;

export const JournalEntrySchema = JournalEntrySummarySchema.extend({
  reversalReason: z.string().nullable().optional(),
  lines: z.array(JournalLineSchema),
});
export type JournalEntryDto = z.infer<typeof JournalEntrySchema>;

export const ListJournalEntriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  voucherType: VoucherTypeCodeSchema.optional(),
  accountCode: AccountCodeSchema.optional(),
  sourceType: SourceTypeSchema.optional(),
});
export type ListJournalEntriesQuery = z.infer<typeof ListJournalEntriesQuerySchema>;
