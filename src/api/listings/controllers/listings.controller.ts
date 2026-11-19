// Written with the help of Claude
import { Controller } from '@nestjs/common';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { ListingsService } from '../../../core/listings/services/listings.service.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { CropQuery, ImageFileBody, INVALID_IMAGE, UPLOAD_NOTE, toCrop } from '../../images/schemas/images.ts';
import { CreateListingBody, ListListingsQuery, Listing, ListingIdParams, ListingsPage } from '../schemas/listings.ts';

const ListListingsRequest = { query: ListListingsQuery } satisfies RequestSchemas;
const GetListingRequest = { params: ListingIdParams } satisfies RequestSchemas;
const CreateListingRequest = { body: CreateListingBody } satisfies RequestSchemas;
const DeleteListingRequest = { params: ListingIdParams } satisfies RequestSchemas;
const UploadListingPhotoRequest = {
  params: ListingIdParams,
  query: CropQuery,
  file: ImageFileBody,
} satisfies RequestSchemas;
const DeleteListingPhotoRequest = { params: ListingIdParams } satisfies RequestSchemas;

const NOT_OWN_LISTING = {
  description: 'No active listing with this id, or it is not the caller’s own',
  schema: ErrorResponse,
};

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
      404: NOT_OWN_LISTING,
    },
  })
  async deleteListing(
    @Input() { params }: RouteInput<typeof DeleteListingRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<void> {
    await this.listingsService.remove(account.accountId, params.id);
  }

  @Endpoint({
    method: 'put',
    path: Routes.listings.photo,
    operationId: 'uploadListingPhoto',
    summary: 'Add a photo to your listing',
    description: `Set or replace the photo of the caller’s own listing, cut to 2:1 and stored at up to 1200 × 600. ${UPLOAD_NOTE}`,
    tags: ['Listings'],
    access: 'user',
    request: UploadListingPhotoRequest,
    responses: {
      200: { description: 'The updated listing', schema: Listing },
      404: NOT_OWN_LISTING,
      422: INVALID_IMAGE,
    },
    mcp: false,
  })
  async uploadListingPhoto(
    @Input() { params, query, file }: RouteInput<typeof UploadListingPhotoRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Listing> {
    return this.listingsService.setPhoto(account.accountId, params.id, { ...file, crop: toCrop(query) });
  }

  @Endpoint({
    method: 'delete',
    path: Routes.listings.photo,
    operationId: 'deleteListingPhoto',
    summary: 'Remove the photo of your listing',
    description: 'Remove the photo of the caller’s own listing. Without a photo, nothing changes.',
    tags: ['Listings'],
    access: 'user',
    request: DeleteListingPhotoRequest,
    responses: {
      200: { description: 'The updated listing', schema: Listing },
      404: NOT_OWN_LISTING,
    },
  })
  async deleteListingPhoto(
    @Input() { params }: RouteInput<typeof DeleteListingPhotoRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Listing> {
    return this.listingsService.removePhoto(account.accountId, params.id);
  }
}
