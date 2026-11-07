// Written with the help of Claude
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/domain-error.ts';
import type { Page, PageRequest } from '../../common/page.ts';
import { AccountsService } from '../../identity/services/accounts.service.ts';
import { ListingsService } from '../../listings/services/listings.service.ts';
import type { Listing } from '../../listings/types/listing.ts';
import { ProfilesService } from '../../profiles/services/profiles.service.ts';
import { AuditLogRepository } from '../repositories/audit-log.repository.ts';
import { ReportCasesRepository } from '../repositories/report-cases.repository.ts';
import type {
  CaseAccount,
  NewListingReport,
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
    private readonly listingsService: ListingsService,
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

  /** Reports someone else's listing (FR-028); repeated reports on one listing join its open case (FR-026). */
  async reportListing(reporterId: string, { listingId, reason, comment }: NewListingReport): Promise<void> {
    const [listing] = await this.listingsService.findByIds([listingId]);
    if (listing?.status !== 'active') {
      throw new DomainError('REFERENCE_NOT_FOUND', 'No listing has this id', 'listingId');
    }
    if (listing.authorId === reporterId) {
      throw new DomainError('CANNOT_REPORT_SELF', 'You cannot report your own listing', 'listingId');
    }
    await this.reportCasesRepository.addListingReport(listingId, { reporterId, reason, comment: comment || null });
    await this.audit(reporterId, 'report.create', 'listing', listingId, 'created');
  }

  async listCases(status: ReportCaseStatus, page: PageRequest): Promise<Page<ReportCase>> {
    const { items, page: info } = await this.reportCasesRepository.findPage(status, page);
    const { toCase } = await this.caseTargets(items);
    return { items: items.map(toCase), page: info };
  }

  async getCase(id: string): Promise<ReportCaseDetails> {
    const found = await this.requireCase(id);
    const { toCase, account } = await this.caseTargets(
      [found],
      found.reports.map((report) => report.reporterId),
    );
    return {
      ...toCase(found),
      reports: found.reports.map(({ reporterId, ...report }) => ({ ...report, reporter: account(reporterId) })),
    };
  }

  /**
   * Bans the reported user and resolves the case (FR-027). A case already resolved as banned bans again, so a ban that
   * failed halfway can be retried.
   */
  async ban(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    const { found, accountId } = await this.requireOthersCase(caseId, adminId, 'account.ban');
    if (found.targetType !== 'account') {
      await this.audit(adminId, 'account.ban', 'report_case', caseId, 'refused: listing case');
      throw new DomainError('CONFLICT', 'A listing case is resolved by removing the listing, not by a ban');
    }
    if ((await this.accountsService.findStanding(accountId))?.role === 'admin') {
      await this.audit(adminId, 'account.ban', 'account', accountId, 'refused: administrator');
      throw new DomainError('CANNOT_BAN_ADMIN', 'An administrator cannot be banned; remove the role first');
    }
    const resolved = await this.reportCasesRepository.resolve(caseId, 'banned', adminId, new Date());
    if (!resolved && (await this.requireCase(caseId)).resolution !== 'banned') {
      await this.refuseResolved(adminId, 'account.ban', caseId);
    }
    await this.accountsService.ban(accountId);
    await this.audit(adminId, 'account.ban', 'account', accountId, 'banned');
    return this.getCase(caseId);
  }

  /**
   * Removes the reported listing and resolves the case (FR-028). A case already resolved as removed removes again, so a
   * removal that failed halfway can be retried.
   */
  async removeListing(caseId: string, adminId: string): Promise<ReportCaseDetails> {
    const { found } = await this.requireOthersCase(caseId, adminId, 'listing.remove');
    if (found.listingId === null) {
      await this.audit(adminId, 'listing.remove', 'report_case', caseId, 'refused: account case');
      throw new DomainError('CONFLICT', 'An account case has no listing to remove');
    }
    const resolved = await this.reportCasesRepository.resolve(caseId, 'removed', adminId, new Date());
    if (!resolved && (await this.requireCase(caseId)).resolution !== 'removed') {
      await this.refuseResolved(adminId, 'listing.remove', caseId);
    }
    await this.listingsService.removeReported(found.listingId);
    await this.audit(adminId, 'listing.remove', 'listing', found.listingId, 'removed');
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

  private async requireCase(id: string) {
    const found = await this.reportCasesRepository.findById(id);
    if (!found) {
      throw new DomainError('NOT_FOUND', 'Report case not found');
    }
    return found;
  }

  /**
   * An administrator cannot resolve a case about themselves or their own listing. Gives the case and the account it is
   * about: the reported user, or the listing's author.
   */
  private async requireOthersCase(caseId: string, adminId: string, action: string) {
    const found = await this.requireCase(caseId);
    const { accountIdOf } = await this.caseListings([found]);
    const accountId = accountIdOf(found);
    if (accountId === adminId) {
      await this.audit(adminId, action, 'report_case', caseId, 'refused: own case');
      throw new DomainError('CANNOT_RESOLVE_OWN_CASE', 'A case about yourself is resolved by another administrator');
    }
    return { found, accountId };
  }

  private async refuseResolved(adminId: string, action: string, caseId: string): Promise<never> {
    await this.audit(adminId, action, 'report_case', caseId, 'refused: already resolved');
    throw new DomainError('CONFLICT', 'The case is already resolved');
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, result: string) {
    await this.auditLogRepository.record({ actorId, action, targetType, targetId, result });
  }

  /** The listings of these cases, and who each case is about: the reported user, or the listing's author. */
  private async caseListings(records: ReportCaseRecord[]) {
    const listings = new Map(
      (await this.listingsService.findByIds(records.flatMap((record) => record.listingId ?? []))).map((listing) => [
        listing.id,
        listing,
      ]),
    );
    const listingOf = (record: ReportCaseRecord): Listing | null => {
      if (record.listingId === null) {
        return null;
      }
      const listing = listings.get(record.listingId);
      // A reported listing is never deleted, only marked removed; a missing one is a data bug, so a 500.
      if (!listing) {
        throw new Error(`Report case ${record.id} refers to a missing listing`);
      }
      return listing;
    };
    // A case has exactly one target (report_cases_one_target_check): the account, or the listing.
    const accountIdOf = (record: ReportCaseRecord): string =>
      listingOf(record)?.authorId ?? (record.accountId as string);
    return { listingOf, accountIdOf };
  }

  /** What the administrator sees of these cases' targets; `otherAccountIds` are loaded too, such as the reporters. */
  private async caseTargets(records: ReportCaseRecord[], otherAccountIds: string[] = []) {
    const { listingOf, accountIdOf } = await this.caseListings(records);
    const summaries = await this.profilesService.getSummaries([...records.map(accountIdOf), ...otherAccountIds]);
    const account = (id: string): CaseAccount => {
      const summary = summaries.get(id);
      return { id, username: summary?.username ?? null, displayName: summary?.displayName ?? null };
    };
    const toCase = (record: ReportCaseRecord): ReportCase => {
      const { accountId: _accountId, listingId: _listingId, ...rest } = record;
      const listing = listingOf(record);
      return {
        ...rest,
        account: account(accountIdOf(record)),
        listing: listing && {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          date: listing.date,
          status: listing.status,
        },
      };
    };
    return { toCase, account };
  }
}
