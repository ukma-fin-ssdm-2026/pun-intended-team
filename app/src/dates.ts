// Written with the help of Claude
const kyivDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return kyivDateTime.format(new Date(iso));
}
