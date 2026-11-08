// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

type ReportBody = components['schemas']['CreateReportBody'];
export type ReportReason = ReportBody['reason'];

export function reportUser(body: { username: string; reason: ReportReason; comment?: string }) {
  return call(() => apiClient.POST('/api/v1/reports', { body }));
}

export function reportListing(body: { listingId: string; reason: ReportReason; comment?: string }) {
  return call(() => apiClient.POST('/api/v1/reports', { body }));
}
