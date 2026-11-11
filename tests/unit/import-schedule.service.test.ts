// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { Logger } from '@nestjs/common';
import type { EventProvider } from '../../dist/core/import/adapters/event-provider.js';
import type { EventImportService } from '../../dist/core/import/services/event-import.service.js';
import { ImportScheduleService } from '../../dist/core/import/services/import-schedule.service.js';
import type { ImportRunSummary } from '../../dist/core/import/types/import.js';
import type { JobQueue } from '../../dist/core/jobs/adapters/job-queue.js';

const done = (overrides: Partial<ImportRunSummary> = {}): ImportRunSummary => ({
  reports: [],
  failed: [],
  notStarted: [],
  ...overrides,
});

function makeSchedule() {
  const jobs = { register: mock.fn(), schedule: mock.fn(), enqueue: mock.fn() };
  const importService = {
    runProvider: mock.fn((): Promise<ImportRunSummary | undefined> => Promise.resolve(done())),
  };
  const providers = [{ id: 'artwizard' }, { id: 'karabas' }] as EventProvider[];
  const service = new ImportScheduleService(
    providers,
    importService as unknown as EventImportService,
    jobs as unknown as JobQueue,
  );
  return { service, jobs, importService };
}

// HLD I3, ADR-006 (decision 9)
describe('ImportScheduleService', () => {
  test('registers import.run without retries, and schedules it daily at 02:00 UTC for each provider', () => {
    const { service, jobs } = makeSchedule();

    service.onModuleInit();

    const [name, , options] = jobs.register.mock.calls[0]?.arguments as unknown[];
    assert.equal(name, 'import.run');
    assert.deepEqual(options, { retryLimit: 0, timeoutSeconds: 3600 });
    assert.deepEqual(
      jobs.schedule.mock.calls.map((call) => call.arguments),
      [
        ['import.run', '0 2 * * *', { providerId: 'artwizard' }, 'artwizard'],
        ['import.run', '0 2 * * *', { providerId: 'karabas' }, 'karabas'],
      ],
    );
  });

  test('the handler runs the provider of the payload, with the check of its last run', async () => {
    const { service, jobs, importService } = makeSchedule();
    service.onModuleInit();
    const handler = jobs.register.mock.calls[0]?.arguments[1] as (job: object) => Promise<void>;

    await handler({ id: 'job-1', name: 'import.run', payload: { providerId: 'karabas' } });

    assert.deepEqual(importService.runProvider.mock.calls[0]?.arguments, ['karabas']);
  });

  test('fails the job when the run failed', async () => {
    const { service, importService } = makeSchedule();
    importService.runProvider.mock.mockImplementation(() =>
      Promise.resolve(done({ failed: [{ provider: 'karabas', error: 'Karabas is down' }] })),
    );

    await assert.rejects(service.handle({ providerId: 'karabas' }), {
      message: 'karabas: the run failed: Karabas is down',
    });
  });

  test('does not fail the job when the run was not started because the last one was too recent', async () => {
    const { service, importService } = makeSchedule();
    importService.runProvider.mock.mockImplementation(() =>
      Promise.resolve(
        done({
          notStarted: [
            { provider: 'karabas', lastStartedAt: '2026-11-11T01:00:00.000Z', allowedFrom: '2026-11-11T21:00:00.000Z' },
          ],
        }),
      ),
    );

    await service.handle({ providerId: 'karabas' });
  });

  test('does nothing, without failing, for a provider that is no longer bound', async () => {
    const { service, importService } = makeSchedule();
    importService.runProvider.mock.mockImplementation(() => Promise.resolve(undefined));
    const warn = mock.method(Logger.prototype, 'warn', () => {});

    await service.handle({ providerId: 'gone' });

    assert.match(warn.mock.calls[0]?.arguments[0] as string, /no provider "gone"/);
    warn.mock.restore();
  });
});
