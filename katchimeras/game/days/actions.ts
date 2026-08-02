import type {
  AddMomentInput,
  ActivityPermissionState,
  BigMomentType,
  CuisineFamily,
  DayEvidenceProvider,
  HatchCheckInEligibilityReason,
  HatchCheckInStatus,
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
  UserConfirmation,
  ClassifiedMemory,
  ManualJournalSubmission,
  JournalNoteClassification,
  JournalRouteProposal,
} from '@/types/home';
import { classifyScene, type SceneRead } from '@/utils/scene-classify';
import { rememberPersonalContext } from '@/utils/intelligence/classification';
import {
  confirmationsRejectDomain,
  pruneRejectedDerivedMoments,
} from '@/utils/intelligence/classification-policy';
import { detectFoodInText, detectFoodInVision, type FoodDetection } from '@/utils/food-detect';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { reconcileDaySkySnapshot } from '@/utils/day-sky';
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
  type StepCountReading,
  withActivityPermission,
  withAppendedMoment,
  withCapturedMoment,
  withConfirmedPlace,
  withDismissedPlaceCandidate,
  withEnrichedDayPlace,
  withDayName,
  withDayForegroundLocationSample,
  withDayStepCount,
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
  withManualJournalEntry,
  withRemovedDayPlace,
  withSavedDayPlace,
  withNoteMemory,
  withPromptAnswer,
  withStartedHatchCheckIn,
  withHatchCheckInAnswer,
  withFinishedHatchCheckIn,
  withSeedCompletion,
  withSleep,
  withStepsInterpretation,
  withStudioMomentRating,
  withTodayStepCount,
  type CapturedMomentInput,
} from './mutations';
import { withRefreshedPhotoLocationsForDay, withSeededPhotoLocationsByDay } from './photo-locations';
import { createEmptyStoredDay, readInputDay, writeInputDay } from './records';
import { normalizeStoredHomeState } from './state-normalization';
import { toLocalDateId } from './date';

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
  reading: number | StepCountReading,
  profile: OnboardingProfile,
  now: Date
) {
  const normalizedReading: StepCountReading =
    typeof reading === 'number'
      ? { stepsCount: reading, dayId: toLocalDateId(now), observedAt: now.toISOString() }
      : { ...reading, observedAt: reading.observedAt ?? now.toISOString() };

  const updateMatchingDay = (day: StoredHomeState['today']) => withDayStepCount(day, normalizedReading);
  const nextToday = state.today.isoDate === normalizedReading.dayId ? updateMatchingDay(state.today) : state.today;
  const nextTomorrow =
    state.tomorrow && state.tomorrow.isoDate === normalizedReading.dayId ? updateMatchingDay(state.tomorrow) : state.tomorrow;
  const nextArchivedDays = state.archivedDays.map((day) =>
    day.isoDate === normalizedReading.dayId ? updateMatchingDay(day) : day
  );

  if (nextToday === state.today && nextTomorrow === state.tomorrow && nextArchivedDays.every((day, index) => day === state.archivedDays[index])) {
    return normalizeStoredHomeState(state, profile, now);
  }

  return normalizeStoredHomeState(
    {
      ...state,
      today: nextToday,
      tomorrow: nextTomorrow,
      archivedDays: nextArchivedDays,
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
  const base = readInputDay(state, 'today', profile, now);
  const nextDay = withDayForegroundLocationSample(base, sample);
  if (nextDay === base) {
    return normalizeStoredHomeState(state, profile, now);
  }

  return normalizeStoredHomeState(writeInputDay(state, 'today', nextDay), profile, now);
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

export function startHatchCheckInForDay(
  state: StoredHomeState,
  dayId: string,
  eligibilityReason: HatchCheckInEligibilityReason,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const day = dayById(state, dayId);
  if (!day || day.state === 'hatched') return state;
  return normalizeStoredHomeState(
    replaceDayById(state, dayId, withStartedHatchCheckIn(day, eligibilityReason, now)),
    profile,
    now
  );
}

export function answerHatchCheckInForDay(
  state: StoredHomeState,
  dayId: string,
  input: { kind: 'flow' | 'category' | 'moment' | 'meaning'; id: string },
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const day = dayById(state, dayId);
  if (!day || day.state === 'hatched') return state;
  return normalizeStoredHomeState(
    replaceDayById(state, dayId, withHatchCheckInAnswer(day, input, now)),
    profile,
    now
  );
}

export function finishHatchCheckInForDay(
  state: StoredHomeState,
  dayId: string,
  status: Exclude<HatchCheckInStatus, 'in_progress'>,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const day = dayById(state, dayId);
  if (!day || day.state === 'hatched') return state;
  return normalizeStoredHomeState(
    replaceDayById(state, dayId, withFinishedHatchCheckIn(day, status, now)),
    profile,
    now
  );
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

export function saveDayPlaceForToday(
  state: StoredHomeState,
  input: { location: import('@/types/home').JournalLocationSelection; detectedNodeId?: string | null },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  return normalizeStoredHomeState(writeInputDay(state, target, withSavedDayPlace(base, input, now)), profile, now);
}

export function enrichDayPlaceForToday(
  state: StoredHomeState,
  input: { id: string; category: string; categoryLabel: string; archetype: string; meaningLabel: string },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  return normalizeStoredHomeState(writeInputDay(state, target, withEnrichedDayPlace(base, input, now)), profile, now);
}

export function removeDayPlaceForToday(
  state: StoredHomeState,
  id: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  return normalizeStoredHomeState(writeInputDay(state, target, withRemovedDayPlace(base, id)), profile, now);
}

export function dismissPlaceCandidateForToday(
  state: StoredHomeState,
  candidateId: string,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  return normalizeStoredHomeState(writeInputDay(state, target, withDismissedPlaceCandidate(base, candidateId)), profile, now);
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

export function addManualJournalEntryForToday(
  state: StoredHomeState,
  input: ManualJournalSubmission,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withManualJournalEntry(base, input, now);
  // Journal projection is already a complete, pure day mutation and cannot
  // affect rollover or map-derived fields. Avoid re-normalizing the full
  // archive for a foreground button tap; hydration still owns migrations and
  // lifecycle transitions.
  return writeInputDay(state, target, reconcileDaySkySnapshot(nextDay));
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

export function updateClassifiedMemoryForToday(
  state: StoredHomeState,
  memory: ClassifiedMemory,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const remembered = rememberPersonalContext(state.personalEntities, memory, now);
  const nextDay = pruneRejectedDerivedMoments({
    ...base,
    classifiedMemories: [
      ...(base.classifiedMemories ?? []).filter((candidate) => candidate.id !== remembered.memory.id),
      remembered.memory,
    ],
  }, remembered.memory);
  return normalizeStoredHomeState(
    { ...writeInputDay(state, target, nextDay), personalEntities: remembered.entities },
    profile,
    now
  );
}

export function setSleepForToday(
  state: StoredHomeState,
  sleep: DaySleep,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const nextDay = withSleep(base, sleep, now);

  return normalizeStoredHomeState(writeInputDay(state, target, nextDay), profile, now);
}

export function setStepsInterpretationForToday(
  state: StoredHomeState,
  input: { movement: StepsInterpretation['movement']; label: string; emoji: string; subtype?: string | null },
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
    semanticCategoryId?: string | null;
    semanticConfidence?: number | null;
    semanticEvaluated?: boolean;
    intelligenceProvider?: DayEvidenceProvider;
    journalClassification?: JournalNoteClassification | null;
    journalRoutes?: JournalRouteProposal[];
    suggestedJournalFlowId?: string | null;
    topLevelConfidence?: 'high' | 'medium' | 'low' | null;
    subcategoryConfidence?: 'high' | 'medium' | 'low' | null;
  },
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const foodDetection: FoodDetection = input.llmClassified
    ? input.food
      ? { ...detectFoodInText(input.food), detected: true, label: input.food }
      : { detected: false }
    : detectFoodInText(input.text);
  const studioDetection = (() => {
    if (input.llmClassified || input.semanticCategoryId?.startsWith('media.')) {
      return input.media
        ? studioDetectionFromMedia(input.media.mediaType, input.media.title)
        : ({ detected: false } as StudioDetection);
    }
    if (input.semanticEvaluated) return { detected: false } as StudioDetection;
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
  const inputDay = readInputDay(state, 'today', profile, now);
  return normalizeStoredHomeState(
    withSeededPhotoLocationsByDay(state, photos, {
      todayPhotoTarget: inputDay.id !== state.today.id ? inputDay : null,
    }),
    profile,
    now
  );
}

export function refreshPhotoLocationsForDay(
  state: StoredHomeState,
  dayId: string,
  photos: RecentPhotoAsset[],
  profile: OnboardingProfile,
  now: Date
) {
  return normalizeStoredHomeState(withRefreshedPhotoLocationsForDay(state, dayId, photos), profile, now);
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
  capture: CapturedMomentInput,
  profile: OnboardingProfile,
  now: Date,
  target: DayInputTarget = 'today'
): StoredHomeState {
  const base = readInputDay(state, target, profile, now);
  const evidenceOnly = capture.captureMode === 'evidence_only';
  if (base.state === 'hatched' && !evidenceOnly) {
    return state;
  }
  const applied = applyCaptureToDayRecord(
    state,
    base,
    capture,
    now,
    evidenceOnly ? { allowHatched: true, journalOnly: true } : undefined
  );
  return normalizeStoredHomeState(
    { ...writeInputDay(state, target, applied.day), personalEntities: applied.personalEntities },
    profile,
    now
  );
}

/**
 * Commits a reviewed Photo Library frame to the calendar day it came from.
 * Historical days are already hatched, so they accept the journal/intelligence
 * record without retroactively changing the creature's earned energy.
 */
export function applyCapturedMomentForDay(
  state: StoredHomeState,
  capture: CapturedMomentInput,
  dayId: string,
  profile: OnboardingProfile,
  now: Date,
  observedAt?: string | null
): StoredHomeState {
  const base = dayById(state, dayId);
  if (!base) return normalizeStoredHomeState(state, profile, now);

  const eventDate = validDate(observedAt) ?? now;
  const historical = base.state === 'hatched';
  const applied = applyCaptureToDayRecord(state, base, capture, eventDate, {
    allowHatched: true,
    journalOnly: historical,
  });
  const sourceId = capture.sourceId ?? capture.meaning?.sourceId ?? null;
  const nextDay = sourceId
    ? { ...applied.day, usedPhotoAssetIds: Array.from(new Set([...(applied.day.usedPhotoAssetIds ?? []), sourceId])) }
    : applied.day;
  const nextState = replaceDayById(state, dayId, nextDay);
  return normalizeStoredHomeState(
    { ...nextState, personalEntities: applied.personalEntities },
    profile,
    now
  );
}

function applyCaptureToDayRecord(
  state: StoredHomeState,
  base: StoredHomeState['today'],
  capture: CapturedMomentInput,
  eventDate: Date,
  options: { allowHatched?: boolean; journalOnly?: boolean } = {}
): { day: StoredHomeState['today']; personalEntities: StoredHomeState['personalEntities'] } {
  const meaning = capture.meaning;
  const scene = capture.scene ?? classifyScene(capture.vision);
  const hasJournal = !!capture.journal;
  const foodRejected = confirmationsRejectDomain(capture.confirmations, 'food');
  const mediaRejected = confirmationsRejectDomain(capture.confirmations, 'media');
  const foodDetection: FoodDetection =
    !hasJournal && !foodRejected && scene.type === 'food' ? scene.food ?? detectFoodInVision(capture.vision) : { detected: false };
  const studioDetection: StudioDetection = hasJournal || foodDetection.detected || mediaRejected
    ? { detected: false }
    : scene.type === 'media' && scene.media
      ? studioDetectionFromMedia(scene.media.mediaType, scene.media.title)
      : detectStudioInVision(capture.vision);
  const studioDetail = scene.type === 'media' && scene.media?.creator ? `by ${scene.media.creator}` : null;
  const nextDay = withCapturedMoment(
    base,
    capture,
    { food: foodDetection, studio: studioDetection, studioDetail },
    eventDate,
    options
  );
  const sourceId = capture.sourceId ?? capture.meaning?.sourceId ?? capture.meaning?.thumbnailUri ?? null;
  const classified = sourceId
    ? nextDay.classifiedMemories?.find((memory) => memory.sourceType === 'photo' && memory.sourceId === sourceId)
    : null;
  if (!classified) return { day: nextDay, personalEntities: state.personalEntities };
  const remembered = rememberPersonalContext(state.personalEntities, classified, eventDate);
  const dayWithEntity = {
    ...nextDay,
    classifiedMemories: nextDay.classifiedMemories?.map((memory) =>
      memory.id === remembered.memory.id ? remembered.memory : memory
    ),
  };
  return { day: dayWithEntity, personalEntities: remembered.entities };
}

function dayById(state: StoredHomeState, dayId: string): StoredHomeState['today'] | null {
  if (state.today.id === dayId) return state.today;
  if (state.tomorrow?.id === dayId) return state.tomorrow;
  return state.archivedDays.find((day) => day.id === dayId) ?? null;
}

function replaceDayById(
  state: StoredHomeState,
  dayId: string,
  nextDay: StoredHomeState['today']
): StoredHomeState {
  if (state.today.id === dayId) return { ...state, today: nextDay };
  if (state.tomorrow?.id === dayId) return { ...state, tomorrow: nextDay };
  return {
    ...state,
    archivedDays: state.archivedDays.map((day) => day.id === dayId ? nextDay : day),
  };
}

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
