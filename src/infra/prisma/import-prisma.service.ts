// Written with the help of Claude
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.ts';

/**
 * The import service's connection, as `nearby_import` (database-access.md), so it can touch only the tables of
 * its grants. Connects lazily, on the first query.
 */
@Injectable()
export class ImportPrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.IMPORT_DATABASE_URL;
    if (!connectionString) {
      throw new Error('IMPORT_DATABASE_URL is not set: see .env.example');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
