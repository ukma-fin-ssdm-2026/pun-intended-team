// Written with the help of Claude
import { z } from 'zod';

export const Id = z.uuid();
export const DateTime = z.iso.datetime({ offset: true });
export const CalendarDate = z.iso.date();

// Catalog access, rule 2: no page holds more than 20 items.
const MAX_PAGE_SIZE = 20;

export const PageQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(MAX_PAGE_SIZE)
    .describe(`Items per page, at most ${MAX_PAGE_SIZE}`),
  offset: z.coerce.number().int().min(0).default(0).describe('Items to skip'),
});

const PageInfo = z
  .object({
    limit: z.number().int(),
    offset: z.number().int(),
    hasMore: z.boolean().describe('Whether another page follows'),
  })
  .meta({ id: 'PageInfo', example: { limit: MAX_PAGE_SIZE, offset: 0, hasMore: false } });

/** A page of items; there is no total, so the size of the catalog is not revealed. */
export function pageOf<T extends z.ZodType>(item: T, id: string) {
  return z.object({ items: z.array(item), page: PageInfo }).meta({ id });
}
