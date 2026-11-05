// Written with the help of Claude
import type { Listing } from '@/api/listings';
import { formatShortDay } from '@/dates';
import type { Post } from '@/mocks/announcements';

// A listing as the feed's card shows it. The API gives no age, no district or time of posting and no name forms, so
// the card shows the display name, the category and the day of the plan. Whose post it is stays undefined until the own
// username is known, so a screen does not offer a report on the own post.
export function listingToPost(listing: Listing, ownUsername?: string): Post {
  const { id, author, category, title, description, date, eventId } = listing;
  return {
    id,
    initial: author.displayName.charAt(0).toUpperCase(),
    nameAge: author.displayName,
    // The report sheet declines the name ("Поскаржитися на Ірину"); without the forms it uses the name as it is.
    author: {
      name: author.displayName,
      accusative: author.displayName,
      instrumental: author.displayName,
      username: author.username,
    },
    meta: `· ${category.name}`,
    title,
    text: description,
    // Noon, so the day is the same in Kyiv whatever the offset.
    chips: [{ icon: 'calendar', label: formatShortDay(`${date}T12:00:00Z`) }],
    eventId: eventId ?? undefined,
    going: false,
    own: ownUsername === undefined ? undefined : ownUsername.toLowerCase() === author.username.toLowerCase(),
  };
}
