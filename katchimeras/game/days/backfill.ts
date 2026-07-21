import type { DayVisionSummary, StoredHomeDayRecord, StoredHomeLocationPoint, StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';

import { toLocalDateId } from './date';
import { normalizeStoredHomeState } from './state-normalization';

export type BackfilledDayInput = {
  isoDate: string;
  stepsCount: number;
  locations: StoredHomeLocationPoint[];
  vision?: DayVisionSummary | null;
};

export function applyBackfilledDays(
  state: StoredHomeState,
  backfilled: BackfilledDayInput[],
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const byIsoDate = new Map(backfilled.map((day) => [day.isoDate, day]));
  const todayIso = toLocalDateId(now);
  const keptArchived = state.archivedDays
    .filter((day) => !(day.id.startsWith('seed-') && byIsoDate.has(day.isoDate)))
    .map((day) => {
      const incoming = byIsoDate.get(day.isoDate);
      if (!incoming || day.creature) {
        byIsoDate.delete(day.isoDate);
        return day;
      }

      byIsoDate.delete(day.isoDate);
      return {
        ...day,
        stepsCount: Math.max(day.stepsCount, incoming.stepsCount),
        locations: day.locations.length > 0 ? day.locations : incoming.locations,
        vision: day.vision ?? incoming.vision ?? undefined,
      };
    });

  const newDays: StoredHomeDayRecord[] = [...byIsoDate.values()]
    .filter((day) => day.isoDate !== todayIso)
    .map((day) => ({
      id: `day-${day.isoDate}`,
      isoDate: day.isoDate,
      state: 'forming' as const,
      stepsCount: day.stepsCount,
      visitedPlaceCount: 0,
      newPlaceCount: 0,
      locationSampleCount: day.locations.length,
      shareReadyAt: null,
      moments: [],
      locations: day.locations,
      healthRouteImport: null,
      exactRouteSegments: [],
      selectedPathId: null,
      promptAnswers: [],
      heroPhoto: null,
      creature: null,
      card: null,
      vision: day.vision ?? undefined,
    }));

  const mergedArchived = [...keptArchived, ...newDays].sort((left, right) =>
    left.isoDate.localeCompare(right.isoDate)
  );

  return normalizeStoredHomeState(
    {
      ...state,
      archivedDays: mergedArchived,
      backfilledAt: now.toISOString(),
    },
    profile,
    now
  );
}

export function setPlaceCategorySeedsForDay(
  state: StoredHomeState,
  dayId: string,
  seeds: string[],
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const applyToDay = (day: StoredHomeDayRecord): StoredHomeDayRecord =>
    day.id === dayId ? { ...day, placeCategorySeeds: seeds } : day;

  return normalizeStoredHomeState(
    {
      ...state,
      today: applyToDay(state.today),
      archivedDays: state.archivedDays.map(applyToDay),
    },
    profile,
    now
  );
}
