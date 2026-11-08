// Written with the help of Claude
// AI Usage: Ukrainian date labels and Kyiv calendar days for the catalog and event page; reviewed by Daryna Halytska.
import { plural } from '@/plural';

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

// "Сб, 24 жовт", as in the matching screens' subtitles.
export function formatShortDay(iso: string): string {
  const { month, day, weekday } = kyivTime(new Date(iso));
  return `${weekdaysShort[weekday]}, ${day} ${monthsShort[month - 1]}`;
}

// "31 жовт 2026, 08:40", as in the admin tables.
export function formatDateTime(iso: string): string {
  const { year, month, day, time } = kyivTime(new Date(iso));
  return `${day} ${monthsShort[month - 1]} ${year}, ${time}`;
}

// "Субота, 24 жовтня", as on the event page.
export function formatEventDay(iso: string): string {
  const { month, day, weekday } = kyivTime(new Date(iso));
  return `${weekdaysLong[weekday]}, ${day} ${monthsLong[month - 1]}`;
}

// "19:00".
export function formatTime(iso: string): string {
  return kyivTime(new Date(iso)).time;
}

// "19:00 – 21:30", or "з 10:00" when the end is unknown.
export function formatTimeRange(startIso: string, endIso: string): string {
  const start = kyivTime(new Date(startIso)).time;
  return endsUnknown(endIso) ? `з ${start}` : `${start} – ${kyivTime(new Date(endIso)).time}`;
}

// The import ends an event at the last millisecond of its Kyiv day when the provider gives no end time.
function endsUnknown(endIso: string): boolean {
  const next = Date.parse(endIso) + 1;
  return next % 60_000 === 0 && kyivTime(new Date(next)).time === '00:00';
}

// Kyiv's offset from UTC at an instant, in minutes: 120 in winter, 180 in summer.
function kyivOffsetMinutes(instant: Date): number {
  const { year, month, day, time } = kyivTime(instant);
  const [hour, minute] = time.split(':').map(Number);
  return (Date.UTC(year, month - 1, day, hour, minute) - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000;
}

// "2026-10-25T19:00:00+03:00" for a Kyiv day and a time such as "19:00": the offset is the one Kyiv has at that moment.
export function kyivIso(day: string, time: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  // The first pass reads the wall time as UTC; the second settles the offset when a clock change lies in between.
  const offset = kyivOffsetMinutes(new Date(wall - kyivOffsetMinutes(new Date(wall)) * 60_000));
  const sign = offset < 0 ? '-' : '+';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${day}T${time}:00${sign}${hours}:${minutes}`;
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

// A month-long exhibition has about 30; the cap only stops a bad end date from looping for long.
const MAX_SESSIONS = 366;

// The starts of an event's sessions, as the API sets them (matching.md, rule 9): one on each Kyiv day from the start
// date, at the event's Kyiv time of day, while that is before the end. More than one makes it a multi-day event.
export function eventSessions(startsAt: string, endsAt: string): string[] {
  const firstDay = kyivDay(new Date(startsAt));
  const time = formatTime(startsAt);
  const end = Date.parse(endsAt);
  const sessions = [startsAt];
  for (let day = addDays(firstDay, 1); sessions.length < MAX_SESSIONS; day = addDays(day, 1)) {
    const start = kyivIso(day, time);
    if (Date.parse(start) >= end) break;
    sessions.push(start);
  }
  return sessions;
}

const HOUR_MS = 60 * 60 * 1000;
// matching.md, policy: the cutoff is an hour before a session starts, or 2 hours before a session of 3 hours or more
// ends.
const CUTOFF_BEFORE_START_MS = HOUR_MS;
const LONG_SESSION_MS = 3 * HOUR_MS;
const CUTOFF_BEFORE_END_MS = 2 * HOUR_MS;

// The cutoff of a session of eventSessions, as the API sets it: when matching stops and with it new applications. The
// last session ends with the event; an earlier one at the event's end time on its day, or at midnight when that time
// comes earlier in the day.
export function sessionCutoff(startsAt: string, endsAt: string, sessionStart: string): number {
  const sessions = eventSessions(startsAt, endsAt);
  const start = Date.parse(sessionStart);
  let end = Date.parse(endsAt);
  if (sessions[sessions.length - 1] !== sessionStart) {
    const day = kyivDay(new Date(sessionStart));
    const onItsDay = Date.parse(kyivIso(day, formatTime(endsAt)));
    end = onItsDay > start ? onItsDay : Date.parse(kyivIso(addDays(day, 1), '00:00')) - 1;
  }
  return end - start >= LONG_SESSION_MS ? end - CUTOFF_BEFORE_END_MS : start - CUTOFF_BEFORE_START_MS;
}

// "через 3 год", "завтра", "через 2 дні": how far away an instant is, for the next matching round.
export function formatUntil(iso: string, now = new Date()): string {
  const hours = Math.floor((Date.parse(iso) - now.getTime()) / HOUR_MS);
  if (hours < 1) return 'менш ніж за годину';
  if (hours < 24) return `через ${hours} год`;
  const [year, month, date] = kyivDay(now).split('-').map(Number);
  const [toYear, toMonth, toDate] = kyivDay(new Date(iso)).split('-').map(Number);
  const days = (Date.UTC(toYear, toMonth - 1, toDate) - Date.UTC(year, month - 1, date)) / (24 * HOUR_MS);
  if (days === 1) return 'завтра';
  return `через ${days} ${plural(days, ['день', 'дні', 'днів'])}`;
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

// Nominative, as in the calendar header "Жовтень 2026".
const monthsNominative = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];

export type CalendarMonth = { year: number; month: number };

export function monthOf(day: KyivDay): CalendarMonth {
  const [year, month] = day.split('-').map(Number);
  return { year, month };
}

export function shiftMonth({ year, month }: CalendarMonth, by: number): CalendarMonth {
  const index = year * 12 + month - 1 + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function formatMonth({ year, month }: CalendarMonth): string {
  return `${monthsNominative[month - 1]} ${year}`;
}

// The month's days in weeks from Monday; null fills the days of the other months.
export function monthWeeks({ year, month }: CalendarMonth): (KyivDay | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (KyivDay | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= length; day += 1) {
    cells.push([year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-'));
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}
