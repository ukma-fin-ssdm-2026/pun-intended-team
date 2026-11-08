// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaReportCasesRepository } from '../../dist/infra/prisma/prisma-report-cases.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';
import { ACCOUNT_ID, OTHER_ACCOUNT_ID } from './fixtures/accounts.ts';

const THIRD_ACCOUNT_ID = 'a0000000-0000-4000-8000-000000000003';

function makeRepository(rows: { reporterId: string; case: { targetAccountId: string | null } }[]) {
  const findMany = mock.fn(() => Promise.resolve(rows));
  const repository = new PrismaReportCasesRepository({ report: { findMany } } as unknown as PrismaService);
  return { repository, findMany };
}

describe('PrismaReportCasesRepository.findReportedPairs', () => {
  test('reads the reports between the accounts, by any of them about another of them', async () => {
    const { repository, findMany } = makeRepository([]);

    await repository.findReportedPairs([ACCOUNT_ID, OTHER_ACCOUNT_ID]);

    assert.deepEqual(findMany.mock.calls[0]?.arguments, [
      {
        where: {
          reporterId: { in: [ACCOUNT_ID, OTHER_ACCOUNT_ID] },
          case: { targetAccountId: { in: [ACCOUNT_ID, OTHER_ACCOUNT_ID] } },
        },
        select: { reporterId: true, case: { select: { targetAccountId: true } } },
      },
    ]);
  });

  test('gives each reporter and reported user once, however many reports there are', async () => {
    const { repository } = makeRepository([
      { reporterId: ACCOUNT_ID, case: { targetAccountId: OTHER_ACCOUNT_ID } },
      { reporterId: ACCOUNT_ID, case: { targetAccountId: OTHER_ACCOUNT_ID } },
      { reporterId: THIRD_ACCOUNT_ID, case: { targetAccountId: ACCOUNT_ID } },
    ]);

    const pairs = await repository.findReportedPairs([ACCOUNT_ID, OTHER_ACCOUNT_ID, THIRD_ACCOUNT_ID]);

    assert.deepEqual(pairs, [
      [ACCOUNT_ID, OTHER_ACCOUNT_ID],
      [THIRD_ACCOUNT_ID, ACCOUNT_ID],
    ]);
  });
});
