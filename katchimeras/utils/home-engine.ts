import { preferenceOptions } from '@/constants/katchadeck';
import {
  HOME_HATCH_HOUR,
  homeCreatureVisuals,
  homeInspirationCategoryBiases,
  homeInspirationCategoryLabels,
  homeInspirationQuotes,
  homeMomentOptions,
  homeNameRoots,
  homeNameSuffixes,
  homeScorePresentation,
  homeVisualPools,
} from '@/constants/home-mvp';
import { timelineDemoEntries } from '@/constants/timeline-demo';
import type {
  AddMomentInput,
  ActivityPermissionState,
  DayScores,
  DayMapSummary,
  EggVisualState,
  HealthPermissionState,
  HomeDayRecord,
  HomeDayState,
  HomeLocationSource,
  HomeLocationType,
  HomeMoment,
  HomeMomentMetadata,
  HomeScoreKey,
  HomeTimelineDay,
  HomeTomorrowRecord,
  InspirationCategory,
  InspirationSelection,
  LocationPermissionState,
  LocalCreatureRecord,
  LocalPathOption,
  RecentPhotoAsset,
  StoredExactRouteSegment,
  StoredHomeDayRecord,
  StoredHomeLocationPoint,
  StoredHealthRouteImportMeta,
  StoredHomeState,
  WeekProfile,
} from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { deriveDayMapSummary } from '@/utils/day-map-engine';

const scoreOrder: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MAX_STORED_DAY_LOCATIONS = 180;
const MAX_HEALTH_ROUTE_SAMPLE_POINTS = 120;
const LOCATION_LINK_WINDOW_MS = 20 * 60 * 1000;
const LOCATION_DEDUPE_WINDOW_MS = 4 * 60 * 1000;
const LOCATION_DEDUPE_DISTANCE_METERS = 65;
const NEW_PLACE_DISTANCE_METERS = 220;
const pathSupportMap: Record<HomeScoreKey, HomeScoreKey> = {
  energy: 'exploration',
  calm: 'focus',
  social: 'calm',
  exploration: 'energy',
  focus: 'calm',
};

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
>;
type Version3StoredHomeDayRecord = Omit<
  StoredHomeDayRecord,
  'stepsCount' | 'visitedPlaceCount' | 'newPlaceCount' | 'locationSampleCount' | 'shareReadyAt'
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
type UpgradeableStoredHomeState =
  | StoredHomeState
  | Version3StoredHomeState
  | Version2StoredHomeState
  | LegacyStoredHomeState;

export type ImportedHealthRoutePoint = {
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export type ImportedHealthRouteSegment = {
  id: string;
  workoutId: string;
  activityType: string;
  startedAt: string;
  endedAt: string;
  coordinates: ImportedHealthRoutePoint[];
};

export type ImportedHealthRoutesPayload = {
  status: 'success' | 'no_data' | 'denied' | 'unavailable' | 'error';
  importedWorkoutCount: number;
  sampledPointCount: number;
  segmentCount: number;
  workoutIds: string[];
  segments?: ImportedHealthRouteSegment[];
  message?: string | null;
};

export function createEmptyScores(): DayScores {
  return {
    energy: 0,
    calm: 0,
    social: 0,
    exploration: 0,
    focus: 0,
  };
}

export function createInitialHomeState(profile: OnboardingProfile, now: Date): StoredHomeState {
  const archivedDays: StoredHomeDayRecord[] = timelineDemoEntries.slice(0, 4).map((entry, index) => {
    const dayDate = shiftLocalDate(now, index - 4);
    const momentType = inferMomentTypeFromEntry(entry.id);
    const moment = createSeedMoment(momentType, dayDate, index);
    const dominant = inferPrimaryTraitFromMoment(momentType);
    const secondary: HomeScoreKey = dominant === 'energy' ? 'focus' : 'calm';

    return {
      id: `seed-${entry.id}`,
      isoDate: toLocalDateId(dayDate),
      state: 'hatched' as const,
      stepsCount: 1800 + index * 1100,
      visitedPlaceCount: 0,
      newPlaceCount: 0,
      locationSampleCount: 0,
      shareReadyAt: new Date(new Date(`${toLocalDateId(dayDate)}T21:00:00`).getTime()).toISOString(),
      moments: [moment],
      locations: createSeedLocations(momentType, dayDate, index, moment.id),
      healthRouteImport: null,
      exactRouteSegments: [],
      selectedPathId: null,
      creature: {
        id: `seed-creature-${entry.creature.id}`,
        name: entry.creature.name,
        primaryTrait: dominant,
        secondaryTrait: secondary,
        rarity: index > 1 ? 'rare' : 'common',
        visualKey: inferVisualKey(entry.creature.id),
        accentColor: entry.creature.accent,
        highlightMomentId: moment.id,
        highlight: entry.summary,
        reflection: entry.memory.body,
        motifTags: [moment.label],
      },
    };
  });

  return {
    version: 4,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    archivedDays,
    today: createEmptyStoredDay(now, profile),
  };
}

export function hydrateHomeState(
  storedState: UpgradeableStoredHomeState | null,
  profile: OnboardingProfile,
  now: Date
): {
  state: StoredHomeState;
  timelineDays: HomeTimelineDay[];
  todayId: string;
} {
  const baseState = storedState ?? createInitialHomeState(profile, now);
  const normalized = normalizeStoredHomeState(baseState, profile, now);
  const weekProfile = computeWeekProfile([
    ...normalized.archivedDays.slice(-4),
    normalized.today,
  ]);
  const archivedDays = normalized.archivedDays.slice(-5).map((day) =>
    deriveHomeDayRecord(day, profile, false, weekProfile, now)
  );
  const today = deriveHomeDayRecord(normalized.today, profile, true, weekProfile, now);

  return {
    state: normalized,
    timelineDays: [...archivedDays, today, createTomorrowRecord(now)],
    todayId: normalized.today.id,
  };
}

export function updateLocationPermissionState(
  state: StoredHomeState,
  permission: LocationPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(
    {
      ...state,
      locationPermission: permission,
    },
    profile,
    now
  );
}

export function updateHealthPermissionState(
  state: StoredHomeState,
  permission: HealthPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(
    {
      ...state,
      healthPermission: permission,
    },
    profile,
    now
  );
}

export function updateActivityPermissionState(
  state: StoredHomeState,
  permission: ActivityPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(
    {
      ...state,
      activityPermission: permission,
    },
    profile,
    now
  );
}

export function updateTodayStepCount(
  state: StoredHomeState,
  stepsCount: number,
  profile: OnboardingProfile,
  now: Date
) {
  if (!Number.isFinite(stepsCount) || stepsCount < 0) {
    return normalizeStoredHomeState(state, profile, now);
  }

  return normalizeStoredHomeState(
    {
      ...state,
      today: {
        ...state.today,
        stepsCount: Math.max(state.today.stepsCount, Math.round(stepsCount)),
      },
    },
    profile,
    now
  );
}

export function recordForegroundLocationSample(
  state: StoredHomeState,
  sample: {
    lat: number;
    lng: number;
    capturedAt: string;
    accuracyMeters?: number;
    type?: HomeLocationType;
    source?: HomeLocationSource;
  },
  profile: OnboardingProfile,
  now: Date
) {
  const nextPoint: StoredHomeLocationPoint = {
    id: `loc-${new Date(sample.capturedAt).getTime().toString(36)}-${Math.abs(
      Math.round(sample.lat * 10000 + sample.lng * 10000)
    ).toString(36)}`,
    lat: Number(sample.lat.toFixed(6)),
    lng: Number(sample.lng.toFixed(6)),
    capturedAt: sample.capturedAt,
    type: sample.type ?? 'unknown',
    hasPhoto: false,
    source: sample.source ?? 'foreground',
    momentId: null,
    accuracyMeters: sample.accuracyMeters ? Number(sample.accuracyMeters.toFixed(1)) : undefined,
  };

  if (shouldSkipLocationSample(state.today.locations, nextPoint)) {
    return normalizeStoredHomeState(state, profile, now);
  }

  return normalizeStoredHomeState(
    {
      ...state,
      today: {
        ...state.today,
        locations: [...state.today.locations, nextPoint].slice(-MAX_STORED_DAY_LOCATIONS),
      },
    },
    profile,
    now
  );
}

export function addMomentToDay(
  state: StoredHomeState,
  profile: OnboardingProfile,
  momentInput: AddMomentInput,
  now: Date
): StoredHomeState {
  const moment = createMoment(momentInput, now);
  const nextLocations = appendPhotoMomentLocation(linkMomentToLatestLocation(state.today.locations, moment), moment);
  const nextToday: StoredHomeDayRecord = {
    ...state.today,
    moments: [...state.today.moments, moment],
    locations: nextLocations,
  };

  return normalizeStoredHomeState(
    {
      ...state,
      today: nextToday,
    },
    profile,
    now
  );
}

export function seedRecentPhotoLocationsForToday(
  state: StoredHomeState,
  photos: RecentPhotoAsset[],
  profile: OnboardingProfile,
  now: Date
) {
  const geotaggedPhotos = photos
    .map((photo) => ({
      ...photo,
      latitude: normalizeCoordinate(photo.latitude),
      longitude: normalizeCoordinate(photo.longitude),
    }))
    .filter((photo) => photo.latitude != null && photo.longitude != null)
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-8);

  if (geotaggedPhotos.length === 0) {
    return normalizeStoredHomeState(state, profile, now);
  }

  const nextLocations = [...state.today.locations];
  geotaggedPhotos.forEach((photo, index) => {
    const seededPoint: StoredHomeLocationPoint = {
      id: `camera-roll-photo-${photo.id}`,
      lat: Number(photo.latitude!.toFixed(6)),
      lng: Number(photo.longitude!.toFixed(6)),
      capturedAt: buildRecentPhotoSeedTimestamp(now, index, geotaggedPhotos.length),
      type: 'unknown',
      hasPhoto: true,
      source: 'photo_attachment',
      momentId: null,
      thumbnailUri: photo.thumbnailUri || photo.uri,
    };
    const existingIndex = nextLocations.findIndex((point) => point.id === seededPoint.id);

    if (existingIndex >= 0) {
      nextLocations[existingIndex] = {
        ...nextLocations[existingIndex],
        ...seededPoint,
        momentId: nextLocations[existingIndex]?.momentId ?? null,
      };
      return;
    }

    nextLocations.push(seededPoint);
  });

  return normalizeStoredHomeState(
    {
      ...state,
      today: {
        ...state.today,
        locations: nextLocations.slice(-MAX_STORED_DAY_LOCATIONS),
      },
    },
    profile,
    now
  );
}

