// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ListingsService } from '../../../core/listings/services/listings.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CreateListingBody, ListListingsQuery, Listing, ListingIdParams, ListingsPage } from '../schemas/listings.ts';

const ListListingsRequest = { query: ListListingsQuery } satisfies RequestSchemas;
const GetListingRequest = { params: ListingIdParams } satisfies RequestSchemas;
const CreateListingRequest = { body: CreateListingBody } satisfies RequestSchemas;
const DeleteListingRequest = { params: ListingIdParams } satisfies RequestSchemas;

@Controller()
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Endpoint({
    method: 'get',
    path: Routes.listings.list,
    operationId: 'listListings',
    summary: 'Browse listings',
    description: 'Browse listings: active "looking for company" posts from today on, soonest first.',
    tags: ['Listings'],
    access: 'user',
    request: ListListingsRequest,
    responses: {
      200: { description: 'A page of listings', schema: ListingsPage },
    },
  })
  async listListings(@Input() { query }: RouteInput<typeof ListListingsRequest>): Promise<ListingsPage> {
    return this.listingsService.list(query);
  }

  @Endpoint({
    method: 'get',
    path: Routes.listings.byId,
    operationId: 'getListing',
    summary: 'Get a listing',
    description: 'Get one active listing with its author and category.',
    tags: ['Listings'],
    access: 'user',
    request: GetListingRequest,
    responses: {
      200: { description: 'The listing', schema: Listing },
      404: { description: 'No active listing with this id', schema: ErrorResponse },
    },
  })
  async getListing(@Input() { params }: RouteInput<typeof GetListingRequest>): Promise<Listing> {
    return this.listingsService.getById(params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.listings.list,
    operationId: 'createListing',
    summary: 'Post a listing',
    tags: ['Listings'],
    access: 'user',
    request: CreateListingRequest,
    responses: {
      201: { description: 'The posted listing', schema: Listing },
      422: {
        description:
          '`REFERENCE_NOT_FOUND`: no such active category or event. `EVENT_CANCELLED`: the event is cancelled. ' +
          '`LISTING_DATE_IN_PAST`: the date is before today.',
        schema: ErrorResponse,
      },
    },
    location: Routes.listings.byId,
  })
  async createListing(
    @Input() { body }: RouteInput<typeof CreateListingRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Listing> {
    return this.listingsService.create(account.accountId, body);
  }

  @Endpoint({
    method: 'delete',
    path: Routes.listings.byId,
    operationId: 'deleteListing',
    summary: 'Remove your listing',
    tags: ['Listings'],
    access: 'user',
    request: DeleteListingRequest,
    responses: {
      204: { description: 'The listing was removed' },
      404: { description: 'No active listing with this id, or it is not the caller’s own', schema: ErrorResponse },
    },
  })
  async deleteListing(
    @Input() { params }: RouteInput<typeof DeleteListingRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<void> {
    await this.listingsService.remove(account.accountId, params.id);
  }
}
