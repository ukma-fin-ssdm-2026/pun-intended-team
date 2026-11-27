// Written with the help of Claude
import { allPages, PAGE_SIZE } from './all-pages';
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type Organization = components['schemas']['Organization'];
export type OrganizationRequest = components['schemas']['OrganizationRequestBody'];
export type PublicOrganization = components['schemas']['PublicOrganization'];

export function getMyOrganization() {
  return call(() => apiClient.GET('/api/v1/me/organization'));
}

export function requestOrganizationStatus(body: OrganizationRequest) {
  return call(() => apiClient.PUT('/api/v1/me/organization', { body }));
}

// The organizer page: a verified organization, 404 for any other.
export function getOrganization(id: string) {
  return call(() => apiClient.GET('/api/v1/organizations/{id}', { params: { path: { id } } }));
}

// Its published events that have not ended, soonest first.
export function loadOrganizationEvents(id: string) {
  return allPages((offset) =>
    call(() =>
      apiClient.GET('/api/v1/organizations/{id}/events', {
        params: { path: { id }, query: { limit: PAGE_SIZE, offset } },
      }),
    ),
  );
}