export function importHealthRoutesForDay(
  state: StoredHomeState,
  dayId: string,
  payload: ImportedHealthRoutesPayload,
  profile: OnboardingProfile,
  now: Date
) {
  const nextState =
    state.today.id === dayId
      ? {
          ...state,
          today: applyHealthRoutesToDayRecord(state.today, payload, now),
        }
      : {
          ...state,
          archivedDays: state.archivedDays.map((day) =>
            day.id === dayId ? applyHealthRoutesToDayRecord(day, payload, now) : day
          ),
        };

  return normalizeStoredHomeState(nextState, profile, now);
}

export function selectPathForToday(
  state: StoredHomeState,
  nextPathId: string,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  return normalizeStoredHomeState(
    {
      ...state,
      today: {
        ...state.today,
        selectedPathId: state.today.selectedPathId === nextPathId ? null : nextPathId,
      },
    },
    profile,
    now
  );
}

export function triggerHatchForDay(
  state: StoredHomeState,
  dayId: string,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  if (state.today.id === dayId) {
    const todayState = resolveDayState(state.today, now);
    if (todayState !== 'ready_to_hatch') {
      return state;
    }

    return normalizeStoredHomeState(
      {
        ...state,
        today: finalizeDayHatch(state.today, profile, now),
      },
      profile,
      now
    );
  }

  const archivedIndex = state.archivedDays.findIndex((day) => day.id === dayId);
  if (archivedIndex < 0) {
    return state;
  }

  const target = state.archivedDays[archivedIndex];
  if (resolveDayState(target, now) !== 'ready_to_hatch') {
    return state;
  }

  const nextArchived = [...state.archivedDays];
  nextArchived[archivedIndex] = finalizeDayHatch(target, profile, now);

  return normalizeStoredHomeState(
    {
      ...state,
      archivedDays: nextArchived,
    },
    profile,
    now
  );
}

export function deriveHomeDayRecord(
  storedDay: StoredHomeDayRecord,
  profile: OnboardingProfile,
  isToday: boolean,
  weekProfile: WeekProfile,
  now: Date
): HomeDayRecord {
  const state = resolveDayState(storedDay, now);
  const scores = computeDayScores(storedDay);
  const insightLine = buildInsightLine(weekProfile, profile);
  const pathOptions = buildPathOptions(weekProfile);
  const egg = deriveEggVisualState(scores, storedDay.selectedPathId, profile, state);
  const highlight = storedDay.creature?.highlight ?? buildUnhatchedHighlight(storedDay, state);
  const dayMap = deriveDayMapSummary(storedDay.locations, storedDay.moments);

  return {
    ...storedDay,
    kind: 'day',
    state,
    dayLabel: getDayLabel(storedDay.isoDate, isToday),
    dateLabel: formatDateLabel(storedDay.isoDate),
    isToday,
    scores,
    egg,
    insightLine,
    pathOptions,
    canAddMoments: isToday && state !== 'hatched',
    canHatch: state === 'ready_to_hatch',
    highlight,
    dayMap,
  };
}

