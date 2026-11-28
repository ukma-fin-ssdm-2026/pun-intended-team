// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { ListingLikesRepository } from '../../core/listings/repositories/listing-likes.repository.ts';
import type { ListingLikes } from '../../core/listings/types/listing.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaListingLikesRepository implements ListingLikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async like(listingId: string, accountId: string): Promise<void> {
    // Of two likes at once, the primary key keeps one and the other is skipped.
    await this.prisma.listingLike.createMany({ data: [{ listingId, accountId }], skipDuplicates: true });
  }

  async unlike(listingId: string, accountId: string): Promise<void> {
    await this.prisma.listingLike.deleteMany({ where: { listingId, accountId } });
  }

  async summaries(listingIds: string[], viewerId: string): Promise<Map<string, ListingLikes>> {
    const likes = new Map(listingIds.map((id) => [id, { likeCount: 0, liked: false }]));
    if (listingIds.length === 0) {
      return likes;
    }
    const rows = await this.prisma.$queryRaw<{ listing_id: string; like_count: number; liked: boolean }[]>`
      SELECT listing_id::text, count(*)::int AS like_count, bool_or(account_id = ${viewerId}::uuid) AS liked
        FROM listing_likes
       WHERE listing_id = ANY(${listingIds}::uuid[])
       GROUP BY listing_id`;
    for (const row of rows) {
      likes.set(row.listing_id, { likeCount: row.like_count, liked: row.liked });
    }
    return likes;
  }
}
