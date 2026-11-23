// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { OrganizationsService } from '../../../core/catalog/services/organizations.service.ts';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CropQuery, ImageFileBody, INVALID_IMAGE, UPLOAD_NOTE, toCrop } from '../../images/schemas/images.ts';
import { Organization, OrganizationRequestBody } from '../schemas/organizations.ts';

const RequestOrganizationRequest = { body: OrganizationRequestBody } satisfies RequestSchemas;
const UploadLogoRequest = { query: CropQuery, file: ImageFileBody } satisfies RequestSchemas;

const NO_ORGANIZATION = { description: 'The caller has not requested organization status', schema: ErrorResponse };

@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.organizations.me,
    operationId: 'getMyOrganization',
    summary: 'Get your organization request',
    description:
      'Get the caller’s organization request with its verification status: pending, verified or rejected. ' +
      'Only a verified organization can publish events.',
    tags: ['Organizations'],
    access: 'user',
    responses: {
      200: { description: 'The request and its status', schema: Organization },
      404: { description: 'The caller has not requested organization status', schema: ErrorResponse },
    },
  })
  async getMyOrganization(@CurrentAccount() account: AccountCaller): Promise<Organization> {
    return this.organizationsService.getOwn(account.accountId);
  }

  @Endpoint({
    method: 'put',
    path: Routes.organizations.me,
    operationId: 'requestOrganizationStatus',
    summary: 'Request organization status',
    description:
      'Ask to become a verified organization with a name, a description and an official link. The request ' +
      'waits as pending until an administrator decides it. A pending request is replaced, and after a rejection ' +
      'the request can be sent again.',
    tags: ['Organizations'],
    access: 'user',
    request: RequestOrganizationRequest,
    responses: {
      200: { description: 'The request, now pending', schema: Organization },
      409: {
        description: '`CONFLICT`: the organization is already verified, or its verification was revoked',
        schema: ErrorResponse,
      },
    },
  })
  async requestOrganizationStatus(
    @Input() { body }: RouteInput<typeof RequestOrganizationRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Organization> {
    return this.organizationsService.request(account.accountId, body);
  }

  @Endpoint({
    method: 'put',
    path: Routes.organizations.logo,
    operationId: 'uploadOrganizationLogo',
    summary: 'Add your organization’s logo',
    description:
      'Set or replace the logo of the caller’s organization, in any verification status: a square shown as a circle, ' +
      `stored at up to 512 × 512. The catalog shows it, so guests may load it. ${UPLOAD_NOTE}`,
    tags: ['Organizations'],
    access: 'user',
    request: UploadLogoRequest,
    responses: {
      200: { description: 'The organization', schema: Organization },
      404: NO_ORGANIZATION,
      422: INVALID_IMAGE,
    },
    mcp: false,
  })
  async uploadOrganizationLogo(
    @Input() { query, file }: RouteInput<typeof UploadLogoRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Organization> {
    return this.organizationsService.setLogo(account.accountId, { ...file, crop: toCrop(query) });
  }

  @Endpoint({
    method: 'delete',
    path: Routes.organizations.logo,
    operationId: 'deleteOrganizationLogo',
    summary: 'Remove your organization’s logo',
    description: 'Remove the logo of the caller’s organization. Without a logo, nothing changes.',
    tags: ['Organizations'],
    access: 'user',
    responses: {
      200: { description: 'The organization', schema: Organization },
      404: NO_ORGANIZATION,
    },
  })
  async deleteOrganizationLogo(@CurrentAccount() account: AccountCaller): Promise<Organization> {
    return this.organizationsService.removeLogo(account.accountId);
  }
}
