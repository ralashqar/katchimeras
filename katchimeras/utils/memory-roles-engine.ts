import type { HomeDayRecord } from '@/types/home';
import { resolveBigMomentDisplay, resolveFoodMomentDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';

export type MemoryRoleId =
  | 'anchor_place'
  | 'comfort_routine'
  | 'small_joy'
  | 'creative_spark'
  | 'social_moment'
  | 'reset_moment'
  | 'milestone'
  | 'discovery';

export type MemoryRoleSource =
  | 'photo'
  | 'note'
  | 'place'
  | 'steps'
  | 'food'
  | 'studio'
  | 'reflection'
  | 'bigMoment';

export type DayMemoryRole = {
  id: MemoryRoleId;
  label: string;
  reason: string;
  source: MemoryRoleSource;
};

const REFLECTION_KINDS = new Set(['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight']);
const COMFORT_PLACE_CATEGORIES = new Set(['cafe', 'home', 'food']);
const DISCOVERY_PLACE_CATEGORIES = new Set(['museum', 'park', 'cinema', 'gallery', 'landmark', 'travel']);

function pushUnique(roles: DayMemoryRole[], role: DayMemoryRole) {
  if (roles.some((item) => item.id === role.id)) return;
  roles.push(role);
}

function hasReflection(day: HomeDayRecord): boolean {
  return (day.promptAnswers ?? []).some((answer) => !answer.dismissed && REFLECTION_KINDS.has(answer.kind));
}

function hasSocialSignal(day: HomeDayRecord): boolean {
  return (
    (day.capturedMeanings ?? []).some((meaning) => meaning.archetype === 'together') ||
    (day.notes ?? []).some((note) => note.archetype === 'together') ||
    (day.promptAnswers ?? []).some((answer) => !answer.dismissed && answer.kind === 'people')
  );
}

function photoCount(day: HomeDayRecord): number {
  return (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0);
}

export function deriveDayMemoryRoles(day: HomeDayRecord, limit = 4): DayMemoryRole[] {
  const roles: DayMemoryRole[] = [];
  const places = day.confirmedPlaces ?? [];
  const foods = day.foodMoments ?? [];
  const studio = day.studioMoments ?? [];
  const notes = day.notes ?? [];

  if ((day.bigMoments?.length ?? 0) > 0) {
    const moment = day.bigMoments?.[0];
    const display = moment ? resolveBigMomentDisplay(moment) : null;
    pushUnique(roles, {
      id: 'milestone',
      label: display?.label ?? 'Milestone',
      reason: display ? `${display.label} became part of the day.` : 'A day marker worth keeping.',
      source: 'bigMoment',
    });
  }

  if (places.length > 0 || (day.visitedPlaceCount ?? 0) > 0) {
    const place = places[0];
    pushUnique(roles, {
      id: 'anchor_place',
      label: place?.label ?? 'Place memory',
      reason: place?.meaningLabel ?? `${places.length || day.visitedPlaceCount} place shaped the day.`,
      source: 'place',
    });
  }

  if (
    foods.some((food) => food.meaning === 'comfort' || food.meaning === 'treat') ||
    places.some((place) => COMFORT_PLACE_CATEGORIES.has(place.category)) ||
    day.moments.some((moment) => moment.type === 'coffee')
  ) {
    const food = foods.find((item) => item.meaning === 'comfort' || item.meaning === 'treat');
    const foodDisplay = food ? resolveFoodMomentDisplay(food) : null;
    pushUnique(roles, {
      id: 'comfort_routine',
      label: foodDisplay?.label ?? 'Comfort routine',
      reason: foodDisplay ? `${foodDisplay.label} gave the day a familiar shape.` : 'A familiar place or ritual shaped the day.',
      source: food ? 'food' : 'place',
    });
  }

  if (studio.length > 0) {
    const item = studio[0];
    const display = resolveStudioMomentDisplay(item);
    pushUnique(roles, {
      id: 'creative_spark',
      label: display.label,
      reason: `${display.label} joined the Study.`,
      source: 'studio',
    });
  }

  if (hasSocialSignal(day)) {
    pushUnique(roles, {
      id: 'social_moment',
      label: 'Shared moment',
      reason: 'People or togetherness shaped this memory.',
      source: 'reflection',
    });
  }

  if (hasReflection(day) || notes.some((note) => note.archetype === 'calm') || day.sleep?.quality === 'good') {
    pushUnique(roles, {
      id: 'reset_moment',
      label: 'Reset moment',
      reason: 'The day has a pause, reflection, or calmer start.',
      source: hasReflection(day) ? 'reflection' : 'note',
    });
  }

  if (
    (day.newPlaceCount ?? 0) > 0 ||
    places.some((place) => DISCOVERY_PLACE_CATEGORIES.has(place.category)) ||
    day.stepsInterpretation?.movement === 'travel'
  ) {
    pushUnique(roles, {
      id: 'discovery',
      label: 'Discovery',
      reason: 'Something new entered the map.',
      source: (day.newPlaceCount ?? 0) > 0 || places.length > 0 ? 'place' : 'steps',
    });
  }

  if (photoCount(day) > 0 || foods.length > 0 || notes.length > 0) {
    const firstMeaning = day.capturedMeanings?.[0];
    pushUnique(roles, {
      id: 'small_joy',
      label: firstMeaning?.label ?? foods[0]?.label ?? notes[0]?.label ?? 'Small joy',
      reason: 'A small kept detail made the patch more personal.',
      source: firstMeaning || day.heroPhoto ? 'photo' : foods.length > 0 ? 'food' : 'note',
    });
  }

  return roles.slice(0, limit);
}
