// Written with the help of Claude
import type { Transaction } from '../../common/transaction.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import type {
  AddedReport,
  ReportCaseRecord,
  ReportCaseStatus,
  ReportReason,
  ReportRecord,
  ReportResolution,
} from '../types/report.ts';

export abstract class ReportCasesRepository {
  /** Adds the report to the account's open case, or opens one. */
  abstract addAccountReport(
    accountId: string,
    report: { reporterId: string; reason: ReportReason; comment: string | null },
    tx?: Transaction,
  ): Promise<AddedReport>;

  /** Adds the report to the listing's open case, or opens one. */
  abstract addListingReport(
    listingId: string,
    report: { reporterId: string; reason: ReportReason; comment: string | null },
    tx?: Transaction,
  ): Promise<AddedReport>;

  /** Account and listing cases with the status, oldest first. */
  abstract findPage(status: ReportCaseStatus, page: PageRequest): Promise<Page<ReportCaseRecord>>;

  /** The case with its reports, oldest first. */
  abstract findById(id: string): Promise<(ReportCaseRecord & { reports: ReportRecord[] }) | undefined>;

  /** Resolves the case if it is still open; false if it was resolved already. */
  abstract resolve(id: string, resolution: ReportResolution, resolvedById: string, resolvedAt: Date): Promise<boolean>;

  abstract countOpen(): Promise<number>;

  /** `[reporter, reported]` for every account of `accountIds` that reported another of them, each pair once. */
  abstract findReportedPairs(accountIds: string[], tx?: Transaction): Promise<[string, string][]>;
}
