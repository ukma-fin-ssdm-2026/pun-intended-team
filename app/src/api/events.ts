// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type Event = components['schemas']['Event'];
// Every editable field; creating and editing an event take the same body.
export type EventBody = components['schemas']['CreateEventBody'];

export function createEvent(body: EventBody) {
  return call(() => apiClient.POST('/api/v1/events', { body }));
}

export function updateEvent(id: string, body: EventBody) {
  return call(() => apiClient.PUT('/api/v1/events/{id}', { params: { path: { id } }, body }));
}

export function cancelEvent(id: string) {
  return call(() => apiClient.POST('/api/v1/events/{id}/cancel', { params: { path: { id } } }));
}
