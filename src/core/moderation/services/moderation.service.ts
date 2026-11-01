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
    // A banned user has nothing left to review; the reporter is not told, so a ban stays private.
    if ((await this.accountsService.findStanding(accountId))?.status !== 'active') {
      await this.audit(reporterId, 'report.create', 'account', accountId, 'ignored: account not active');
      return;
    }
    await this.reportCasesRepository.addAccountReport(accountId, { reporterId, reason, comment: comment || null });
    await this.audit(reporterId, 'report.create', 'account', accountId, 'created');
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

  /**
   * Bans the reported user and resolves the case (FR-027). A case already resolved as banned bans again, so a ban that
   * failed halfway can be retried.
   */
  async ban(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    const found = await this.requireOthersCase(caseId, adminId, 'account.ban');
    if ((await this.accountsService.findStanding(found.accountId))?.role === 'admin') {
      await this.audit(adminId, 'account.ban', 'account', found.accountId, 'refused: administrator');
      throw new DomainError('CANNOT_BAN_ADMIN', 'An administrator cannot be banned; remove the role first');
    }
    const resolved = await this.reportCasesRepository.resolve(caseId, 'banned', adminId, new Date());
    if (!resolved && (await this.requireCase(caseId)).resolution !== 'banned') {
      await this.refuseResolved(adminId, 'account.ban', caseId);
    }
    await this.accountsService.ban(found.accountId);
    await this.audit(adminId, 'account.ban', 'account', found.accountId, 'banned');
    return this.getCase(caseId);
  }

  /** Closes the case without action, for reports that turn out unfounded. */
  async dismiss(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    await this.requireOthersCase(caseId, adminId, 'report_case.dismiss');
    if (!(await this.reportCasesRepository.resolve(caseId, 'dismissed', adminId, new Date()))) {
      await this.refuseResolved(adminId, 'report_case.dismiss', caseId);
    }
    await this.audit(adminId, 'report_case.dismiss', 'report_case', caseId, 'dismissed');
    return this.getCase(caseId);
  }

  async stats(): Promise<{ openReports: number }> {
    return { openReports: await this.reportCasesRepository.countOpen() };
  }

  private async requireCase(id: string): Promise<ReportCaseRecord> {
    const found = await this.reportCasesRepository.findById(id);
    if (!found) {
      throw new DomainError('NOT_FOUND', 'Report case not found');
    }
    return found;
  }

  /** An administrator who was reported cannot resolve their own case. */
  private async requireOthersCase(caseId: string, adminId: string, action: string): Promise<ReportCaseRecord> {
    const found = await this.requireCase(caseId);
    if (found.accountId === adminId) {
      await this.audit(adminId, action, 'report_case', caseId, 'refused: own case');
      throw new DomainError('CANNOT_RESOLVE_OWN_CASE', 'A case about yourself is resolved by another administrator');
    }
    return found;
  }

  private async refuseResolved(adminId: string, action: string, caseId: string): Promise<never> {
    await this.audit(adminId, action, 'report_case', caseId, 'refused: already resolved');
    throw new DomainError('CONFLICT', 'The case is already resolved');
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, result: string) {
    await this.auditLogRepository.record({ actorId, action, targetType, targetId, result });
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
