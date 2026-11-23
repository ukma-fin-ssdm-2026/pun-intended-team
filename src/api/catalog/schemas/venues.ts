// Written with the help of Claude
import { z } from 'zod';
import { Id, PageQuery, pageOf, SearchText } from '../../common/schemas/common.ts';
import { AdminVenue, adminVenueExample, eventExample, Venue } from './events.ts';

const CreateVenueFields = z.strictObject({
  name: z.string().trim().min(1).max(100).describe('The venue’s name, as users will see it'),
  address: z.string().trim().min(1).max(200).describe('Street and building, as users will see it'),
  location: z
    .strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .describe('Where the venue’s map pin stands; must be in Kyiv'),
});

const { id: _id, ...createVenueExample } = eventExample.venue;

export const CreateVenueBody = CreateVenueFields.meta({
  id: 'CreateVenueBody',
  example: createVenueExample,
});

export const VenuesPage = pageOf(Venue, 'VenuesPage', eventExample.venue);

export const ListVenuesQuery = PageQuery;

export const AdminVenuesPage = pageOf(AdminVenue, 'AdminVenuesPage', adminVenueExample);

export const ListAdminVenuesQuery = PageQuery.extend({
  search: SearchText.optional().describe('Part of the name or the address, in any case'),
  source: z.enum(['organization', 'import']).optional(),
  organizationId: Id.optional().describe('Only venues of this organization, by its account id'),
});

export const VenueIdParams = z.object({
  id: Id.describe('Venue id'),
});

export type CreateVenueBody = z.infer<typeof CreateVenueFields>;
export type VenuesPage = z.infer<typeof VenuesPage>;
export type AdminVenuesPage = z.infer<typeof AdminVenuesPage>;
