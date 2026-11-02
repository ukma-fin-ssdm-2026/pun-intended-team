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
    operationId: 'reportUser',
    summary: 'Report a user',
    description:
      'Report a user by username, with a reason and an optional comment. Administrators review it; repeated reports ' +
      'on one user are grouped into one case. The reporter gets no details about the case, and a report on a ' +
      'banned user is accepted the same way but not stored.',
    tags: ['Moderation'],
    access: 'user',
    request: CreateReportRequest,
    responses: {
      204: { description: 'The report was received' },
      422: {
        description: '`REFERENCE_NOT_FOUND`: no user has this username. `CANNOT_REPORT_SELF`: it is your own username.',
        schema: ErrorResponse,
      },
    },
  })
  async reportUser(
    @Input() { body }: RouteInput<typeof CreateReportRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<void> {
    await this.moderationService.report(account.accountId, body);
  }
}