export function createTomorrowRecord(now: Date): HomeTomorrowRecord {
  const tomorrowDate = shiftLocalDate(now, 1);

  return {
    kind: 'tomorrow',
    id: 'tomorrow',
    isoDate: toLocalDateId(tomorrowDate),
    dayLabel: 'Tomorrow',
    dateLabel: 'Forming',
    title: 'Not yet formed',
    subtitle: 'Another day needs a little movement before it becomes visible.',
    accentColor: '#D8E2FF',
  };
}

export function getCreatureVisual(visualKey: LocalCreatureRecord['visualKey']) {
  return homeCreatureVisuals[visualKey];
}

export function buildPathOptions(profile: WeekProfile): LocalPathOption[] {
  const sorted = [...scoreOrder].sort((left, right) => profile[left] - profile[right]);
  const contrastKey = sorted[0];
  const reinforcementKey =
    [...scoreOrder].sort((left, right) => profile[right] - profile[left]).find((key) => key !== contrastKey) ??
    sorted[1] ??
    contrastKey;

  return [
    {
      id: `contrast:${contrastKey}`,
      key: contrastKey,
      title: `Path of ${homeScorePresentation[contrastKey].label}`,
      body: homeScorePresentation[contrastKey].contrastBody,
      accentColor: homeScorePresentation[contrastKey].accentColor,
      icon: homeScorePresentation[contrastKey].icon,
    },
    {
      id: `reinforce:${reinforcementKey}`,
      key: reinforcementKey,
      title: `Path of ${homeScorePresentation[reinforcementKey].label}`,
      body: homeScorePresentation[reinforcementKey].reinforcementBody,
      accentColor: homeScorePresentation[reinforcementKey].accentColor,
      icon: homeScorePresentation[reinforcementKey].icon,
    },
  ];
}

export function buildInsightLine(profile: WeekProfile, onboardingProfile: OnboardingProfile) {
  const dominant = [...scoreOrder].sort((left, right) => profile[right] - profile[left])[0] ?? 'calm';
  const quietest = [...scoreOrder].sort((left, right) => profile[left] - profile[right])[0] ?? 'energy';

  if (quietest === 'energy' && profile.energy < 0.18) {
    return 'Your days have been gentler this week, almost waiting for a spark.';
  }

  if (dominant === 'calm') {
    return 'Your days have been calm this week, with a softer center than usual.';
  }

  if (dominant === 'exploration') {
    return 'There is a roaming quality to this week. Newness is starting to leave a mark.';
  }

  if (dominant === 'social') {
    return 'Connection has been shaping your days lately, even in small moments.';
  }

  if (dominant === 'focus') {
    return 'A clearer line has been forming through the week. The days feel more deliberate.';
  }

  if (onboardingProfile.preferenceIds.includes('cozy')) {
    return 'Warm, familiar moments are still doing more shaping than they seem to.';
  }

  return 'There is more momentum in your week than the surface suggests.';
}

function normalizeStoredHomeState(
  inputState: UpgradeableStoredHomeState,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const upgradedState = upgradeStoredHomeState(inputState);
  const todayDateId = toLocalDateId(now);
  let archivedDays: StoredHomeDayRecord[] = [...upgradedState.archivedDays];
  let today: StoredHomeDayRecord = { ...upgradedState.today };

  if (today.isoDate !== todayDateId) {
    archivedDays = [...archivedDays, resolveRolledPastDay(today, profile, now)].slice(-5);
    today = createEmptyStoredDay(now, profile);
  }

  today = {
    ...today,
    state: resolveDayState(today, now),
  };

  archivedDays = archivedDays
    .map((day): StoredHomeDayRecord => ({
      ...day,
      state: resolveDayState(day, now),
    }))
    .slice(-5);

  const normalizedArchived: StoredHomeDayRecord[] = [];
  archivedDays.forEach((day) => {
    normalizedArchived.push(updateStoredDayDerivedFields(day, normalizedArchived, now));
  });
  const normalizedToday = updateStoredDayDerivedFields(today, normalizedArchived, now);

  return {
    version: 4,
    locationPermission: upgradedState.locationPermission,
    activityPermission: upgradedState.activityPermission,
    healthPermission: upgradedState.healthPermission,
    archivedDays: normalizedArchived,
    today: normalizedToday,
  };
}

function resolveRolledPastDay(day: StoredHomeDayRecord, _profile: OnboardingProfile, now: Date): StoredHomeDayRecord {
  if (day.state === 'hatched') {
    return day;
  }

  if (!dayHasShape(day)) {
    return {
      ...day,
      state: 'forming',
    };
  }

  if (resolveDayState(day, now) === 'ready_to_hatch') {
    return day;
  }

  return {
    ...day,
    state: 'ready_to_hatch',
  };
}

function createEmptyStoredDay(now: Date, profile: OnboardingProfile): StoredHomeDayRecord {
  return {
    id: `day-${toLocalDateId(now)}`,
    isoDate: toLocalDateId(now),
    state: 'forming',
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: buildInitialPathId(profile),
    creature: null,
  };
}

