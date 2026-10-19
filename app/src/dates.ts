// Written with the help of Claude
// AI Usage: Ukrainian date labels and Kyiv calendar days for the catalog and event page; reviewed by Daryna Halytska.

const kyivParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Spelled out instead of the 'uk' locale, whose short forms ("сб", "жовт.") differ from the design and between engines.
const weekdaysShort = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const weekdaysLong = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
const monthsShort = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'];
// Genitive, as in "18 жовтня".
const monthsLong = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

type KyivTime = { year: number; month: number; day: number; weekday: number; time: string };

function kyivTime(date: Date): KyivTime {
  const parts = Object.fromEntries(kyivParts.formatToParts(date).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday, time: `${parts.hour}:${parts.minute}` };
}

// "Сб, 24 жовт · 19:00", as on the catalog cards.
export function formatEventDate(iso: string): string {
  const { month, day, weekday, time } = kyivTime(new Date(iso));
  return `${weekdaysShort[weekday]}, ${day} ${monthsShort[month - 1]} · ${time}`;
}

// "Субота, 24 жовтня", as on the event page.
export function formatEventDay(iso: string): string {
  const { month, day, weekday } = kyivTime(new Date(iso));
  return `${weekdaysLong[weekday]}, ${day} ${monthsLong[month - 1]}`;
}

// "19:00 – 21:30".
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${kyivTime(new Date(startIso)).time} – ${kyivTime(new Date(endIso)).time}`;
}

// Calendar day in Kyiv as "2026-10-24", so days compare as strings.
export type KyivDay = string;

export function kyivDay(date: Date): KyivDay {
  const { year, month, day } = kyivTime(date);
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function addDays(day: KyivDay, days: number): KyivDay {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

export function tomorrow(today: KyivDay): KyivDay {
  return addDays(today, 1);
}

// The coming Saturday and Sunday; on a Sunday only that day is left.
export function weekendDays(today: KyivDay): KyivDay[] {
  const [year, month, date] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  if (weekday === 0) return [today];
  const saturday = addDays(today, 6 - weekday);
  return [saturday, addDays(saturday, 1)];
}
