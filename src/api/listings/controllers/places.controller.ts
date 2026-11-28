// Written with the help of Claude
import { Controller } from '@nestjs/common';
import { PlacesService } from '../../../core/listings/services/places.service.ts';
import { Endpoint, Input, type RequestSchemas, type RouteInput } from '../../common/endpoint.ts';
import { Routes } from '../../common/routes.ts';
import { ErrorResponse } from '../../common/schemas/errors.ts';
import { PlaceDescription, ReversePlaceQuery } from '../schemas/listings.ts';

const ReversePlaceRequest = { query: ReversePlaceQuery } satisfies RequestSchemas;

@Controller()
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Endpoint({
    method: 'get',
    path: Routes.places.reverse,
    operationId: 'reversePlace',
    summary: 'Name a point on the map',
    description:
      'Say what is at a point the place picker of a listing settles on: the place or the building, and its address. ' +
      'Answers come from OpenStreetMap (© OpenStreetMap contributors, ODbL), at most one request a second for the ' +
      'whole server; recent points are answered from memory.',
    tags: ['Listings'],
    access: 'user',
    request: ReversePlaceRequest,
    responses: {
      200: { description: 'What is at the point', schema: PlaceDescription },
      404: { description: 'Nothing found at the point', schema: ErrorResponse },
      422: { description: '`PLACE_OUTSIDE_CITY`: the point is not in Kyiv', schema: ErrorResponse },
      503: {
        description: '`PLACE_LOOKUP_UNAVAILABLE`: OpenStreetMap cannot be reached; the user can name the place',
        schema: ErrorResponse,
      },
    },
  })
  async reversePlace(@Input() { query }: RouteInput<typeof ReversePlaceRequest>): Promise<PlaceDescription> {
    return this.placesService.describe(query);
  }
}
