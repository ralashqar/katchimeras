import type { StoredHomeDayRecord } from '@/types/home';
import {
  atmospherePresetForWeather,
  clampAtmosphereUnit,
  type AtmosphereSettings,
  type ExpressiveAtmospherePresetId,
} from '@/utils/atmosphere';

export type DayAtmosphereReason = {
  label: string;
  source: 'weather' | 'journal' | 'moment' | 'place' | 'mood' | 'sleep' | 'photo' | 'creature';
  weight: number;
};

export type DayAtmospherePlan = {
  expressive: AtmosphereSettings | null;
  expressiveCandidates: DayExpressiveAtmosphereCandidate[];
  expressiveReasons: DayAtmosphereReason[];
  physical: AtmosphereSettings | null;
  physicalReasons: DayAtmosphereReason[];
  seed: number;
  version: 1;
};

export type DayExpressiveAtmosphereCandidate = {
  preset: Exclude<ExpressiveAtmospherePresetId, 'none'>;
  score: number;
};

type Candidate = DayExpressiveAtmosphereCandidate['preset'];

const CANDIDATE_ORDER: readonly Candidate[] = [
  'celebration_drift',
  'social_ribbons',
  'fireflies',
  'petal_drift',
  'falling_leaves',
  'cozy_embers',
  'idea_sparks',
  'journey_breeze',
  'memory_shimmer',
  'dream_wisps',
  'dandelion_seeds',
  'golden_motes',
  'quiet_dust',
] as const;

const EXPRESSIVE_WIND: Record<Candidate, number> = {
  celebration_drift: 0.12,
  cozy_embers: 0.05,
  dandelion_seeds: 0.22,
  dream_wisps: 0.08,
  falling_leaves: 0.2,
  fireflies: 0.04,
  golden_motes: 0.06,
  idea_sparks: 0.08,
  journey_breeze: 0.38,
  memory_shimmer: 0.04,
  petal_drift: 0.18,
  quiet_dust: 0.025,
  social_ribbons: 0.16,
};

