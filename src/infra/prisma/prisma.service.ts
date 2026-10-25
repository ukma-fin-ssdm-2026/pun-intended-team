// Written with the help of Claude
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.ts';

/** Connects lazily, on the first query; the connection string is read when the app starts, after .env is loaded. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.MAIN_DATABASE_URL;
    if (!connectionString) {
      throw new Error('MAIN_DATABASE_URL is not set: see .env.example');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
