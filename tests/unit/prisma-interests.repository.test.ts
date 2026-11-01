// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaInterestsRepository } from '../../dist/infra/prisma/prisma-interests.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';

/** An interest row as Prisma returns it. */
function aRow(name: string, groupName: string, groupPosition: number) {
  return { id: `id-${name}`, name, groupName, groupPosition };
}

function makeRepository(rows: ReturnType<typeof aRow>[]) {
  const prisma = { interest: { findMany: mock.fn(() => Promise.resolve(rows)) } };
  return new PrismaInterestsRepository(prisma as unknown as PrismaService);
}

describe('PrismaInterestsRepository.findAll', () => {
  // Under the C collation, "Є", "І" and "Ї" come before "А"; the list must not depend on it.
  test('lists groups in their set order and the interests of a group in Ukrainian alphabetical order', async () => {
    const repository = makeRepository([
      aRow('Таро', 'Езотерика', 3),
      aRow('Шахи', 'Ігри', 2),
      aRow('Есперанто', 'Мови й історія', 1),
      aRow('Історія', 'Мови й історія', 1),
      aRow('Відеоігри', 'Ігри', 2),
      aRow('Астрологія', 'Езотерика', 3),
    ]);

    const interests = await repository.findAll();

    assert.deepEqual(
      interests.map(({ group, name }) => `${group}: ${name}`),
      [
        'Мови й історія: Есперанто',
        'Мови й історія: Історія',
        'Ігри: Відеоігри',
        'Ігри: Шахи',
        'Езотерика: Астрологія',
        'Езотерика: Таро',
      ],
    );
    assert.deepEqual(interests[0], { id: 'id-Есперанто', name: 'Есперанто', group: 'Мови й історія' });
  });
});
