import type {
  BigMomentType,
  DayHeroPhoto,
  DayPromptAnswer,
  DayPromptKind,
  DaySleep,
  FeaturedMemory,
  JournalLocationSelection,
  HatchCheckInEligibilityReason,
  HatchCheckInStatus,
  StepsInterpretation,
  StoredHomeDayRecord,
} from '@/types/home';
import { buildPlaceClassifiedMemory, upsertClassifiedMemory } from '@/utils/intelligence/classification';
import {
  buildHatchCheckInPlan,
  currentHatchCheckInQuestion,
  HATCH_CHECK_IN_FLOWS,
  hatchCheckInDetailChoices,
  hatchCheckInIsComplete,
  hatchCheckInMeaningChoices,
  hatchReflectionMoments,
  resolveHatchCheckInSignals,
} from '@/utils/hatch-check-in';
import { withManualJournalEntry } from './manual-journal';

const MANUAL_BIG_MOMENT_LABEL: Record<BigMomentType, string> = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  firstTime: 'A first',
  holiday: 'Holiday',
  trip: 'A trip',
  achievement: 'An achievement',
  milestone: 'A milestone',
  baby: 'A new baby',
  wedding: 'A wedding',
  graduation: 'A graduation',
  newHome: 'A new home',
  newJob: 'A new job',
  reunion: 'A reunion',
};

export function withPromptAnswer(day: StoredHomeDayRecord, answer: DayPromptAnswer): StoredHomeDayRecord {
  return {
    ...day,
    promptAnswers: [...day.promptAnswers.filter((candidate) => candidate.kind !== answer.kind), answer],
  };
}

export function withStartedHatchCheckIn(
  day: StoredHomeDayRecord,
  eligibilityReason: HatchCheckInEligibilityReason,
  now: Date
): StoredHomeDayRecord {
  if (day.hatchCheckIn) return day;
  const timestamp = now.toISOString();
  const plan = buildHatchCheckInPlan(day, eligibilityReason);
  return {
    ...day,
    hatchCheckIn: {
      planVersion: 2,
      mode: plan.mode,
      questionPlan: plan.questionPlan,
      answeredQuestionIds: [],
      status: 'in_progress',
      eligibilityReason,
      moodId: null,
      moodLabel: null,
      flowId: plan.anchor?.flowId ?? null,
      flowLabel: plan.anchor ? HATCH_CHECK_IN_FLOWS.find((item) => item.id === plan.anchor?.flowId)?.label ?? null : null,
      categoryId: plan.anchor?.categoryId ?? null,
      categoryLabel: plan.anchor?.categoryId
        ? hatchCheckInDetailChoices(plan.anchor.flowId).find((item) => item.id === plan.anchor?.categoryId)?.label ?? null
        : null,
      anchorId: plan.anchor?.id ?? null,
      anchorLabel: plan.anchor?.label ?? null,
      anchorSeedId: plan.anchor?.seedId ?? null,
      meaningId: null,
      meaningLabel: null,
      semanticTags: [],
      scoreBias: {},
      encounterSeedBias: [],
      startedAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    },
  };
}

