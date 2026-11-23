// Written with the help of Claude
import type { ApiResult } from './public-client';

// The API's largest page.
export const PAGE_SIZE = 20;
// An organization's own lists are short; this only stops a runaway loop.
const MAX_PAGES = 10;

type Page<T> = { items: T[]; page: { hasMore: boolean } };

/** Every item of a short list, page after page; the first failed page fails the whole list. */
export async function allPages<T>(loadPage: (offset: number) => Promise<ApiResult<Page<T>>>): Promise<ApiResult<T[]>> {
  const items: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await loadPage(page * PAGE_SIZE);
    if (!result.ok) return result;
    items.push(...result.data.items);
    if (!result.data.page.hasMore) break;
  }
  return { ok: true, data: items };
}
