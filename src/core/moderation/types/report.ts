// Written with the help of Claude
/** The reasons of the report sheet in the app (Figma Д3). */
export const reportReasons = ['offensive_messages', 'no_show', 'fake_profile', 'unsafe_behaviour', 'other'] as const;

export type ReportReason = (typeof reportReasons)[number];

export interface NewReport {
  username: string;
  reason: ReportReason;
  comment?: string;
}

export const reportCaseStatuses = ['open', 'resolved'] as const;

export type ReportCaseStatus = (typeof reportCaseStatuses)[number];

export type ReportResolution = 'banned' | 'removed' | 'dismissed';

/** A case as storage keeps it: every report on one account until an administrator resolves it (FR-026). */
export interface ReportCaseRecord {
  id: string;
  accountId: string;
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

export interface ReportCase extends Omit<ReportCaseRecord, 'accountId'> {
  account: CaseAccount;
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
