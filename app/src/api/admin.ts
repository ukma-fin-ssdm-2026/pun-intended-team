// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type PlatformStats = components['schemas']['PlatformStats'];
export type ReportCase = components['schemas']['ReportCase'];
export type ReportCaseDetails = components['schemas']['ReportCaseDetails'];
export type ReportCasesPage = components['schemas']['ReportCasesPage'];
export type CaseStatus = ReportCase['status'];
export type AdminCategory = components['schemas']['AdminCategory'];

export const CASES_PAGE_SIZE = 20;

export function getStats() {
  return call(() => apiClient.GET('/api/v1/admin/stats'));
}

export function listReportCases(status: CaseStatus, offset: number) {
  return call(() =>
    apiClient.GET('/api/v1/admin/report-cases', { params: { query: { status, limit: CASES_PAGE_SIZE, offset } } }),
  );
}

export function getReportCase(id: string) {
  return call(() => apiClient.GET('/api/v1/admin/report-cases/{id}', { params: { path: { id } } }));
}

export function banReportedUser(id: string) {
  return call(() => apiClient.POST('/api/v1/admin/report-cases/{id}/ban', { params: { path: { id } } }));
}

export function dismissReportCase(id: string) {
  return call(() => apiClient.POST('/api/v1/admin/report-cases/{id}/dismiss', { params: { path: { id } } }));
}

export function listAdminCategories() {
  return call(() => apiClient.GET('/api/v1/admin/categories'));
}

export function createCategory(name: string) {
  return call(() => apiClient.POST('/api/v1/admin/categories', { body: { name, isActive: true } }));
}

export function updateCategory(id: string, body: components['schemas']['UpdateCategoryBody']) {
  return call(() => apiClient.PATCH('/api/v1/admin/categories/{id}', { params: { path: { id } }, body }));
}

export function deleteCategory(id: string) {
  return call(() => apiClient.DELETE('/api/v1/admin/categories/{id}', { params: { path: { id } } }));
}
