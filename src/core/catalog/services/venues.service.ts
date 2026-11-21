// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import { inKyiv } from '../../common/kyiv-area.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { OrganizationsRepository } from '../repositories/organizations.repository.ts';
import { VenuesRepository } from '../repositories/venues.repository.ts';
import type { NewVenue, Venue, VenueOverview, VenueSearch } from '../types/venue.ts';
import { requireVerifiedOrganization } from './verified-organization.ts';

/** An organization's own venues, where it publishes its events (FR-009). */
@Injectable()
export class VenuesService {
  constructor(
    private readonly venuesRepository: VenuesRepository,
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  /** Empty for an account that is not an organization. */
  async listOwn(accountId: string, page: PageRequest): Promise<Page<Venue>> {
    return this.venuesRepository.findByOrganization(accountId, page);
  }

  /** Anyone but the owning organization is told the venue does not exist. */
  async getOwn(accountId: string, id: string): Promise<Venue> {
    const venue = await this.venuesRepository.findById(id);
    if (venue?.organizationId !== accountId) {
      throw new DomainError('NOT_FOUND', 'Venue not found');
    }
    return venue;
  }

  /** For the admin panel: every venue, imported and organizations' own. */
  async search(filter: VenueSearch, page: PageRequest): Promise<Page<VenueOverview>> {
    return this.venuesRepository.search(filter, page);
  }

  async getOverview(id: string): Promise<VenueOverview> {
    const venue = await this.venuesRepository.findOverview(id);
    if (!venue) {
      throw new DomainError('NOT_FOUND', 'Venue not found');
    }
    return venue;
  }

  async create(accountId: string, venue: NewVenue): Promise<Venue> {
    await requireVerifiedOrganization(this.organizationsRepository, accountId);
    if (!inKyiv(venue.location)) {
      throw new DomainError('VENUE_OUTSIDE_CITY', 'The venue must be in Kyiv', 'location');
    }
    return this.venuesRepository.create(accountId, venue);
  }
}
