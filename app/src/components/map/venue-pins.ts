// Written with the help of Claude
import type { components } from '@/api/schema';

type Event = components['schemas']['Event'];
type Venue = components['schemas']['Venue'];

export type VenueWithEvents = { venue: Venue; events: Event[] };

/** One pin per venue (FR-012): its events in the order given, soonest first as the API sends them. */
export function venuesOf(events: Event[]): VenueWithEvents[] {
  const byVenue = new Map<string, VenueWithEvents>();
  for (const event of events) {
    const found = byVenue.get(event.venue.id);
    if (found) found.events.push(event);
    else byVenue.set(event.venue.id, { venue: event.venue, events: [event] });
  }
  return [...byVenue.values()];
}

/** "1 подія", "3 події", "5 подій". */
export function eventsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} подія`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} події`;
  return `${count} подій`;
}

/** The search of the map ("Заклад або подія") matches an event's title or its venue's name. */
export function matchesMapSearch(event: Event, query: string): boolean {
  const search = query.trim().toLocaleLowerCase('uk');
  return (
    !search ||
    event.title.toLocaleLowerCase('uk').includes(search) ||
    event.venue.name.toLocaleLowerCase('uk').includes(search)
  );
}
