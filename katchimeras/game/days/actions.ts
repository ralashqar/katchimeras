import type {
  AddMomentInput,
  ActivityPermissionState,
  BigMomentType,
  CuisineFamily,
  DayEvidenceProvider,
  DayHeroPhoto,
  DayInputTarget,
  DayPromptAnswer,
  DayPromptKind,
  DayScores,
  DaySleep,
  DayVisionSummary,
  DayWeather,
  FeaturedMemory,
  FoodMeaning,
  HealthPermissionState,
  HomeLocationSource,
  HomeLocationType,
  LocationPermissionState,
  RecentPhotoAsset,
  StepsInterpretation,
  StoredHomeState,
  StudioMediaType,
  StudioMoment,
  StudioRating,
} from '@/types/home';
import { classifyScene, type SceneRead } from '@/utils/scene-classify';
import { detectFoodInText, detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import {
  detectStudioInText,
  detectStudioInVision,
  extractStudioTitle,
  isGenericStudioLabel,
  studioDetectionFromMedia,
  type StudioDetection,
} from '@/utils/studio-detect';

import { applyHealthRoutesToDayRecord, type ImportedHealthRoutesPayload } from './health-routes';
import {
  createDayPromptAnswer,
  createMoment,
  type DayPromptAnswerInput,
} from './moment-factories';
import {
  withActivityPermission,
  withAppendedMoment,
  withCapturedMoment,
  withConfirmedPlace,
  withDayName,
  withDayWeather,
  withDismissedPrompt,
  withFeaturedMemory,
  withFoodMomentMeaning,
  withForegroundLocationSample,
  withGeneratedReflection,
  withHealthPermission,
  withHeroPhotoMeaning,
  withHeroPhotoSelection,
  withLocationPermission,
  withManualBigMoment,
  withManualFoodMoment,
  withManualStudioMoment,
  withNoteMemory,
  withPromptAnswer,
  withSeedCompletion,
  withSleep,
  withStepsInterpretation,
  withStudioMomentRating,
  withTodayStepCount,
} from './mutations';
import { withSeededPhotoLocationsByDay } from './photo-locations';
import { createEmptyStoredDay, readInputDay, writeInputDay } from './records';
import { normalizeStoredHomeState } from './state-normalization';

export type SelectHeroPhotoInput = {
  assetId: string;
  thumbnailUri: string;
  localUri?: string;
};

export function updateLocationPermissionState(
  state: StoredHomeState,
  permission: LocationPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withLocationPermission(state, permission), profile, now);
}

export function updateHealthPermissionState(
  state: StoredHomeState,
  permission: HealthPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withHealthPermission(state, permission), profile, now);
}

export function updateActivityPermissionState(
  state: StoredHomeState,
  permission: ActivityPermissionState,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withActivityPermission(state, permission), profile, now);
}

