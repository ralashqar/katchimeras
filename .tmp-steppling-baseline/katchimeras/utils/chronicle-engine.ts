import type { BigMomentType, CapturedMeaning, DayNote, DayScores, HomeDayRecord } from '@/types/home';
import { resolveBigMomentDisplay, resolveMovementDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';

// Chronicle (Patch Systems V3) — answers "what was this day about?". It turns the
// day's real signals (calendar events, big moments, photos+meanings, places,
// voice notes, mood, hatch) into a TITLE + a short STORY + a light timeline. It is
// NOT a calendar viewer or a stats list. Pure + testable; calendar events are
// passed in (fetched on-device, best-effort) so this stays dependency-free.

export type ChronicleTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export type CalendarEventCategory = 'focus' | 'connection' | 'care' | 'journey' | 'celebration' | 'ritual' | 'quiet' | 'unknown';

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
  calendarHighlights: string[];
  calendarSourceCount: number;
  contextNote?: string;
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
  | 'stepsInterpretation'
  | 'studioMoments'
  | 'hatchCheckIn'
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
  baby: 'A Day of Welcome',
  wedding: 'A Day of Vows',
  graduation: 'A Day of Honours',
  newHome: 'A Day of New Walls',
  newJob: 'A Day of Beginnings',
  reunion: 'A Day Together Again',
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
  care: 'Care',
  celebration: 'Celebration',
  connection: 'Connection',
  focus: 'Focus',
  journey: 'Travel',
  quiet: 'Calm',
  ritual: 'Ritual',
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

function addFacet(scores: Map<string, number>, facet: string | null, amount: number) {
  if (!facet) return;
  scores.set(facet, (scores.get(facet) ?? 0) + amount);
}

function rankFacets(day: ChronicleDayInput, events: CalendarEventContext[]): string[] {
  const scores = (day.scores ?? {}) as Partial<DayScores>;
  const facetScores = new Map<string, number>();
  // Calendar is one narrative signal; captured memories and interpreted movement can outrank it.
  for (const facet of calendarFacets(events)) addFacet(facetScores, facet, 1.2);
  const meaningful =
    (day.bigMoments?.length ?? 0) > 0 || countArchetype(day.capturedMeanings, day.notes, 'meaningful') > 0;
  if (meaningful) addFacet(facetScores, 'Meaning', 1.8);
  if (countArchetype(day.capturedMeanings, day.notes, 'together') > 0) addFacet(facetScores, 'Connection', 1.7);
  // An interpreted active day reads as Adventure (a hike / travel) or Movement.
  const movement = day.stepsInterpretation;
  if (movement) {
    const facet = movement.movement === 'hike' || movement.movement === 'travel' ? 'Adventure' : 'Movement';
    addFacet(facetScores, facet, 1.7);
  }
  // Books/films/shows the day took in read as Stories.
  if ((day.studioMoments?.length ?? 0) > 0) addFacet(facetScores, 'Stories', 1.4);
  const checkInFacet = hatchCheckInFacet(day.hatchCheckIn?.flowId ?? null);
  if (day.hatchCheckIn?.status !== 'skipped') addFacet(facetScores, checkInFacet, 1.6);
  for (const key of Object.keys(FACET)) {
    const value = (scores as Record<string, number>)[key] ?? 0;
    if (value > 0) addFacet(facetScores, FACET[key], value / 2);
  }
  return [...facetScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([facet]) => facet)
    .slice(0, 2);
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
  for (const event of events.slice(0, 2)) shaped.push(calendarHighlightForEvent(event));
  for (const moment of day.bigMoments ?? []) {
    shaped.push(resolveBigMomentDisplay(moment).label);
  }
  if (day.hatchCheckIn?.status !== 'skipped') {
    const reflection = [day.hatchCheckIn?.anchorLabel ?? day.hatchCheckIn?.categoryLabel, day.hatchCheckIn?.meaningLabel]
      .filter((item): item is string => Boolean(item))
      .join(' · ');
    if (reflection) shaped.push(reflection);
  }
  const places = placeCount(day);
  if (places > 0) shaped.push(`${places} ${places === 1 ? 'place' : 'places'} visited`);
  const memories = memoryCount(day);
  if (memories > 0) shaped.push(`${memories} ${memories === 1 ? 'memory' : 'memories'} captured`);
  const voices = voiceCount(day);
  if (voices > 0) shaped.push(`${voices} voice ${voices === 1 ? 'note' : 'notes'}`);
  const studio = day.studioMoments?.length ?? 0;
  if (studio > 0) shaped.push(`${studio} ${studio === 1 ? 'inspiration' : 'inspirations'}`);
  const steps = day.stepsCount ?? 0;
  const stepsLabel = steps >= 1000 ? `${(steps / 1000).toFixed(steps >= 10000 ? 0 : 1)}k steps` : null;
  // An interpreted day leads with what it WAS (a hike), with the count as colour.
  if (day.stepsInterpretation) {
    const display = resolveMovementDisplay(day.stepsInterpretation);
    shaped.push(stepsLabel ? `${display.label} · ${stepsLabel}` : display.label);
  } else if (steps >= 6000 && stepsLabel) {
    shaped.push(stepsLabel);
  }
  return shaped;
}

function chronicleSummary(day: ChronicleDayInput, events: CalendarEventContext[]): string {
  const lead: string[] = [];
  const big = day.bigMoments?.[0];
  if (big && lead.length < 2) lead.push(resolveBigMomentDisplay(big).label.toLowerCase());
  // A named active day (a hike, a travel day) is a strong day-shaper.
  if (day.stepsInterpretation && lead.length < 2) lead.push(resolveMovementDisplay(day.stepsInterpretation).label.toLowerCase());
  if (day.hatchCheckIn?.status !== 'skipped' && lead.length < 2) {
    const reflection = day.hatchCheckIn?.meaningLabel ?? day.hatchCheckIn?.anchorLabel ?? day.hatchCheckIn?.categoryLabel;
    if (reflection) lead.push(reflection.toLowerCase());
  }
  const places = placeCount(day);
  if (places > 0 && lead.length < 2) lead.push(`${places} ${places === 1 ? 'place' : 'places'}`);
  const memories = memoryCount(day);
  if (memories > 0 && lead.length < 2) lead.push(`${memories} ${memories === 1 ? 'memory' : 'memories'}`);
  const studio = day.studioMoments?.length ?? 0;
  if (studio > 0 && lead.length < 2) lead.push(`${studio} ${studio === 1 ? 'inspiration' : 'inspirations'}`);
  const voices = voiceCount(day);
  if (voices > 0 && lead.length < 2) lead.push(`${voices} voice ${voices === 1 ? 'note' : 'notes'}`);
  for (const event of events.slice(0, 2)) {
    if (lead.length < 2) lead.push(event.title.toLowerCase());
  }

  if (lead.length === 0) return 'A quiet day, still finding its shape.';
  const sentence = `Today was shaped by ${lead.slice(0, 2).join(' and ')}.`;
  const strongest = day.heroPhoto ? null : day.capturedMeanings?.[day.capturedMeanings.length - 1];
  if (strongest?.label) return `${sentence} The strongest memory: ${strongest.label.toLowerCase()}.`;
  return sentence;
}

function hatchCheckInFacet(flowId: string | null): string | null {
  if (flowId === 'people') return 'Connection';
  if (flowId === 'movement') return 'Movement';
  if (flowId === 'went_somewhere') return 'Adventure';
  if (flowId === 'studio') return 'Stories';
  if (flowId === 'work') return 'Focus';
  if (flowId === 'big_event') return 'Meaning';
  if (flowId === 'food' || flowId === 'general') return 'Comfort';
  return null;
}

function timeOfDayFromHour(hour: number): ChronicleTimeOfDay {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

const TIME_LABEL: Record<ChronicleTimeOfDay, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
};

function calendarHighlightForEvent(event: CalendarEventContext): string {
  const slot = TIME_LABEL[timeOfDayFromHour(new Date(event.startTime).getHours())];
  return `${event.title} shaped the ${slot}`;
}

function calendarHighlights(events: CalendarEventContext[]): string[] {
  return events.slice(0, 2).map(calendarHighlightForEvent);
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
    if (moment.createdAt) raw.push({ id: moment.id, label: resolveBigMomentDisplay(moment).label, ms: new Date(moment.createdAt).getTime() });
  }
  for (const item of day.studioMoments ?? []) {
    const display = resolveStudioMomentDisplay(item);
    if (item.createdAt) raw.push({ id: item.id, label: `${display.emoji} ${display.label}`, ms: new Date(item.createdAt).getTime() });
  }
  raw.sort((a, b) => a.ms - b.ms);
  return raw
    .filter((item) => !Number.isNaN(item.ms))
    .slice(0, 8)
    .map((item) => ({ id: item.id, label: item.label, timeOfDay: timeOfDayFromHour(new Date(item.ms).getHours()) }));
}

export function deriveDayChronicle(day: ChronicleDayInput, calendarEvents: CalendarEventContext[] = []): DayChronicle {
  const events = [...calendarEvents].sort((a, b) => a.startTime - b.startTime);
  const highlights = calendarHighlights(events);
  const shaped = chronicleShaped(day, events);
  const hasStory = shaped.length > 0 || !!day.creature || events.length > 0;
  return {
    dateKey: day.isoDate,
    title: chronicleTitle(day, events),
    summary: chronicleSummary(day, events),
    timeline: chronicleTimeline(day, events),
    shaped,
    calendarHighlights: highlights,
    calendarSourceCount: events.length,
    contextNote: events.length > 0 ? 'Planned moments helped Katchimera read the shape of this day.' : undefined,
    hasStory,
  };
}
