import type {
  BigMomentType,
  DayHeroPhoto,
  DayPromptAnswer,
  DayPromptKind,
  DaySleep,
  FeaturedMemory,
  StepsInterpretation,
  StoredHomeDayRecord,
} from '@/types/home';

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
  };
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

export function withSleep(day: StoredHomeDayRecord, sleep: DaySleep): StoredHomeDayRecord {
  return {
    ...day,
    sleep,
  };
}

export function withStepsInterpretation(
  day: StoredHomeDayRecord,
  input: { movement: StepsInterpretation['movement']; label: string; emoji: string },
  now: Date
): StoredHomeDayRecord {
  return {
    ...day,
    stepsInterpretation: {
      movement: input.movement,
      label: input.label,
      emoji: input.emoji,
      createdAt: now.toISOString(),
    },
  };
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