function upgradeStoredHomeState(inputState: UpgradeableStoredHomeState): StoredHomeState {
  if ('version' in inputState && inputState.version === 4) {
    return {
      ...inputState,
      archivedDays: inputState.archivedDays.map(ensureHealthRouteFieldsOnDayRecord),
      today: ensureHealthRouteFieldsOnDayRecord(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 3) {
    return {
      version: 4,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: inputState.healthPermission,
      archivedDays: inputState.archivedDays.map(ensureHealthRouteFieldsOnDayRecord),
      today: ensureHealthRouteFieldsOnDayRecord(inputState.today),
    };
  }

  if ('version' in inputState && inputState.version === 2) {
    return {
      version: 4,
      locationPermission: inputState.locationPermission,
      activityPermission: 'unknown',
      healthPermission: 'unknown',
      archivedDays: inputState.archivedDays.map(ensureHealthRouteFieldsOnDayRecord),
      today: ensureHealthRouteFieldsOnDayRecord(inputState.today),
    };
  }

  const legacy = inputState as LegacyStoredHomeState;

  return {
    version: 4,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    archivedDays: legacy.archivedDays.map(ensureHealthRouteFieldsOnDayRecord),
    today: ensureHealthRouteFieldsOnDayRecord(legacy.today),
  };
}

function ensureHealthRouteFieldsOnDayRecord(
  day: StoredHomeDayRecord | Version3StoredHomeDayRecord | Version2StoredHomeDayRecord | LegacyStoredHomeDayRecord
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
  };
}

function applyHealthRoutesToDayRecord(
  day: StoredHomeDayRecord,
  payload: ImportedHealthRoutesPayload,
  now: Date
): StoredHomeDayRecord {
  const nextImportMeta = buildHealthRouteImportMeta(payload, now);

  if (payload.status !== 'success' || !payload.segments || payload.segments.length === 0) {
    return {
      ...day,
      healthRouteImport: nextImportMeta,
    };
  }

  const normalizedSegments = payload.segments
    .map(normalizeImportedHealthRouteSegment)
    .filter((segment) => segment.coordinates.length > 0);

  const baseLocations = day.locations.filter((point) => point.source !== 'health_workout_route');
  const sampledRouteLocations = buildSampledHealthRouteLocations(normalizedSegments, baseLocations);

  return {
    ...day,
    locations: [...baseLocations, ...sampledRouteLocations].slice(-MAX_STORED_DAY_LOCATIONS),
    healthRouteImport: {
      ...nextImportMeta,
      sampledPointCount: sampledRouteLocations.length,
      segmentCount: normalizedSegments.length,
    },
    exactRouteSegments: normalizedSegments,
  };
}

function buildHealthRouteImportMeta(
  payload: ImportedHealthRoutesPayload,
  now: Date
): StoredHealthRouteImportMeta {
  return {
    status: payload.status,
    importedAt: payload.status === 'success' ? now.toISOString() : null,
    workoutIds: payload.workoutIds,
    importedWorkoutCount: payload.importedWorkoutCount,
    sampledPointCount: payload.sampledPointCount,
    segmentCount: payload.segmentCount,
    message: payload.message ?? null,
  };
}

function normalizeImportedHealthRouteSegment(segment: ImportedHealthRouteSegment): StoredExactRouteSegment {
  return {
    ...segment,
    coordinates: segment.coordinates
      .map((coordinate) => ({
        latitude: Number(coordinate.latitude.toFixed(6)),
        longitude: Number(coordinate.longitude.toFixed(6)),
        capturedAt: coordinate.capturedAt,
      }))
      .filter(
        (coordinate) =>
          Number.isFinite(coordinate.latitude) &&
          Number.isFinite(coordinate.longitude) &&
          Boolean(coordinate.capturedAt)
      ),
  };
}

function buildSampledHealthRouteLocations(
  segments: StoredExactRouteSegment[],
  baseLocations: StoredHomeLocationPoint[]
): StoredHomeLocationPoint[] {
  const collectedPoints: StoredHomeLocationPoint[] = [];
  const existingPoints = [...baseLocations];

  for (const segment of segments) {
    const downsampled = downsampleRouteCoordinates(segment.coordinates);
    for (const coordinate of downsampled) {
      if (collectedPoints.length >= MAX_HEALTH_ROUTE_SAMPLE_POINTS) {
        return collectedPoints;
      }

      const nextPoint: StoredHomeLocationPoint = {
        id: `health-route-${segment.workoutId}-${new Date(coordinate.capturedAt).getTime().toString(36)}-${collectedPoints.length.toString(36)}`,
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        capturedAt: coordinate.capturedAt,
        type: classifyHealthRouteLocationType(segment.activityType),
        hasPhoto: false,
        source: 'health_workout_route',
        momentId: null,
      };

      if (isDuplicateImportedHealthRoutePoint([...existingPoints, ...collectedPoints], nextPoint)) {
        continue;
      }

      collectedPoints.push(nextPoint);
    }
  }

  return collectedPoints;
}

function downsampleRouteCoordinates(
  coordinates: StoredExactRouteSegment['coordinates']
): StoredExactRouteSegment['coordinates'] {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const kept: StoredExactRouteSegment['coordinates'] = [coordinates[0]];
  let lastKept = coordinates[0];

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const candidate = coordinates[index];
    const distance = getDistanceMeters(
      lastKept.latitude,
      lastKept.longitude,
      candidate.latitude,
      candidate.longitude
    );
    const elapsedMs = Math.abs(new Date(candidate.capturedAt).getTime() - new Date(lastKept.capturedAt).getTime());

    if (distance >= 100 || elapsedMs >= 120_000) {
      kept.push(candidate);
      lastKept = candidate;
    }
  }

  const lastCoordinate = coordinates[coordinates.length - 1];
  if (kept[kept.length - 1]?.capturedAt !== lastCoordinate.capturedAt) {
    kept.push(lastCoordinate);
  }

  return kept;
}

function isDuplicateImportedHealthRoutePoint(
  existingPoints: StoredHomeLocationPoint[],
  nextPoint: StoredHomeLocationPoint
) {
  return existingPoints.some((point) => {
    const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(nextPoint.capturedAt).getTime());
    const distance = getDistanceMeters(point.lat, point.lng, nextPoint.lat, nextPoint.lng);
    return timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 100;
  });
}

function classifyHealthRouteLocationType(activityType: string): HomeLocationType {
  const normalized = activityType.toLowerCase();
  if (normalized.includes('walk') || normalized.includes('run') || normalized.includes('hike')) {
    return 'park';
  }
  return 'unknown';
}

function shouldSkipLocationSample(existingPoints: StoredHomeLocationPoint[], nextPoint: StoredHomeLocationPoint) {
  const latestPoint = existingPoints[existingPoints.length - 1];
  if (!latestPoint) {
    return false;
  }

  const timeDelta = new Date(nextPoint.capturedAt).getTime() - new Date(latestPoint.capturedAt).getTime();
  const distance = getDistanceMeters(nextPoint.lat, nextPoint.lng, latestPoint.lat, latestPoint.lng);

  return timeDelta >= 0 && timeDelta <= LOCATION_DEDUPE_WINDOW_MS && distance <= LOCATION_DEDUPE_DISTANCE_METERS;
}

function buildRecentPhotoSeedTimestamp(now: Date, index: number, total: number) {
  const base = new Date(now);
  const remaining = total - index - 1;
  base.setSeconds(0, 0);
  base.setMinutes(base.getMinutes() - remaining * 42);
  return base.toISOString();
}

function normalizeCoordinate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function linkMomentToLatestLocation(points: StoredHomeLocationPoint[], moment: HomeMoment) {
  if (points.length === 0) {
    return points;
  }

  const momentTime = new Date(moment.createdAt).getTime();
  const momentType = deriveLocationTypeFromMoment(moment);
  let linked = false;

  const nextPoints = points.map((point, index, collection) => {
    if (linked) {
      return point;
    }

    const pointTime = new Date(point.capturedAt).getTime();
    const isFresh = momentTime >= pointTime && momentTime - pointTime <= LOCATION_LINK_WINDOW_MS;
    const isLatest = index === collection.length - 1;

    if (!isFresh || !isLatest) {
      return point;
    }

    linked = true;
    return {
      ...point,
      hasPhoto: point.hasPhoto || moment.type === 'photo',
      momentId: moment.type === 'photo' || !point.momentId ? moment.id : point.momentId,
      thumbnailUri: moment.type === 'photo' ? moment.metadata?.thumbnailUri ?? point.thumbnailUri : point.thumbnailUri,
      type: momentType ?? point.type,
    };
  });

  return nextPoints;
}

