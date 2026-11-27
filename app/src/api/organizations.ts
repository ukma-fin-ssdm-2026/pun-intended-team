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

// In any verification status: Instagram is a public link, not reviewed, so it never resets a verified organization.
// The API keeps the bare username of "@name", "name" or a profile link; null removes it.
export function setOrganizationInstagram(instagram: string | null) {
  return call(() => apiClient.PUT('/api/v1/me/organization/instagram', { body: { instagram } }));
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
