// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { VenuesService } from '../../../core/catalog/services/venues.service.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { AdminVenue } from '../schemas/events.ts';
import { AdminVenuesPage, ListAdminVenuesQuery, VenueIdParams } from '../schemas/venues.ts';

const ListVenuesRequest = { query: ListAdminVenuesQuery } satisfies RequestSchemas;
const GetVenueRequest = { params: VenueIdParams } satisfies RequestSchemas;

@Controller()
export class AdminVenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.admin.venues,
    operationId: 'adminListVenues',
    summary: 'List all venues',
    description: 'List every venue by name: the imported ones and those organizations added.',
    tags: ['Venues'],
    access: 'admin',
    request: ListVenuesRequest,
    responses: {
      200: { description: 'A page of venues', schema: AdminVenuesPage },
    },
  })
  async listVenues(@Input() { query }: RouteInput<typeof ListVenuesRequest>): Promise<AdminVenuesPage> {
    const { limit, offset, ...filter } = query;
    return this.venuesService.search(filter, { limit, offset });
  }

  @Endpoint({
    method: 'get',
    path: Routes.admin.venueById,
    operationId: 'adminGetVenue',
    summary: 'Get any venue',
    description: 'Get one venue with the organization that owns it.',
    tags: ['Venues'],
    access: 'admin',
    request: GetVenueRequest,
    responses: {
      200: { description: 'The venue', schema: AdminVenue },
      404: { description: 'No venue with this id, or the caller is not an administrator', schema: ErrorResponse },
    },
  })
  async getVenue(@Input() { params }: RouteInput<typeof GetVenueRequest>): Promise<AdminVenue> {
    return this.venuesService.getOverview(params.id);
  }
}