function appendPhotoMomentLocation(points: StoredHomeLocationPoint[], moment: HomeMoment) {
  if (moment.type !== 'photo' || !moment.metadata?.latitude || !moment.metadata?.longitude) {
    return points;
  }

  const attachedPoint: StoredHomeLocationPoint = {
    id: `photo-location-${moment.id}`,
    lat: Number(moment.metadata.latitude.toFixed(6)),
    lng: Number(moment.metadata.longitude.toFixed(6)),
    capturedAt: moment.createdAt,
    type: moment.metadata.locationType ?? 'unknown',
    hasPhoto: true,
    source: 'photo_attachment',
    momentId: moment.id,
    thumbnailUri: moment.metadata.thumbnailUri,
  };

  const hasNearbyPoint = points.some((point) => {
    const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(moment.createdAt).getTime());
    const distance = getDistanceMeters(point.lat, point.lng, attachedPoint.lat, attachedPoint.lng);
    return timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 180;
  });

  if (hasNearbyPoint) {
    return points.map((point) => {
      const timeDelta = Math.abs(new Date(point.capturedAt).getTime() - new Date(moment.createdAt).getTime());
      const distance = getDistanceMeters(point.lat, point.lng, attachedPoint.lat, attachedPoint.lng);

      if (timeDelta <= LOCATION_LINK_WINDOW_MS && distance <= 180) {
        return {
          ...point,
          hasPhoto: true,
          momentId: point.momentId ?? moment.id,
          thumbnailUri: moment.metadata?.thumbnailUri ?? point.thumbnailUri,
        };
      }

      return point;
    });
  }

  return [...points, attachedPoint].slice(-MAX_STORED_DAY_LOCATIONS);
}

function deriveLocationTypeFromMoment(moment: HomeMoment): HomeLocationType | null {
  if (moment.type === 'coffee') {
    return 'cafe';
  }

  if (moment.type === 'walk' || moment.type === 'new_place') {
    return 'park';
  }

  if (moment.type === 'calm' || moment.type === 'focus') {
    return 'home';
  }

  return null;
}

function createSeedLocations(
  momentType: HomeMoment['type'],
  date: Date,
  seedIndex: number,
  momentId: string
): StoredHomeLocationPoint[] {
  const presets = seedLocationPresets[momentType] ?? seedLocationPresets.focus;
  const baseDate = new Date(date);
  baseDate.setHours(9, 0, 0, 0);

  return presets.map((preset, index) => {
    const capturedAt = new Date(baseDate);
    capturedAt.setHours(baseDate.getHours() + index * 3);

    return {
      id: `seed-location-${seedIndex}-${index}`,
      lat: preset.lat,
      lng: preset.lng,
      capturedAt: capturedAt.toISOString(),
      type: preset.type,
      hasPhoto: momentType === 'photo',
      source: 'foreground',
      momentId: index === presets.length - 1 ? momentId : null,
      accuracyMeters: 80,
    };
  });
}

function createFallbackLocationsForStoredDay(day: Pick<StoredHomeDayRecord, 'id' | 'isoDate' | 'moments' | 'creature'>) {
  if (day.moments.length === 0) {
    return [];
  }

  const firstMoment = day.moments[0];
  const dayDate = new Date(`${day.isoDate}T12:00:00`);
  const seedIndex = stableHash(`${day.id}|${day.isoDate}`) % 1000;
  return createSeedLocations(firstMoment.type, dayDate, seedIndex, firstMoment.id);
}

function updateStoredDayDerivedFields(
  day: StoredHomeDayRecord,
  priorDays: StoredHomeDayRecord[],
  now: Date
): StoredHomeDayRecord {
  const dayMap = deriveDayMapSummary(day.locations, day.moments);
  const visitedPlaceCount = dayMap?.nodes.length ?? 0;
  const locationSampleCount = day.locations.length;
  const newPlaceCount = countNewPlacesForDay(dayMap, priorDays);
  const shareReadyAt =
    day.shareReadyAt ??
    (day.creature ? new Date(`${day.isoDate}T21:00:00`).toISOString() : null);

  return {
    ...day,
    state: resolveDayState(day, now),
    visitedPlaceCount,
    newPlaceCount,
    locationSampleCount,
    shareReadyAt,
  };
}

function countNewPlacesForDay(dayMap: DayMapSummary | null, priorDays: StoredHomeDayRecord[]) {
  if (!dayMap || dayMap.nodes.length === 0) {
    return 0;
  }

  const previousLocations = priorDays.flatMap((day) => day.locations);
  if (previousLocations.length === 0) {
    return dayMap.nodes.length;
  }

  return dayMap.nodes.filter((node) => {
    return !previousLocations.some((location) => {
      const distance = getDistanceMeters(node.latitude, node.longitude, location.lat, location.lng);
      return distance <= NEW_PLACE_DISTANCE_METERS;
    });
  }).length;
}

function dayHasShape(day: StoredHomeDayRecord) {
  return (
    day.moments.length > 0 ||
    day.stepsCount > 0 ||
    day.locationSampleCount > 0 ||
    day.visitedPlaceCount > 0 ||
    day.locations.length > 0
  );
}

function buildInitialPathId(profile: OnboardingProfile) {
  if (profile.aspirationId === 'adventurous') {
    return 'contrast:exploration';
  }

  if (profile.aspirationId === 'calm') {
    return 'reinforce:calm';
  }

  return null;
}

function resolveDayState(day: StoredHomeDayRecord, now: Date): HomeDayState {
  if (day.creature) {
    return 'hatched';
  }

  if (day.state === 'ready_to_hatch') {
    return 'ready_to_hatch';
  }

  if (!dayHasShape(day)) {
    return 'forming';
  }

  const sameDay = day.isoDate === toLocalDateId(now);
  if (sameDay && now.getHours() >= HOME_HATCH_HOUR) {
    return 'ready_to_hatch';
  }

  if (!sameDay) {
    return 'ready_to_hatch';
  }

  return 'forming';
}

