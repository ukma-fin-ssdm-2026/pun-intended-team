// Written with the help of Claude
import { apiClient } from './client';
import { call } from './public-client';
import type { components } from './schema';

export type ListingRequest = components['schemas']['ListingRequest'];
export type ListingRequestPerson = ListingRequest['requester'];
export type ListingRequestContacts = components['schemas']['MatchContacts'];

// "Хочу піти" on someone else's listing; its author gets a notification.
export function requestToJoinListing(listingId: string) {
  return call(() => apiClient.POST('/api/v1/listings/{id}/requests', { params: { path: { id: listingId } } }));
}

export function getListingRequest(id: string) {
  return call(() => apiClient.GET('/api/v1/listing-requests/{id}', { params: { path: { id } } }));
}

export function acceptListingRequest(id: string) {
  return call(() => apiClient.POST('/api/v1/listing-requests/{id}/accept', { params: { path: { id } } }));
}

export function declineListingRequest(id: string) {
  return call(() => apiClient.POST('/api/v1/listing-requests/{id}/decline', { params: { path: { id } } }));
}

// 404 until the author accepts, 422 SAFETY_NOTICE_REQUIRED until the caller has acknowledged the safety notice.
export function getListingRequestContacts(id: string) {
  return call(() => apiClient.GET('/api/v1/listing-requests/{id}/contacts', { params: { path: { id } } }));
}
