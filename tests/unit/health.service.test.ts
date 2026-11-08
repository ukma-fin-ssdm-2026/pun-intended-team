// Written with the help of Claude
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { Logger } from '@nestjs/common';
import type { DatabaseProbe } from '../../dist/core/system/adapters/database-probe.js';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from '../../dist/core/system/services/health.service.js';

function serviceWith(ping: () => Promise<void>): HealthService {
  return new HealthService({ ping } as DatabaseProbe);
}

describe('HealthService.check', () => {
  let logError: ReturnType<typeof mock.method>;

  beforeEach(() => {
    logError = mock.method(Logger.prototype, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    mock.timers.reset();
  });

  test('is healthy when the database answers', async () => {
    const health = await serviceWith(() => Promise.resolve()).check();

    assert.deepEqual(health, { status: 'healthy', checks: { database: 'up' } });
    assert.equal(logError.mock.callCount(), 0);
  });

  test('is unhealthy when the database fails, and logs the cause only', async () => {
    const health = await serviceWith(() => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).check();

    assert.deepEqual(health, { status: 'unhealthy', checks: { database: 'down' } });
    assert.match(String(logError.mock.calls[0]?.arguments[0]), /the database is down: connect ECONNREFUSED/);
  });

  test('is unhealthy when the database does not answer within the time limit', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const result = serviceWith(() => new Promise(() => {})).check();

    mock.timers.tick(HEALTH_CHECK_TIMEOUT_MS - 1);
    let settled = false;
    void result.then(() => (settled = true));
    await new Promise(setImmediate);
    assert.equal(settled, false);

    mock.timers.tick(1);
    assert.deepEqual(await result, { status: 'unhealthy', checks: { database: 'down' } });
    assert.match(String(logError.mock.calls[0]?.arguments[0]), /no answer within 2000 ms/);
  });
});
