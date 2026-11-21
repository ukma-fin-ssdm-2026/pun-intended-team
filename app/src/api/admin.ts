// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components, paths } from './schema';

export type PlatformStats = components['schemas']['PlatformStats'];
export type ReportCase = components['schemas']['ReportCase'];
export type ReportCaseDetails = components['schemas']['ReportCaseDetails'];
export type ReportCasesPage = components['schemas']['ReportCasesPage'];
export type CaseStatus = ReportCase['status'];
export type AdminCategory = components['schemas']['AdminCategory'];
export type BackupRun = components['schemas']['BackupRun'];
export type AdminOrganization = components['schemas']['AdminOrganization'];
export type AdminAccount = components['schemas']['AdminAccount'];
export type AdminAccountDetails = components['schemas']['AdminAccountDetails'];
export type AdminEvent = components['schemas']['AdminEvent'];
export type AdminVenue = components['schemas']['AdminVenue'];

type Filter<Query> = Omit<NonNullable<Query>, 'limit' | 'offset'>;
export type AccountsFilter = Filter<paths['/api/v1/admin/accounts']['get']['parameters']['query']>;
export type EventsFilter = Filter<paths['/api/v1/admin/events']['get']['parameters']['query']>;
export type VenuesFilter = Filter<paths['/api/v1/admin/venues']['get']['parameters']['query']>;
export type OrganizationsFilter = Filter<paths['/api/v1/admin/organizations']['get']['parameters']['query']>;

export const CASES_PAGE_SIZE = 20;

export function getStats() {
  return call(() => apiClient.GET('/api/v1/admin/stats'));
}

export function listBackups() {
  return call(() => apiClient.GET('/api/v1/admin/backups'));
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

export function removeReportedListing(id: string) {
  return call(() => apiClient.POST('/api/v1/admin/report-cases/{id}/remove-listing', { params: { path: { id } } }));
}

export function dismissReportCase(id: string) {
  return call(() => apiClient.POST('/api/v1/admin/report-cases/{id}/dismiss', { params: { path: { id } } }));
}

export function listOrganizations(filter: OrganizationsFilter, offset: number) {
  return call(() =>
    apiClient.GET('/api/v1/admin/organizations', {
      params: { query: { ...filter, limit: CASES_PAGE_SIZE, offset } },
    }),
  );
}

export function getOrganization(accountId: string) {
  return call(() => apiClient.GET('/api/v1/admin/organizations/{accountId}', { params: { path: { accountId } } }));
}

export function listAccounts(filter: AccountsFilter, offset: number) {
  return call(() =>
    apiClient.GET('/api/v1/admin/accounts', { params: { query: { ...filter, limit: CASES_PAGE_SIZE, offset } } }),
  );
}

export function getAccount(id: string) {
  return call(() => apiClient.GET('/api/v1/admin/accounts/{id}', { params: { path: { id } } }));
}

export function listAdminEvents(filter: EventsFilter, offset: number) {
  return call(() =>
    apiClient.GET('/api/v1/admin/events', { params: { query: { ...filter, limit: CASES_PAGE_SIZE, offset } } }),
  );
}

export function getAdminEvent(id: string) {
  return call(() => apiClient.GET('/api/v1/admin/events/{id}', { params: { path: { id } } }));
}

export function listAdminVenues(filter: VenuesFilter, offset: number) {
  return call(() =>
    apiClient.GET('/api/v1/admin/venues', { params: { query: { ...filter, limit: CASES_PAGE_SIZE, offset } } }),
  );
}

export function getAdminVenue(id: string) {
  return call(() => apiClient.GET('/api/v1/admin/venues/{id}', { params: { path: { id } } }));
}

export function approveOrganization(accountId: string) {
  return call(() =>
    apiClient.POST('/api/v1/admin/organizations/{accountId}/approve', { params: { path: { accountId } } }),
  );
}

export function rejectOrganization(accountId: string) {
  return call(() =>
    apiClient.POST('/api/v1/admin/organizations/{accountId}/reject', { params: { path: { accountId } } }),
  );
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
