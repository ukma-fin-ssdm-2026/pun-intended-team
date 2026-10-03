// Written with the help of Claude
import type { Page, PageRequest } from '../../core/common/page.js';

export function paginate<T>(items: T[], { limit, offset }: PageRequest): Page<T> {
  return {
    items: items.slice(offset, offset + limit),
    page: { limit, offset, hasMore: items.length > offset + limit },
  };
}
