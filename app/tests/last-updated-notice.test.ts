// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';

import { lastUpdatedNotice } from '@/hooks/use-events';

// FR-014
describe('lastUpdatedNotice', () => {
  test('shows nothing while the imported events are current', () => {
    expect(lastUpdatedNotice(null)).toBeUndefined();
  });

  test('shows nothing before the events are loaded', () => {
    expect(lastUpdatedNotice(undefined)).toBeUndefined();
  });

  test('shows the Kyiv time the events were last updated', () => {
    expect(lastUpdatedNotice('2026-11-10T02:01:12.000Z')).toBe('Оновлено 10 лист 2026, 04:01');
  });
});
