// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { EventsService } from '../../../core/catalog/services/events.service.ts';
import { OrganizationsService } from '../../../core/catalog/services/organizations.service.ts';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CropQuery, ImageFileBody, INVALID_IMAGE, UPLOAD_NOTE, toCrop } from '../../images/schemas/images.ts';
import { ListMyEventsQuery, OrganizationEventsPage } from '../schemas/events.ts';
import {
  Organization,
  OrganizationIdParams,
  OrganizationInstagramBody,
  OrganizationRequestBody,
  PublicOrganization,
} from '../schemas/organizations.ts';

const GetOrganizationRequest = { params: OrganizationIdParams } satisfies RequestSchemas;
const ListOrganizationEventsRequest = {
  params: OrganizationIdParams,
  query: ListMyEventsQuery,
} satisfies RequestSchemas;
const RequestOrganizationRequest = { body: OrganizationRequestBody } satisfies RequestSchemas;
const UploadLogoRequest = { query: CropQuery, file: ImageFileBody } satisfies RequestSchemas;
const SetInstagramRequest = { body: OrganizationInstagramBody } satisfies RequestSchemas;

const NO_ORGANIZATION = { description: 'The caller has not requested organization status', schema: ErrorResponse };
const NO_PUBLIC_ORGANIZATION = {
  description: 'No verified organization with this id: unknown, still pending, rejected or revoked',
  schema: ErrorResponse,
};

@Controller()
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly eventsService: EventsService,
  ) {}

  @Endpoint({
    method: 'get',
    path: Routes.organizations.byId,
    operationId: 'getOrganization',
    summary: 'Get an organization’s page',
    description:
      'Get a verified organization as its page shows it: name, description, site, Instagram and logo. ' +
      'An organization that is not verified is not found.',
    tags: ['Organizations'],
    access: 'guest',
    request: GetOrganizationRequest,
    responses: {
      200: { description: 'The organization', schema: PublicOrganization },
      404: NO_PUBLIC_ORGANIZATION,
    },
  })
  async getOrganization(@Input() { params }: RouteInput<typeof GetOrganizationRequest>): Promise<PublicOrganization> {
    return this.organizationsService.getPublic(params.id);
  }

  @Endpoint({
    method: 'get',
    path: Routes.organizations.events,
    operationId: 'listOrganizationEvents',
    summary: 'List an organization’s events',
    description:
      'List the published events of a verified organization that have not ended, soonest first, for its page.',
    tags: ['Organizations'],
    access: 'guest',
    request: ListOrganizationEventsRequest,
    responses: {
      200: { description: 'A page of events', schema: OrganizationEventsPage },
      404: NO_PUBLIC_ORGANIZATION,
    },
  })
  async listOrganizationEvents(
    @Input() { params, query }: RouteInput<typeof ListOrganizationEventsRequest>,
  ): Promise<OrganizationEventsPage> {
    return this.eventsService.listByOrganization(params.id, query);
  }

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
      'the request can be sent again. The Instagram username is set apart, with `setOrganizationInstagram`.',
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
    path: Routes.organizations.instagram,
    operationId: 'setOrganizationInstagram',
    summary: 'Set your organization’s Instagram',
    description:
      'Set or clear the Instagram username of the caller’s organization, in any verification status. It is a ' +
      'public link, not checked by an administrator, so a verified organization stays verified and a pending ' +
      'request keeps waiting.',
    tags: ['Organizations'],
    access: 'user',
    request: SetInstagramRequest,
    responses: {
      200: { description: 'The organization', schema: Organization },
      404: NO_ORGANIZATION,
      422: {
        description: '`INVALID_SOCIAL_HANDLE`: the Instagram username does not fit; `details` names `instagram`',
        schema: ErrorResponse,
      },
    },
  })
  async setOrganizationInstagram(
    @Input() { body }: RouteInput<typeof SetInstagramRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Organization> {
    return this.organizationsService.setInstagram(account.accountId, body.instagram);
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