export function withHatchCheckInAnswer(
  day: StoredHomeDayRecord,
  input: { kind: 'flow' | 'category' | 'moment' | 'meaning'; id: string },
  now: Date
): StoredHomeDayRecord {
  const current = day.hatchCheckIn;
  if (!current || current.status !== 'in_progress') return day;
  const question = currentHatchCheckInQuestion(day);
  if (!question || question.kind !== input.kind) return day;
  let next = {
    ...current,
    updatedAt: now.toISOString(),
    answeredQuestionIds: [...new Set([...(current.answeredQuestionIds ?? []), question.id])],
  };
  if (input.kind === 'flow') {
    const choice = HATCH_CHECK_IN_FLOWS.find((item) => item.id === input.id);
    if (!choice) return day;
    next = { ...next, flowId: choice.id, flowLabel: choice.label, categoryId: null, categoryLabel: null, anchorSeedId: null };
  } else if (input.kind === 'category') {
    const choice = hatchCheckInDetailChoices(current.flowId).find((item) => item.id === input.id);
    if (!choice) return day;
    next = { ...next, categoryId: choice.id, categoryLabel: choice.label, anchorId: `reconstructed:${current.flowId}:${choice.id}`, anchorLabel: choice.label, anchorSeedId: null };
  } else if (input.kind === 'moment') {
    const choice = hatchReflectionMoments(day).find((item) => item.id === input.id);
    if (!choice) return day;
    next = {
      ...next,
      anchorId: choice.id,
      anchorLabel: choice.label,
      anchorSeedId: choice.seedId ?? null,
      flowId: choice.flowId,
      flowLabel: HATCH_CHECK_IN_FLOWS.find((item) => item.id === choice.flowId)?.label ?? null,
      categoryId: choice.categoryId,
      categoryLabel: choice.categoryId ? hatchCheckInDetailChoices(choice.flowId).find((item) => item.id === choice.categoryId)?.label ?? null : null,
      answeredQuestionIds: choice.categoryId
        ? [...new Set([...(next.answeredQuestionIds ?? []), 'evidence.category'])]
        : next.answeredQuestionIds,
    };
  } else {
    const choice = hatchCheckInMeaningChoices(current.flowId).find((item) => item.id === input.id);
    if (!choice) return day;
    next = { ...next, meaningId: choice.id, meaningLabel: choice.label };
  }
  const signals = resolveHatchCheckInSignals(next);
  const selectedJournalId = input.kind === 'moment' && input.id.startsWith('journal:')
    ? input.id.slice('journal:'.length)
    : null;
  return {
    ...day,
    ...(selectedJournalId && (day.journalRecords ?? []).some((record) => record.id === selectedJournalId)
      ? { keyJournalRecordId: selectedJournalId }
      : {}),
    hatchCheckIn: { ...next, ...signals },
  };
}

export function withFinishedHatchCheckIn(
  day: StoredHomeDayRecord,
  requestedStatus: Exclude<HatchCheckInStatus, 'in_progress'>,
  now: Date
): StoredHomeDayRecord {
  const current = day.hatchCheckIn;
  if (!current || current.status !== 'in_progress') return day;
  const answered = (current.answeredQuestionIds?.length ?? 0) > 0 || Boolean(current.moodId || current.flowId || current.categoryId || current.meaningId);
  const status = requestedStatus === 'completed'
    ? (hatchCheckInIsComplete(day) ? 'completed' : answered ? 'partial' : 'skipped')
    : answered ? 'partial' : 'skipped';
  const timestamp = now.toISOString();
  return { ...day, hatchCheckIn: { ...current, status, updatedAt: timestamp, completedAt: timestamp } };
}

export function withDismissedPrompt(
  day: StoredHomeDayRecord,
  kind: DayPromptKind,
  now: Date
): StoredHomeDayRecord {
  return withPromptAnswer(day, {
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
  });
}

export function withSeedCompletion(day: StoredHomeDayRecord, seedId: string): StoredHomeDayRecord {
  if ((day.seedCompletions ?? []).includes(seedId)) {
    return day;
  }
  return {
    ...day,
    seedCompletions: [...(day.seedCompletions ?? []), seedId],
  };
}

export function withConfirmedPlace(
  day: StoredHomeDayRecord,
  input: { id: string; category: string; archetype: string; label: string; meaningLabel?: string },
  now: Date
): StoredHomeDayRecord {
  const existing = (day.confirmedPlaces ?? []).filter((place) => place.id !== input.id);
  return {
    ...day,
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
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [
      buildPlaceClassifiedMemory({
        sourceId: input.id,
        observedAt: now.toISOString(),
        category: input.category,
        meaning: input.meaningLabel ?? input.archetype,
      }),
    ]),
  };
}