function computeDayScores(day: StoredHomeDayRecord) {
  const nextScores = createEmptyScores();

  day.moments.forEach((moment) => {
    const option = homeMomentOptions[moment.type];
    scoreOrder.forEach((key) => {
      nextScores[key] = clampScore(nextScores[key] + (option.scoreBias[key] ?? 0));
    });

    if (moment.type === 'inspiration' && moment.metadata?.category) {
      const inspirationBias = homeInspirationCategoryBiases[moment.metadata.category];
      scoreOrder.forEach((key) => {
        nextScores[key] = clampScore(nextScores[key] + (inspirationBias[key] ?? 0));
      });
    }
  });

  const stepEnergy = clampScore(Math.min(day.stepsCount / 5200, 1) * 0.34);
  const placeEnergy = clampScore(Math.min(day.locationSampleCount / 8, 1) * 0.06);
  const explorationFromPlaces = clampScore(
    Math.min(day.newPlaceCount * 0.18 + Math.max(day.visitedPlaceCount - 1, 0) * 0.08, 0.4)
  );
  const calmFromSteadyDay =
    day.locationSampleCount > 0 && day.visitedPlaceCount <= 1 && day.stepsCount < 2400 ? 0.12 : 0;
  const focusFromSteadyDay =
    day.locationSampleCount >= 3 && day.visitedPlaceCount <= 1 ? 0.14 : day.locationSampleCount >= 5 ? 0.06 : 0;

  nextScores.energy = clampScore(nextScores.energy + stepEnergy + placeEnergy);
  nextScores.exploration = clampScore(nextScores.exploration + explorationFromPlaces);
  nextScores.calm = clampScore(nextScores.calm + calmFromSteadyDay);
  nextScores.focus = clampScore(nextScores.focus + focusFromSteadyDay);

  const pathDelta = getPathDelta(day.selectedPathId);
  scoreOrder.forEach((key) => {
    nextScores[key] = clampScore(nextScores[key] + (pathDelta[key] ?? 0));
  });

  return nextScores;
}

function computeWeekProfile(days: StoredHomeDayRecord[]): WeekProfile {
  if (days.length === 0) {
    return createEmptyScores();
  }

  const totals = createEmptyScores();
  days.forEach((day) => {
    const scores = computeDayScores(day);
    scoreOrder.forEach((key) => {
      totals[key] += scores[key];
    });
  });

  return scoreOrder.reduce((result, key) => {
    result[key] = clampScore(totals[key] / days.length);
    return result;
  }, createEmptyScores());
}

function getPathDelta(pathId: string | null): Partial<DayScores> {
  const selectedPath = parsePathId(pathId);
  if (!selectedPath) {
    return {};
  }

  const supportKey = pathSupportMap[selectedPath.key];

  if (selectedPath.mode === 'contrast') {
    return {
      [selectedPath.key]: 0.32,
      [supportKey]: 0.12,
    };
  }

  return {
    [selectedPath.key]: 0.24,
    [supportKey]: 0.08,
  };
}

function deriveEggVisualState(
  scores: DayScores,
  selectedPathId: string | null,
  profile: OnboardingProfile,
  state: HomeDayState
): EggVisualState {
  const dominant = [...scoreOrder].sort((left, right) => scores[right] - scores[left])[0] ?? 'calm';
  const selectedPath = parsePathId(selectedPathId);
  const presentation = homeScorePresentation[dominant];
  const pathPresentation = selectedPath ? homeScorePresentation[selectedPath.key] : null;
  const preferenceAccent = resolvePreferenceAccent(profile);
  const intensity = clampScore(
    scoreOrder.reduce((sum, key) => sum + scores[key], 0) / scoreOrder.length + (selectedPathId ? 0.12 : 0)
  );

  return {
    accentColor: pathPresentation?.accentColor ?? preferenceAccent ?? presentation.accentColor,
    haloColor: pathPresentation?.accentColor ?? presentation.accentColor,
    coreColor: pathPresentation?.coreColor ?? presentation.coreColor,
    intensity,
    shimmer: state === 'ready_to_hatch' || Boolean(selectedPathId),
    swirl: clampScore(scores.energy + scores.exploration * 0.8 + scores.social * 0.4),
    label:
      state === 'ready_to_hatch'
        ? 'Ready to hatch'
        : pathPresentation
          ? `${selectedPath?.mode === 'contrast' ? 'Pulling toward' : 'Leaning into'} ${pathPresentation.label.toLowerCase()}`
        : intensity > 0.5
          ? 'Gathering shape'
          : 'Still forming',
  };
}

function resolvePreferenceAccent(profile: OnboardingProfile) {
  const preference = preferenceOptions.find((option) => profile.preferenceIds.includes(option.id));
  return preference?.palette[1] ?? null;
}

function buildUnhatchedHighlight(day: StoredHomeDayRecord, state: HomeDayState) {
  if (state === 'ready_to_hatch') {
    return 'The day has enough shape now. It is ready to be revealed.';
  }

  if (day.moments.length === 0) {
    if (day.stepsCount >= 1800 && day.newPlaceCount > 0) {
      return 'Movement and a change of place are already bending the egg toward something curious.';
    }

    if (day.stepsCount >= 1800) {
      return 'The day is already gathering motion. The egg has started responding to it.';
    }

    if (day.locationSampleCount > 0) {
      return 'Places have started settling into the egg, even before a moment was added by hand.';
    }

    return 'Nothing has landed in the egg yet, but the day still has room to take shape.';
  }

  const lastMoment = day.moments[day.moments.length - 1];
  if (lastMoment.type === 'inspiration') {
    return 'A line of inspiration settled into the day and changed its tone.';
  }
  return `${lastMoment.label} was the latest thing to settle into the day.`;
}

function finalizeDayHatch(day: StoredHomeDayRecord, profile: OnboardingProfile, now: Date): StoredHomeDayRecord {
  const scores = computeDayScores(day);
  const sortedTraits = [...scoreOrder].sort((left, right) => scores[right] - scores[left]);
  const primaryTrait = sortedTraits[0] ?? 'calm';
  const secondaryTrait = sortedTraits[1] ?? 'focus';
  const signature = [
    day.isoDate,
    ...day.moments.map((moment) => moment.type),
    day.selectedPathId ?? 'none',
  ].join('|');
  const hash = stableHash(signature);
  const rarity = resolveRarity(scores, day.moments);
  const visualPool = homeVisualPools[primaryTrait];
  const visualKey = visualPool[hash % visualPool.length] ?? visualPool[0];
  const roots = homeNameRoots[primaryTrait];
  const suffixes = homeNameSuffixes[secondaryTrait];
  const name = `${roots[hash % roots.length]}${suffixes[(hash >> 3) % suffixes.length]}`;
  const highlightMoment = pickHighlightMoment(day.moments, primaryTrait);
  const accentColor = homeCreatureVisuals[visualKey].accentColor;

  return {
    ...day,
    state: 'hatched',
    shareReadyAt: day.shareReadyAt ?? now.toISOString(),
    creature: {
      id: `creature-${day.isoDate}-${hash}`,
      name,
      primaryTrait,
      secondaryTrait,
      rarity,
      visualKey,
      accentColor,
      highlightMomentId: highlightMoment?.id ?? null,
      highlight: buildHatchedHighlight(day, highlightMoment, primaryTrait),
      reflection: buildReflectionLine(profile, primaryTrait, secondaryTrait, day.selectedPathId),
      motifTags: uniqueMomentLabels(day.moments).slice(0, 2),
    },
  };
}

