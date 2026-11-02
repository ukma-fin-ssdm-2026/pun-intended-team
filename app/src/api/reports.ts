// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type ReportBody = components['schemas']['CreateReportBody'];
export type ReportReason = ReportBody['reason'];

export function reportUser(body: ReportBody) {
  return call(() => apiClient.POST('/api/v1/reports', { body }));
}
