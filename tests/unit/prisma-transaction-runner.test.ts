// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { PrismaTransactionRunner } from '../../dist/infra/prisma/prisma-transaction-runner.js';

const TX = { client: 'tx' };

function makeRunner() {
  const $transaction = mock.fn<
    (work: (tx: unknown) => Promise<unknown>, options?: { timeout: number }) => Promise<unknown>
  >((work) => work(TX));
  const runner = new PrismaTransactionRunner({ $transaction } as never);
  return { runner, $transaction };
}

describe('PrismaTransactionRunner.run', () => {
  test("runs the work in a Prisma interactive transaction with Prisma's default time limit", async () => {
    const { runner, $transaction } = makeRunner();

    const result = await runner.run((tx) => Promise.resolve(tx));

    assert.equal(result, TX);
    assert.equal($transaction.mock.calls[0]?.arguments[1], undefined);
  });

  test('passes a longer time limit on to Prisma', async () => {
    const { runner, $transaction } = makeRunner();

    await runner.run(() => Promise.resolve(), { timeoutMs: 60_000 });

    assert.deepEqual($transaction.mock.calls[0]?.arguments[1], { timeout: 60_000 });
  });
});
