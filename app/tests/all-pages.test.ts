// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { allPages } from '@/api/all-pages';

const page = (items: number[], hasMore: boolean) => ({ ok: true as const, data: { items, page: { hasMore } } });

describe('allPages', () => {
  test('joins the pages until the last one, asking for each by its offset', async () => {
    const offsets: number[] = [];

    const result = await allPages(async (offset) => {
      offsets.push(offset);
      return offset === 0 ? page([1, 2], true) : page([3], false);
    });

    expect(result).toEqual({ ok: true, data: [1, 2, 3] });
    expect(offsets).toEqual([0, 20]);
  });

  test('fails the whole list when a page fails', async () => {
    const failure = { ok: false as const, status: 503, code: 'SERVICE_UNAVAILABLE' };

    const result = await allPages(async (offset) => (offset === 0 ? page([1], true) : failure));

    expect(result).toEqual(failure);
  });
});
