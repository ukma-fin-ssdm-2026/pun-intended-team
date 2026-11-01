// Written with the help of Claude
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { StatsService } from '../../dist/core/admin/services/stats.service.js';
import type { EventsService } from '../../dist/core/catalog/services/events.service.js';
import type { AccountsService } from '../../dist/core/identity/services/accounts.service.js';
import type { MatchingService } from '../../dist/core/matching/services/matching.service.js';
import type { ModerationService } from '../../dist/core/moderation/services/moderation.service.js';

describe('StatsService.get', () => {
  test("combines each module's counts", async () => {
    const service = new StatsService(
      { stats: () => Promise.resolve({ users: 12 }) } as unknown as AccountsService,
      { stats: () => Promise.resolve({ events: 5 }) } as unknown as EventsService,
      { stats: () => Promise.resolve({ matches: 0 }) } as unknown as MatchingService,
      { stats: () => Promise.resolve({ openReports: 3 }) } as unknown as ModerationService,
    );

    assert.deepEqual(await service.get(), { users: 12, events: 5, matches: 0, openReports: 3 });
  });
});
