// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type Organization = components['schemas']['Organization'];
export type OrganizationRequest = components['schemas']['OrganizationRequestBody'];

export function getMyOrganization() {
  return call(() => apiClient.GET('/api/v1/me/organization'));
}

export function requestOrganizationStatus(body: OrganizationRequest) {
  return call(() => apiClient.PUT('/api/v1/me/organization', { body }));
}
