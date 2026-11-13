// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { ImportedEventsRepository } from '../../core/import/repositories/imported-events.repository.ts';
import type {
  CompleteRun,
  ImportCategory,
  ImportedEventFields,
  ImportedEventRow,
  ImportRunStatus,
  NewImportedVenue,
  RunDetails,
} from '../../core/import/types/import.ts';
import { locationColumns, toImportedEventRow, toVenue } from './catalog-rows.ts';
import { Prisma } from './generated/client.ts';
import { ImportPrismaService } from './import-prisma.service.ts';

/** Touches only `categories` (read), `events`, `venues`, `import_runs` and `skipped_records`: the grants of `nearby_import`. */
@Injectable()
export class PrismaImportedEventsRepository implements ImportedEventsRepository {
  constructor(private readonly prisma: ImportPrismaService) {}

  async findCategories(): Promise<ImportCategory[]> {
    return this.prisma.category.findMany({ select: { id: true, slug: true, isActive: true } });
  }

  async failUnfinishedRuns(provider: string): Promise<void> {
    await this.prisma.importRun.updateMany({ where: { provider, status: 'running' }, data: { status: 'failed' } });
  }

  async startRun(provider: string): Promise<string> {
    const run = await this.prisma.importRun.create({ data: { provider, status: 'running' }, select: { id: true } });
    return run.id;
  }

  async finishRun(runId: string, status: ImportRunStatus, details?: RunDetails): Promise<void> {
    await this.prisma.importRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        ...(details && { complete: details.complete, seen: details.seen, parts: details.parts ?? Prisma.DbNull }),
      },
    });
  }

  async lastCompleteRun(provider: string): Promise<CompleteRun | undefined> {
    const run = await this.prisma.importRun.findFirst({
      where: { provider, status: 'succeeded', complete: true },
      orderBy: { startedAt: 'desc' },
      select: { seen: true, parts: true },
    });
    return run ? { seen: run.seen ?? 0, parts: countsOf(run.parts) } : undefined;
  }

  async saveSkipped(runId: string, raw: unknown, reason: string): Promise<void> {
    await this.prisma.skippedRecord.create({
      data: { importRunId: runId, raw: toJson(raw), reason },
      select: { id: true },
    });
  }

  async findVenues(): Promise<Venue[]> {
    const rows = await this.prisma.venue.findMany({
      where: { source: 'import' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toVenue);
  }

  async updateVenueLocation(id: string, location: Venue['location']): Promise<Venue> {
    return toVenue(
      await this.prisma.venue.update({ where: { id, source: 'import' }, data: locationColumns(location) }),
    );
  }

  async createVenue({ name, address, location }: NewImportedVenue): Promise<Venue> {
    return toVenue(
      await this.prisma.venue.create({ data: { name, address, ...locationColumns(location), source: 'import' } }),
    );
  }

  async findEvent(provider: string, externalId: string): Promise<ImportedEventRow | undefined> {
    const row = await this.prisma.event.findUnique({ where: { provider_externalId: { provider, externalId } } });
    return row ? toImportedEventRow(row) : undefined;
  }

  async createEvent({ provider, externalId, ...fields }: Omit<ImportedEventRow, 'id'>): Promise<ImportedEventRow> {
    const row = await this.prisma.event.create({
      data: { ...eventColumns(fields), provider, externalId, source: 'import', status: 'published' },
    });
    return toImportedEventRow(row);
  }

  async updateEvent(id: string, fields: ImportedEventFields): Promise<void> {
    // `source` in the filter keeps the import away from organization events, which it may not change.
    await this.prisma.event.update({
      where: { id, source: 'import' },
      data: { ...eventColumns(fields), status: 'published' },
    });
  }

  async cancelUnseen(
    provider: string,
    seenExternalIds: string[],
    range: { from: string; to: string },
  ): Promise<number> {
    const { count } = await this.prisma.event.updateMany({
      where: {
        source: 'import',
        provider,
        status: 'published',
        externalId: { notIn: seenExternalIds },
        startsAt: { gt: new Date(range.from), lte: new Date(range.to) },
      },
      data: { status: 'cancelled' },
    });
    return count;
  }
}

function eventColumns({ startsAt, endsAt, ...fields }: ImportedEventFields) {
  return { ...fields, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}

/** A stored `parts` column as counts; anything else in it is left out. */
function countsOf(parts: Prisma.JsonValue): Record<string, number> {
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parts).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

/** The record as JSON, the shape `skipped_records.raw` stores; whatever JSON cannot hold is dropped. */
function toJson(raw: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return (JSON.parse(JSON.stringify(raw ?? null)) as Prisma.InputJsonValue | null) ?? Prisma.JsonNull;
}
