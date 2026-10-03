// Written with the help of Claude
// The service covers Kyiv only, so calendar dates ("today", date filters) are Kyiv dates.
const kyivDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' });

/** The Kyiv calendar date of an instant, as YYYY-MM-DD. */
export function kyivDate(instant: Date | string = new Date()): string {
  return kyivDateFormat.format(new Date(instant));
}

/** YYYY-MM-DD plus a number of days. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
