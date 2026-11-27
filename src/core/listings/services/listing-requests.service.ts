// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { TransactionRunner } from '../../common/transaction-runner.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import type { Contacts, PublicProfile } from '../../profiles/types/profile.ts';
import { ListingRequestsRepository } from '../repositories/listing-requests.repository.ts';
import { ListingsRepository } from '../repositories/listings.repository.ts';
import type { Listing } from '../types/listing.ts';
import type { ListingRequest, ListingRequestPerson, ListingRequestView } from '../types/listing-request.ts';

/** "Хочу піти" on a listing: a user asks its author to go together, and the author accepts or declines. */
@Injectable()
export class ListingRequestsService {
  constructor(
    private readonly requestsRepository: ListingRequestsRepository,
    private readonly listingsRepository: ListingsRepository,
    private readonly profilesService: ProfilesService,
    private readonly transactions: TransactionRunner,
  ) {}

  /**
   * Asks to join someone else's active listing, once. The requester needs a complete profile, as for matching, so the
   * author sees who asks and gets a way to reach them on accepting.
   */
  async create(requesterId: string, listingId: string): Promise<ListingRequestView> {
    const listing = await this.listingsRepository.findActiveById(listingId);
    if (!listing) {
      throw new DomainError('NOT_FOUND', 'Listing not found');
    }
    if (listing.authorId === requesterId) {
      throw new DomainError('CANNOT_REQUEST_OWN_LISTING', 'The listing is the caller’s own');
    }
    if (!(await this.profilesService.isComplete(requesterId))) {
      throw new DomainError('PROFILE_INCOMPLETE', 'Complete the profile before asking to join a listing');
    }
    if (await this.requestsRepository.findByListingAndRequester(listingId, requesterId)) {
      throw new DomainError('ALREADY_REQUESTED', 'The user has already asked to join this listing');
    }
    const request = await this.transactions.run((tx) => this.requestsRepository.create(listingId, requesterId, tx));
    return this.view(requesterId, request, listing);
  }

  /** Requests on the caller's listings, pending first, newest first. */
  async listIncoming(authorId: string, page: PageRequest): Promise<Page<ListingRequestView>> {
    const result = await this.requestsRepository.findOnListingsOf(authorId, page);
    const listings = await this.listingsRepository.findByIds([...new Set(result.items.map((r) => r.listingId))]);
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const viewOf = await this.viewsOf(
      authorId,
      result.items.flatMap((request) => {
        const listing = byId.get(request.listingId);
        return listing ? [{ request, listing }] : [];
      }),
    );
    return { ...result, items: viewOf };
  }

  async getOwn(userId: string, id: string): Promise<ListingRequestView> {
    const { request, listing } = await this.requireVisible(userId, id);
    return this.view(userId, request, listing);
  }

  async accept(authorId: string, id: string): Promise<ListingRequestView> {
    return this.decide(authorId, id, 'accepted');
  }

  /** Declining tells the requester nothing; their post card keeps showing the request as sent. */
  async decline(authorId: string, id: string): Promise<ListingRequestView> {
    return this.decide(authorId, id, 'declined');
  }

  /**
   * The other side's contacts, only once the author has accepted; before that, and after a decline, the request is
   * reported missing, as a match that is not mutual is (SEC-001). They wait for the safety notice (SAFE-002).
   */
  async getContacts(userId: string, id: string): Promise<Contacts> {
    const { request, listing } = await this.requireVisible(userId, id);
    if (request.status !== 'accepted') {
      throw new DomainError('NOT_FOUND', 'Listing request not found');
    }
    const otherId = userId === listing.authorId ? request.requesterId : listing.authorId;
    return this.profilesService.revealContacts(userId, otherId);
  }

  private async decide(authorId: string, id: string, status: 'accepted' | 'declined'): Promise<ListingRequestView> {
    const { request, listing } = await this.requireVisible(authorId, id);
    if (listing.authorId !== authorId) {
      throw new DomainError('NOT_FOUND', 'Listing request not found');
    }
    if (request.status !== 'pending') {
      throw new DomainError('CONFLICT', 'The request has already been answered');
    }
    const decided = await this.transactions.run(async (tx) => {
      const changed = await this.requestsRepository.decide(id, status, new Date(), tx);
      if (!changed) {
        throw new DomainError('CONFLICT', 'The request has already been answered');
      }
      return changed;
    });
    return this.view(authorId, decided, listing);
  }

  /**
   * A request its author or requester may see. Anyone else gets NOT_FOUND, and so does everyone for a pending request
   * on a removed listing, which nobody can decide any more.
   */
  private async requireVisible(userId: string, id: string): Promise<{ request: ListingRequest; listing: Listing }> {
    const request = await this.requestsRepository.findById(id);
    const [listing] = request ? await this.listingsRepository.findByIds([request.listingId]) : [];
    if (
      !request ||
      !listing ||
      (userId !== request.requesterId && userId !== listing.authorId) ||
      (request.status === 'pending' && listing.status === 'removed')
    ) {
      throw new DomainError('NOT_FOUND', 'Listing request not found');
    }
    return { request, listing };
  }

  private async view(userId: string, request: ListingRequest, listing: Listing): Promise<ListingRequestView> {
    const [view] = await this.viewsOf(userId, [{ request, listing }]);
    if (!view) {
      throw new Error('A listing request refers to a missing profile');
    }
    return view;
  }

  /** A request whose requester or author has no profile is left out: a data bug, not something to show. */
  private async viewsOf(
    userId: string,
    pairs: { request: ListingRequest; listing: Listing }[],
  ): Promise<ListingRequestView[]> {
    const profiles = await this.profilesService.getPublicProfiles(
      pairs.flatMap(({ request, listing }) => [request.requesterId, listing.authorId]),
    );
    return pairs.flatMap(({ request, listing }) => {
      const requester = profiles.get(request.requesterId);
      const author = profiles.get(listing.authorId);
      if (!requester || !author) {
        return [];
      }
      return [
        {
          id: request.id,
          status: request.status,
          role: userId === listing.authorId ? ('author' as const) : ('requester' as const),
          createdAt: request.createdAt,
          decidedAt: request.decidedAt,
          listing: {
            id: listing.id,
            title: listing.title,
            date: listing.date,
            place: listing.place,
            eventId: listing.eventId,
          },
          requester: personOf(requester),
          author: personOf(author),
        },
      ];
    });
  }
}

function personOf({ accountId: _accountId, ...person }: PublicProfile): ListingRequestPerson {
  return person;
}
