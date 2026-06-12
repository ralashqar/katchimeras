import { homeMomentOptions } from '@/constants/home-mvp';
import type { HomeMoment, HomeMomentType, StoredHomeState } from '@/types/home';
import { loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';

export type DevScenarioId = 'coffee_day' | 'run_day' | 'thin_day' | 'repeat_park_week';

export const devScenarioOptions: { id: DevScenarioId; label: string }[] = [
  { id: 'coffee_day', label: 'Scenario: coffee day' },
  { id: 'run_day', label: 'Scenario: run day' },
  { id: 'thin_day', label: 'Scenario: thin recovery day' },
  { id: 'repeat_park_week', label: 'Scenario: repeat park week' },
];

// Dev-only: overwrite today's stored day with a synthetic, ready-to-hatch
// scenario so encounter matching can be exercised without living the day.
// Returns false when no stored Home state exists yet (open Home once first).
export function applyDevScenario(scenarioId: DevScenarioId, now: Date): boolean {
  const stored = loadStoredHomeState();
  if (!stored || !('today' in stored)) {
    return false;
  }

  const state = stored as StoredHomeState;
  const isoDate = state.today.isoDate;
  const baseToday = {
    ...state.today,
    state: 'ready_to_hatch' as const,
    creature: null,
    selectedPathId: null,
    moments: [] as HomeMoment[],
    stepsCount: 0,
    exactRouteSegments: [],
    healthRouteImport: null,
  };

  let nextState: StoredHomeState;

  if (scenarioId === 'coffee_day') {
    nextState = {
      ...state,
      today: {
        ...baseToday,
        moments: [makeDevMoment('coffee', now, 0), makeDevMoment('coffee', now, 1)],
        stepsCount: 1600,
      },
    };
  } else if (scenarioId === 'run_day') {
    nextState = {
      ...state,
      today: {
        ...baseToday,
        stepsCount: 9800,
        exactRouteSegments: [
          {
            id: `dev-run-${isoDate}`,
            workoutId: `dev-workout-${isoDate}`,
            activityType: 'running',
            startedAt: now.toISOString(),
            endedAt: now.toISOString(),
            coordinates: [],
          },
        ],
      },
    };
  } else if (scenarioId === 'thin_day') {
    nextState = {
      ...state,
      today: {
        ...baseToday,
        stepsCount: 700,
      },
    };
  } else {
    nextState = {
      ...state,
      encounterHistory: {
        ...state.encounterHistory,
        location_park_mossprout: {
          count: 3,
          lastSeenIsoDate: isoDate,
        },
      },
      today: {
        ...baseToday,
        moments: [makeDevMoment('walk', now, 0)],
        stepsCount: 4200,
      },
    };
  }

  saveStoredHomeState(nextState);
  return true;
}

function makeDevMoment(type: HomeMomentType, now: Date, index: number): HomeMoment {
  const option = homeMomentOptions[type];
  return {
    id: `dev-moment-${now.getTime().toString(36)}-${index}-${type}`,
    type,
    label: option.label,
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: now.toISOString(),
    source: 'quick_tag',
    metadata: null,
  };
}
