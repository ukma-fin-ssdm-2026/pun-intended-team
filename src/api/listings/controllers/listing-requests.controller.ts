// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ListingRequestsService } from '../../../core/listings/services/listing-requests.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { MatchContacts } from '../../matching/schemas/matches.ts';
import {
  ListingRequest,
  ListingRequestIdParams,
  ListingRequestsPage,
  ListListingRequestsQuery,
} from '../schemas/listing-requests.ts';
import { ListingIdParams } from '../schemas/listings.ts';

const CreateListingRequestRequest = { params: ListingIdParams } satisfies RequestSchemas;
const ListMyListingRequestsRequest = { query: ListListingRequestsQuery } satisfies RequestSchemas;
const ListingRequestRequest = { params: ListingRequestIdParams } satisfies RequestSchemas;

const notVisible = {
  description:
    'No such request, the caller is neither its requester nor the listing’s author, or it was pending on a ' +
    'listing that has since been removed',
  schema: ErrorResponse,
};

const notTheAuthors = {
  description: `${notVisible.description}; or the caller is not the listing’s author`,
  schema: ErrorResponse,
};

const alreadyAnswered = {
  description: '`CONFLICT`: the author has already accepted or declined the request.',
  schema: ErrorResponse,
};

@Controller()
export class ListingRequestsController {
  constructor(private readonly requestsService: ListingRequestsService) {}

  @Endpoint({
    method: 'post',
    path: Routes.listings.requests,
    operationId: 'requestToJoinListing',
    summary: 'Ask to join a listing',
    description:
      '"Хочу піти": ask the author of someone else’s active listing to go together. The author gets a ' +
      '`listing_request` notification. One request per listing; a second one is `409 ALREADY_REQUESTED`.',
    tags: ['Listings'],
    access: 'user',
    request: CreateListingRequestRequest,
    responses: {
      201: { description: 'The caller’s request, `pending`', schema: ListingRequest },
      404: { description: 'No active listing with this id', schema: ErrorResponse },
      409: { description: '`ALREADY_REQUESTED`: the caller has already asked to join it.', schema: ErrorResponse },
      422: {
        description:
          '`CANNOT_REQUEST_OWN_LISTING`: the listing is the caller’s own. `PROFILE_INCOMPLETE`: the profile lacks ' +
          'a communication format, a gender, an interest or a linked account; the app sends the user to complete it.',
        schema: ErrorResponse,
      },
    },
    location: Routes.listingRequests.byId,
  })
  async requestToJoinListing(
    @Input() { params }: RouteInput<typeof CreateListingRequestRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<ListingRequest> {
    return this.requestsService.create(account.accountId, params.id);
  }

  @Endpoint({
    method: 'get',
    path: Routes.listingRequests.mine,
    operationId: 'listMyListingRequests',
    summary: 'List requests to join your listings',
    description:
      'Requests on the caller’s listings, pending first, newest first, with each requester’s public profile but ' +
      'no contacts. Pending requests on a removed listing are left out.',
    tags: ['Listings'],
    access: 'user',
    request: ListMyListingRequestsRequest,
    responses: {
      200: { description: 'A page of requests', schema: ListingRequestsPage },
    },
  })
  async listMyListingRequests(
    @Input() { query }: RouteInput<typeof ListMyListingRequestsRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<ListingRequestsPage> {
    return this.requestsService.listIncoming(account.accountId, query);
  }

  @Endpoint({
    method: 'get',
    path: Routes.listingRequests.byId,
    operationId: 'getListingRequest',
    summary: 'Get a listing request',
    description: 'One request, for its requester or the listing’s author, with both public profiles but no contacts.',
    tags: ['Listings'],
    access: 'user',
    request: ListingRequestRequest,
    responses: {
      200: { description: 'The request', schema: ListingRequest },
      404: notVisible,
    },
  })
  async getListingRequest(
    @Input() { params }: RouteInput<typeof ListingRequestRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<ListingRequest> {
    return this.requestsService.getOwn(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.listingRequests.accept,
    operationId: 'acceptListingRequest',
    summary: 'Accept a request to join your listing',
    description:
      'The listing’s author accepts a pending request. The requester gets a `listing_request_accepted` ' +
      'notification, and both can read each other’s contacts with `getListingRequestContacts`.',
    tags: ['Listings'],
    access: 'user',
    request: ListingRequestRequest,
    responses: {
      200: { description: 'The request, `accepted`', schema: ListingRequest },
      404: notTheAuthors,
      409: alreadyAnswered,
    },
  })
  async acceptListingRequest(
    @Input() { params }: RouteInput<typeof ListingRequestRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<ListingRequest> {
    return this.requestsService.accept(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.listingRequests.decline,
    operationId: 'declineListingRequest',
    summary: 'Decline a request to join your listing',
    description: 'The listing’s author declines a pending request. The requester gets no notification.',
    tags: ['Listings'],
    access: 'user',
    request: ListingRequestRequest,
    responses: {
      200: { description: 'The request, `declined`', schema: ListingRequest },
      404: notTheAuthors,
      409: alreadyAnswered,
    },
  })
  async declineListingRequest(
    @Input() { params }: RouteInput<typeof ListingRequestRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<ListingRequest> {
    return this.requestsService.decline(account.accountId, params.id);
  }

  @Endpoint({
    method: 'get',
    path: Routes.listingRequests.contacts,
    operationId: 'getListingRequestContacts',
    summary: 'Get the contacts of an accepted listing request',
    description:
      'How to reach the other side, once the author accepted: the requester for the author, the author for the ' +
      'requester. Before that, and after a decline, the answer is `404`, as for a request that does not exist ' +
      '(SEC-001). An accepted request answers `422` until the caller has acknowledged the safety notice with ' +
      '`acknowledgeSafetyNotice` (SAFE-002).',
    tags: ['Listings'],
    access: 'user',
    request: ListingRequestRequest,
    responses: {
      200: { description: 'The other side’s contacts', schema: MatchContacts },
      404: { description: 'No accepted request with this id that the caller is part of', schema: ErrorResponse },
      422: {
        description: '`SAFETY_NOTICE_REQUIRED`: the caller has not acknowledged the safety notice yet.',
        schema: ErrorResponse,
      },
    },
  })
  async getListingRequestContacts(
    @Input() { params }: RouteInput<typeof ListingRequestRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<MatchContacts> {
    return this.requestsService.getContacts(account.accountId, params.id);
  }
}
