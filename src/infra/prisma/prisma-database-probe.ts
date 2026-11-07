// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DatabaseProbe } from '../../core/system/adapters/database-probe.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaDatabaseProbe extends DatabaseProbe {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
