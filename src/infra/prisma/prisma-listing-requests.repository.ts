// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../core/common/domain-error.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import type { Transaction } from '../../core/common/transaction.ts';
import { ListingRequestsRepository } from '../../core/listings/repositories/listing-requests.repository.ts';
import type { ListingRequest } from '../../core/listings/types/listing-request.ts';
import type { ListingRequest as ListingRequestRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';
import { violatedIndex } from './violated-index.ts';

@Injectable()
export class PrismaListingRequestsRepository implements ListingRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(listingId: string, requesterId: string, tx?: Transaction): Promise<ListingRequest> {
    try {
      return toRequest(await clientOf(this.prisma, tx).listingRequest.create({ data: { listingId, requesterId } }));
    } catch (error) {
      // The service checks first; of two requests at once, the index stops the second.
      if (violatedIndex(error) === 'listing_requests_listing_id_requester_id_key') {
        throw new DomainError('ALREADY_REQUESTED', 'The user has already asked to join this listing');
      }
      throw error;
    }
  }

  async findById(id: string, tx?: Transaction): Promise<ListingRequest | undefined> {
    const row = await clientOf(this.prisma, tx).listingRequest.findUnique({ where: { id } });
    return row ? toRequest(row) : undefined;
  }

  async findByListingAndRequester(listingId: string, requesterId: string): Promise<ListingRequest | undefined> {
    const row = await this.prisma.listingRequest.findUnique({
      where: { listingId_requesterId: { listingId, requesterId } },
    });
    return row ? toRequest(row) : undefined;
  }

  async findOwn(requesterId: string, listingIds: string[]): Promise<Map<string, ListingRequest>> {
    if (listingIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.listingRequest.findMany({ where: { requesterId, listingId: { in: listingIds } } });
    return new Map(rows.map((row) => [row.listingId, toRequest(row)]));
  }

  async findOnListingsOf(authorId: string, { limit, offset }: PageRequest): Promise<Page<ListingRequest>> {
    const rows = await this.prisma.listingRequest.findMany({
      where: {
        listing: { authorId },
        NOT: { status: 'pending', listing: { status: 'removed' } },
      },
      // The enum is declared pending, accepted, declined, so this lists the pending ones first.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map(toRequest),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async decide(
    id: string,
    status: 'accepted' | 'declined',
    decidedAt: Date,
    tx?: Transaction,
  ): Promise<ListingRequest | undefined> {
    const client = clientOf(this.prisma, tx);
    const { count } = await client.listingRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status, decidedAt },
    });
    return count === 0 ? undefined : this.findById(id, tx);
  }
}

function toRequest(row: ListingRequestRow): ListingRequest {
  return {
    id: row.id,
    listingId: row.listingId,
    requesterId: row.requesterId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}