export function resolveDayAtmosphere(day: StoredHomeDayRecord | null | undefined): DayAtmospherePlan {
  const seed = hashDaySeed(day?.id ?? day?.isoDate ?? 'today');
  if (!day) {
    return {
      expressive: null,
      expressiveCandidates: [],
      expressiveReasons: [],
      physical: null,
      physicalReasons: [],
      seed,
      version: 1,
    };
  }

  const recordedWeatherPreset = atmospherePresetForWeather(day.weather?.condition);
  const physicalPreset = recordedWeatherPreset === 'none' && (day.weather?.tempMaxC ?? 0) >= 27
    ? 'heat_shimmer'
    : recordedWeatherPreset;
  const physical = physicalPreset === 'none'
    ? null
    : settings(physicalPreset, physicalPreset === 'storm' ? 0.82 : 0.66, seed, physicalPreset === 'storm' ? 0.34 : 0.18);
  const physicalReasons: DayAtmosphereReason[] = physical
    ? [{ label: weatherReasonLabel(physicalPreset), source: 'weather', weight: 1 }]
    : [];

  const scores = new Map<Candidate, number>();
  const reasons = new Map<Candidate, DayAtmosphereReason[]>();
  const add = (
    preset: Candidate,
    weight: number,
    label: string,
    source: DayAtmosphereReason['source'],
  ) => {
    scores.set(preset, (scores.get(preset) ?? 0) + weight);
    const list = reasons.get(preset) ?? [];
    list.push({ label, source, weight });
    reasons.set(preset, list);
  };

  for (const moment of day.bigMoments ?? []) {
    add('celebration_drift', 10, 'A confirmed milestone or celebration', 'journal');
    if (moment.type === 'reunion' || moment.type === 'wedding' || moment.type === 'baby') {
      add('social_ribbons', 6, 'A meaningful shared life event', 'journal');
    }
  }

  const promptTags = day.promptAnswers
    .filter((answer) => !answer.dismissed)
    .flatMap((answer) => [...answer.semanticTags, ...answer.choiceIds]);
  const mood = [...day.promptAnswers]
    .reverse()
    .find((answer) => !answer.dismissed && answer.kind === 'feeling')
    ?.choiceIds[0] ?? null;

  if (mood === 'energized') add('golden_motes', 2.8, 'Radiant mood', 'mood');
  if (mood === 'good' || mood === 'calm' || mood === 'loved') add('golden_motes', 1.8, 'Light mood', 'mood');
  if (mood === 'calm' || mood === 'loved') add('quiet_dust', 1.6, 'Settled mood', 'mood');
  if (mood === 'loved') add('social_ribbons', 2.4, 'Connected mood', 'mood');

  if (day.sleep?.quality === 'good') add('dream_wisps', 2.1, 'Well-rested start', 'sleep');
  if (day.sleep?.quality === 'low') add('quiet_dust', 1.2, 'Low-energy morning', 'sleep');

  for (const moment of day.moments) {
    if (moment.type === 'social') add('social_ribbons', 3.1, 'Shared time was journaled', 'moment');
    if (moment.type === 'walk' || moment.type === 'new_place') add('journey_breeze', 2.5, 'Movement or discovery was journaled', 'moment');
    if (moment.type === 'coffee') add('cozy_embers', 2.5, 'A cozy ritual was journaled', 'moment');
    if (moment.type === 'focus' || moment.type === 'inspiration') add('idea_sparks', 2.5, 'Creative focus was journaled', 'moment');
    if (moment.type === 'calm') add('quiet_dust', 2, 'A calm moment was journaled', 'moment');
  }

  for (const place of day.confirmedPlaces ?? []) {
    const category = place.category.toLowerCase();
    if (category.includes('park') || category.includes('garden') || category.includes('nature')) {
      add('petal_drift', 2.8, 'A garden or nature place was saved', 'place');
      add('dandelion_seeds', 1.5, 'Time outdoors was saved', 'place');
    }
    if (category.includes('cafe') || category.includes('home') || category.includes('food')) {
      add('cozy_embers', 2, 'A cozy place was saved', 'place');
    }
  }

  const photoCount = day.moments.filter((moment) => moment.type === 'photo').length;
  if (photoCount >= 2 || day.featuredMemory?.kind === 'photo') {
    add('memory_shimmer', Math.min(4, 1.5 + photoCount * 0.45), 'The day holds featured photos', 'photo');
  }

  for (const memory of day.classifiedMemories ?? []) {
    if (memory.dominantDomain === 'nature') add('petal_drift', 2.3, 'Nature appears in the day', 'photo');
    if (memory.dominantDomain === 'people') add('social_ribbons', 1.7, 'Shared moments appear in the day', 'photo');
    if (memory.dominantDomain === 'movement' || memory.dominantDomain === 'place') add('journey_breeze', 1.4, 'The day moved through places', 'photo');
    if (memory.dominantDomain === 'work' || memory.dominantDomain === 'media') add('idea_sparks', 1.3, 'Creative or focused material appears', 'photo');
  }

  const text = daySignalText(day, promptTags);
  if (matches(text, /\b(birthday|celebrat\w*|party|graduat\w*|anniversar\w*|milestone|promotion|won|achievement)\b/)) {
    add('celebration_drift', 7.5, 'Celebration language was journaled', 'journal');
  }
  if (matches(text, /\b(reunion|together|family|friends|shared|date night|gathering|wedding)\b/)) {
    add('social_ribbons', 3.6, 'Connection was journaled', 'journal');
  }
  if (matches(text, /\b(garden|flowers?|blossom|spring|picnic)\b/)) add('petal_drift', 3.2, 'Flowers or spring were journaled', 'journal');
  if (matches(text, /\b(autumn|fall leaves|falling leaves|leafy|woodland)\b/)) add('falling_leaves', 4, 'Autumn nature was journaled', 'journal');
  if (matches(text, /\b(sunset|golden hour|sunrise|radiant|beautiful light)\b/)) add('golden_motes', 3.4, 'Golden light was journaled', 'journal');
  if (matches(text, /\b(fireflies|garden at night|evening walk|night walk|moonlit)\b/)) add('fireflies', 4, 'A quiet outdoor night was journaled', 'journal');
  if (matches(text, /\b(cozy|coffee|cafe|fireplace|cooking|baking|home cooked|comfort food)\b/)) add('cozy_embers', 3.4, 'Cozy ritual language was journaled', 'journal');
  if (matches(text, /\b(idea|creative|design|writing|drawing|painting|making|project|deep work|inspired)\b/)) add('idea_sparks', 3.5, 'Creative work was journaled', 'journal');
  if (matches(text, /\b(travel|trip|flight|train|road trip|new route|long walk|hike|cycle|journey)\b/)) add('journey_breeze', 3.5, 'A journey was journaled', 'journal');
  if (matches(text, /\b(dream|rested|sleep|bedtime|slow morning)\b/)) add('dream_wisps', 2.5, 'Restful time was journaled', 'journal');
  if (matches(text, /\b(reading|library|museum|quiet|stillness|reflect|solitude)\b/)) add('quiet_dust', 2.8, 'A quiet reflective moment was journaled', 'journal');

  if (day.stepsInterpretation) {
    add('journey_breeze', 2.8, 'The day’s movement was identified', 'moment');
  }
  if ((day.foodMoments ?? []).some((food) => food.meaning === 'comfort' || food.homeCooked)) {
    add('cozy_embers', 2.5, 'A comforting meal was saved', 'moment');
  }
  if ((day.studioMoments ?? []).some((studio) => studio.rating === 'inspired')) {
    add('idea_sparks', 2.6, 'Something inspiring was saved', 'moment');
  }

  const expressiveCandidates = CANDIDATE_ORDER
    .map((preset, priority) => ({ preset, priority, score: scores.get(preset) ?? 0 }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.priority - right.priority)
    .map(({ preset, score }) => ({ preset, score }));
  const winner = expressiveCandidates.find((candidate) => candidate.score >= 2) ?? null;
  const expressiveReasons = winner
    ? [...(reasons.get(winner.preset) ?? [])]
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 3)
    : [];
  const expressive = winner
    ? settings(
        winner.preset,
        clampAtmosphereUnit(0.28 + winner.score * 0.055),
        seed + 7919,
        EXPRESSIVE_WIND[winner.preset],
      )
    : null;

  return {
    expressive,
    expressiveCandidates,
    expressiveReasons,
    physical,
    physicalReasons,
    seed,
    version: 1,
  };
}

