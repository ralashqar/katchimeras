import type { BigMomentType, CapturedMeaning, DayNote, DayScores, HomeDayRecord } from '@/types/home';

// Chronicle (Patch Systems V3) — answers "what was this day about?". It turns the
// day's real signals (calendar events, big moments, photos+meanings, places,
// voice notes, mood, hatch) into a TITLE + a short STORY + a light timeline. It is
// NOT a calendar viewer or a stats list. Pure + testable; calendar events are
// passed in (fetched on-device, best-effort) so this stays dependency-free.

export type ChronicleTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type CalendarEventCategory = 'work' | 'social' | 'family' | 'health' | 'travel' | 'personal' | 'unknown';

export type CalendarEventContext = {
  id: string;
  title: string;
  startTime: number; // epoch ms
  endTime: number;
  location?: string;
  attendeesCount?: number;
  calendarName?: string;
  category?: CalendarEventCategory;
};

export type ChronicleTimelineItem = {
  id: string;
  label: string;
  timeOfDay: ChronicleTimeOfDay;
};

export type DayChronicle = {
  dateKey: string;
  title: string;
  summary: string;
  timeline: ChronicleTimelineItem[];
  shaped: string[];
  hasStory: boolean;
};

type ChronicleDayInput = Pick<
  HomeDayRecord,
  | 'isoDate'
  | 'scores'
  | 'capturedMeanings'
  | 'heroPhoto'
  | 'notes'
  | 'bigMoments'
  | 'confirmedPlaces'
  | 'visitedPlaceCount'
  | 'newPlaceCount'
  | 'stepsCount'
  | 'creature'
>;

const BIG_MOMENT_TITLE: Record<BigMomentType, string> = {
  birthday: 'A Day to Celebrate',
  anniversary: 'A Day to Remember',
  firstTime: 'A Day of Firsts',
  holiday: 'A Day to Celebrate',
  trip: 'A Day of Travel',
  achievement: 'A Day of Triumph',
  milestone: 'A Milestone Day',
};

// Score axis → a warm facet word for the title.
const FACET: Record<string, string> = {
  social: 'Connection',
  energy: 'Motion',
  exploration: 'Discovery',
  calm: 'Calm',
  focus: 'Focus',
};

// Calendar category → its facet word (drives the calendar-informed title).
const CATEGORY_FACET: Record<CalendarEventCategory, string | null> = {
  health: 'Care',
  social: 'Connection',
  family: 'Connection',
  work: 'Focus',
  travel: 'Travel',
  personal: 'Meaning',
  unknown: null,
};

function countArchetype(meanings: CapturedMeaning[] | undefined, notes: DayNote[] | undefined, archetype: string): number {
  return (
    (meanings ?? []).filter((meaning) => meaning.archetype === archetype).length +
    (notes ?? []).filter((note) => note.archetype === archetype).length
  );
}

function calendarFacets(events: CalendarEventContext[]): string[] {
  const facets: string[] = [];
  for (const event of events) {
    const facet = CATEGORY_FACET[event.category ?? 'unknown'];
    if (facet && !facets.includes(facet)) facets.push(facet);
  }
  return facets;
}

function rankFacets(day: ChronicleDayInput, events: CalendarEventContext[]): string[] {
  const scores = (day.scores ?? {}) as Partial<DayScores>;
  const ranked = (Object.keys(FACET) as string[])
    .map((key) => [FACET[key], (scores as Record<string, number>)[key] ?? 0] as const)
    .sort((a, b) => b[1] - a[1]);

  const facets: string[] = [];
  // Calendar facets lead — the day's commitments shape what it was about.
  for (const facet of calendarFacets(events)) if (!facets.includes(facet)) facets.push(facet);
  const meaningful =
    (day.bigMoments?.length ?? 0) > 0 || countArchetype(day.capturedMeanings, day.notes, 'meaningful') > 0;
  if (meaningful && !facets.includes('Meaning')) facets.push('Meaning');
  if (countArchetype(day.capturedMeanings, day.notes, 'together') > 0 && !facets.includes('Connection')) {
    facets.push('Connection');
  }
  for (const [name, value] of ranked) {
    if (facets.length >= 2) break;
    if (value > 0 && !facets.includes(name)) facets.push(name);
  }
  return facets;
}

function chronicleTitle(day: ChronicleDayInput, events: CalendarEventContext[]): string {
  const big = day.bigMoments?.[0];
  if (big) return BIG_MOMENT_TITLE[big.type] ?? 'A Day to Remember';
  const facets = rankFacets(day, events);
  if (facets.length >= 2) return `A Day of ${facets[0]} & ${facets[1]}`;
  if (facets.length === 1) return `A Day of ${facets[0]}`;
  return 'A Quiet Day';
}

