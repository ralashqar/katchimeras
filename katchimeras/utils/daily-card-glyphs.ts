import type {
  CardDayGlyph,
  CardDayGlyphKey,
  CardTrait,
  StoredHomeDayRecord,
} from '@/types/home';

export const MAX_DAILY_CARD_GLYPHS = 4;
export const MIN_DAILY_CARD_GLYPH_STRENGTH = 0.72;

const CONFIDENCE_RANK: Record<CardDayGlyph['confidence'], number> = {
  explicit: 3,
  confirmed: 2,
  inferred: 1,
};

const GLYPH_ORDER: CardDayGlyphKey[] = [
  'milestone',
  'connection',
  'movement',
  'nature',
  'explore',
  'food',
  'culture',
  'focus',
];

const GLYPH_LABELS: Record<CardDayGlyphKey, string> = {
  movement: 'Movement',
  connection: 'Connection',
  milestone: 'Big event',
  explore: 'Exploring',
  nature: 'Nature',
  food: 'Food',
  culture: 'Culture',
  focus: 'Making and focus',
};

type GlyphCandidate = CardDayGlyph & {
  evidenceSet: Set<string>;
};

export function resolveDailyCardGlyphs(
  day: StoredHomeDayRecord,
  options: {
    pastDays?: readonly StoredHomeDayRecord[];
    traits?: readonly CardTrait[];
  } = {}
): CardDayGlyph[] {
  const candidates = new Map<CardDayGlyphKey, GlyphCandidate>();
  const add = (
    key: CardDayGlyphKey,
    strength: number,
    confidence: CardDayGlyph['confidence'],
    evidence: string
  ) => {
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, {
        key,
        label: GLYPH_LABELS[key],
        strength,
        confidence,
        evidence: [evidence],
        evidenceSet: new Set([evidence]),
      });
      return;
    }
    if (existing.evidenceSet.has(evidence)) return;
    existing.evidenceSet.add(evidence);
    existing.evidence.push(evidence);
    existing.strength = Math.min(1, Math.max(existing.strength, strength) + 0.04);
    if (CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
      existing.confidence = confidence;
    }
  };

  const journalRecords = day.journalRecords?.length
    ? day.journalRecords
    : (day.manualJournalEntries ?? []);
  const journalFlows = new Set(journalRecords.map((record) => record.flowId));
  const promptTags = new Set(
    (day.promptAnswers ?? [])
      .filter((answer) => !answer.dismissed)
      .flatMap((answer) => answer.semanticTags)
  );

  if ((day.bigMoments?.length ?? 0) > 0) add('milestone', 1, 'explicit', 'big-moment:confirmed');
  if (journalFlows.has('big_event')) add('milestone', 0.95, 'explicit', 'journal:big-event');

  if (journalFlows.has('people')) add('connection', 0.95, 'explicit', 'journal:people');
  if ((day.moments ?? []).some((moment) => moment.type === 'social')) {
    add('connection', 0.84, 'explicit', 'moment:social');
  }
  if ([...promptTags].some((tag) => tag.includes('family') || tag.includes('friend'))) {
    add('connection', 0.9, 'explicit', 'prompt:people');
  }

  if (day.stepsInterpretation) add('movement', 0.96, 'explicit', `movement:${day.stepsInterpretation.movement}`);
  if (journalFlows.has('movement')) add('movement', 0.95, 'explicit', 'journal:movement');
  if ((day.moments ?? []).some((moment) => moment.type === 'walk')) {
    add('movement', 0.86, 'explicit', 'moment:walk');
  }
  if (
    (day.exactRouteSegments?.length ?? 0) > 0
    || (day.healthRouteImport?.status === 'success' && day.healthRouteImport.importedWorkoutCount > 0)
  ) {
    add('movement', 0.88, 'confirmed', 'health:route');
  }
  if (isHighStepHighlight(day, options.pastDays ?? [])) {
    add('movement', 0.78, 'inferred', 'steps:highlight');
  }

  const confirmedNaturePlace = (day.confirmedPlaces ?? []).some((place) =>
    isNatureValue(place.category)
    || isNatureValue(place.categoryLabel)
    || isNatureValue(place.label)
  );
  const locatedNaturePlace = (day.locations ?? []).find((location) =>
    isNatureValue(location.type)
    || isNatureValue(location.label)
  );
  const seededNaturePlace = (day.placeCategorySeeds ?? []).some(isNatureValue);
  if (confirmedNaturePlace) add('nature', 0.96, 'confirmed', 'place:nature-confirmed');
  if (locatedNaturePlace) {
    const userOrPhotoBacked = locatedNaturePlace.source === 'manual'
      || locatedNaturePlace.source === 'photo_attachment';
    add(
      'nature',
      userOrPhotoBacked ? 0.86 : 0.76,
      userOrPhotoBacked ? 'confirmed' : 'inferred',
      'place:nature-location'
    );
  }
  if (seededNaturePlace) add('nature', 0.82, 'inferred', 'place:nature-inferred');
  if (options.traits?.some((trait) => trait.id === 'nature_day')) {
    add('nature', 0.76, 'inferred', 'trait:nature-day');
  }

  if (journalFlows.has('went_somewhere')) add('explore', 0.95, 'explicit', 'journal:place');
  if (day.newPlaceCount > 0) add('explore', 0.9, 'confirmed', 'place:new');
  if ((day.moments ?? []).some((moment) => moment.type === 'new_place')) {
    add('explore', 0.84, 'explicit', 'moment:new-place');
  }

  if ((day.foodMoments?.length ?? 0) > 0) add('food', 0.98, 'explicit', 'memory:food');
  if (journalFlows.has('food')) add('food', 0.95, 'explicit', 'journal:food');
  if ((day.moments ?? []).some((moment) => moment.type === 'coffee')) {
    add('food', 0.82, 'explicit', 'moment:coffee');
  }

  if ((day.studioMoments?.length ?? 0) > 0) add('culture', 0.98, 'explicit', 'memory:studio');
  if (journalFlows.has('studio')) add('culture', 0.95, 'explicit', 'journal:studio');

  if (journalFlows.has('work')) add('focus', 0.95, 'explicit', 'journal:work');
  if (promptTags.has('activity:work')) add('focus', 0.9, 'explicit', 'prompt:work');
  if ((day.moments ?? []).some((moment) => moment.type === 'focus')) {
    add('focus', 0.84, 'explicit', 'moment:focus');
  }
  if (options.traits?.some((trait) => trait.id === 'deep_work')) {
    add('focus', 0.74, 'inferred', 'trait:deep-work');
  }

  const nature = candidates.get('nature');
  const explore = candidates.get('explore');
  if (
    nature
    && explore
    && explore.evidence.every((evidence) => evidence.startsWith('place:'))
  ) {
    candidates.delete('explore');
  }

  return [...candidates.values()]
    .filter((candidate) => candidate.strength >= MIN_DAILY_CARD_GLYPH_STRENGTH)
    .sort((left, right) =>
      CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence]
      || right.strength - left.strength
      || GLYPH_ORDER.indexOf(left.key) - GLYPH_ORDER.indexOf(right.key)
    )
    .slice(0, MAX_DAILY_CARD_GLYPHS)
    .map(({ evidenceSet: _evidenceSet, ...glyph }) => ({
      ...glyph,
      strength: Number(glyph.strength.toFixed(3)),
    }));
}

function isHighStepHighlight(
  day: StoredHomeDayRecord,
  pastDays: readonly StoredHomeDayRecord[]
): boolean {
  const steps = Math.max(0, day.stepsCount ?? 0);
  if (steps >= 8_000) return true;
  const historicalSteps = pastDays
    .filter((candidate) => candidate.isoDate < day.isoDate && candidate.stepsCount > 0)
    .sort((left, right) => right.isoDate.localeCompare(left.isoDate))
    .slice(0, 28)
    .map((candidate) => candidate.stepsCount)
    .sort((left, right) => left - right);
  if (historicalSteps.length < 3) return false;
  const middle = Math.floor(historicalSteps.length / 2);
  const median = historicalSteps.length % 2 === 0
    ? (historicalSteps[middle - 1] + historicalSteps[middle]) / 2
    : historicalSteps[middle];
  return steps >= Math.max(5_000, median * 1.35);
}

function isNatureValue(value?: string | null): boolean {
  if (!value) return false;
  return /(?:park|garden|forest|nature|beach|woodland|trail|playground)/i.test(value);
}