function resolveRarity(scores: DayScores, moments: HomeMoment[]) {
  const total = scoreOrder.reduce((sum, key) => sum + scores[key], 0);
  const diversityBonus = uniqueMomentLabels(moments).length * 0.14;
  const rarityValue = total + diversityBonus;

  if (rarityValue >= 1.8) {
    return 'legendary';
  }
  if (rarityValue >= 1.4) {
    return 'epic';
  }
  if (rarityValue >= 0.9) {
    return 'rare';
  }
  return 'common';
}

function pickHighlightMoment(moments: HomeMoment[], primaryTrait: HomeScoreKey) {
  const preferredType = preferredMomentTypeForTrait(primaryTrait);
  return [...moments].reverse().find((moment) => moment.type === preferredType) ?? moments[moments.length - 1] ?? null;
}

function buildHatchedHighlight(day: StoredHomeDayRecord, moment: HomeMoment | null, primaryTrait: HomeScoreKey) {
  if (!moment) {
    if (day.stepsCount >= 3200 && day.newPlaceCount > 0) {
      return 'Distance and a changed setting gave the day enough contrast to become something vivid.';
    }

    if (day.stepsCount >= 3200) {
      return 'Movement alone carried enough energy to give the day a visible form.';
    }

    if (day.locationSampleCount > 0) {
      return 'The places you moved through quietly shaped the hatch, even without a saved moment.';
    }

    return 'Even a quieter day left enough behind to become visible.';
  }

  if (moment.type === 'coffee') {
    return 'A warm stop settled into the center of the day and gave it a glow.';
  }
  if (moment.type === 'walk') {
    return 'A little motion gave the day its forward pull.';
  }
  if (moment.type === 'new_place') {
    return 'A change in place bent the day toward something more curious.';
  }
  if (moment.type === 'social') {
    return 'Connection widened the day and softened its edges.';
  }
  if (moment.type === 'calm') {
    return 'Stillness became the part of the day that stayed visible.';
  }
  if (moment.type === 'photo') {
    return 'One image caught the day at the right angle and kept it glowing.';
  }
  if (moment.type === 'inspiration') {
    return 'A small line of meaning gave the day a direction it kept.';
  }

  if (primaryTrait === 'focus') {
    return 'A sharper line ran through the day and held it together.';
  }

  return `${moment.label} ended up defining what the day became.`;
}

function buildReflectionLine(
  profile: OnboardingProfile,
  primary: HomeScoreKey,
  secondary: HomeScoreKey,
  selectedPathId: string | null
) {
  const selectedPath = parsePathId(selectedPathId);

  if (selectedPath && (selectedPath.key === primary || selectedPath.key === secondary)) {
    return `The chosen path kept tugging at the day, and the hatch answered with ${homeScorePresentation[selectedPath.key].label.toLowerCase()}.`;
  }
  if (profile.aspirationId === 'calm' && primary === 'calm') {
    return 'The hatch feels softer, steadier, and more grounded than the week before it.';
  }
  if (profile.aspirationId === 'adventurous' && primary === 'exploration') {
    return 'There is a little more openness here. The day leaned outward and kept the trace of it.';
  }

  return `This hatch carries ${homeScorePresentation[primary].label.toLowerCase()} first, with a quieter thread of ${homeScorePresentation[secondary].label.toLowerCase()} underneath.`;
}

function parsePathId(pathId: string | null): { mode: 'contrast' | 'reinforce'; key: HomeScoreKey } | null {
  if (!pathId) {
    return null;
  }

  const [mode, key] = pathId.split(':') as ['contrast' | 'reinforce' | undefined, HomeScoreKey | undefined];
  if (!mode || !key || !scoreOrder.includes(key)) {
    return null;
  }

  if (mode !== 'contrast' && mode !== 'reinforce') {
    return null;
  }

  return { mode, key };
}

function preferredMomentTypeForTrait(trait: HomeScoreKey) {
  if (trait === 'energy') return 'walk';
  if (trait === 'exploration') return 'new_place';
  if (trait === 'social') return 'social';
  if (trait === 'calm') return 'calm';
  if (trait === 'focus') return 'focus';
  return 'coffee';
}

function createMoment(input: AddMomentInput, now: Date): HomeMoment {
  const option = homeMomentOptions[input.type];
  return {
    id: `moment-${now.getTime().toString(36)}-${input.type}`,
    type: input.type,
    label: resolveMomentLabel(input, option.label),
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: now.toISOString(),
    source: input.type === 'photo' || input.type === 'inspiration' ? input.source : 'quick_tag',
    metadata: resolveMomentMetadata(input),
  };
}

function createSeedMoment(type: HomeMoment['type'], date: Date, index: number): HomeMoment {
  const option = homeMomentOptions[type];
  return {
    id: `seed-moment-${index}-${type}`,
    type,
    label: option.label,
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: date.toISOString(),
    source: 'quick_tag',
    metadata: null,
  };
}

function resolveMomentMetadata(input: AddMomentInput): HomeMomentMetadata | null {
  if (input.type === 'photo' || input.type === 'inspiration') {
    return input.metadata;
  }

  return null;
}

function resolveMomentLabel(input: AddMomentInput, fallbackLabel: string) {
  if (input.type === 'inspiration') {
    return `${homeInspirationCategoryLabels[input.metadata.category]} quote`;
  }

  return fallbackLabel;
}

function inferMomentTypeFromEntry(entryId: string): HomeMoment['type'] {
  if (entryId.includes('walk') || entryId.includes('gym')) {
    return 'walk';
  }
  if (entryId.includes('coffee') || entryId.includes('cafe')) {
    return 'coffee';
  }
  if (entryId.includes('family')) {
    return 'social';
  }
  return 'focus';
}

function inferPrimaryTraitFromMoment(momentType: HomeMoment['type']): HomeScoreKey {
  if (momentType === 'walk') return 'energy';
  if (momentType === 'coffee') return 'calm';
  if (momentType === 'new_place') return 'exploration';
  if (momentType === 'social') return 'social';
  if (momentType === 'focus') return 'focus';
  return 'calm';
}

