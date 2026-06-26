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
import { dayPromptRegistry } from '@/constants/day-prompts';
import { timelineDemoEntries } from '@/constants/timeline-demo';
import type {
  AddMomentInput,
  ActivityPermissionState,
  BigMomentType,
  DaySleep,
  CapturedMeaning,
  DayNote,
  DayInputTarget,
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
  DayVisionSummary,
  DayWeather,
  FoodMeaning,
  FoodMoment,
  FoodSource,
  HomeTimelineDay,
  HomeTomorrowRecord,
  InspirationCategory,
  InspirationSelection,
  LocationPermissionState,
  PhotoVisionResult,
  LocalCreatureRecord,
  LocalPathOption,
  DayHeroPhoto,
  DayPromptAnswer,
  DayPromptKind,
  DayPromptAnswerSource,
  DayPromptEncounterBias,
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
import { buildEncounterCreature, recordEncounterHatch } from '@/utils/encounter-engine';
import { selectHatch, makeSeededRng } from '@/utils/hatch-selection';
import { resolveDayLifecycleState } from '@/utils/day-state';
import { curatePhotos } from '@/utils/photo-curation';
import { buildReflectionContext } from '@/utils/reflection-context';
import { resolveVariantCellId } from '@/utils/creature-variant';
import { aggregatePhotoVision, mergeDayVision } from '@/utils/vision-signals';
import { mergeCaptureEnergy } from '@/utils/capture-energy';
import { detectFoodInText, detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import { classifyScene, type SceneRead } from '@/utils/scene-classify';

import type { EncounterHistoryMap } from '@/types/home';

const scoreOrder: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MAX_STORED_DAY_LOCATIONS = 180;
// How many past days the device retains — the depth the Life Map fills in over
// time. The timeline UI still only shows the last 5; this is the storage depth.
const MAX_ARCHIVED_DAYS = 120;
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
// v6 → v7 only added optional fields (storedNonce on days; pickProbability /
// fieldEchoes / birthSignals on creatures), so the stored shape is otherwise
// identical — the migration is a version bump.
type Version6StoredHomeState = Omit<StoredHomeState, 'version'> & { version: 6 };
type UpgradeableStoredHomeState =
  | StoredHomeState
  | Version6StoredHomeState
  | Version5StoredHomeState
  | Version4StoredHomeState
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

export type DayPromptAnswerInput = {
  kind: DayPromptKind;
  choiceIds: string[];
  source?: DayPromptAnswerSource;
  relatedAssetId?: string | null;
  noteText?: string | null;
};

export type SelectHeroPhotoInput = {
  assetId: string;
  thumbnailUri: string;
  localUri?: string;
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
      promptAnswers: [],
      heroPhoto: null,
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
        encounterProfileId: null,
        repeatDepth: 0,
      },
    };
  });

  return {
    version: 7,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
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

// Every persisted day (today + ALL archived days) hydrated to HomeDayRecord,
// sorted oldest → newest. The timeline only hydrates a recent window; the
// calendar + journal need to resolve any past day, so this hydrates the lot.
export function hydrateAllDays(
  storedState: UpgradeableStoredHomeState | null,
  profile: OnboardingProfile,
  now: Date
): HomeDayRecord[] {
  const baseState = storedState ?? createInitialHomeState(profile, now);
  const normalized = normalizeStoredHomeState(baseState, profile, now);
  const weekProfile = computeWeekProfile([...normalized.archivedDays.slice(-4), normalized.today]);
  return [...normalized.archivedDays, normalized.today]
    .map((day) =>
      deriveHomeDayRecord(day, profile, day.id === normalized.today.id, weekProfile, now)
    )
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate));
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

// --- Forming-day input targeting ---------------------------------------------
// Inputs (moments / prompts / captures) normally land on `today`, but once today
// has hatched the user can pre-feed `tomorrow`. These helpers read/write the
// chosen forming day, lazily creating tomorrow's record on first feed.

function tomorrowDateId(now: Date): string {
  return toLocalDateId(shiftLocalDate(now, 1));
}

