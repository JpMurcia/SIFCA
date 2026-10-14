import { z } from 'zod';

export const PageInfoSchema = z.object({
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean(),
});

export const LimitSchema = z.coerce.number().int().min(1).max(100).default(25);

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), page: PageInfoSchema });
}
