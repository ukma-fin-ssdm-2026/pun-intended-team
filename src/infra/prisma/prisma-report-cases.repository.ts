// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { ReportCasesRepository } from '../../core/moderation/repositories/report-cases.repository.ts';
import type {
  ReportCaseRecord,
  ReportCaseStatus,
  ReportReason,
  ReportRecord,
  ReportResolution,
} from '../../core/moderation/types/report.ts';
import type { Report as ReportRow, ReportCase as ReportCaseRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { violatedIndex } from './violated-index.ts';

const OPEN_ACCOUNT_CASE_INDEX = 'report_cases_open_target_account_key';

@Injectable()
export class PrismaReportCasesRepository implements ReportCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addAccountReport(
    accountId: string,
    report: { reporterId: string; reason: ReportReason; comment: string | null },
  ): Promise<string> {
    const caseId = await this.openCaseOf(accountId);
    await this.prisma.report.create({ data: { caseId, ...report } });
    return caseId;
  }

  async findPage(status: ReportCaseStatus, { limit, offset }: PageRequest): Promise<Page<ReportCaseRecord>> {
    const rows = await this.prisma.reportCase.findMany({
      where: { targetType: 'account', status },
      include: { reports: { select: { createdAt: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map((row) => toCaseRecord(row, row.reports)),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findById(id: string): Promise<(ReportCaseRecord & { reports: ReportRecord[] }) | undefined> {
    const row = await this.prisma.reportCase.findFirst({
      where: { id, targetType: 'account' },
      include: { reports: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    return row ? { ...toCaseRecord(row, row.reports), reports: row.reports.map(toReportRecord) } : undefined;
  }

  async resolve(id: string, resolution: ReportResolution, resolvedById: string, resolvedAt: Date): Promise<boolean> {
    const { count } = await this.prisma.reportCase.updateMany({
      where: { id, status: 'open' },
      data: { status: 'resolved', resolution, resolvedById, resolvedAt },
    });
    return count === 1;
  }

  async countOpen(): Promise<number> {
    return this.prisma.reportCase.count({ where: { status: 'open' } });
  }

  // Two first reports at once can both find no open case; the unique index lets one create it, the other joins it.
  private async openCaseOf(accountId: string): Promise<string> {
    const where = { targetType: 'account', targetAccountId: accountId, status: 'open' } as const;
    const open = await this.prisma.reportCase.findFirst({ where, select: { id: true } });
    if (open) {
      return open.id;
    }
    try {
      return (await this.prisma.reportCase.create({ data: { targetType: 'account', targetAccountId: accountId } })).id;
    } catch (error) {
      const created =
        violatedIndex(error) === OPEN_ACCOUNT_CASE_INDEX && (await this.prisma.reportCase.findFirst({ where }));
      if (created) {
        return created.id;
      }
      throw error;
    }
  }
}

function toCaseRecord(row: ReportCaseRow, reports: { createdAt: Date }[]): ReportCaseRecord {
  const first = reports[0]?.createdAt ?? row.createdAt;
  const last = reports.at(-1)?.createdAt ?? row.createdAt;
  return {
    id: row.id,
    // Only account cases are read here, so the account is always set.
    accountId: row.targetAccountId ?? '',
    status: row.status,
    resolution: row.resolution,
    reportCount: reports.length,
    firstReportedAt: first.toISOString(),
    lastReportedAt: last.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

function toReportRecord({ id, reporterId, reason, comment, createdAt }: ReportRow): ReportRecord {
  return { id, reporterId, reason: reason as ReportReason, comment, reportedAt: createdAt.toISOString() };
}