function inferVisualKey(input: string) {
  if (input === 'voltstep') return 'voltstep';
  if (input === 'hearthsip') return 'hearthsip';
  if (input === 'skysette') return 'skysette';
  if (input === 'creamalume') return 'creamalume';
  if (input === 'pulsepounce') return 'pulsepounce';
  if (input === 'gatherglow') return 'gatherglow';
  return 'glimmuse';
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function uniqueMomentLabels(moments: HomeMoment[]) {
  return Array.from(new Set(moments.map((moment) => moment.label)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

const seedLocationPresets: Record<HomeMoment['type'], readonly { lat: number; lng: number; type: HomeLocationType }[]> = {
  photo: [
    { lat: 51.5084, lng: -0.1276, type: 'unknown' },
    { lat: 51.5106, lng: -0.1202, type: 'park' },
  ],
  inspiration: [
    { lat: 51.5145, lng: -0.1421, type: 'home' },
  ],
  coffee: [
    { lat: 51.5124, lng: -0.1363, type: 'home' },
    { lat: 51.5152, lng: -0.1416, type: 'cafe' },
  ],
  walk: [
    { lat: 51.5062, lng: -0.1165, type: 'park' },
    { lat: 51.5024, lng: -0.1199, type: 'park' },
    { lat: 51.4996, lng: -0.1248, type: 'park' },
  ],
  new_place: [
    { lat: 51.5111, lng: -0.1288, type: 'unknown' },
    { lat: 51.5194, lng: -0.1269, type: 'park' },
  ],
  social: [
    { lat: 51.5139, lng: -0.1352, type: 'cafe' },
    { lat: 51.5172, lng: -0.1317, type: 'unknown' },
  ],
  calm: [
    { lat: 51.5149, lng: -0.1428, type: 'home' },
  ],
  focus: [
    { lat: 51.5157, lng: -0.1412, type: 'home' },
  ],
};

function getDistanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number) {
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(rightLat - leftLat);
  const lngDelta = toRadians(rightLng - leftLng);
  const leftLatRadians = toRadians(leftLat);
  const rightLatRadians = toRadians(rightLat);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(leftLatRadians) * Math.cos(rightLatRadians) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function shiftLocalDate(date: Date, dayOffset: number) {
  const nextDate = new Date(date);
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

export function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

function getDayLabel(isoDate: string, isToday: boolean) {
  if (isToday) {
    return 'Today';
  }
  const date = new Date(`${isoDate}T12:00:00`);
  return weekdayNames[date.getDay()];
}

export function deriveInspirationSelection(
  timelineDays: HomeTimelineDay[],
  requestedCategory?: InspirationCategory,
  now: Date = new Date()
): InspirationSelection {
  const dayRecords = timelineDays.filter((day): day is HomeDayRecord => day.kind === 'day');
  const recentDays = dayRecords.slice(-5);
  const today = dayRecords.find((day) => day.isToday) ?? dayRecords[dayRecords.length - 1] ?? null;
  const yesterday = [...dayRecords].reverse().find((day) => !day.isToday) ?? null;
  const weekProfile = averageTimelineScores(recentDays);
  const dominant = [...scoreOrder].sort((left, right) => weekProfile[right] - weekProfile[left])[0] ?? 'calm';
  const quietest = [...scoreOrder].sort((left, right) => weekProfile[left] - weekProfile[right])[0] ?? 'energy';
  const contextTags = buildInspirationContextTags({ dominant, quietest, today, weekProfile, yesterday });
  const category = requestedCategory ?? inferInspirationCategory(contextTags, dominant, quietest, today);
  const pool = homeInspirationQuotes.filter((quote) => quote.category === category);
  const scored = pool.map((quote) => ({
    quote,
    score: quote.tags.reduce((count, tag) => count + (contextTags.includes(tag) ? 1 : 0), 0),
  }));
  const bestScore = Math.max(...scored.map((entry) => entry.score), 0);
  const candidates = scored.filter((entry) => entry.score === bestScore).map((entry) => entry.quote);
  const selectionPool = candidates.length > 0 ? candidates : pool;
  const signature = [today?.isoDate ?? toLocalDateId(now), category, ...contextTags].join('|');
  const quote = selectionPool[stableHash(signature) % selectionPool.length] ?? pool[0] ?? homeInspirationQuotes[0];

  return {
    quote,
    category,
    contextTags,
    mode: requestedCategory ? 'category' : 'auto',
  };
}

function buildInspirationContextTags({
  dominant,
  quietest,
  today,
  weekProfile,
  yesterday,
}: {
  dominant: HomeScoreKey;
  quietest: HomeScoreKey;
  today: HomeDayRecord | null;
  weekProfile: WeekProfile;
  yesterday: HomeDayRecord | null;
}) {
  const tags = new Set<string>();
  const todayTotal = today ? scoreOrder.reduce((sum, key) => sum + today.scores[key], 0) : 0;
  const yesterdayTotal = yesterday ? scoreOrder.reduce((sum, key) => sum + yesterday.scores[key], 0) : 0;

  if (!today || today.moments.length === 0) {
    tags.add('today_empty');
  }
  if (today && today.moments.length > 0 && today.moments.length <= 2) {
    tags.add('small_progress');
  }
  if (todayTotal < 0.34) {
    tags.add('quiet_day');
  }
  if (weekProfile.energy < 0.18 || quietest === 'energy') {
    tags.add('low_energy');
  }
  if (dominant === 'calm') {
    tags.add('calm_week');
    tags.add('grounded');
  }
  if (dominant === 'social') {
    tags.add('social_week');
    tags.add('gratitude_ready');
  }
  if (dominant === 'exploration') {
    tags.add('exploration_rising');
  }
  if (dominant === 'focus') {
    tags.add('focus_week');
  }
  if (yesterdayTotal > 1.1 || (yesterday && (yesterday.scores.energy > 0.42 || yesterday.scores.social > 0.36))) {
    tags.add('busy_yesterday');
  }
  if (tags.has('busy_yesterday') && tags.has('today_empty')) {
    tags.add('recovery');
  }

  return Array.from(tags).sort();
}

function inferInspirationCategory(
  contextTags: string[],
  dominant: HomeScoreKey,
  quietest: HomeScoreKey,
  today: HomeDayRecord | null
): InspirationCategory {
  if (contextTags.includes('low_energy')) {
    return 'energy';
  }
  if (contextTags.includes('recovery') || contextTags.includes('busy_yesterday')) {
    return 'calm';
  }
  if (!today || today.moments.length === 0) {
    return dominant === 'calm' ? 'reflection' : 'motivation';
  }
  if (dominant === 'social') {
    return 'gratitude';
  }
  if (dominant === 'focus' || dominant === 'exploration' || quietest === 'social') {
    return 'reflection';
  }
  if (dominant === 'calm') {
    return 'calm';
  }
  return 'motivation';
}

function averageTimelineScores(days: HomeDayRecord[]) {
  if (days.length === 0) {
    return createEmptyScores();
  }

  return scoreOrder.reduce((result, key) => {
    result[key] = clampScore(days.reduce((sum, day) => sum + day.scores[key], 0) / days.length);
    return result;
  }, createEmptyScores());
}