export function withSavedDayPlace(
  day: StoredHomeDayRecord,
  input: { location: JournalLocationSelection; detectedNodeId?: string | null },
  now: Date
): StoredHomeDayRecord {
  const location = input.location;
  const existing = (day.confirmedPlaces ?? []).find((place) =>
    (location.placeId && place.placeId === location.placeId) ||
    (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && distanceMeters(
      place.latitude!, place.longitude!, location.latitude, location.longitude
    ) <= 75)
  );
  const id = existing?.id ?? `saved-place-${now.getTime().toString(36)}`;
  const pointId = existing?.locationPointId ?? `saved-location-${id}`;
  const saved = {
    ...(existing ?? {
      id,
      category: 'other_place',
      archetype: 'unassigned',
      label: location.name,
      confirmedAt: now.toISOString(),
    }),
    name: location.name,
    label: location.name,
    latitude: Number(location.latitude.toFixed(6)),
    longitude: Number(location.longitude.toFixed(6)),
    address: location.address ?? null,
    placeId: location.placeId ?? null,
    venueKey: location.venueKey ?? `geo:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
    locality: location.locality ?? null,
    region: location.region ?? null,
    countryCode: location.countryCode ?? null,
    locationSource: input.detectedNodeId ? 'detected' as const : location.source,
    locationPointId: pointId,
    detectedNodeId: input.detectedNodeId ?? existing?.detectedNodeId,
  };
  const point = {
    id: pointId,
    lat: saved.latitude,
    lng: saved.longitude,
    capturedAt: now.toISOString(),
    type: locationTypeForCategory(saved.category),
    hasPhoto: false,
    source: 'manual' as const,
    momentId: null,
    accuracyMeters: location.accuracyMeters ?? undefined,
    label: location.name,
    address: location.address ?? undefined,
    journalRecordId: id,
  };
  return {
    ...day,
    confirmedPlaces: [...(day.confirmedPlaces ?? []).filter((place) => place.id !== id), saved],
    locations: [...(day.locations ?? []).filter((candidate) => candidate.id !== pointId), point].slice(-180),
  };
}

export function withEnrichedDayPlace(
  day: StoredHomeDayRecord,
  input: { id: string; category: string; categoryLabel: string; archetype: string; meaningLabel: string },
  now: Date
): StoredHomeDayRecord {
  const place = day.confirmedPlaces?.find((candidate) => candidate.id === input.id);
  if (!place) return day;
  const nextPlace = {
    ...place,
    category: input.category,
    categoryLabel: input.categoryLabel,
    archetype: input.archetype,
    meaningLabel: input.meaningLabel,
    confirmedAt: now.toISOString(),
  };
  return {
    ...day,
    confirmedPlaces: day.confirmedPlaces?.map((candidate) => candidate.id === input.id ? nextPlace : candidate),
    locations: day.locations.map((point) => point.id === place.locationPointId
      ? { ...point, type: locationTypeForCategory(input.category) }
      : point),
    classifiedMemories: upsertClassifiedMemory(day.classifiedMemories, [
      buildPlaceClassifiedMemory({
        sourceId: input.id,
        observedAt: now.toISOString(),
        category: input.category,
        meaning: input.meaningLabel,
      }),
    ]),
  };
}

export function withRemovedDayPlace(day: StoredHomeDayRecord, id: string): StoredHomeDayRecord {
  const place = day.confirmedPlaces?.find((candidate) => candidate.id === id);
  if (!place) return day;
  return {
    ...day,
    confirmedPlaces: day.confirmedPlaces?.filter((candidate) => candidate.id !== id),
    locations: day.locations.filter((point) => point.id !== place.locationPointId),
    dismissedPlaceCandidateIds: place.detectedNodeId
      ? [...new Set([...(day.dismissedPlaceCandidateIds ?? []), place.detectedNodeId])]
      : day.dismissedPlaceCandidateIds,
  };
}

export function withDismissedPlaceCandidate(day: StoredHomeDayRecord, candidateId: string): StoredHomeDayRecord {
  if (!candidateId || day.dismissedPlaceCandidateIds?.includes(candidateId)) return day;
  return { ...day, dismissedPlaceCandidateIds: [...(day.dismissedPlaceCandidateIds ?? []), candidateId].slice(-40) };
}

function locationTypeForCategory(category: string): 'home' | 'cafe' | 'park' | 'unknown' {
  if (category === 'home') return 'home';
  if (category === 'cafe' || category === 'restaurant') return 'cafe';
  if (category === 'park' || category === 'garden' || category === 'forest') return 'park';
  return 'unknown';
}

function distanceMeters(leftLat: number, leftLng: number, rightLat: number, rightLng: number) {
  const radius = 6_371_000;
  const dLat = (rightLat - leftLat) * Math.PI / 180;
  const dLng = (rightLng - leftLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(leftLat * Math.PI / 180) * Math.cos(rightLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function withManualBigMoment(
  day: StoredHomeDayRecord,
  input: { type: BigMomentType; subject?: string | null },
  now: Date
): StoredHomeDayRecord {
  const moment = {
    id: `big-${now.getTime().toString(36)}-${input.type}`,
    type: input.type,
    label: MANUAL_BIG_MOMENT_LABEL[input.type],
    subject: input.subject ?? null,
    noteId: null,
    createdAt: now.toISOString(),
  };
  return {
    ...day,
    bigMoments: [...(day.bigMoments ?? []).filter((existing) => existing.type !== input.type), moment],
  };
}

export function withSleep(day: StoredHomeDayRecord, sleep: DaySleep, now?: Date): StoredHomeDayRecord {
  return {
    ...day,
    sleep: { ...sleep, recordedAt: sleep.recordedAt ?? now?.toISOString() },
  };
}

export function withStepsInterpretation(
  day: StoredHomeDayRecord,
  input: { movement: StepsInterpretation['movement']; label: string; emoji: string; subtype?: string | null },
  now: Date
): StoredHomeDayRecord {
  const categoryId = movementJournalCategory(input.movement);
  const context = input.subtype ?? movementJournalContext(input.movement);
  return withManualJournalEntry(day, {
    flowId: 'movement',
    path: ['movement', categoryId],
    categoryId,
    canonicalQualityIds: [],
    fields: { specific: input.label, context },
    sourceType: 'manual',
    sourceId: `movement:${day.isoDate}`,
    sessionId: `steps-interpretation:${day.isoDate}`,
    journalSource: {
      kind: 'manual',
      sourceId: `movement:${day.isoDate}`,
      origin: { kind: 'steps_interpretation' },
    },
  }, now);
}

function movementJournalCategory(movement: StepsInterpretation['movement']): string {
  if (movement === 'transit' || movement === 'drive') return 'commute';
  return movement;
}

function movementJournalContext(movement: StepsInterpretation['movement']): string | null {
  if (movement === 'transit') return 'mostly_transit';
  if (movement === 'drive') return 'mostly_driving';
  return null;
}

export function withFeaturedMemory(
  day: StoredHomeDayRecord,
  featured: { kind: FeaturedMemory['kind']; assetId?: string; thumbnailUri?: string },
  now: Date
): StoredHomeDayRecord {
  return {
    ...day,
    featuredMemory: {
      kind: featured.kind,
      assetId: featured.assetId,
      thumbnailUri: featured.thumbnailUri,
      createdAt: now.toISOString(),
    },
  };
}

export function withDayName(day: StoredHomeDayRecord, name: string): StoredHomeDayRecord {
  const trimmed = name.trim().slice(0, 40);
  return {
    ...day,
    dayName: trimmed.length > 0 ? trimmed : undefined,
  };
}

export function withHeroPhotoSelection(
  day: StoredHomeDayRecord,
  heroPhoto: DayHeroPhoto,
  photoAnswer: DayPromptAnswer
): StoredHomeDayRecord {
  return {
    ...day,
    heroPhoto,
    usedPhotoAssetIds: Array.from(new Set([...(day.usedPhotoAssetIds ?? []), heroPhoto.assetId])),
    promptAnswers: [
      ...day.promptAnswers.filter((candidate) => candidate.kind !== 'meaningful_photo'),
      photoAnswer,
    ],
  };
}

export function withHeroPhotoMeaning(
  day: StoredHomeDayRecord,
  answer: DayPromptAnswer
): StoredHomeDayRecord {
  if (!day.heroPhoto) {
    return day;
  }
  return {
    ...day,
    heroPhoto: {
      ...day.heroPhoto,
      meaningChoiceIds: answer.choiceIds,
      meaningLabels: answer.labels,
      noteText: answer.noteText ?? null,
    },
    promptAnswers: [...day.promptAnswers.filter((candidate) => candidate.kind !== 'meaning'), answer],
  };
}
