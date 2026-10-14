import { z } from 'zod';

/** Códigos estables de error del módulo de contabilidad (research §14). */
export const ProblemCodeSchema = z.enum([
  'ENTRY_NOT_BALANCED',
  'VALIDATION_FAILED',
  'PERIOD_CLOSED',
  'PERIOD_NOT_FOUND',
  'ALREADY_REVERSED',
  'ENTRY_IMMUTABLE',
  'PERIOD_CLOSE_BLOCKED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'UNAUTHENTICATED',
  'INTERNAL_ERROR',
]);
export type ProblemCode = z.infer<typeof ProblemCodeSchema>;

/** application/problem+json (RFC 9457). */
export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: ProblemCodeSchema,
  requestId: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string(), message: z.string(), rule: z.string().optional() }))
    .optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;
