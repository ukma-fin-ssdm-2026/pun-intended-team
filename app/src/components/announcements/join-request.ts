// Written with the help of Claude
import type { ListingRequest } from '@/api/listing-requests';
import { formatShortDay } from '@/dates';
import type { JoinRequest } from '@/components/announcements/join-request-sheet';

export const JOIN_REQUEST_NOTE = 'Прийми, і ви одразу зможете домовитися про зустріч.';

// The Д4 sheet for a request from the API: who asks, and the author's own post with its day and place.
export function joinRequestOf({ requester, listing }: ListingRequest): JoinRequest {
  // Noon, so the day is the same in Kyiv whatever the offset.
  const day = formatShortDay(`${listing.date}T12:00:00Z`);
  return {
    initial: requester.displayName.charAt(0).toUpperCase(),
    photo: requester.photo,
    nameAge: `${requester.displayName}, ${requester.age}`,
    interests: requester.interests.map(({ name }) => name).join(' · '),
    post: listing.title,
    details: listing.place ? `${day} · ${listing.place.name}` : day,
    note: JOIN_REQUEST_NOTE,
  };
}
