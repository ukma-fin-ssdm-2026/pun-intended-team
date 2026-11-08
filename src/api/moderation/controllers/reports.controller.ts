// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ModerationService } from '../../../core/moderation/services/moderation.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CreateReportBody } from '../schemas/reports.ts';

const CreateReportRequest = { body: CreateReportBody } satisfies RequestSchemas;

@Controller()
export class ReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Endpoint({
    method: 'post',
    path: Routes.reports.create,
    operationId: 'createReport',
    summary: 'Report a user or a listing',
    description:
      'Report a user by username, or someone else’s listing by its id, with a reason and an optional comment. ' +
      'Administrators review it; repeated reports on one user or one listing are grouped into one case. The ' +
      'reporter gets no details about the case, and a report on a banned user is accepted the same way but not stored.',
    tags: ['Moderation'],
    access: 'user',
    request: CreateReportRequest,
    responses: {
      204: { description: 'The report was received' },
      422: {
        description:
          '`REFERENCE_NOT_FOUND`: no user has this username, or no active listing has this id. ' +
          '`CANNOT_REPORT_SELF`: it is your own username or your own listing.',
        schema: ErrorResponse,
      },
    },
  })
  async createReport(
    @Input() { body }: RouteInput<typeof CreateReportRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<void> {
    const { username, listingId, ...report } = body;
    // The schema lets exactly one of the two through.
    if (listingId !== undefined) {
      await this.moderationService.reportListing(account.accountId, { listingId, ...report });
    } else if (username !== undefined) {
      await this.moderationService.report(account.accountId, { username, ...report });
    }
  }
}
