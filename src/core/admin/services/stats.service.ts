// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { EventsService } from '../../catalog/services/events.service.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { MatchingService } from '../../matching/services/matching.service.ts';
import { ModerationService } from '../../moderation/services/moderation.service.ts';

export interface PlatformStats {
  users: number;
  events: number;
  matches: number;
  openReports: number;
}

/** Platform statistics for administrators (FR-030); each module counts its own data. */
@Injectable()
export class StatsService {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly eventsService: EventsService,
    private readonly matchingService: MatchingService,
    private readonly moderationService: ModerationService,
  ) {}

  async get(): Promise<PlatformStats> {
    const [users, events, matches, reports] = await Promise.all([
      this.accountsService.stats(),
      this.eventsService.stats(),
      this.matchingService.stats(),
      this.moderationService.stats(),
    ]);
    return { ...users, ...events, ...matches, ...reports };
  }
}
