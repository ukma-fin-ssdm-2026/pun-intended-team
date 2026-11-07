// Written with the help of Claude
/** The reasons of the report sheet in the app (Figma Д3). */
export const reportReasons = ['offensive_messages', 'no_show', 'fake_profile', 'unsafe_behaviour', 'other'] as const;

export type ReportReason = (typeof reportReasons)[number];

export interface NewReport {
  username: string;
  reason: ReportReason;
  comment?: string;
}

export interface NewListingReport {
  listingId: string;
  reason: ReportReason;
  comment?: string;
}

export const reportTargetTypes = ['account', 'listing'] as const;

export type ReportTargetType = (typeof reportTargetTypes)[number];

export const reportCaseStatuses = ['open', 'resolved'] as const;

export type ReportCaseStatus = (typeof reportCaseStatuses)[number];

export type ReportResolution = 'banned' | 'removed' | 'dismissed';

/** A case as storage keeps it: every report on one account or listing until an administrator resolves it (FR-026). */
export interface ReportCaseRecord {
  id: string;
  targetType: ReportTargetType;
  /** The reported account; null in a listing case. */
  accountId: string | null;
  /** The reported listing; null in an account case. */
  listingId: string | null;
  status: ReportCaseStatus;
  resolution: ReportResolution | null;
  reportCount: number;
  firstReportedAt: string;
  lastReportedAt: string;
  resolvedAt: string | null;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reason: ReportReason;
  comment: string | null;
  reportedAt: string;
}

/** An account as the administrator sees it in a case; username and display name are null without a profile. */
export interface CaseAccount {
  id: string;
  username: string | null;
  displayName: string | null;
}

/** A reported listing as the administrator sees it, also after it was removed. */
export interface CaseListing {
  id: string;
  title: string;
  description: string;
  date: string;
  status: 'active' | 'removed';
}

export interface ReportCase extends Omit<ReportCaseRecord, 'accountId' | 'listingId'> {
  /** The reported user, or the author of the reported listing. */
  account: CaseAccount;
  /** Null in an account case. */
  listing: CaseListing | null;
}

export interface ReportCaseDetails extends ReportCase {
  reports: (Omit<ReportRecord, 'reporterId'> & { reporter: CaseAccount })[];
}

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  result: string;
}
