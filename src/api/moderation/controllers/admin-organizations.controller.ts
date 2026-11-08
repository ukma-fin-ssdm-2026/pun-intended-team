// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { OrganizationReviewService } from '../../../core/moderation/services/organization-review.service.ts';
import {
  AdminOrganizationsPage,
  ListOrganizationsQuery,
  Organization,
  OrganizationAccountParams,
} from '../../catalog/schemas/organizations.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';

const ListOrganizationsRequest = { query: ListOrganizationsQuery } satisfies RequestSchemas;
const DecideOrganizationRequest = { params: OrganizationAccountParams } satisfies RequestSchemas;

const NO_REQUEST = {
  description: 'The account has not requested organization status, or the caller is not an administrator',
  schema: ErrorResponse,
};

const NOT_PENDING = {
  description:
    '`CONFLICT`: the request is not pending. `CANNOT_DECIDE_OWN_REQUEST`: it is the caller’s own request, ' +
    'which another administrator decides',
  schema: ErrorResponse,
};

@Controller()
export class AdminOrganizationsController {
  constructor(private readonly organizationReviewService: OrganizationReviewService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.organizations,
    operationId: 'adminListOrganizations',
    summary: 'List organization requests',
    description:
      'List organization requests: pending ones first, oldest first, then the verified, rejected and revoked ones.',
    tags: ['Organizations'],
    access: 'admin',
    request: ListOrganizationsRequest,
    responses: {
      200: { description: 'A page of requests', schema: AdminOrganizationsPage },
    },
  })
  async listOrganizations(
    @Input() { query }: RouteInput<typeof ListOrganizationsRequest>,
  ): Promise<AdminOrganizationsPage> {
    return this.organizationReviewService.list(query);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.approveOrganization,
    operationId: 'adminApproveOrganization',
    summary: 'Verify an organization',
    description:
      'Approve a pending request: the organization becomes verified and can publish events. The administrator ' +
      'and the time are recorded.',
    tags: ['Organizations'],
    access: 'admin',
    request: DecideOrganizationRequest,
    responses: {
      200: { description: 'The organization, now verified', schema: Organization },
      404: NO_REQUEST,
      409: NOT_PENDING,
    },
  })
  async approveOrganization(
    @Input() { params }: RouteInput<typeof DecideOrganizationRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<Organization> {
    return this.organizationReviewService.decide(params.accountId, 'verified', admin.accountId);
  }

  @Endpoint({
    method: 'post',
    path: Routes.admin.rejectOrganization,
    operationId: 'adminRejectOrganization',
    summary: 'Reject an organization request',
    description: 'Reject a pending request. The account can send the request again.',
    tags: ['Organizations'],
    access: 'admin',
    request: DecideOrganizationRequest,
    responses: {
      200: { description: 'The organization, now rejected', schema: Organization },
      404: NO_REQUEST,
      409: NOT_PENDING,
    },
  })
  async rejectOrganization(
    @Input() { params }: RouteInput<typeof DecideOrganizationRequest>,
    @CurrentAccount() admin: AccountCaller,
  ): Promise<Organization> {
    return this.organizationReviewService.decide(params.accountId, 'rejected', admin.accountId);
  }
}
