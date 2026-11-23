// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import { ImagesRepository } from '../../core/images/repositories/images.repository.ts';
import type { ImageFile, ImageRecord, ImageRef } from '../../core/images/types/image.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

const refFields = {
  id: true,
  width: true,
  height: true,
  cropLeft: true,
  cropTop: true,
  cropWidth: true,
  cropHeight: true,
} as const;

interface RefRow {
  id: string;
  width: number;
  height: number;
  cropLeft: number | null;
  cropTop: number | null;
  cropWidth: number | null;
  cropHeight: number | null;
}

@Injectable()
export class PrismaImagesRepository implements ImagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    { ownerId, content, contentType, width, height, crop, isPublic }: ImageRecord,
    tx?: Transaction,
  ): Promise<ImageRef> {
    const row = await clientOf(this.prisma, tx).image.create({
      data: {
        ownerId,
        content: Uint8Array.from(content),
        contentType,
        width,
        height,
        cropLeft: crop?.left,
        cropTop: crop?.top,
        cropWidth: crop?.width,
        cropHeight: crop?.height,
        isPublic,
      },
      select: refFields,
    });
    return toRef(row);
  }

  async findRefs(ids: string[]): Promise<ImageRef[]> {
    const rows = await this.prisma.image.findMany({ where: { id: { in: ids } }, select: refFields });
    return rows.map(toRef);
  }

  async findFile(id: string, { publicOnly }: { publicOnly: boolean }): Promise<ImageFile | undefined> {
    const row = await this.prisma.image.findFirst({
      where: { id, isPublic: publicOnly ? true : undefined },
      select: { content: true, contentType: true },
    });
    return row ?? undefined;
  }

  async delete(ids: string[], tx?: Transaction): Promise<void> {
    await clientOf(this.prisma, tx).image.deleteMany({ where: { id: { in: ids } } });
  }
}

function toRef({ id, width, height, cropLeft, cropTop, cropWidth, cropHeight }: RefRow): ImageRef {
  const crop =
    cropLeft === null || cropTop === null || cropWidth === null || cropHeight === null
      ? null
      : { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight };
  return { id, width, height, crop };
}