function placeCount(day: ChronicleDayInput): number {
  return (day.confirmedPlaces?.length ?? 0) || (day.visitedPlaceCount ?? 0);
}
function memoryCount(day: ChronicleDayInput): number {
  return (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
}
function voiceCount(day: ChronicleDayInput): number {
  return (day.notes ?? []).filter((note) => note.kind === 'voice').length;
}

function chronicleShaped(day: ChronicleDayInput, events: CalendarEventContext[]): string[] {
  const shaped: string[] = [];
  for (const event of events.slice(0, 3)) shaped.push(event.title);
  for (const moment of day.bigMoments ?? []) {
    shaped.push(moment.subject ? `${moment.label} · ${moment.subject}` : moment.label);
  }
  const places = placeCount(day);
  if (places > 0) shaped.push(`${places} ${places === 1 ? 'place' : 'places'} visited`);
  const memories = memoryCount(day);
  if (memories > 0) shaped.push(`${memories} ${memories === 1 ? 'memory' : 'memories'} captured`);
  const voices = voiceCount(day);
  if (voices > 0) shaped.push(`${voices} voice ${voices === 1 ? 'note' : 'notes'}`);
  const steps = day.stepsCount ?? 0;
  if (steps >= 6000) shaped.push(`${(steps / 1000).toFixed(steps >= 10000 ? 0 : 1)}k steps`);
  return shaped;
}

function chronicleSummary(day: ChronicleDayInput, events: CalendarEventContext[]): string {
  const lead: string[] = [];
  for (const event of events.slice(0, 2)) lead.push(event.title.toLowerCase());
  const big = day.bigMoments?.[0];
  if (big && lead.length < 2) lead.push(big.subject ? `${big.label.toLowerCase()} with ${big.subject}` : big.label.toLowerCase());
  const places = placeCount(day);
  if (places > 0 && lead.length < 2) lead.push(`${places} ${places === 1 ? 'place' : 'places'}`);
  const memories = memoryCount(day);
  if (memories > 0 && lead.length < 2) lead.push(`${memories} ${memories === 1 ? 'memory' : 'memories'}`);
  const voices = voiceCount(day);
  if (voices > 0 && lead.length < 2) lead.push(`${voices} voice ${voices === 1 ? 'note' : 'notes'}`);

  if (lead.length === 0) return 'A quiet day, still finding its shape.';
  const sentence = `Today was shaped by ${lead.slice(0, 2).join(' and ')}.`;
  const strongest = day.heroPhoto ? null : day.capturedMeanings?.[day.capturedMeanings.length - 1];
  if (strongest?.label) return `${sentence} The strongest memory: ${strongest.label.toLowerCase()}.`;
  return sentence;
}

function timeOfDayFromHour(hour: number): ChronicleTimeOfDay {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}
function chronicleTimeline(day: ChronicleDayInput, events: CalendarEventContext[]): ChronicleTimelineItem[] {
  const raw: { id: string; label: string; ms: number }[] = [];
  for (const event of events) raw.push({ id: `e-${event.id}`, label: event.title, ms: event.startTime });
  for (const meaning of day.capturedMeanings ?? []) {
    if (meaning.createdAt) raw.push({ id: `m-${meaning.createdAt}`, label: meaning.label, ms: new Date(meaning.createdAt).getTime() });
  }
  for (const note of day.notes ?? []) {
    if (note.createdAt) raw.push({ id: note.id, label: note.label, ms: new Date(note.createdAt).getTime() });
  }
  for (const moment of day.bigMoments ?? []) {
    if (moment.createdAt) raw.push({ id: moment.id, label: moment.label, ms: new Date(moment.createdAt).getTime() });
  }
  raw.sort((a, b) => a.ms - b.ms);
  return raw
    .filter((item) => !Number.isNaN(item.ms))
    .slice(0, 8)
    .map((item) => ({ id: item.id, label: item.label, timeOfDay: timeOfDayFromHour(new Date(item.ms).getHours()) }));
}

export function deriveDayChronicle(day: ChronicleDayInput, calendarEvents: CalendarEventContext[] = []): DayChronicle {
  const events = [...calendarEvents].sort((a, b) => a.startTime - b.startTime);
  const shaped = chronicleShaped(day, events);
  const hasStory = shaped.length > 0 || !!day.creature || events.length > 0;
  return {
    dateKey: day.isoDate,
    title: chronicleTitle(day, events),
    summary: chronicleSummary(day, events),
    timeline: chronicleTimeline(day, events),
    shaped,
    hasStory,
  };
}
