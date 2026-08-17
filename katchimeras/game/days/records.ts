import type { DayInputTarget, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { toLocalDateId, tomorrowDateId } from './date';

export function createEmptyStoredDay(now: Date, _profile: OnboardingProfile): StoredHomeDayRecord {
  return {
    id: `day-${toLocalDateId(now)}`,
    isoDate: toLocalDateId(now),
    state: 'forming',
    stepsCount: 0,
    stepsCountDayId: toLocalDateId(now),
    stepsUpdatedAt: null,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: null,
    dailyHatch: null,
    legacyEncounter: null,
    card: null,
    growth: { schemaVersion: 1, events: [], careActions: [] },
    storedNonce: makeStoredNonce(now),
  };
}

export function makeStoredNonce(now: Date): string {
  return `${now.getTime().toString(36)}-${toLocalDateId(now)}`;
}

export function ensureTomorrowDay(
  state: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
): StoredHomeDayRecord {
  const iso = tomorrowDateId(now);
  if (state.tomorrow && state.tomorrow.isoDate === iso) {
    return state.tomorrow;
  }
  return { ...createEmptyStoredDay(now, profile), id: `day-${iso}`, isoDate: iso };
}

export function readInputDay(
  state: StoredHomeState,
  target: DayInputTarget,
  profile: OnboardingProfile,
  now: Date
): StoredHomeDayRecord {
  const resolved = resolveInputTarget(state, target);
  if (resolved === 'tomorrow') return ensureTomorrowDay(state, profile, now);
  if (resolved === 'yesterday') {
    const yesterday = toLocalDateId(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
    return state.archivedDays.find((day) => day.isoDate === yesterday) ?? state.today;
  }
  return state.today;
}

export function writeInputDay(
  state: StoredHomeState,
  target: DayInputTarget,
  day: StoredHomeDayRecord
): StoredHomeState {
  const resolved = resolveInputTarget(state, target);
  if (resolved === 'tomorrow') return { ...state, tomorrow: day };
  if (resolved === 'yesterday') {
    return {
      ...state,
      archivedDays: state.archivedDays.map((archived) => archived.isoDate === day.isoDate ? day : archived),
    };
  }
  return { ...state, today: day };
}

export function resolveInputTarget(state: StoredHomeState, target: DayInputTarget): DayInputTarget {
  if (target === 'yesterday') return target;
  return target;
}
