import { z } from 'zod';
import { MoneySchema } from '../common/decimal.js';
import { SourceTypeSchema } from './journal-entry.js';

/** Eventos de dominio del módulo de contabilidad (contracts/ports.md §4). Los consumidores validan con estos esquemas. */
export const JournalEntryPostedEventSchema = z.object({
  name: z.literal('accounting.journal_entry.posted.v1'),
  occurredAt: z.iso.datetime({ offset: true }),
  payload: z.object({
    entryId: z.uuid(),
    tenantId: z.uuid(),
    voucherType: z.string(),
    number: z.number().int().min(1),
    accountingDate: z.iso.date(),
    totalDebit: MoneySchema,
    totalCredit: MoneySchema,
    source: z.object({ type: SourceTypeSchema, id: z.uuid().nullable() }),
    postedAt: z.iso.datetime({ offset: true }),
  }),
});

export const JournalEntryReversedEventSchema = z.object({
  name: z.literal('accounting.journal_entry.reversed.v1'),
  occurredAt: z.iso.datetime({ offset: true }),
  payload: z.object({
    entryId: z.uuid(),
    tenantId: z.uuid(),
    reversalOf: z.uuid(),
    reason: z.string(),
    voucherType: z.string(),
    number: z.number().int().min(1),
    accountingDate: z.iso.date(),
  }),
});

export const PeriodEventPayloadSchema = z.object({
  periodId: z.uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

export const PeriodClosedEventSchema = z.object({
  name: z.literal('accounting.period.closed.v1'),
  occurredAt: z.iso.datetime({ offset: true }),
  payload: PeriodEventPayloadSchema.extend({ closedBy: z.uuid(), closedAt: z.iso.datetime({ offset: true }) }),
});

export const PeriodReopenedEventSchema = z.object({
  name: z.literal('accounting.period.reopened.v1'),
  occurredAt: z.iso.datetime({ offset: true }),
  payload: PeriodEventPayloadSchema.extend({ reopenedBy: z.uuid(), reason: z.string() }),
});
