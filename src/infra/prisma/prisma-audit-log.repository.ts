// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../../core/moderation/repositories/audit-log.repository.ts';
import type { AuditEntry } from '../../core/moderation/types/report.ts';
import { PrismaService } from './prisma.service.ts';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({ data: entry });
  }
}
