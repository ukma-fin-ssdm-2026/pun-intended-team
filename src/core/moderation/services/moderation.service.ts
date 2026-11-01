// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { AuditLogRepository } from '../repositories/audit-log.repository.ts';
import { ReportCasesRepository } from '../repositories/report-cases.repository.ts';
import type {
  CaseAccount,
  NewReport,
  ReportCase,
  ReportCaseDetails,
  ReportCaseRecord,
  ReportCaseStatus,
  ReportResolution,
} from '../types/report.ts';

@Injectable()
export class ModerationService {
  constructor(
    private readonly reportCasesRepository: ReportCasesRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly profilesService: ProfilesService,
    private readonly accountsService: AccountsService,
  ) {}

  /** Reports a user by username (FR-025); repeated reports on one user join its open case (FR-026). */
  async report(reporterId: string, { username, reason, comment }: NewReport): Promise<void> {
    const accountId = await this.profilesService.findAccountId(username);
    if (!accountId) {
      throw new DomainError('REFERENCE_NOT_FOUND', 'No user has this username', 'username');
    }
    if (accountId === reporterId) {
      throw new DomainError('CANNOT_REPORT_SELF', 'You cannot report yourself', 'username');
    }
    await this.reportCasesRepository.addAccountReport(accountId, { reporterId, reason, comment: comment || null });
  }

  async listCases(status: ReportCaseStatus, page: PageRequest): Promise<Page<ReportCase>> {
    const { items, page: info } = await this.reportCasesRepository.findPage(status, page);
    const accounts = await this.caseAccounts(items.map((item) => item.accountId));
    return { items: items.map((item) => withAccount(item, accounts)), page: info };
  }

  async getCase(id: string): Promise<ReportCaseDetails> {
    const found = await this.reportCasesRepository.findById(id);
    if (!found) {
      throw new DomainError('NOT_FOUND', 'Report case not found');
    }
    const accounts = await this.caseAccounts([found.accountId, ...found.reports.map((r) => r.reporterId)]);
    return {
      ...withAccount(found, accounts),
      reports: found.reports.map(({ reporterId, ...report }) => ({ ...report, reporter: accounts(reporterId) })),
    };
  }

  /** Bans the reported user and resolves the case (FR-027). */
  async ban(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    const found = await this.resolve(caseId, 'banned', adminId);
    await this.accountsService.ban(found.accountId);
    await this.auditLogRepository.record({
      actorId: adminId,
      action: 'account.ban',
      targetType: 'account',
      targetId: found.accountId,
      result: 'banned',
    });
    return this.getCase(caseId);
  }

  /** Closes the case without action, for reports that turn out unfounded. */
  async dismiss(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    await this.resolve(caseId, 'dismissed', adminId);
    await this.auditLogRepository.record({
      actorId: adminId,
      action: 'report_case.dismiss',
      targetType: 'report_case',
      targetId: caseId,
      result: 'dismissed',
    });
    return this.getCase(caseId);
  }

  async stats(): Promise<{ openReports: number }> {
    return { openReports: await this.reportCasesRepository.countOpen() };
  }

  private async resolve(caseId: string, resolution: ReportResolution, adminId: string): Promise<ReportCaseRecord> {
    const found = await this.reportCasesRepository.findById(caseId);
    if (!found) {
      throw new DomainError('NOT_FOUND', 'Report case not found');
    }
    if (!(await this.reportCasesRepository.resolve(caseId, resolution, adminId, new Date()))) {
      throw new DomainError('CONFLICT', 'The case is already resolved');
    }
    return found;
  }

  private async caseAccounts(accountIds: string[]): Promise<(accountId: string) => CaseAccount> {
    const summaries = await this.profilesService.getSummaries(accountIds);
    return (id) => {
      const summary = summaries.get(id);
      return { id, username: summary?.username ?? null, displayName: summary?.displayName ?? null };
    };
  }
}

function withAccount(
  { accountId, ...record }: ReportCaseRecord,
  accounts: (accountId: string) => CaseAccount,
): ReportCase {
  return { ...record, account: accounts(accountId) };
}
