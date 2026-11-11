// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { lastUpdatedNotice } from '@/hooks/use-events-freshness';

// FR-014
describe('lastUpdatedNotice', () => {
  test('shows nothing while every provider’s latest run succeeded', () => {
    expect(
      lastUpdatedNotice([
        { provider: 'artwizard', lastSucceededAt: '2026-11-11T02:00:31.000Z', latestRunFailed: false },
        { provider: 'karabas', lastSucceededAt: '2026-11-11T02:01:12.000Z', latestRunFailed: false },
      ]),
    ).toBeUndefined();
  });

  test('shows the Kyiv time of the last succeeded run of a provider whose latest run failed', () => {
    expect(
      lastUpdatedNotice([
        { provider: 'artwizard', lastSucceededAt: '2026-11-11T02:00:31.000Z', latestRunFailed: false },
        { provider: 'karabas', lastSucceededAt: '2026-11-10T02:01:12.000Z', latestRunFailed: true },
      ]),
    ).toBe('Оновлено 10 лист 2026, 04:01');
  });

  test('shows the oldest time when several providers failed', () => {
    expect(
      lastUpdatedNotice([
        { provider: 'artwizard', lastSucceededAt: '2026-11-09T02:00:31.000Z', latestRunFailed: true },
        { provider: 'karabas', lastSucceededAt: '2026-11-10T02:01:12.000Z', latestRunFailed: true },
      ]),
    ).toBe('Оновлено 9 лист 2026, 04:00');
  });

  test('shows nothing for a failed provider that never succeeded, since there is no time to show', () => {
    expect(
      lastUpdatedNotice([{ provider: 'artwizard', lastSucceededAt: null, latestRunFailed: true }]),
    ).toBeUndefined();
  });
});
