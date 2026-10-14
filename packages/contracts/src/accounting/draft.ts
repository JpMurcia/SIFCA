import { z } from 'zod';
import { JournalLineInputSchema, MAX_LINES } from './journal-entry.js';

/** Borrador: admite descuadre y datos incompletos; no consume consecutivo ni afecta saldos. */
export const SaveJournalDraftRequestSchema = z
  .object({
    voucherType: z.string().regex(/^[A-Z]{1,5}$/),
    accountingDate: z.iso.date().optional(),
    description: z.string().max(500).optional(),
    lines: z.array(JournalLineInputSchema).max(MAX_LINES),
    /** Requerido al reemplazar un borrador (bloqueo optimista). */
    version: z.number().int().min(1).optional(),
  })
  .strict();
export type SaveJournalDraftRequest = z.infer<typeof SaveJournalDraftRequestSchema>;

export const ListJournalDraftsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
  periodId: z.uuid().optional(),
});

export const JournalDraftSchema = z.object({
  id: z.uuid(), voucherType: z.string(), accountingDate: z.iso.date().nullable().optional(), description: z.string().nullable().optional(),
  lines: z.array(JournalLineInputSchema), version: z.number().int(), createdBy: z.uuid().optional(),
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
});
