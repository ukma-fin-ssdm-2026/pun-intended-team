// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { VenuesService } from '../../../core/catalog/services/venues.service.ts';
import type { AccountCaller } from '../../../core/identity/types/caller.ts';
import { CurrentAccount } from '../../common/auth.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { Venue } from '../schemas/events.ts';
import { CreateVenueBody, ListVenuesQuery, VenueIdParams, VenuesPage } from '../schemas/venues.ts';

const ListVenuesRequest = { query: ListVenuesQuery } satisfies RequestSchemas;
const GetVenueRequest = { params: VenueIdParams } satisfies RequestSchemas;
const CreateVenueRequest = { body: CreateVenueBody } satisfies RequestSchemas;

@Controller()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.venues.mine,
    operationId: 'listMyVenues',
    summary: 'List your organization’s venues',
    description:
      'List the venues the caller’s organization has added, by name. An organization publishes events only at its ' +
      'own venues. Empty for an account that is not an organization.',
    tags: ['Venues'],
    access: 'user',
    request: ListVenuesRequest,
    responses: {
      200: { description: 'A page of venues', schema: VenuesPage },
    },
  })
  async listMyVenues(
    @Input() { query }: RouteInput<typeof ListVenuesRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<VenuesPage> {
    return this.venuesService.listOwn(account.accountId, query);
  }

  @Endpoint({
    method: 'get',
    path: Routes.venues.byId,
    operationId: 'getMyVenue',
    summary: 'Get one of your organization’s venues',
    tags: ['Venues'],
    access: 'user',
    request: GetVenueRequest,
    responses: {
      200: { description: 'The venue', schema: Venue },
      404: { description: 'No venue with this id, or it is not one of the organization’s own', schema: ErrorResponse },
    },
  })
  async getMyVenue(
    @Input() { params }: RouteInput<typeof GetVenueRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Venue> {
    return this.venuesService.getOwn(account.accountId, params.id);
  }

  @Endpoint({
    method: 'post',
    path: Routes.venues.mine,
    operationId: 'createVenue',
    summary: 'Add a venue',
    description:
      'Add a venue where the caller’s organization can publish events: a name, an address and its point on the map, ' +
      'which must be in Kyiv.',
    tags: ['Venues'],
    access: 'user',
    request: CreateVenueRequest,
    responses: {
      201: { description: 'The added venue', schema: Venue },
      422: {
        description:
          '`ORGANIZATION_NOT_VERIFIED`: the caller is not a verified organization. ' +
          '`VENUE_OUTSIDE_CITY`: the location is not in Kyiv.',
        schema: ErrorResponse,
      },
    },
    location: Routes.venues.byId,
  })
  async createVenue(
    @Input() { body }: RouteInput<typeof CreateVenueRequest>,
    @CurrentAccount() account: AccountCaller,
  ): Promise<Venue> {
    return this.venuesService.create(account.accountId, body);
  }
}
