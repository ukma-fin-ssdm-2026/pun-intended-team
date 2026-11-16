// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../core/common/transaction.ts';
import type { Page, PageRequest } from '../../core/common/page.ts';
import { ReportCasesRepository } from '../../core/moderation/repositories/report-cases.repository.ts';
import type {
  AddedReport,
  ReportCaseRecord,
  ReportCaseStatus,
  ReportReason,
  ReportRecord,
  ReportResolution,
} from '../../core/moderation/types/report.ts';
import { Prisma, type Report as ReportRow, type ReportCase as ReportCaseRow } from './generated/client.ts';
import { PrismaService } from './prisma.service.ts';
import { clientOf } from './transaction-client.ts';

const MAX_ATTEMPTS = 3;

type CaseTarget =
  { targetType: 'account'; targetAccountId: string } | { targetType: 'listing'; targetListingId: string };
type NewReportRow = { reporterId: string; reason: ReportReason; comment: string | null };

@Injectable()
export class PrismaReportCasesRepository implements ReportCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addAccountReport(accountId: string, report: NewReportRow, tx?: Transaction): Promise<AddedReport> {
    return this.addReport({ targetType: 'account', targetAccountId: accountId }, report, tx);
  }

  async addListingReport(listingId: string, report: NewReportRow, tx?: Transaction): Promise<AddedReport> {
    return this.addReport({ targetType: 'listing', targetListingId: listingId }, report, tx);
  }

  async findPage(status: ReportCaseStatus, { limit, offset }: PageRequest): Promise<Page<ReportCaseRecord>> {
    const rows = await this.prisma.reportCase.findMany({
      where: { status },
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
      where: { id },
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

  async findReportedPairs(accountIds: string[], tx?: Transaction): Promise<[string, string][]> {
    const rows = await clientOf(this.prisma, tx).report.findMany({
      where: { reporterId: { in: accountIds }, case: { targetAccountId: { in: accountIds } } },
      select: { reporterId: true, case: { select: { targetAccountId: true } } },
    });
    const pairs = new Map<string, [string, string]>();
    for (const { reporterId, case: reportCase } of rows) {
      if (reportCase.targetAccountId) {
        pairs.set(`${reporterId} ${reportCase.targetAccountId}`, [reporterId, reportCase.targetAccountId]);
      }
    }
    return [...pairs.values()];
  }

  private async addReport(target: CaseTarget, report: NewReportRow, tx?: Transaction): Promise<AddedReport> {
    // A case can be resolved, or opened by a parallel first report, between the lookup and the write; try again then.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const added = await this.addToOpenCase(target, report, clientOf(this.prisma, tx));
      if (added) {
        return added;
      }
    }
    throw new Error(`Could not add the report on ${target.targetType} ${targetId(target)}: its case kept changing`);
  }

  /** Adds the report to the open case, or opens one with it; undefined when the case changed in the meantime. */
  private async addToOpenCase(
    target: CaseTarget,
    { reporterId, reason, comment }: NewReportRow,
    client: Prisma.TransactionClient,
  ): Promise<AddedReport | undefined> {
    const open = await client.reportCase.findFirst({
      where: { ...target, status: 'open' },
      select: { id: true },
    });
    if (open) {
      // FOR SHARE makes a resolution that commits first win: the report is then not written into the resolved case.
      const [added] = await client.$queryRaw<{ id: string }[]>`
        INSERT INTO reports (case_id, reporter_id, reason, comment)
        SELECT id, ${reporterId}::uuid, ${reason}::text, ${comment}::text FROM report_cases
        WHERE id = ${open.id}::uuid AND status = 'open'
        FOR SHARE
        RETURNING id`;
      return added ? { caseId: open.id, reportId: added.id } : undefined;
    }
    // ON CONFLICT rather than catching the unique violation of a parallel first report, which would abort the caller's
    // transaction; the next attempt then finds the case that report opened.
    const [opened] = await client.$queryRaw<{ id: string }[]>(openCaseSql(target));
    if (!opened) {
      return undefined;
    }
    const created = await client.report.create({
      data: { caseId: opened.id, reporterId, reason, comment },
      select: { id: true },
    });
    return { caseId: opened.id, reportId: created.id };
  }
}

function openCaseSql(target: CaseTarget): Prisma.Sql {
  return target.targetType === 'account'
    ? Prisma.sql`
        INSERT INTO report_cases (target_type, target_account_id) VALUES ('account', ${target.targetAccountId}::uuid)
        ON CONFLICT (target_account_id) WHERE status = 'open' AND target_account_id IS NOT NULL DO NOTHING
        RETURNING id`
    : Prisma.sql`
        INSERT INTO report_cases (target_type, target_listing_id) VALUES ('listing', ${target.targetListingId}::uuid)
        ON CONFLICT (target_listing_id) WHERE status = 'open' AND target_listing_id IS NOT NULL DO NOTHING
        RETURNING id`;
}

function targetId(target: CaseTarget): string {
  return target.targetType === 'account' ? target.targetAccountId : target.targetListingId;
}

function toCaseRecord(row: ReportCaseRow, reportCount: number, first: Date, last: Date): ReportCaseRecord {
  return {
    id: row.id,
    targetType: row.targetType,
    accountId: row.targetAccountId,
    listingId: row.targetListingId,
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
