// Written with the help of Claude
import { z } from 'zod';
import { reportCaseStatuses, reportReasons } from '../../../core/moderation/types/report.ts';
import { DateTime, Id, PageQuery, pageOf } from '../../common/schemas/common.ts';

const ReportReason = z
  .enum(reportReasons)
  .describe(
    'offensive_messages, no_show (did not come and did not warn), fake_profile, unsafe_behaviour (dangerous behaviour) ' +
      'or other',
  );

const CreateReportFields = z.strictObject({
  username: z.string().trim().min(1).max(50).describe('Username of the user being reported, as their profile shows it'),
  reason: ReportReason,
  comment: z.string().trim().max(1000).optional().describe('What happened, in the reporter’s words'),
});

export const createReportExample: CreateReportBody = {
  username: 'olena_k',
  reason: 'no_show',
  comment: 'We agreed to meet at the entrance; she did not come and did not answer.',
};

export const CreateReportBody = CreateReportFields.meta({ id: 'CreateReportBody', example: createReportExample });

const CaseAccount = z
  .object({
    id: Id,
    username: z.string().nullable().describe('Null when the account has no profile'),
    displayName: z.string().nullable(),
  })
  .meta({ id: 'CaseAccount', description: 'A reported user or a reporter, as an administrator sees them' });

const ReportCaseFields = z.object({
  id: Id,
  account: CaseAccount.describe('The reported user'),
  status: z.enum(reportCaseStatuses),
  resolution: z.enum(['banned', 'removed', 'dismissed']).nullable().describe('Null while the case is open'),
  reportCount: z.number().int().describe('Reports in the case, repeated reports by one user included'),
  firstReportedAt: DateTime,
  lastReportedAt: DateTime,
  resolvedAt: DateTime.nullable(),
});

const accountExample = { id: 'c3a1f6d2-4b7e-4f0a-9d21-6e8b5a3c7f14', username: 'olena_k', displayName: 'Olena' };

export const reportCaseExample: ReportCase = {
  id: '5d7f9b1c-3e5a-4c7e-9a1b-3d5f7a9c1e30',
  account: accountExample,
  status: 'open',
  resolution: null,
  reportCount: 2,
  firstReportedAt: '2026-10-30T19:12:00.000Z',
  lastReportedAt: '2026-10-31T08:40:00.000Z',
  resolvedAt: null,
};

export const ReportCase = ReportCaseFields.meta({ id: 'ReportCase', example: reportCaseExample });

export const ReportCasesPage = pageOf(ReportCase, 'ReportCasesPage', reportCaseExample);

const ReportFields = z.object({
  id: Id,
  reporter: CaseAccount,
  reason: ReportReason,
  comment: z.string().nullable(),
  reportedAt: DateTime,
});

const ReportCaseDetailsFields = ReportCaseFields.extend({
  reports: z.array(ReportFields).describe('Every report in the case, oldest first'),
});

export const reportCaseDetailsExample: ReportCaseDetails = {
  ...reportCaseExample,
  reports: [
    {
      id: '7f9b1d3e-5a7c-4e9a-8b1d-5f7a9c1e3b52',
      reporter: { id: 'd8e2b4c6-1a3f-4e5d-8b7c-9f0a2c4e6b18', username: 'taras', displayName: 'Taras' },
      reason: 'no_show',
      comment: 'We agreed to meet at the entrance; she did not come and did not answer.',
      reportedAt: '2026-10-30T19:12:00.000Z',
    },
  ],
};

export const ReportCaseDetails = ReportCaseDetailsFields.meta({
  id: 'ReportCaseDetails',
  example: reportCaseDetailsExample,
});

export const ReportCaseIdParams = z.object({
  id: Id.describe('Report case id'),
});

export const ListReportCasesQuery = PageQuery.extend({
  status: z.enum(reportCaseStatuses).default('open').describe('open (the default) or resolved'),
});

export type CreateReportBody = z.input<typeof CreateReportFields>;
export type ReportCase = z.infer<typeof ReportCaseFields>;
export type ReportCasesPage = z.infer<typeof ReportCasesPage>;
export type ReportCaseDetails = z.infer<typeof ReportCaseDetailsFields>;
