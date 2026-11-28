// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaListingLikesRepository } from '../../dist/infra/prisma/prisma-listing-likes.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID } from './fixtures/accounts.ts';

const LIKED = 'd0000000-0000-4000-8000-000000000001';
const UNLIKED = 'd0000000-0000-4000-8000-000000000002';

function makeRepository(rows: unknown[] = []) {
  const listingLike = {
    createMany: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve({ count: 1 })),
    deleteMany: mock.fn<(args: unknown) => Promise<unknown>>(() => Promise.resolve({ count: 1 })),
  };
  const queryRaw = mock.fn(() => Promise.resolve(rows));
  const prisma = { listingLike, $queryRaw: queryRaw } as unknown as PrismaService;
  return { repository: new PrismaListingLikesRepository(prisma), listingLike, queryRaw };
}

describe('PrismaListingLikesRepository', () => {
  test('a like skips a duplicate, so liking twice keeps one row', async () => {
    const { repository, listingLike } = makeRepository();

    await repository.like(LIKED, ACCOUNT_ID);

    assert.deepEqual(listingLike.createMany.mock.calls[0]?.arguments[0], {
      data: [{ listingId: LIKED, accountId: ACCOUNT_ID }],
      skipDuplicates: true,
    });
  });

  test('an unlike deletes only the viewer’s like and does not fail without one', async () => {
    const { repository, listingLike } = makeRepository();
    listingLike.deleteMany.mock.mockImplementation(() => Promise.resolve({ count: 0 }));

    await repository.unlike(LIKED, ACCOUNT_ID);

    assert.deepEqual(listingLike.deleteMany.mock.calls[0]?.arguments[0], {
      where: { listingId: LIKED, accountId: ACCOUNT_ID },
    });
  });

  test('reads the likes of a page in one query and gives 0 to a listing nobody likes', async () => {
    const { repository, queryRaw } = makeRepository([{ listing_id: LIKED, like_count: 2, liked: true }]);

    const likes = await repository.summaries([LIKED, UNLIKED], ACCOUNT_ID);

    assert.equal(queryRaw.mock.callCount(), 1);
    assert.deepEqual(likes.get(LIKED), { likeCount: 2, liked: true });
    assert.deepEqual(likes.get(UNLIKED), { likeCount: 0, liked: false });
  });

  test('asks the database nothing for no listings', async () => {
    const { repository, queryRaw } = makeRepository();

    assert.equal((await repository.summaries([], ACCOUNT_ID)).size, 0);
    assert.equal(queryRaw.mock.callCount(), 0);
  });
});
