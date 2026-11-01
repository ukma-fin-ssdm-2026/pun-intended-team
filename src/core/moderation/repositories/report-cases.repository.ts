// Written with the help of Claude
import type { Page, PageRequest } from '../../common/page.ts';
import type {
  ReportCaseRecord,
  ReportCaseStatus,
  ReportReason,
  ReportRecord,
  ReportResolution,
} from '../types/report.ts';

export abstract class ReportCasesRepository {
  /** Adds the report to the account's open case, or opens one; returns the case id. */
  abstract addAccountReport(
    accountId: string,
    report: { reporterId: string; reason: ReportReason; comment: string | null },
  ): Promise<string>;

  /** Cases with the status, oldest first. */
  abstract findPage(status: ReportCaseStatus, page: PageRequest): Promise<Page<ReportCaseRecord>>;

  /** The case with its reports, oldest first. */
  abstract findById(id: string): Promise<(ReportCaseRecord & { reports: ReportRecord[] }) | undefined>;

  /** Resolves the case if it is still open; false if it was resolved already. */
  abstract resolve(id: string, resolution: ReportResolution, resolvedById: string, resolvedAt: Date): Promise<boolean>;

  abstract countOpen(): Promise<number>;
}
