import { requireOptionalNativeModule } from 'expo-modules-core';

import type { CalendarEventCategory, CalendarEventContext } from '@/utils/chronicle-engine';

export type CalendarPermissionState = 'unknown' | 'granted' | 'denied' | 'unavailable';

type ExpoCalendarApi = {
  EntityTypes: { EVENT: string };
  getCalendarPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestCalendarPermissionsAsync: () => Promise<{ granted: boolean }>;
  getCalendarsAsync: (entityType?: string) => Promise<{ id: string; title?: string }[]>;
  getEventsAsync: (
    calendarIds: string[],
    startDate: Date,
    endDate: Date
  ) => Promise<
    {
      id: string;
      title?: string | null;
      startDate: string | Date;
      endDate: string | Date;
      allDay?: boolean;
      location?: string | null;
      calendarId?: string;
    }[]
  >;
};

export type CalendarDayContext = {
  events: CalendarEventContext[];
  permissionState: CalendarPermissionState;
};

// Calendar -> Chronicle is best-effort and local-first. The client fetches
// events on device, reduces them to small title/time/category facts, and passes
// them to the pure Chronicle engine. No raw calendar store is persisted here.
const CATEGORY_RULES: { category: CalendarEventCategory; re: RegExp }[] = [
  { category: 'celebration', re: /\b(birthday|anniversary|wedding|party|celebration|graduation)\b/i },
  { category: 'care', re: /\b(dentist|doctor|gp|clinic|hospital|therapy|appointment|checkup|check-up|gym|workout|physio)\b/i },
  { category: 'journey', re: /\b(flight|airport|train|trip|drive to|hotel|holiday|vacation|travel|journey)\b/i },
  { category: 'connection', re: /\b(dinner|lunch|brunch|coffee|drinks|catch ?up|hangout|date|family|mum|mom|dad|grandma|grandpa|kids?|son|daughter|parents)\b/i },
  { category: 'focus', re: /\b(meeting|standup|stand-up|1:1|review|interview|call|sync|deadline|work|office|client|deep work|planning)\b/i },
  { category: 'ritual', re: /\b(class|lesson|practice|school run|commute|weekly|monthly|routine)\b/i },
  { category: 'quiet', re: /\b(rest|reading|journal|meditation|walk alone|quiet)\b/i },
];

let permissionPromptAttempted = false;

function categorize(title: string, calendarName?: string): CalendarEventCategory {
  const haystack = `${title} ${calendarName ?? ''}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(haystack)) return rule.category;
  }
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

export async function loadCalendarContextForDay(isoDate: string): Promise<CalendarDayContext> {
  if (!requireOptionalNativeModule('ExpoCalendar')) return { events: [], permissionState: 'unavailable' };
  const range = dayRange(isoDate);
  if (!range) return { events: [], permissionState: 'unknown' };

  try {
    const Calendar = (await import('expo-calendar')) as unknown as ExpoCalendarApi;
    const permission = await Calendar.getCalendarPermissionsAsync();
    let granted = permission.granted;
    if (!granted && permission.canAskAgain && !permissionPromptAttempted) {
      permissionPromptAttempted = true;
      granted = (await Calendar.requestCalendarPermissionsAsync()).granted;
    }
    if (!granted) return { events: [], permissionState: 'denied' };

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) return { events: [], permissionState: 'granted' };

    const events = await Calendar.getEventsAsync(
      calendars.map((calendar) => calendar.id),
      range.start,
      range.end
    );

    return {
      events: events
        .filter((event) => !event.allDay)
        .map((event): CalendarEventContext => {
          const calendarName = calendars.find((calendar) => calendar.id === event.calendarId)?.title;
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
        .slice(0, 8),
      permissionState: 'granted',
    };
  } catch {
    return { events: [], permissionState: 'unknown' };
  }
}

export async function loadCalendarEventsForDay(isoDate: string): Promise<CalendarEventContext[]> {
  return (await loadCalendarContextForDay(isoDate)).events;
}
