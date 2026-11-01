// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaInterestsRepository } from '../../dist/infra/prisma/prisma-interests.repository.js';
import type { PrismaService } from '../../dist/infra/prisma/prisma.service.js';

/** An interest row as Prisma returns it. */
function aRow(name: string, groupName: string) {
  return { id: `id-${name}`, name, groupName };
}

function makeRepository(rows: ReturnType<typeof aRow>[]) {
  const prisma = { interest: { findMany: mock.fn(() => Promise.resolve(rows)) } };
  return new PrismaInterestsRepository(prisma as unknown as PrismaService);
}

describe('PrismaInterestsRepository.findAll', () => {
  // Under the C collation, "Є", "І" and "Ї" come before "А"; the list must not depend on it.
  test('lists by group, then by name, in Ukrainian alphabetical order', async () => {
    const repository = makeRepository([
      aRow('Шахи', 'Ігри'),
      aRow('Біг', 'Спорт і природа'),
      aRow('Есперанто', 'Мови й історія'),
      aRow('Історія', 'Мови й історія'),
      aRow('Аніме', 'Кіно і сцена'),
      aRow('Відеоігри', 'Ігри'),
    ]);

    const interests = await repository.findAll();

    assert.deepEqual(
      interests.map(({ group, name }) => `${group}: ${name}`),
      [
        'Ігри: Відеоігри',
        'Ігри: Шахи',
        'Кіно і сцена: Аніме',
        'Мови й історія: Есперанто',
        'Мови й історія: Історія',
        'Спорт і природа: Біг',
      ],
    );
    assert.deepEqual(interests[0], { id: 'id-Відеоігри', name: 'Відеоігри', group: 'Ігри' });
  });
});
