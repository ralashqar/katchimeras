import type {
  CapturedMeaning,
  CuisineFamily,
  FoodMeaning,
  FoodMoment,
  FoodSource,
  StoredHomeDayRecord,
  StudioMoment,
  StudioRating,
  StudioSource,
} from '@/types/home';
import type { FoodDetection } from '@/utils/food-detect';
import type { StudioDetection } from '@/utils/studio-detect';

export function appendFoodMoment(existing: FoodMoment[] | undefined, moment: FoodMoment): FoodMoment[] {
  const list = existing ?? [];
  const dupe = list.some(
    (item) =>
      (!!moment.noteId && item.noteId === moment.noteId) ||
      (!!moment.thumbnailUri && item.thumbnailUri === moment.thumbnailUri)
  );
  if (dupe) return list;
  return [...list, moment].slice(-12);
}

export function buildManualFoodMoment(
  input: {
    label: string;
    emoji: string;
    meaning: FoodMeaning;
    thumbnailUri?: string | null;
    cuisine?: CuisineFamily | null;
    homeCooked?: boolean;
  },
  now: Date
): FoodMoment {
  return {
    id: `food-${now.getTime().toString(36)}`,
    label: input.label,
    emoji: input.emoji,
    meaning: input.meaning,
    thumbnailUri: input.thumbnailUri ?? null,
    source: 'manual',
    noteId: null,
    detail: null,
    cuisine: input.cuisine ?? null,
    homeCooked: input.homeCooked || undefined,
    createdAt: now.toISOString(),
  };
}

export function withManualFoodMoment(
  day: StoredHomeDayRecord,
  input: {
    label: string;
    emoji: string;
    meaning: FoodMeaning;
    thumbnailUri?: string | null;
    cuisine?: CuisineFamily | null;
    homeCooked?: boolean;
  },
  now: Date
): StoredHomeDayRecord {
  return {
    ...day,
    foodMoments: appendFoodMoment(day.foodMoments, buildManualFoodMoment(input, now)),
  };
}

export function buildAutoFoodMoment(
  detection: FoodDetection,
  opts: {
    source: FoodSource;
    now: Date;
    archetype?: string | null;
    thumbnailUri?: string | null;
    noteId?: string | null;
    detail?: string | null;
  }
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
    cuisine: detection.cuisine ?? null,
    createdAt: opts.now.toISOString(),
  };
}

export function updateFoodMomentMeaning(
  moments: FoodMoment[] | undefined,
  input: { momentId: string; meaning: FoodMeaning }
) {
  return (moments ?? []).map((moment) =>
    moment.id === input.momentId ? { ...moment, meaning: input.meaning } : moment
  );
}

export function withFoodMomentMeaning(
  day: StoredHomeDayRecord,
  input: { momentId: string; meaning: FoodMeaning }
): StoredHomeDayRecord {
  return {
    ...day,
    foodMoments: updateFoodMomentMeaning(day.foodMoments, input),
  };
}

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

export function appendStudioMoment(existing: StudioMoment[] | undefined, moment: StudioMoment): StudioMoment[] {
  const list = existing ?? [];
  const dupe = list.some(
    (item) =>
      (!!moment.noteId && item.noteId === moment.noteId) ||
      (!!moment.thumbnailUri && item.thumbnailUri === moment.thumbnailUri)
  );
  if (dupe) return list;
  return [...list, moment].slice(-12);
}

export function buildManualStudioMoment(
  input: {
    label: string;
    mediaType: StudioMoment['mediaType'];
    emoji: string;
    rating: StudioRating;
    thumbnailUri?: string | null;
  },
  now: Date
): StudioMoment {
  return {
    id: `studio-${now.getTime().toString(36)}`,
    label: input.label,
    mediaType: input.mediaType,
    emoji: input.emoji,
    rating: input.rating,
    thumbnailUri: input.thumbnailUri ?? null,
    source: 'manual',
    noteId: null,
    detail: null,
    createdAt: now.toISOString(),
  };
}

export function withManualStudioMoment(
  day: StoredHomeDayRecord,
  input: {
    label: string;
    mediaType: StudioMoment['mediaType'];
    emoji: string;
    rating: StudioRating;
    thumbnailUri?: string | null;
  },
  now: Date
): StoredHomeDayRecord {
  return {
    ...day,
    studioMoments: appendStudioMoment(day.studioMoments, buildManualStudioMoment(input, now)),
  };
}

export function buildAutoStudioMoment(
  detection: StudioDetection,
  opts: {
    source: StudioSource;
    now: Date;
    archetype?: string | null;
    thumbnailUri?: string | null;
    noteId?: string | null;
    detail?: string | null;
  }
): StudioMoment {
  return {
    id: `studio-${opts.now.getTime().toString(36)}-${opts.source}`,
    label: detection.label ?? 'Something',
    mediaType: detection.mediaType ?? 'other',
    emoji: detection.emoji ?? '✨',
    rating: studioRatingFromArchetype(opts.archetype),
    thumbnailUri: opts.thumbnailUri ?? null,
    source: opts.source,
    noteId: opts.noteId ?? null,
    detail: opts.detail ?? null,
    createdAt: opts.now.toISOString(),
  };
}

export function updateStudioMomentRating(
  moments: StudioMoment[] | undefined,
  input: { momentId: string; rating: StudioRating }
) {
  return (moments ?? []).map((moment) =>
    moment.id === input.momentId ? { ...moment, rating: input.rating } : moment
  );
}

export function withStudioMomentRating(
  day: StoredHomeDayRecord,
  input: { momentId: string; rating: StudioRating }
): StoredHomeDayRecord {
  return {
    ...day,
    studioMoments: updateStudioMomentRating(day.studioMoments, input),
  };
}

export function appendCapturedMeaning(
  existing: CapturedMeaning[] | undefined,
  entry: CapturedMeaning
): CapturedMeaning[] {
  const filtered = (existing ?? []).filter((item) => item.label.toLowerCase() !== entry.label.toLowerCase());
  return [...filtered, entry].slice(-12);
}

function studioRatingFromArchetype(archetype: string | undefined | null): StudioRating {
  switch (archetype) {
    case 'meaningful':
      return 'inspired';
    case 'together':
    case 'social':
    case 'calm':
      return 'loved';
    default:
      return 'liked';
  }
}
