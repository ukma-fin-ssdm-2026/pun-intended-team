// Written with the help of Claude
// Stand-in for Concert.ua's listing: it is not known yet whether the service gives us an API (R-001), so this is
// the shape the adapter expects, with one record of each kind the adapter must handle. Dates count from `now`
// so the records stay inside the 28-day catalog window.
const DAY_MS = 24 * 60 * 60 * 1000;

export function concertUaSampleFeed(now: Date = new Date()): unknown[] {
  const at = (days: number, hour: number) => {
    const date = new Date(now.getTime() + days * DAY_MS);
    date.setUTCHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  return [
    {
      id: 'cu-1001',
      title: 'Jazz evening at Caribbean Club',
      description: 'Live quartet, two sets.',
      genre: 'Concert',
      venue: { name: 'Caribbean Club', address: '6 Naberezhno-Khreshchatytska St, Kyiv', lat: 50.4638, lng: 30.5206 },
      startsAt: at(5, 16),
      endsAt: at(5, 19),
    },
    {
      // A number as id and no end time: the adapter turns the id into a string and gives the event a default length.
      id: 1002,
      title: 'Open-air rock fest',
      description: '',
      genre: 'Festival',
      venue: { name: 'Natalka Park', address: 'Naberezhno-Luhova St, Kyiv', lat: 50.4825, lng: 30.5181 },
      startsAt: at(9, 14),
    },
    {
      id: 'cu-1003',
      title: 'Photo exhibition: Kyiv at night',
      description: 'Thirty prints from local photographers.',
      genre: 'Exhibition',
      venue: { name: 'Mystetskyi Arsenal', address: '10-12 Lavrska St, Kyiv', lat: 50.4357, lng: 30.5555 },
      startsAt: at(3, 8),
      endsAt: at(12, 18),
    },
    // Not usable: a genre we have no category for, a missing title, an impossible date.
    {
      id: 'cu-1004',
      title: 'Stand-up show',
      description: '',
      genre: 'Comedy',
      venue: { name: 'Club Zhovten', address: '26 Zhylianska St, Kyiv', lat: 50.4385, lng: 30.5176 },
      startsAt: at(6, 17),
      endsAt: at(6, 19),
    },
    {
      id: 'cu-1005',
      genre: 'Concert',
      venue: { name: 'Atlas', address: '37-41 Sichovykh Striltsiv St, Kyiv', lat: 50.4545, lng: 30.5069 },
      startsAt: at(7, 17),
      endsAt: at(7, 19),
    },
    {
      id: 'cu-1006',
      title: 'Orchestra night',
      description: '',
      genre: 'Concert',
      venue: { name: 'Philharmonic', address: '2 Volodymyrskyi Descent, Kyiv', lat: 50.4547, lng: 30.5238 },
      startsAt: 'next friday',
      endsAt: 'late',
    },
  ];
}
