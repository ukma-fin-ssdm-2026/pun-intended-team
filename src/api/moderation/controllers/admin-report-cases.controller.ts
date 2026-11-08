// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ModerationService } from '../../../core/moderation/services/moderation.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { ListReportCasesQuery, ReportCaseDetails, ReportCaseIdParams, ReportCasesPage } from '../schemas/reports.ts';

const ListReportCasesRequest = { query: ListReportCasesQuery } satisfies RequestSchemas;
const ReportCaseRequest = { params: ReportCaseIdParams } satisfies RequestSchemas;

const CASE_NOT_FOUND = {
  description: 'No report case with this id, or the caller is not an administrator',
  schema: ErrorResponse,
};

const OWN_CASE =
  '`CANNOT_RESOLVE_OWN_CASE`: the case is about the caller or their listing, which another administrator must judge';

@Controller()
export class AdminReportCasesController {
  constructor(private readonly moderationService: ModerationService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.reportCases,
    operationId: 'adminListReportCases',
    summary: 'List report cases',
    description:
      'List report cases, oldest first: one case per reported user or listing, with the number of reports. ' +
      'Open cases by default; `status=resolved` lists the resolved ones.',
    tags: ['Moderation'],
    access: 'admin',
    request: ListReportCasesRequest,
    responses: {
      200: { description: 'A page of report cases', schema: ReportCasesPage },
    },
  })
  async listReportCases(
    @Input() { query: { status, limit, offset } }: RouteInput<typeof ListReportCasesRequest>,
  ): Promise<ReportCasesPage> {
    return this.moderationService.listCases(status, { limit, offset });
  }

  @Endpoint({
    method: 'get',
    path: Routes.admin.reportCaseById,
    operationId: 'adminGetReportCase',
    summary: 'Get a report case',
    description:
      'Get a report case with every report in it: who reported, the reason and the comment. A listing case ' +
      'shows the listing, also after it was removed.',
    tags: ['Moderation'],
    access: 'admin',
    request: ReportCaseRequest,
    responses: {
      200: { description: 'The case and its reports', schema: ReportCaseDetails },
      404: CASE_NOT_FOUND,
    },
  })
  async getReportCase(@Input() { params }: RouteInput<typeof ReportCaseRequest>): Promise<ReportCaseDetails> {
    return this.moderationService.getCase(params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.banReportCase,
    operationId: 'adminBanReportedUser',
    summary: 'Ban the reported user',
    description:
      'Ban the user the case is about and resolve the case. Every session of the user ends at once: ' +
      'their next request gets 401, and they cannot sign in again. On a case already resolved as banned, the ban ' +
      'is applied again, so a ban that failed halfway can be retried.',
    tags: ['Moderation'],
    access: 'admin',
    request: ReportCaseRequest,
    responses: {
      200: { description: 'The resolved case', schema: ReportCaseDetails },
      404: CASE_NOT_FOUND,
      409: {
        description: `\`CONFLICT\`: the case was dismissed, or it is about a listing. \`CANNOT_BAN_ADMIN\`: the reported user is an administrator. ${OWN_CASE}`,
        schema: ErrorResponse,
      },
    },
  })
  async banReportedUser(
    @Input() { params }: RouteInput<typeof ReportCaseRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<ReportCaseDetails> {
    return this.moderationService.ban(params.id, admin.accountId);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.removeReportedListing,
    operationId: 'adminRemoveReportedListing',
    summary: 'Remove the reported listing',
    description:
      'Remove the listing a listing case is about and resolve the case as `removed`. The listing leaves the feed ' +
      'and its page answers 404, as after the author deletes it. On a case already resolved as removed, the ' +
      'removal is applied again, so a removal that failed halfway can be retried.',
    tags: ['Moderation'],
    access: 'admin',
    request: ReportCaseRequest,
    responses: {
      200: { description: 'The resolved case', schema: ReportCaseDetails },
      404: CASE_NOT_FOUND,
      409: {
        description: `\`CONFLICT\`: the case was banned or dismissed, or it is about a user. ${OWN_CASE}`,
        schema: ErrorResponse,
      },
    },
  })
  async removeReportedListing(
    @Input() { params }: RouteInput<typeof ReportCaseRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<ReportCaseDetails> {
    return this.moderationService.removeListing(params.id, admin.accountId);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.dismissReportCase,
    operationId: 'adminDismissReportCase',
    summary: 'Dismiss a report case',
    description: 'Resolve the case without action, when the reports turn out to be unfounded.',
    tags: ['Moderation'],
    access: 'admin',
    request: ReportCaseRequest,
    responses: {
      200: { description: 'The resolved case', schema: ReportCaseDetails },
      404: CASE_NOT_FOUND,
      409: { description: `\`CONFLICT\`: the case is already resolved. ${OWN_CASE}`, schema: ErrorResponse },
    },
  })
  async dismissReportCase(
    @Input() { params }: RouteInput<typeof ReportCaseRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<ReportCaseDetails> {
    return this.moderationService.dismiss(params.id, admin.accountId);
  }
}
