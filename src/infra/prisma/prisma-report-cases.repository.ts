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
const MAX_ATTEMPTS = 3;

@Injectable()
export class PrismaReportCasesRepository implements ReportCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addAccountReport(
    accountId: string,
    report: { reporterId: string; reason: ReportReason; comment: string | null },
  ): Promise<string> {
    // A case can be resolved, or opened by a parallel first report, between the lookup and the write; try again then.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const caseId = await this.addToOpenCase(accountId, report);
      if (caseId) {
        return caseId;
      }
    }
    throw new Error(`Could not add the report on account ${accountId}: its case kept changing`);
  }

  async findPage(status: ReportCaseStatus, { limit, offset }: PageRequest): Promise<Page<ReportCaseRecord>> {
    const rows = await this.prisma.reportCase.findMany({
      where: { targetType: 'account', status },
      include: { _count: { select: { reports: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    const dates = await this.prisma.report.groupBy({
      by: ['caseId'],
      where: { caseId: { in: items.map((row) => row.id) } },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });
    const datesByCase = new Map(
      dates.map(({ caseId, _min, _max }) => [caseId, { first: _min.createdAt, last: _max.createdAt }]),
    );
    return {
      items: items.map((row) => {
        const { first, last } = datesByCase.get(row.id) ?? {};
        return toCaseRecord(row, row._count.reports, first ?? row.createdAt, last ?? row.createdAt);
      }),
      page: { limit, offset, hasMore: rows.length > limit },
    };
  }

  async findById(id: string): Promise<(ReportCaseRecord & { reports: ReportRecord[] }) | undefined> {
    const row = await this.prisma.reportCase.findFirst({
      where: { id, targetType: 'account' },
      include: { reports: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!row) {
      return undefined;
    }
    const first = row.reports[0]?.createdAt ?? row.createdAt;
    const last = row.reports.at(-1)?.createdAt ?? row.createdAt;
    return { ...toCaseRecord(row, row.reports.length, first, last), reports: row.reports.map(toReportRecord) };
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

  /** Adds the report to the open case, or opens one with it; undefined when the case changed in the meantime. */
  private async addToOpenCase(
    accountId: string,
    { reporterId, reason, comment }: { reporterId: string; reason: ReportReason; comment: string | null },
  ): Promise<string | undefined> {
    const open = await this.prisma.reportCase.findFirst({
      where: { targetType: 'account', targetAccountId: accountId, status: 'open' },
      select: { id: true },
    });
    if (open) {
      // FOR SHARE makes a resolution that commits first win: the report is then not written into the resolved case.
      const added = await this.prisma.$executeRaw`
        INSERT INTO reports (case_id, reporter_id, reason, comment)
        SELECT id, ${reporterId}::uuid, ${reason}::text, ${comment}::text FROM report_cases
        WHERE id = ${open.id}::uuid AND status = 'open'
        FOR SHARE`;
      return added === 1 ? open.id : undefined;
    }
    try {
      const created = await this.prisma.reportCase.create({
        data: {
          targetType: 'account',
          targetAccountId: accountId,
          reports: { create: { reporterId, reason, comment } },
        },
      });
      return created.id;
    } catch (error) {
      if (violatedIndex(error) === OPEN_ACCOUNT_CASE_INDEX) {
        return undefined;
      }
      throw error;
    }
  }
}

function toCaseRecord(row: ReportCaseRow, reportCount: number, first: Date, last: Date): ReportCaseRecord {
  return {
    id: row.id,
    // Only account cases are read here, so the account is always set.
    accountId: row.targetAccountId ?? '',
    status: row.status,
    resolution: row.resolution,
    reportCount,
    firstReportedAt: first.toISOString(),
    lastReportedAt: last.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

function toReportRecord({ id, reporterId, reason, comment, createdAt }: ReportRow): ReportRecord {
  return { id, reporterId, reason: reason as ReportReason, comment, reportedAt: createdAt.toISOString() };
}
