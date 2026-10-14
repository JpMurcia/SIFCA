import { z } from 'zod';
import { MoneySchema, SignedMoneySchema } from '../common/decimal.js';

const AccountCodeSchema = z.string().regex(/^[0-9]{1,12}$/);

export const TrialBalanceQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    level: z.coerce.number().int().refine((n) => [1, 2, 4, 6, 8].includes(n), 'level debe ser 1, 2, 4, 6 u 8').optional(),
  })
  .refine((q) => q.from <= q.to, { message: 'from debe ser anterior o igual a to', path: ['from'] });

export const JournalBookQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date(), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() })
  .refine((q) => q.from <= q.to, { message: 'from debe ser anterior o igual a to', path: ['from'] });

export const GeneralLedgerQuerySchema = z
  .object({ accountCode: AccountCodeSchema, from: z.iso.date(), to: z.iso.date(), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().optional() })
  .refine((q) => q.from <= q.to, { message: 'from debe ser anterior o igual a to', path: ['from'] });

export const TrialBalanceRowSchema = z.object({
  accountCode: z.string(), accountName: z.string().optional(), nature: z.enum(['DEBIT', 'CREDIT']),
  openingDebit: MoneySchema, openingCredit: MoneySchema, movementDebit: MoneySchema, movementCredit: MoneySchema,
  closingDebit: MoneySchema, closingCredit: MoneySchema, contraNature: z.boolean(),
});
export const TrialBalanceSchema = z.object({
  from: z.iso.date(), to: z.iso.date(), level: z.number().int().nullable().optional(),
  rows: z.array(TrialBalanceRowSchema),
  totals: z.object({ openingDebit: MoneySchema, openingCredit: MoneySchema, movementDebit: MoneySchema, movementCredit: MoneySchema, closingDebit: MoneySchema, closingCredit: MoneySchema }),
  balanced: z.boolean(),
});

export const JournalBookRowSchema = z.object({
  entryId: z.uuid(), accountingDate: z.iso.date(), voucherType: z.string(), number: z.number().int(), lineNo: z.number().int(),
  accountCode: z.string(), accountName: z.string().optional(), partyId: z.uuid().nullable().optional(),
  debit: MoneySchema, credit: MoneySchema, description: z.string().nullable().optional(),
});

export const GeneralLedgerSchema = z.object({
  accountCode: z.string(), accountName: z.string().optional(), nature: z.enum(['DEBIT', 'CREDIT']).optional(),
  from: z.iso.date(), to: z.iso.date(), openingBalance: SignedMoneySchema, closingBalance: SignedMoneySchema,
  movements: z.array(z.object({
    entryId: z.uuid(), accountingDate: z.iso.date(), voucherType: z.string(), number: z.number().int(),
    debit: MoneySchema, credit: MoneySchema, runningBalance: SignedMoneySchema, description: z.string().nullable().optional(),
  })),
  page: z.object({ nextCursor: z.string().nullable().optional(), hasMore: z.boolean() }).optional(),
});
