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

const OWN_CASE = 'the case is about the caller, whom another administrator must judge';

@Controller()
export class AdminReportCasesController {
  constructor(private readonly moderationService: ModerationService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.reportCases,
    operationId: 'adminListReportCases',
    summary: 'List report cases',
    description:
      'List report cases, oldest first: one case per reported user, with the number of reports. ' +
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
    description: 'Get a report case with every report in it: who reported, the reason and the comment.',
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
        description: `The case was dismissed, the reported user is an administrator, or ${OWN_CASE}`,
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
      409: { description: `The case is already resolved, or ${OWN_CASE}`, schema: ErrorResponse },
    },
  })
  async dismissReportCase(
    @Input() { params }: RouteInput<typeof ReportCaseRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<ReportCaseDetails> {
    return this.moderationService.dismiss(params.id, admin.accountId);
  }
}
