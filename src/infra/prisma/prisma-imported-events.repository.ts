// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Venue } from '../../core/catalog/types/venue.ts';
import { ImportedEventsRepository } from '../../core/import/repositories/imported-events.repository.ts';
import type {
  ImportCategory,
  ImportedEventFields,
  ImportedEventRow,
  ImportRunStatus,
  NewImportedVenue,
} from '../../core/import/types/import.ts';
import { locationColumns, toImportedEventRow, toVenue } from './catalog-rows.ts';
import { Prisma } from './generated/client.ts';
import { ImportPrismaService } from './import-prisma.service.ts';

/** Touches only `categories` (read), `events`, `venues`, `import_runs` and `skipped_records`: the grants of `nearby_import`. */
@Injectable()
export class PrismaImportedEventsRepository implements ImportedEventsRepository {
  constructor(private readonly prisma: ImportPrismaService) {}

  async findActiveCategories(): Promise<ImportCategory[]> {
    return this.prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  }

  async startRun(provider: string): Promise<string> {
    const run = await this.prisma.importRun.create({ data: { provider, status: 'running' }, select: { id: true } });
    return run.id;
  }

  async finishRun(runId: string, status: ImportRunStatus): Promise<void> {
    await this.prisma.importRun.update({ where: { id: runId }, data: { status, finishedAt: new Date() } });
  }

  async saveSkipped(runId: string, raw: unknown, reason: string): Promise<void> {
    await this.prisma.skippedRecord.create({
      data: { importRunId: runId, raw: toJson(raw), reason },
      select: { id: true },
    });
  }

  async findVenue(name: string, address: string): Promise<Venue | undefined> {
    const row = await this.prisma.venue.findFirst({ where: { source: 'import', name, address } });
    return row ? toVenue(row) : undefined;
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
    await this.prisma.event.update({ where: { id, source: 'import' }, data: eventColumns(fields) });
  }
}

function eventColumns({ startsAt, endsAt, ...fields }: ImportedEventFields) {
  return { ...fields, startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
}

/** The record as JSON, the shape `skipped_records.raw` stores; whatever JSON cannot hold is dropped. */
function toJson(raw: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return (JSON.parse(JSON.stringify(raw ?? null)) as Prisma.InputJsonValue | null) ?? Prisma.JsonNull;
}