export function atmosphereSettingsForPlan(plan: DayAtmospherePlan): AtmosphereSettings[] {
  return [plan.physical, plan.expressive].filter((layer): layer is AtmosphereSettings => layer !== null);
}

function settings(
  preset: AtmosphereSettings['preset'],
  intensity: number,
  seed: number,
  wind: number,
): AtmosphereSettings {
  return {
    intensity: clampAtmosphereUnit(intensity),
    paused: false,
    preset,
    quality: 'auto',
    seed,
    wind,
  };
}

function daySignalText(day: StoredHomeDayRecord, promptTags: string[]): string {
  const values: string[] = [
    ...promptTags,
    day.dayName ?? '',
    day.creature?.highlight ?? '',
    day.creature?.reflection ?? '',
    ...(day.creature?.motifTags ?? []),
    ...(day.notes ?? []).flatMap((note) => [note.text, note.label, note.archetype]),
    ...(day.manualJournalEntries ?? []).flatMap((entry) => [
      entry.categoryId,
      entry.flowId,
      entry.feeling ?? '',
      entry.note ?? '',
      ...entry.canonicalQualityIds,
      ...entry.path,
      ...Object.values(entry.fields).flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : []),
    ]),
    ...(day.foodMoments ?? []).flatMap((food) => [food.label, food.detail ?? '', food.meaning ?? '']),
    ...(day.studioMoments ?? []).flatMap((studio) => [studio.label, studio.detail ?? '', studio.mediaType, studio.rating ?? '']),
    ...(day.vision?.concepts.map((concept) => concept.name) ?? []),
    ...(day.vision?.details ?? []),
  ];
  return values.join(' ').toLowerCase();
}

function matches(text: string, expression: RegExp): boolean {
  return expression.test(text);
}

function hashDaySeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weatherReasonLabel(preset: AtmosphereSettings['preset']): string {
  switch (preset) {
    case 'rain': return 'Rain was recorded for the day';
    case 'snow': return 'Snow was recorded for the day';
    case 'fog': return 'Fog was recorded for the day';
    case 'storm': return 'A storm was recorded for the day';
    case 'heat_shimmer': return 'A hot day was recorded';
    default: return 'Weather shaped the day';
  }
}