export function updateTodayStepCount(
  state: StoredHomeState,
  stepsCount: number,
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withTodayStepCount(state, stepsCount), profile, now);
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
  return normalizeStoredHomeState(withForegroundLocationSample(state, sample), profile, now);
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
  const nextDay = withAppendedMoment(base, moment);

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
  const nextDay = withPromptAnswer(base, answer);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function completeSeedForToday(
  state: StoredHomeState,
  seedId: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withSeedCompletion(base, seedId);
  if (nextDay === base) {
    return normalizeStoredHomeState(state, profile, now);
  }

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function confirmPlaceForToday(
  state: StoredHomeState,
  input: { id: string; category: string; archetype: string; label: string; meaningLabel?: string },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withConfirmedPlace(base, input, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function markBigMomentForToday(
  state: StoredHomeState,
  input: { type: BigMomentType; subject?: string | null },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withManualBigMoment(base, input, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function addFoodMomentForToday(
  state: StoredHomeState,
  input: {
    label: string;
    emoji: string;
    meaning: FoodMeaning;
    thumbnailUri?: string | null;
    cuisine?: CuisineFamily | null;
    homeCooked?: boolean;
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withManualFoodMoment(base, input, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setFoodMomentMeaningForToday(
  state: StoredHomeState,
  input: { momentId: string; meaning: FoodMeaning },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withFoodMomentMeaning(base, input);
  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function addStudioMomentForToday(
  state: StoredHomeState,
  input: {
    label: string;
    mediaType: StudioMoment['mediaType'];
    emoji: string;
    rating: StudioRating;
    thumbnailUri?: string | null;
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withManualStudioMoment(base, input, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setStudioMomentRatingForToday(
  state: StoredHomeState,
  input: { momentId: string; rating: StudioRating },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withStudioMomentRating(base, input);
  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setSleepForToday(
  state: StoredHomeState,
  sleep: DaySleep,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withSleep(base, sleep);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setStepsInterpretationForToday(
  state: StoredHomeState,
  input: { movement: StepsInterpretation['movement']; label: string; emoji: string },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withStepsInterpretation(base, input, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setFeaturedMemoryForToday(
  state: StoredHomeState,
  featured: { kind: FeaturedMemory['kind']; assetId?: string; thumbnailUri?: string },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withFeaturedMemory(base, featured, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setDayNameForToday(
  state: StoredHomeState,
  name: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withDayName(base, name);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

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
    media?: { mediaType: StudioMediaType; title: string | null; creator: string | null } | null;
    food?: string | null;
    llmClassified?: boolean;
    intelligenceProvider?: DayEvidenceProvider;
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const foodDetection: FoodDetection = input.llmClassified
    ? input.food
      ? { detected: true, label: input.food }
      : { detected: false }
    : detectFoodInText(input.text);
  const studioDetection = (() => {
    if (input.llmClassified) {
      return input.media
        ? studioDetectionFromMedia(input.media.mediaType, input.media.title)
        : ({ detected: false } as StudioDetection);
    }
    const detection = detectStudioInText(input.text);
    if (!detection.detected || !isGenericStudioLabel(detection.label)) return detection;
    const fromLabel = extractStudioTitle(input.label) ?? (isGenericStudioLabel(input.label) ? null : input.label.trim());
    return fromLabel ? { ...detection, label: fromLabel } : detection;
  })();
  const nextDay = withNoteMemory(base, input, { food: foodDetection, studio: studioDetection }, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function dismissDayPromptForToday(
  state: StoredHomeState,
  kind: DayPromptKind,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withDismissedPrompt(base, kind, now);

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
  const nextDay = withHeroPhotoSelection(base, heroPhoto, photoAnswer);

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

  const nextDay = withHeroPhotoMeaning(base, meaningAnswer);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function seedPhotoLocationsByDay(
  state: StoredHomeState,
  photos: RecentPhotoAsset[],
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withSeededPhotoLocationsByDay(state, photos), profile, now);
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

export function applyCapturedMomentForToday(
  state: StoredHomeState,
  capture: {
    energy: Partial<DayScores>;
    vision: DayVisionSummary | null;
    sourceId?: string | null;
    meaning?: { archetype: string; label: string; thumbnailUri?: string | null; sourceId?: string | null };
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
  const scene = capture.scene ?? classifyScene(capture.vision);
  const foodDetection: FoodDetection =
    scene.type === 'food' ? scene.food ?? detectFoodInVision(capture.vision) : { detected: false };
  const studioDetection: StudioDetection = foodDetection.detected
    ? { detected: false }
    : scene.type === 'media' && scene.media
      ? studioDetectionFromMedia(scene.media.mediaType, scene.media.title)
      : detectStudioInVision(capture.vision);
  const studioDetail = scene.type === 'media' && scene.media?.creator ? `by ${scene.media.creator}` : null;
  const nextDay = withCapturedMoment(
    base,
    capture,
    { food: foodDetection, studio: studioDetection, studioDetail },
    now
  );
  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setDayWeatherForDay(
  state: StoredHomeState,
  dayId: string,
  weather: DayWeather,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  return normalizeStoredHomeState(withDayWeather(state, dayId, weather), profile, now);
}

export function applyGeneratedReflection(
  state: StoredHomeState,
  dayId: string,
  generated: { highlight: string; reflection: string },
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  return normalizeStoredHomeState(withGeneratedReflection(state, dayId, generated), profile, now);
}

export function resetTodayInState(state: StoredHomeState, profile: OnboardingProfile, now: Date): StoredHomeState {
  return { ...state, today: createEmptyStoredDay(now, profile) };
}
