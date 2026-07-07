import type {
  HealthPermissionState,
  LocationPermissionState,
  StoredHomeDayRecord,
  StoredHomeState,
} from '@/types/home';
import { createFallbackLocationsForStoredDay } from './locations';

type LegacyStoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  | 'locations'
  | 'healthRouteImport'
  | 'exactRouteSegments'
  | 'stepsCount'
  | 'visitedPlaceCount'
  | 'newPlaceCount'
  | 'locationSampleCount'
  | 'shareReadyAt'
  | 'promptAnswers'
  | 'heroPhoto'
>;

type Version2StoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  | 'healthRouteImport'
  | 'exactRouteSegments'
  | 'stepsCount'
  | 'visitedPlaceCount'
  | 'newPlaceCount'
  | 'locationSampleCount'
  | 'shareReadyAt'
  | 'promptAnswers'
  | 'heroPhoto'
>;

type Version3StoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  'stepsCount' | 'visitedPlaceCount' | 'newPlaceCount' | 'locationSampleCount' | 'shareReadyAt' | 'promptAnswers' | 'heroPhoto'
>;

type Version2StoredHomeState = {
  version: 2;
  locationPermission: LocationPermissionState;
  archivedDays: Version2StoredHomeDayRecord[];
  today: Version2StoredHomeDayRecord;
};

type Version3StoredHomeState = {
  version: 3;
  locationPermission: LocationPermissionState;
  healthPermission: HealthPermissionState;
  archivedDays: Version3StoredHomeDayRecord[];
  today: Version3StoredHomeDayRecord;
};

type LegacyStoredHomeState = {
  version?: 1;
  archivedDays: LegacyStoredHomeDayRecord[];
  today: LegacyStoredHomeDayRecord;
};

type Version5StoredHomeDayRecord = Omit<StoredHomeDayRecord, 'promptAnswers' | 'heroPhoto'>;

type Version5StoredHomeState = Omit<StoredHomeState, 'version' | 'archivedDays' | 'today'> & {
  version: 5;
  archivedDays: Version5StoredHomeDayRecord[];
  today: Version5StoredHomeDayRecord;
};

type Version4StoredHomeState = Omit<StoredHomeState, 'version' | 'encounterHistory' | 'archivedDays' | 'today'> & {
  version: 4;
  archivedDays: Version5StoredHomeDayRecord[];
  today: Version5StoredHomeDayRecord;
};

// v6 to v7 only added optional fields, so the stored shape is otherwise
// identical. The migration is a version bump plus field backfills.
type Version6StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 6 };

export type UpgradeableStoredHomeState =
  | StoredHomeState
  | Version6StoredHomeState
  | Version5StoredHomeState
  | Version4StoredHomeState
  | Version3StoredHomeState
  | Version2StoredHomeState
  | LegacyStoredHomeState;

export function upgradeStoredHomeState(inputState: UpgradeableStoredHomeState): StoredHomeState {
  if ('version' in inputState && (inputState.version === 7 || inputState.version === 6)) {
    return {
      ...inputState,
      version: 7,
      encounterHistory: inputState.encounterHistory ?? {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
      tomorrow: inputState.tomorrow ? ensureStoredDayFields(inputState.tomorrow) : undefined,
    };
  }

  if ('version' in inputState && inputState.version === 5) {
    return {
      ...inputState,
      version: 7,
      encounterHistory: inputState.encounterHistory ?? {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 4) {
    return {
      ...inputState,
      version: 7,
      encounterHistory: {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 3) {
    return {
      version: 7,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: inputState.healthPermission,
      encounterHistory: {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 2) {
    return {
      version: 7,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: 'unknown',
      encounterHistory: {},
      archivedDays: inputState.archivedDays.map(ensureStoredDayFields),
      today: ensureStoredDayFields(inputState.today),
    };
  }

  const legacy = inputState as LegacyStoredHomeState;

  return {
    version: 7,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
    archivedDays: legacy.archivedDays.map(ensureStoredDayFields),
    today: ensureStoredDayFields(legacy.today),
  };
}

function ensureStoredDayFields(
  day:
    | StoredHomeDayRecord
    | Version5StoredHomeDayRecord
    | Version3StoredHomeDayRecord
    | Version2StoredHomeDayRecord
    | LegacyStoredHomeDayRecord
): StoredHomeDayRecord {
  const existingLocations = 'locations' in day ? day.locations ?? [] : [];
  return {
    ...day,
    stepsCount: 'stepsCount' in day && typeof day.stepsCount === 'number' ? Math.max(0, Math.round(day.stepsCount)) : 0,
    visitedPlaceCount:
      'visitedPlaceCount' in day && typeof day.visitedPlaceCount === 'number'
        ? Math.max(0, Math.round(day.visitedPlaceCount))
        : 0,
    newPlaceCount:
      'newPlaceCount' in day && typeof day.newPlaceCount === 'number' ? Math.max(0, Math.round(day.newPlaceCount)) : 0,
    locationSampleCount:
      'locationSampleCount' in day && typeof day.locationSampleCount === 'number'
        ? Math.max(0, Math.round(day.locationSampleCount))
        : existingLocations.length,
    shareReadyAt: 'shareReadyAt' in day ? day.shareReadyAt ?? null : null,
    locations: existingLocations.length > 0 ? existingLocations : createFallbackLocationsForStoredDay(day),
    healthRouteImport: 'healthRouteImport' in day ? day.healthRouteImport ?? null : null,
    exactRouteSegments: 'exactRouteSegments' in day ? day.exactRouteSegments ?? [] : [],
    promptAnswers: 'promptAnswers' in day && Array.isArray(day.promptAnswers) ? day.promptAnswers : [],
    heroPhoto: 'heroPhoto' in day ? day.heroPhoto ?? null : null,
    creature: day.creature
      ? {
          ...day.creature,
          encounterProfileId: day.creature.encounterProfileId ?? null,
          repeatDepth: day.creature.repeatDepth ?? 0,
        }
      : null,
  };
}