function ensureTomorrowDay(
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

function readInputDay(
  state: StoredHomeState,
  target: DayInputTarget,
  profile: OnboardingProfile,
  now: Date
): StoredHomeDayRecord {
  return target === 'tomorrow' ? ensureTomorrowDay(state, profile, now) : state.today;
}

function writeInputDay(
  state: StoredHomeState,
  target: DayInputTarget,
  day: StoredHomeDayRecord
): StoredHomeState {
  return target === 'tomorrow' ? { ...state, tomorrow: day } : { ...state, today: day };
}

export function addMomentToDay(
  state: StoredHomeState,
  profile: OnboardingProfile,
  momentInput: AddMomentInput,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const moment = createMoment(momentInput, now);
  const nextLocations = appendPhotoMomentLocation(linkMomentToLatestLocation(base.locations, moment), moment);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    moments: [...base.moments, moment],
    locations: nextLocations,
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function answerDayPromptForToday(
  state: StoredHomeState,
  input: DayPromptAnswerInput,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const answer = createDayPromptAnswer(input, now);
  if (!answer) {
    return normalizeStoredHomeState(state, profile, now);
  }

  const base = readInputDay(state, target, profile, now);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    promptAnswers: [...base.promptAnswers.filter((candidate) => candidate.kind !== answer.kind), answer],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Today Patch V2 — mark a Daily Seed done (the gentle one-tap path). Idempotent:
// re-completing a seed is a no-op. The earned seed grows its reward object on the
// next patch derivation (utils/today-patch-engine.ts).
export function completeSeedForToday(
  state: StoredHomeState,
  seedId: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  if ((base.seedCompletions ?? []).includes(seedId)) {
    return normalizeStoredHomeState(state, profile, now);
  }
  const nextDay: StoredHomeDayRecord = {
    ...base,
    seedCompletions: [...(base.seedCompletions ?? []), seedId],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Confirm a detected place: the user picks what it was (category) + what it meant
// (archetype). Stored per day-map node id so each place is confirmed once; a
// re-confirm of the same node overwrites. Drives the Places cell + clears its "!".
export function confirmPlaceForToday(
  state: StoredHomeState,
  input: { id: string; category: string; archetype: string; label: string; meaningLabel?: string },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const existing = (base.confirmedPlaces ?? []).filter((place) => place.id !== input.id);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    confirmedPlaces: [
      ...existing,
      {
        id: input.id,
        category: input.category,
        archetype: input.archetype,
        label: input.label,
        meaningLabel: input.meaningLabel,
        confirmedAt: now.toISOString(),
      },
    ],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Friendly default label per Big Moment type (manual marking — no note text).
const MANUAL_BIG_MOMENT_LABEL: Record<BigMomentType, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  firstTime: 'A first',
  holiday: 'Holiday',
  trip: 'A trip',
  achievement: 'An achievement',
  milestone: 'A milestone',
};

// Manually mark today as a Big Moment (the Big Moment quest). Appends a Big
// Moment (one per type/day) — which grows a rare landmark on the patch and lifts
// the day's Chronicle. No note required.
export function markBigMomentForToday(
  state: StoredHomeState,
  input: { type: BigMomentType; subject?: string | null },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const moment = {
    id: `big-${now.getTime().toString(36)}-${input.type}`,
    type: input.type,
    label: MANUAL_BIG_MOMENT_LABEL[input.type],
    subject: input.subject ?? null,
    noteId: null,
    createdAt: now.toISOString(),
  };
  const nextDay: StoredHomeDayRecord = {
    ...base,
    bigMoments: [...(base.bigMoments ?? []).filter((existing) => existing.type !== input.type), moment],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Add a food memory (the Food quest / manual add) — grows the Food Vault. Not a
// tracker: just what was tasted/shared, with a meaning. Capped per day.
// Append a food moment, de-duplicated by its source reference (same note or same
// photo never doubles up) and capped. Returns the existing list unchanged if it's
// a duplicate, so callers can append unconditionally.
function appendFoodMoment(existing: FoodMoment[] | undefined, moment: FoodMoment): FoodMoment[] {
  const list = existing ?? [];
  const dupe = list.some(
    (m) =>
      (!!moment.noteId && m.noteId === moment.noteId) ||
      (!!moment.thumbnailUri && m.thumbnailUri === moment.thumbnailUri)
  );
  if (dupe) return list;
  return [...list, moment].slice(-12);
}

// A food's "meaning" inferred from the moment/note's mood archetype, so an
// auto-detected food still lands with a sensible why (the user can add a precise
// one via the manual picker).
function foodMeaningFromArchetype(archetype: string | undefined | null): FoodMeaning {
  switch (archetype) {
    case 'together':
    case 'social':
      return 'sharedMeal';
    case 'meaningful':
      return 'discovery';
    case 'calm':
      return 'comfort';
    case 'energy':
    case 'focus':
      return 'fuel';
    default:
      return 'treat';
  }
}

// Build an auto-detected food moment from a detection + its source reference.
function buildAutoFoodMoment(
  detection: FoodDetection,
  opts: { source: FoodSource; now: Date; archetype?: string | null; thumbnailUri?: string | null; noteId?: string | null; detail?: string | null }
): FoodMoment {
  return {
    id: `food-${opts.now.getTime().toString(36)}-${opts.source}`,
    label: detection.label ?? 'Food',
    emoji: detection.emoji ?? '🍽',
    meaning: foodMeaningFromArchetype(opts.archetype),
    thumbnailUri: opts.thumbnailUri ?? null,
    source: opts.source,
    noteId: opts.noteId ?? null,
    detail: opts.detail ?? null,
    createdAt: opts.now.toISOString(),
  };
}

export function addFoodMomentForToday(
  state: StoredHomeState,
  input: { label: string; emoji: string; meaning: FoodMeaning; thumbnailUri?: string | null },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const moment: FoodMoment = {
    id: `food-${now.getTime().toString(36)}`,
    label: input.label,
    emoji: input.emoji,
    meaning: input.meaning,
    thumbnailUri: input.thumbnailUri ?? null,
    source: 'manual',
    noteId: null,
    detail: null,
    createdAt: now.toISOString(),
  };
  const nextDay: StoredHomeDayRecord = {
    ...base,
    foodMoments: appendFoodMoment(base.foodMoments, moment),
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Set how the day began (sleep atmosphere) — from a one-tap "how was it?" answer
// (source 'manual') or an Apple Health read (source 'appleHealth' + minutes).
export function setSleepForToday(
  state: StoredHomeState,
  sleep: DaySleep,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    sleep,
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Give the day/patch a user-chosen name (the namePatch quest). Display-only — never
// affects scores or hatch. Trimmed + capped; empty clears it.
export function setDayNameForToday(
  state: StoredHomeState,
  name: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const trimmed = name.trim().slice(0, 40);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    dayName: trimmed.length > 0 ? trimmed : undefined,
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Today Patch V3 — attach a written/voice note to the day: a time-capsule entry
// (feeds the Memory Vault + Reflection cells via its inferred mood) plus, when
// the user has confirmed one, a Big Moment that grows a centre landmark.
export function applyNoteForToday(
  state: StoredHomeState,
  input: {
    kind: 'text' | 'voice';
    text: string;
    audioUri?: string | null;
    durationMs?: number | null;
    archetype: string;
    label: string;
    bigMoment?: { type: BigMomentType; subject?: string | null };
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const createdAt = now.toISOString();
  const stamp = `${now.getTime().toString(36)}-${base.notes?.length ?? 0}`;
  const note: DayNote = {
    id: `note-${stamp}`,
    kind: input.kind,
    text: input.text,
    audioUri: input.audioUri ?? null,
    durationMs: input.durationMs ?? null,
    archetype: input.archetype,
    label: input.label,
    createdAt,
  };
  // If the note talks about food, fold it into the Food Vault, keeping a back-
  // reference to the note (so the reader can show where it came from).
  const foodDetection = detectFoodInText(input.text);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    notes: [...(base.notes ?? []), note],
    foodMoments: foodDetection.detected
      ? appendFoodMoment(
          base.foodMoments,
          buildAutoFoodMoment(foodDetection, {
            source: 'note',
            now,
            archetype: input.archetype,
            noteId: note.id,
            detail: input.text.trim().slice(0, 120),
          })
        )
      : base.foodMoments,
    bigMoments: input.bigMoment
      ? [
          ...(base.bigMoments ?? []),
          {
            id: `bm-${stamp}`,
            type: input.bigMoment.type,
            label: input.label,
            subject: input.bigMoment.subject ?? null,
            noteId: note.id,
            createdAt,
          },
        ]
      : base.bigMoments,
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function dismissDayPromptForToday(
  state: StoredHomeState,
  kind: DayPromptKind,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const answer: DayPromptAnswer = {
    id: `prompt-${now.getTime().toString(36)}-${kind}-dismissed`,
    kind,
    choiceIds: [],
    labels: [],
    createdAt: now.toISOString(),
    dismissed: true,
    source: 'prompt_chip',
    semanticTags: [],
    scoreBias: {},
    encounterSeedBias: [],
    relatedAssetId: null,
    noteText: null,
  };

  const base = readInputDay(state, target, profile, now);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    promptAnswers: [...base.promptAnswers.filter((candidate) => candidate.kind !== kind), answer],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function selectHeroPhotoForToday(
  state: StoredHomeState,
  input: SelectHeroPhotoInput,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const heroPhoto: DayHeroPhoto = {
    assetId: input.assetId,
    thumbnailUri: input.thumbnailUri,
    localUri: input.localUri,
    selectedAt: now.toISOString(),
    meaningChoiceIds: [],
    meaningLabels: [],
    noteText: null,
  };
  const photoAnswer: DayPromptAnswer = {
    id: `prompt-${now.getTime().toString(36)}-meaningful_photo`,
    kind: 'meaningful_photo',
    choiceIds: ['selected'],
    labels: ['Meaningful photo'],
    createdAt: now.toISOString(),
    source: 'prompt_chip',
    semanticTags: ['meaningful_photo'],
    scoreBias: { calm: 0.08, focus: 0.06 },
    encounterSeedBias: [],
    relatedAssetId: input.assetId,
    noteText: null,
  };

  const base = readInputDay(state, target, profile, now);
  const nextDay: StoredHomeDayRecord = {
    ...base,
    heroPhoto,
    // Remember this asset so it stops surfacing as a "new photo" prompt.
    usedPhotoAssetIds: Array.from(new Set([...(base.usedPhotoAssetIds ?? []), input.assetId])),
    promptAnswers: [
      ...base.promptAnswers.filter((candidate) => candidate.kind !== 'meaningful_photo'),
      photoAnswer,
    ],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function answerHeroPhotoMeaningForToday(
  state: StoredHomeState,
  input: Omit<DayPromptAnswerInput, 'kind' | 'source' | 'relatedAssetId'>,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const heroPhoto = base.heroPhoto;
  if (!heroPhoto) {
    return answerDayPromptForToday(
      state,
      { ...input, kind: 'meaning', source: 'photo_meaning' },
      profile,
      now,
      target
    );
  }

  const meaningAnswer = createDayPromptAnswer(
    {
      ...input,
      kind: 'meaning',
      source: 'photo_meaning',
      relatedAssetId: heroPhoto.assetId,
    },
    now
  );
  if (!meaningAnswer) {
    return normalizeStoredHomeState(state, profile, now);
  }

  const nextDay: StoredHomeDayRecord = {
    ...base,
    heroPhoto: {
      ...heroPhoto,
      meaningChoiceIds: meaningAnswer.choiceIds,
      meaningLabels: meaningAnswer.labels,
      noteText: meaningAnswer.noteText ?? null,
    },
    promptAnswers: [...base.promptAnswers.filter((candidate) => candidate.kind !== 'meaning'), meaningAnswer],
  };

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Routes each geotagged photo to the day it was actually taken - today or a
// matching archived day - using the photo's real capture time so travel paths
// order correctly. Hatched days are never rewritten. Replaces the old
// today-only seeder, which dumped every recent photo onto today and faked the
// timestamp (so last week's photo appeared on today's map).
export function seedPhotoLocationsByDay(
  state: StoredHomeState,
  photos: RecentPhotoAsset[],
  profile: OnboardingProfile,
  now: Date
) {
  type NormalizedPhoto = Omit<RecentPhotoAsset, 'latitude' | 'longitude'> & {
    latitude: number;
    longitude: number;
  };
  // Curate before anything enters the day: screenshots, burst duplicates, and
  // tiny throwaways never become locations, so the map (and the roll the user
  // sees) stays composed of keepers only. Pure metadata work — no pixels move.
  const keepers = curatePhotos(photos).keepers;
  const geotaggedByDate = new Map<string, NormalizedPhoto[]>();
  keepers
    .map((photo) => ({
      ...photo,
      latitude: normalizeCoordinate(photo.latitude),
      longitude: normalizeCoordinate(photo.longitude),
    }))
    .filter((photo): photo is NormalizedPhoto => photo.latitude != null && photo.longitude != null)
    .forEach((photo) => {
      const dateId = toLocalDateId(new Date(photo.createdAt));
      const bucket = geotaggedByDate.get(dateId) ?? [];
      bucket.push(photo);
      geotaggedByDate.set(dateId, bucket);
    });

  if (geotaggedByDate.size === 0) {
    return normalizeStoredHomeState(state, profile, now);
  }

  const applyToDay = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    if (day.creature) {
      return day;
    }
    const bucket = geotaggedByDate.get(day.isoDate);
    if (!bucket || bucket.length === 0) {
      return day;
    }

    const nextLocations = [...day.locations];
    [...bucket]
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(-MAX_STORED_DAY_LOCATIONS)
      .forEach((photo) => {
        const seededPoint: StoredHomeLocationPoint = {
          id: `camera-roll-photo-${photo.id}`,
          lat: Number(photo.latitude.toFixed(6)),
          lng: Number(photo.longitude.toFixed(6)),
          capturedAt: new Date(photo.createdAt).toISOString(),
          type: 'unknown',
          hasPhoto: true,
          source: 'photo_attachment',
          momentId: null,
          thumbnailUri: photo.thumbnailUri || photo.uri,
          similarityHash: photo.similarityHash,
          meanLuminance: photo.meanLuminance,
          luminanceRange: photo.luminanceRange,
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

    // Aggregate any on-device vision reads from this day's keeper photos into a
    // day-level summary the encounter engine can match on (scenes, signs,
    // faces). Absent until the native vision module has analysed the frames.
    const visionResults = bucket
      .map((photo) => photo.vision)
      .filter((result): result is PhotoVisionResult => result != null);
    const nextVision = visionResults.length > 0 ? aggregatePhotoVision(visionResults) : day.vision;

    return { ...day, locations: nextLocations.slice(-MAX_STORED_DAY_LOCATIONS), vision: nextVision };
  };

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
    const todayState = resolveDayState(state.today, now, resolveHatchHour(profile));
    if (todayState !== 'ready_to_hatch') {
      return state;
    }

    const hatchedToday = finalizeDayHatch(
      state.today,
      profile,
      now,
      state.encounterHistory,
      state.archivedDays
    );

    return normalizeStoredHomeState(
      {
        ...state,
        encounterHistory: recordHatchedEncounter(state.encounterHistory, hatchedToday),
        today: hatchedToday,
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
  if (resolveDayState(target, now, resolveHatchHour(profile)) !== 'ready_to_hatch') {
    return state;
  }

  const nextArchived = [...state.archivedDays];
  const pastDays = [state.today, ...state.archivedDays].filter((entry) => entry.id !== dayId);
  const hatchedDay = finalizeDayHatch(target, profile, now, state.encounterHistory, pastDays);
  nextArchived[archivedIndex] = hatchedDay;

  return normalizeStoredHomeState(
    {
      ...state,
      encounterHistory: recordHatchedEncounter(state.encounterHistory, hatchedDay),
      archivedDays: nextArchived,
    },
    profile,
    now
  );
}

function recordHatchedEncounter(history: EncounterHistoryMap, day: StoredHomeDayRecord) {
  if (!day.creature?.encounterProfileId) {
    return history;
  }
  return recordEncounterHatch(history, day.creature.encounterProfileId, day.isoDate);
}

// Replaces demo-seed history (or empty past days) with real reconstructed
// days from pedometer history and photo geotags. Days the user already lived
// in the app (hatched, or carrying real data) are never overwritten - real
// days only merge in extra steps/locations they were missing.
export function applyBackfilledDays(
  state: StoredHomeState,
  backfilled: {
    isoDate: string;
    stepsCount: number;
    locations: StoredHomeLocationPoint[];
    vision?: DayVisionSummary | null;
  }[],
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
        // Carry the on-device vision read so a later hatch picks the creature the
        // photos actually showed (and the quote can name it) — without it the
        // reconstructed day falls back to a generic step/place creature.
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

// One camera capture's contribution to today: its captured energy (score
// deltas) accumulate, and its detected subject folds into the day's vision.
// Best-effort no-op once the day has hatched.
export function applyCapturedMomentForToday(
  state: StoredHomeState,
  capture: {
    energy: Partial<DayScores>;
    vision: DayVisionSummary | null;
    meaning?: { archetype: string; label: string; thumbnailUri?: string | null };
    // Optional pre-resolved hierarchical scene (Apple Foundation Models LLM) from
    // the capture screen. When absent we classify with the rule engine here.
    scene?: SceneRead;
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  if (base.state === 'hatched') {
    return state;
  }
  const meaning = capture.meaning;
  // Hierarchical read of the snapped photo: classify the scene (LLM if the screen
  // resolved one, else the rule engine), then act on the branch. Food scenes fold
  // straight into the Food Vault (referencing the photo's thumbnail) — no prompt.
  const scene = capture.scene ?? classifyScene(capture.vision);
  const foodDetection: FoodDetection =
    scene.type === 'food' ? scene.food ?? detectFoodInVision(capture.vision) : { detected: false };
  const nextDay: StoredHomeDayRecord = {
    ...base,
    capturedEnergy: mergeCaptureEnergy(base.capturedEnergy, capture.energy),
    capturedMeanings:
      meaning && meaning.label.trim()
        ? appendCapturedMeaning(base.capturedMeanings, {
            archetype: meaning.archetype,
            label: meaning.label.trim(),
            thumbnailUri: meaning.thumbnailUri ?? null,
            createdAt: now.toISOString(),
          })
        : base.capturedMeanings,
    vision: capture.vision ? mergeDayVision(base.vision, capture.vision) : base.vision,
    foodMoments: foodDetection.detected
      ? appendFoodMoment(
          base.foodMoments,
          buildAutoFoodMoment(foodDetection, {
            source: 'photo',
            now,
            archetype: meaning?.archetype,
            thumbnailUri: meaning?.thumbnailUri ?? null,
          })
        )
      : base.foodMoments,
  };
  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

// Append a captured meaning, de-duplicated by label (latest wins) and capped so
// a day's list can't grow without bound.
function appendCapturedMeaning(existing: CapturedMeaning[] | undefined, entry: CapturedMeaning): CapturedMeaning[] {
  const filtered = (existing ?? []).filter((item) => item.label.toLowerCase() !== entry.label.toLowerCase());
  return [...filtered, entry].slice(-12);
}

export function setDayWeatherForDay(
  state: StoredHomeState,
  dayId: string,
  weather: DayWeather,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const applyToDay = (day: StoredHomeDayRecord): StoredHomeDayRecord =>
    day.id === dayId ? { ...day, weather } : day;

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

export function applyGeneratedReflection(
  state: StoredHomeState,
  dayId: string,
  generated: { highlight: string; reflection: string },
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const applyToDay = (day: StoredHomeDayRecord): StoredHomeDayRecord => {
    if (day.id !== dayId || !day.creature || day.creature.reflectionSource === 'generated') {
      return day;
    }

    return {
      ...day,
      creature: {
        ...day.creature,
        highlight: generated.highlight,
        reflection: generated.reflection,
        reflectionSource: 'generated',
      },
    };
  };

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

export function deriveHomeDayRecord(
  storedDay: StoredHomeDayRecord,
  profile: OnboardingProfile,
  isToday: boolean,
  weekProfile: WeekProfile,
  now: Date
): HomeDayRecord {
  const state = resolveDayState(storedDay, now, resolveHatchHour(profile));
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

// The forming "tomorrow" as a feedable day record — its egg/scores reflect
// whatever has been pre-fed. Used once today has hatched so the Add/Camera
// controls have somewhere to land. Always reports canAddMoments, never canHatch.
export function deriveTomorrowDayRecord(
  state: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
): HomeDayRecord {
  const weekProfile = computeWeekProfile([...state.archivedDays.slice(-4), state.today]);
  const iso = tomorrowDateId(now);
  const stored =
    state.tomorrow && state.tomorrow.isoDate === iso
      ? state.tomorrow
      : { ...createEmptyStoredDay(now, profile), id: `day-${iso}`, isoDate: iso };
  const record = deriveHomeDayRecord(stored, profile, false, weekProfile, now);
  return { ...record, dayLabel: 'Tomorrow', canAddMoments: true, canHatch: false };
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
  const tomorrowDate = tomorrowDateId(now);
  const hatchHour = resolveHatchHour(profile);
  let archivedDays: StoredHomeDayRecord[] = [...upgradedState.archivedDays];
  let today: StoredHomeDayRecord = { ...upgradedState.today };
  let tomorrow: StoredHomeDayRecord | undefined = upgradedState.tomorrow
    ? { ...upgradedState.tomorrow }
    : undefined;

  if (today.isoDate !== todayDateId) {
    archivedDays = [...archivedDays, resolveRolledPastDay(today, profile, now)].slice(-MAX_ARCHIVED_DAYS);
    // The calendar advanced: if we pre-fed a tomorrow whose date is now today,
    // promote it (it carries the moments/energy/vision the user already fed);
    // otherwise start a fresh egg.
    today = tomorrow && tomorrow.isoDate === todayDateId ? tomorrow : createEmptyStoredDay(now, profile);
    tomorrow = undefined;
  }

  // Drop a stale tomorrow (already promoted, or left in the past).
  if (tomorrow && tomorrow.isoDate !== tomorrowDate) {
    tomorrow = undefined;
  }

  today = {
    ...today,
    state: resolveDayState(today, now, hatchHour),
  };

  archivedDays = archivedDays
    .map((day): StoredHomeDayRecord => ({
      ...day,
      state: resolveDayState(day, now, hatchHour),
    }))
    .slice(-MAX_ARCHIVED_DAYS);

  // Archived days are settled — their derived fields (dayMap, place counts) only
  // change when their own locations/moments change. Memoize by signature so a
  // routine state update doesn't re-derive every past day's map (the cross-day
  // new-place scan is otherwise quadratic at this retention depth). Today is the
  // one actively-edited day, so it always recomputes.
  const normalizedArchived: StoredHomeDayRecord[] = [];
  archivedDays.forEach((day) => {
    normalizedArchived.push(updateStoredDayDerivedFields(day, normalizedArchived, now, hatchHour, false));
  });
  const normalizedToday = updateStoredDayDerivedFields(today, normalizedArchived, now, hatchHour, true);
  // The forming tomorrow gets its derived fields too (so its egg reflects what's
  // been fed), but only when something has actually been fed into it.
  const normalizedTomorrow =
    tomorrow && dayHasShape(tomorrow)
      ? updateStoredDayDerivedFields(
          { ...tomorrow, state: 'forming' },
          [...normalizedArchived, normalizedToday],
          now,
          hatchHour,
          false
        )
      : undefined;

  return {
    version: 7,
    locationPermission: upgradedState.locationPermission,
    activityPermission: upgradedState.activityPermission,
    healthPermission: upgradedState.healthPermission,
    encounterHistory: upgradedState.encounterHistory,
    archivedDays: normalizedArchived,
    today: normalizedToday,
    tomorrow: normalizedTomorrow,
    backfilledAt: upgradedState.backfilledAt,
  };
}

function resolveRolledPastDay(day: StoredHomeDayRecord, profile: OnboardingProfile, now: Date): StoredHomeDayRecord {
  if (day.state === 'hatched') {
    return day;
  }

  if (!dayHasShape(day)) {
    return {
      ...day,
      state: 'forming',
    };
  }

  if (resolveDayState(day, now, resolveHatchHour(profile)) === 'ready_to_hatch') {
    return day;
  }

  return {
    ...day,
    state: 'ready_to_hatch',
  };
}

// Dev-only: reset just TODAY to a fresh empty day, preserving onboarding, archived
// days, tomorrow, and encounter history. Powers the Dev tab "Reset Today only".
export function resetTodayInState(state: StoredHomeState, profile: OnboardingProfile, now: Date): StoredHomeState {
  return { ...state, today: createEmptyStoredDay(now, profile) };
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
    selectedPathId: null,
    promptAnswers: [],
    heroPhoto: null,
    creature: null,
    storedNonce: makeStoredNonce(now),
  };
}

// A stable per-day nonce, generated once at day creation, that seeds the hatch
// RNG so the probabilistic draw differs day to day yet stays reproducible.
function makeStoredNonce(now: Date): string {
  return `${now.getTime().toString(36)}-${toLocalDateId(now)}`;
}

function upgradeStoredHomeState(inputState: UpgradeableStoredHomeState): StoredHomeState {
  // v7 passthrough and the v6 → v7 bump share a body: the shape is identical
  // apart from the version number (only optional fields were added).
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

function dayInputSignature(day: StoredHomeDayRecord): string {
  return `${day.locations.length}|${day.moments.length}|${day.selectedPathId ?? ''}|${day.creature ? 1 : 0}`;
}

function updateStoredDayDerivedFields(
  day: StoredHomeDayRecord,
  priorDays: StoredHomeDayRecord[],
  now: Date,
  hatchHour: number,
  force: boolean
): StoredHomeDayRecord {
  const signature = dayInputSignature(day);

  // Inputs unchanged since this day was last derived — keep the cached fields
  // and only refresh the time-dependent state (forming → ready as the hour
  // passes). Skips the expensive dayMap derivation and cross-day place scan.
  if (!force && day.derivedSignature === signature) {
    return { ...day, state: resolveDayState(day, now, hatchHour) };
  }

  const dayMap = deriveDayMapSummary(day.locations, day.moments);
  const visitedPlaceCount = dayMap?.nodes.length ?? 0;
  const locationSampleCount = day.locations.length;
  const newPlaceCount = countNewPlacesForDay(dayMap, priorDays);
  const shareReadyAt =
    day.shareReadyAt ??
    (day.creature ? new Date(`${day.isoDate}T21:00:00`).toISOString() : null);

  return {
    ...day,
    state: resolveDayState(day, now, hatchHour),
    visitedPlaceCount,
    newPlaceCount,
    locationSampleCount,
    shareReadyAt,
    derivedSignature: signature,
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
    day.locations.length > 0 ||
    day.promptAnswers.some((answer) => !answer.dismissed) ||
    Boolean(day.heroPhoto)
  );
}

export function resolveHatchHour(profile: OnboardingProfile) {
  const hour = profile.hatchHour ?? HOME_HATCH_HOUR;
  return Math.min(Math.max(Math.round(hour), 17), 23);
}

function resolveDayState(day: StoredHomeDayRecord, now: Date, hatchHour: number): HomeDayState {
  return resolveDayLifecycleState({
    hasCreature: Boolean(day.creature),
    storedState: day.state,
    hasShape: dayHasShape(day),
    isSameDay: day.isoDate === toLocalDateId(now),
    hour: now.getHours(),
    hatchHour,
  });
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

  day.promptAnswers
    .filter((answer) => !answer.dismissed)
    .forEach((answer) => {
      scoreOrder.forEach((key) => {
        nextScores[key] = clampScore(nextScores[key] + (answer.scoreBias[key] ?? 0));
      });
    });

  // Energy captured through the camera (Moment Capture) folds in like a moment.
  if (day.capturedEnergy) {
    scoreOrder.forEach((key) => {
      nextScores[key] = clampScore(nextScores[key] + (day.capturedEnergy?.[key] ?? 0));
    });
  }

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

  // Sleep atmosphere gently colours the day's mood (and so the egg glow + hatch).
  // Never a punishment: good sleep lifts calm + energy; low sleep is just a
  // softer, calmer morning.
  if (day.sleep?.quality === 'good') {
    nextScores.calm = clampScore(nextScores.calm + 0.05);
    nextScores.energy = clampScore(nextScores.energy + 0.05);
  } else if (day.sleep?.quality === 'low') {
    nextScores.calm = clampScore(nextScores.calm + 0.05);
  }

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

function finalizeDayHatch(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  now: Date,
  encounterHistory: EncounterHistoryMap,
  pastDays: readonly StoredHomeDayRecord[] = []
): StoredHomeDayRecord {
  const scores = computeDayScores(day);
  const sortedTraits = [...scoreOrder].sort((left, right) => scores[right] - scores[left]);
  const primaryTrait = sortedTraits[0] ?? 'calm';
  const secondaryTrait = sortedTraits[1] ?? 'focus';

  // Hatch Engine v2: the day's candidate field is drawn probabilistically (not
  // argmax), seeded so the draw is reproducible across re-derivations. The
  // previously-hatched day is demoted so two days rarely hatch the same creature.
  const yesterdayProfileId = resolveYesterdayProfileId(day, pastDays);
  const seed = `${day.isoDate}|${dayInputSignature(day)}|${day.storedNonce ?? ''}`;
  const selection = selectHatch({
    day,
    history: encounterHistory,
    yesterdayProfileId,
    rng: makeSeededRng(seed),
    primaryTrait,
    secondaryTrait,
  });
  if (selection) {
    const encounterCreature = selection.creature;
    // The same mood × bond-depth read that drives the words also selects the
    // creature's expression cutout — computed once here, at hatch, and persisted.
    const context = buildReflectionContext({ ...day, creature: encounterCreature }, pastDays);
    return {
      ...day,
      state: 'hatched',
      shareReadyAt: day.shareReadyAt ?? now.toISOString(),
      creature: {
        ...encounterCreature,
        mood: context.mood,
        bondDepth: context.bondDepth,
        variantCell: resolveVariantCellId(context.mood, context.bondDepth) ?? undefined,
      },
    };
  }

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
      encounterProfileId: null,
      repeatDepth: 0,
    },
  };
}

// The encounterProfileId of the most recent hatched day before this one — fed
// to the v2 selector so consecutive days lean away from repeating a creature.
function resolveYesterdayProfileId(
  day: StoredHomeDayRecord,
  pastDays: readonly StoredHomeDayRecord[]
): string | null {
  let best: StoredHomeDayRecord | null = null;
  for (const candidate of pastDays) {
    if (candidate.isoDate >= day.isoDate || !candidate.creature?.encounterProfileId) {
      continue;
    }
    if (!best || candidate.isoDate > best.isoDate) {
      best = candidate;
    }
  }
  return best?.creature?.encounterProfileId ?? null;
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

function createDayPromptAnswer(input: DayPromptAnswerInput, now: Date): DayPromptAnswer | null {
  const definition = dayPromptRegistry[input.kind];
  if (!definition) {
    return null;
  }

  const options = input.choiceIds
    .map((choiceId) => definition.options.find((option) => option.id === choiceId))
    .filter((option): option is NonNullable<typeof option> => option != null);
  if (input.choiceIds.length > 0 && options.length === 0 && input.kind !== 'meaningful_photo') {
    return null;
  }

  const labels = input.kind === 'meaningful_photo' && options.length === 0 ? ['Meaningful photo'] : options.map((option) => option.label);
  const semanticTags = uniqueStrings(options.flatMap((option) => option.semanticTags));
  const scoreBias = mergeScoreBiases(options.map((option) => option.scoreBias));
  const encounterSeedBias = mergeEncounterBiases(options.flatMap((option) => option.encounterSeedBias ?? []));

  return {
    id: `prompt-${now.getTime().toString(36)}-${input.kind}`,
    kind: input.kind,
    choiceIds: input.choiceIds,
    labels,
    createdAt: now.toISOString(),
    source: input.source ?? 'prompt_chip',
    semanticTags,
    scoreBias,
    encounterSeedBias,
    relatedAssetId: input.relatedAssetId ?? null,
    noteText: input.noteText?.trim() ? input.noteText.trim().slice(0, 240) : null,
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function mergeScoreBiases(biases: Partial<DayScores>[]) {
  return biases.reduce<Partial<DayScores>>((result, bias) => {
    scoreOrder.forEach((key) => {
      const value = bias[key];
      if (typeof value === 'number') {
        result[key] = clampScore((result[key] ?? 0) + value);
      }
    });
    return result;
  }, {});
}

function mergeEncounterBiases(biases: DayPromptEncounterBias[]) {
  const bySeed = new Map<string, number>();
  biases.forEach((bias) => {
    bySeed.set(bias.seedId, Math.max(bySeed.get(bias.seedId) ?? 0, bias.intensity));
  });
  return [...bySeed.entries()].map(([seedId, intensity]) => ({ seedId, intensity: clamp01(intensity) }));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
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
