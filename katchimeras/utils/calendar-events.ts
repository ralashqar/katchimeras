import type { CalendarEventContext } from '@/utils/chronicle-engine';

// Calendar → Chronicle is wired end-to-end (the engine folds events into the
// day's title/summary/timeline), but the on-device FETCH is disabled until
// expo-calendar is installed — importing it before then breaks the bundle/build.
//
// TO ENABLE CALENDAR:
//   1. npx expo install expo-calendar
//   2. add the plugin back to app.json "plugins":
//        ["expo-calendar", { "calendarPermission": "Katchimeras reads your
//          calendar on your device to understand what your day was about — events
//          stay on your phone and only shape your day's Chronicle." }]
//   3. replace the stub body below with the REAL IMPLEMENTATION block.
//
// Until then this returns [] and the Chronicle builds from the day's other
// signals (photos, places, notes, big moments, mood, hatch).
export async function loadCalendarEventsForDay(_isoDate: string): Promise<CalendarEventContext[]> {
  return [];
}

/* ───────────────────────── REAL IMPLEMENTATION (paste in once expo-calendar is installed) ─────────────────────────
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { CalendarEventCategory } from '@/utils/chronicle-engine';

type ExpoCalendarApi = {
  EntityTypes: { EVENT: unknown };
  getCalendarPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestCalendarPermissionsAsync: () => Promise<{ granted: boolean }>;
  getCalendarsAsync: (entityType: unknown) => Promise<{ id: string; title?: string }[]>;
  getEventsAsync: (
    calendarIds: string[],
    startDate: Date,
    endDate: Date
  ) => Promise<
    { id: string; title?: string | null; startDate: string | Date; endDate: string | Date; allDay?: boolean; location?: string | null; calendarId?: string }[]
  >;
};

const CATEGORY_RULES: { category: CalendarEventCategory; re: RegExp }[] = [
  { category: 'health', re: /\b(dentist|doctor|gp|clinic|hospital|therapy|appointment|checkup|check-up|gym|workout)\b/i },
  { category: 'travel', re: /\b(flight|airport|train|trip|drive to|hotel|holiday|vacation)\b/i },
  { category: 'family', re: /\b(family|mum|mom|dad|grandma|grandpa|kids?|son|daughter|parents)\b/i },
  { category: 'social', re: /\b(dinner|lunch|brunch|coffee|drinks|party|catch ?up|hangout|date|wedding|birthday)\b/i },
  { category: 'work', re: /\b(meeting|standup|stand-up|1:1|review|interview|call|sync|deadline|work|office|client)\b/i },
];
function categorize(title: string, calendarName?: string): CalendarEventCategory {
  const haystack = `${title} ${calendarName ?? ''}`;
  for (const rule of CATEGORY_RULES) if (rule.re.test(haystack)) return rule.category;
  return 'unknown';
}
function dayRange(isoDate: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, y, m, d] = match;
  return {
    start: new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0),
    end: new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999),
  };
}

export async function loadCalendarEventsForDay(isoDate: string): Promise<CalendarEventContext[]> {
  if (!requireOptionalNativeModule('ExpoCalendar')) return [];
  const range = dayRange(isoDate);
  if (!range) return [];
  try {
    const Calendar = (await import('expo-calendar')) as unknown as ExpoCalendarApi;
    const permission = await Calendar.getCalendarPermissionsAsync();
    let granted = permission.granted;
    if (!granted && permission.canAskAgain) granted = (await Calendar.requestCalendarPermissionsAsync()).granted;
    if (!granted) return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) return [];
    const events = await Calendar.getEventsAsync(calendars.map((c) => c.id), range.start, range.end);
    return events
      .filter((event) => !event.allDay)
      .map((event): CalendarEventContext => {
        const calendarName = calendars.find((c) => c.id === event.calendarId)?.title;
        const title = (event.title ?? 'Event').trim() || 'Event';
        return {
          id: event.id,
          title,
          startTime: new Date(event.startDate).getTime(),
          endTime: new Date(event.endDate).getTime(),
          location: event.location ?? undefined,
          calendarName,
          category: categorize(title, calendarName),
        };
      })
      .filter((event) => !Number.isNaN(event.startTime))
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 8);
  } catch {
    return [];
  }
}
──────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
