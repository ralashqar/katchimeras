import type {
  CardMemorySpark,
  CardFacet,
  CardFacetKey,
  CardScene,
  CardState,
  CardTrait,
  CardTraitFamily,
  CardVisualTreatment,
  DailyCreatureCard,
  DayScores,
  HomeRarityTier,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import { resolveBondStage } from '@/utils/bond';
import { buildReflectionContext } from '@/utils/reflection-context';
import { dayInputSignature } from '@/game/days/shape';
import { resolveDailyCardGlyphs } from '@/utils/daily-card-glyphs';
import {
  resolveDailyCardAtmosphere,
  resolveDailyCardEnvironment,
} from '@/utils/daily-card-scene';
import { selectFeaturedWisps } from '@/utils/wisp-engine';

type CardBuildMode = 'live_hatch' | 'legacy_backfill';

type BuildDailyCreatureCardOptions = {
  mode: CardBuildMode;
  sealedAt: string;
  pastDays?: readonly StoredHomeDayRecord[];
  scores?: DayScores;
};

type TraitCandidate = CardTrait;

const CARD_ENGINE_VERSION = 'daily-card-v5' as const;

const CONFIDENCE_RANK: Record<CardTrait['confidence'], number> = {
  explicit: 3,
  confirmed: 2,
  inferred: 1,
};

const TONE_LABEL: Record<CardState['tone'], string> = {
  calm: 'Calm',
  restless: 'Restless',
  gentle: 'Gentle',
  bold: 'Bold',
};

const CARD_MOOD_STATE: Record<string, { iconState: string; label: string }> = {
  energized: { iconState: 'radiant', label: 'Radiant' },
  radiant: { iconState: 'radiant', label: 'Radiant' },
  good: { iconState: 'light', label: 'Light' },
  calm: { iconState: 'light', label: 'Light' },
  loved: { iconState: 'light', label: 'Light' },
  light: { iconState: 'light', label: 'Light' },
  meh: { iconState: 'meh', label: 'Meh' },
  drained: { iconState: 'heavy', label: 'Heavy' },
  low: { iconState: 'heavy', label: 'Heavy' },
  heavy: { iconState: 'heavy', label: 'Heavy' },
  stressed: { iconState: 'stormy', label: 'Stormy' },
  stormy: { iconState: 'stormy', label: 'Stormy' },
};

const VITALITY_LABEL: Record<CardState['vitality'], string> = {
  tired: 'Tired',
  well_rested: 'Well Rested',
  energised: 'Energised',
  low_key: 'Low-Key',
  steady: 'Steady',
};

const FRAME_PALETTE: Record<HomeRarityTier, [string, string]> = {
  common: ['#FFF8E8', '#E8D7B4'],
  rare: ['#F5FFF4', '#9FD7B2'],
  epic: ['#FAF4FF', '#B6A0E8'],
  legendary: ['#FFF8DF', '#E5B85F'],
};

const EPITHET_BY_TRAIT: Record<string, string> = {
  night_owl: 'The Midnight Maker',
  first_light: 'The Dawn-Touched',
  well_rested: 'The Rested Dreamer',
  cozy_ritual: 'The Cozy Regular',
  wanderlust: 'The Sunset Wanderer',
  new_route: 'The New-Path Seeker',
  long_journey: 'The Far-Roaming',
  slow_pace: 'The Gentle Drifter',
  nature_day: 'The Garden-Bound',
  city_glow: 'The City-Lit',
  rain_kissed: 'The Rain-Kissed Wanderer',
  storm_touched: 'The Storm-Touched',
  deep_work: 'The Focused Maker',
  creative_flow: 'The Bright-Spark Maker',
  curious: 'The Quietly Curious',
  shared_warmth: 'The Warm-Hearted',
  solo_time: 'The Quiet Companion',
  reconnected: 'The Long-Awaited Friend',
  celebration: 'The Celebration Keeper',
  new_discovery: 'The Curious Finder',
  family_time: 'The Hearthside Keeper',
  gentle_day: 'The Soft-Day Keeper',
  recovery_day: 'The Returning Light',
  second_wind: 'The Second-Wind Spirit',
};

export function buildDailyCreatureCard(
  day: StoredHomeDayRecord,
  creature: LocalCreatureRecord,
  options: BuildDailyCreatureCardOptions
): DailyCreatureCard {
  const dayWithCreature = { ...day, creature };
  const context = buildReflectionContext(dayWithCreature, options.pastDays ?? []);
  const scores = options.scores ?? deriveCardScores(dayWithCreature);
  const state = resolveCardState(dayWithCreature, context.mood, scores.energy);
  const traits = resolveCardTraits(dayWithCreature, context, scores);
  const meetingNumber = Math.max(1, creature.bondVisitCount ?? creature.repeatDepth + 1);
  const treatment = resolveTreatment(dayWithCreature, creature, traits);
  const facets = resolveCardFacets(dayWithCreature, state, scores);
  const dayFacts = resolveDayFacts(dayWithCreature, creature, traits);
  const dayGlyphs = resolveDailyCardGlyphs(dayWithCreature, {
    pastDays: options.pastDays,
    traits,
  });

  return {
    id: `card:${day.id}`,
    dayId: day.id,
    isoDate: day.isoDate,
    schemaVersion: 5,
    engineVersion: CARD_ENGINE_VERSION,
    provenance: options.mode,
    creatureId: creature.id,
    speciesId: creature.encounterProfileId,
    creatureName: creature.name,
    visualKey: creature.visualKey,
    variantCell: creature.variantCell,
    accentColor: creature.accentColor,
    rarity: creature.rarity,
    rarityReason: creature.rarityReason ?? null,
    meetingNumber,
    bondStage: resolveBondStage(meetingNumber),
    placeLabel: resolvePlaceLabel(dayWithCreature),
    state,
    epithet: resolveEpithet(traits, creature),
    traits,
    memorySpark: resolveMemorySpark(dayWithCreature, creature),
    treatment,
    storyLine: resolveStoryLine(dayWithCreature, state, traits, facets),
    facets,
    dayFacts,
    dayGlyphs,
    scene: resolveScene(dayWithCreature, treatment, traits),
    featuredWisps: options.mode === 'live_hatch'
      ? selectFeaturedWisps(dayWithCreature, options.pastDays ?? [])
      : [],
    sealedInputSignature: dayInputSignature(dayWithCreature),
    sealedAt: options.sealedAt,
  };
}

export function upgradeDailyCreatureCard(
  card: DailyCreatureCard,
  day: StoredHomeDayRecord,
  creature: LocalCreatureRecord
): DailyCreatureCard {
  if (
    card.schemaVersion === 5
    && card.facets
    && card.dayFacts
    && card.dayGlyphs
    && card.scene?.environment
    && card.scene.atmosphere
    && card.storyLine
    && card.featuredWisps
  ) {
    const selectedPhoto = resolveDayPhoto(day);
    const mood = resolveMoodFacet(day, card.state);
    const moodChanged = card.facets.mood.value !== mood.value || card.facets.mood.iconKey !== mood.iconKey;
    const photoChanged = Boolean(selectedPhoto && !card.memorySpark?.photoUri);
    if (!moodChanged && !photoChanged) return card;
    const memorySpark = card.memorySpark ?? resolveMemorySpark(day, creature);
    return {
      ...card,
      facets: moodChanged ? { ...card.facets, mood } : card.facets,
      memorySpark: photoChanged && memorySpark && selectedPhoto
        ? { ...memorySpark, photoUri: selectedPhoto.uri }
        : card.memorySpark,
    };
  }
  const rebuilt = buildDailyCreatureCard({ ...day, card: null, creature }, creature, {
    mode: card.provenance,
    sealedAt: card.sealedAt,
  });
  return {
    ...rebuilt,
    id: card.id,
    creatureId: card.creatureId,
    speciesId: card.speciesId,
    creatureName: card.creatureName,
    visualKey: card.visualKey,
    variantCell: card.variantCell,
    accentColor: card.accentColor,
    rarity: card.rarity,
    rarityReason: card.rarityReason,
    meetingNumber: card.meetingNumber,
    bondStage: card.bondStage,
    placeLabel: card.placeLabel,
    state: card.state,
    epithet: card.epithet,
    traits: card.traits,
    memorySpark: card.memorySpark,
    treatment: card.treatment,
    featuredWisps: card.featuredWisps ?? [],
    sealedInputSignature: card.sealedInputSignature,
    sealedAt: card.sealedAt,
  };
}

export function updateCardMemorySpark(
  card: DailyCreatureCard,
  day: StoredHomeDayRecord,
  creature?: LocalCreatureRecord | null
): DailyCreatureCard {
  const narrator = creature ?? {
    highlight: card.dayLine ?? card.storyLine ?? card.memorySpark?.caption ?? '',
    reflection: card.dayLine ?? card.storyLine ?? '',
    highlightMomentId: null,
  };
  return { ...card, memorySpark: resolveMemorySpark(day, narrator) };
}

function resolveCardState(day: StoredHomeDayRecord, mood: string, energy: number): CardState {
  const tone: CardState['tone'] =
    mood === 'cozy' ? 'calm' : mood === 'restless' ? 'restless' : mood === 'defiant' ? 'bold' : 'gentle';
  const vitality: CardState['vitality'] =
    day.sleep?.quality === 'low'
      ? 'tired'
      : day.sleep?.quality === 'good'
        ? 'well_rested'
        : energy >= 0.65
          ? 'energised'
          : energy <= 0.25
            ? 'low_key'
            : 'steady';
  const separator = tone === 'restless' && vitality === 'tired' ? ' but ' : ' & ';
  return { tone, vitality, label: `${TONE_LABEL[tone]}${separator}${VITALITY_LABEL[vitality]}` };
}

function resolveCardTraits(
  day: StoredHomeDayRecord,
  context: ReturnType<typeof buildReflectionContext>,
  scores: DayScores
): CardTrait[] {
  const candidates: TraitCandidate[] = [];
  const signals = new Set(day.creature?.birthSignals ?? []);
  const factors = new Set(day.creature?.livingFactors ?? []);
  const semanticTags = new Set(
    day.promptAnswers.filter((answer) => !answer.dismissed).flatMap((answer) => answer.semanticTags)
  );
  const placeCategories = new Set([
    ...(day.placeCategorySeeds ?? []),
    ...(day.confirmedPlaces ?? []).flatMap((place) => [place.category, place.label.toLowerCase()]),
  ]);

  const add = (
    id: string,
    family: CardTraitFamily,
    label: string,
    strength: number,
    confidence: CardTrait['confidence'],
    evidence: string[]
  ) => candidates.push({ id, family, label, strength, confidence, evidence });

  if (factors.has('night_owl') || signals.has('night_owl')) add('night_owl', 'rhythm', 'Night Owl', 0.92, 'inferred', ['time:small_hours']);
  if (factors.has('first_light') || signals.has('first_light')) add('first_light', 'rhythm', 'First Light', 0.86, 'inferred', ['time:first_light']);
  if (day.sleep?.quality === 'good') add('well_rested', 'rhythm', 'Well Rested', 0.95, 'explicit', ['sleep:good']);
  if (signals.has('coffee_shop') || day.moments.some((moment) => moment.type === 'coffee')) add('cozy_ritual', 'rhythm', 'Cozy Ritual', 0.78, day.moments.some((moment) => moment.type === 'coffee') ? 'explicit' : 'inferred', ['moment:coffee']);

  if (factors.has('far_from_routine') || factors.has('wandering')) add('wanderlust', 'movement', 'Wanderlust', 0.88, 'inferred', ['movement:roaming']);
  if (day.newPlaceCount > 0) add('new_route', 'movement', 'New Route', 0.9, 'confirmed', ['places:new']);
  if (factors.has('long_journey')) add('long_journey', 'movement', 'Long Journey', 0.9, 'inferred', ['movement:distance']);
  if (day.stepsCount < 2500 && day.visitedPlaceCount <= 1) add('slow_pace', 'movement', 'Slow Pace', 0.64, 'inferred', ['movement:gentle']);

  if (['park', 'garden', 'forest'].some((value) => signals.has(value) || placeCategories.has(value))) add('nature_day', 'place_weather', 'Nature Day', 0.88, 'confirmed', ['place:nature']);
  if (signals.has('city_day') || signals.has('shibuya_crossing')) add('city_glow', 'place_weather', 'City Glow', 0.84, 'inferred', ['place:city']);
  if (day.weather?.condition === 'rain' || signals.has('rain_day')) add('rain_kissed', 'place_weather', 'Rain-Kissed', 0.91, 'inferred', ['weather:rain']);
  if (day.weather?.condition === 'storm' || signals.has('storm_day')) add('storm_touched', 'place_weather', 'Storm-Touched', 0.92, 'inferred', ['weather:storm']);

  if (scores.focus >= 0.55 || signals.has('focus_day')) add('deep_work', 'mind', 'Deep Work', 0.82, semanticTags.has('activity:work') ? 'explicit' : 'inferred', ['score:focus']);
  if ((day.studioMoments?.length ?? 0) > 0 || signals.has('creative_day')) add('creative_flow', 'mind', 'Creative Flow', 0.84, (day.studioMoments?.length ?? 0) > 0 ? 'confirmed' : 'inferred', ['memory:studio']);
  if (signals.has('museum') || signals.has('library') || signals.has('bookstore')) add('curious', 'mind', 'Curious', 0.74, 'inferred', ['place:curiosity']);

  if (scores.social >= 0.45 || signals.has('social_gathering')) add('shared_warmth', 'connection', 'Shared Warmth', 0.84, semanticTags.has('people:friends') || semanticTags.has('people:family') ? 'explicit' : 'inferred', ['score:social']);
  if ([...semanticTags].some((tag) => tag.includes('solo') || tag.includes('alone'))) add('solo_time', 'connection', 'Solo Time', 0.9, 'explicit', ['prompt:solo']);
  if ((day.bigMoments ?? []).some((moment) => moment.type === 'reunion')) add('reconnected', 'connection', 'Reconnected', 0.98, 'explicit', ['moment:reunion']);

  if ((day.bigMoments?.length ?? 0) > 0 || signals.has('celebration')) add('celebration', 'memory', 'Celebration', 0.96, (day.bigMoments?.length ?? 0) > 0 ? 'explicit' : 'inferred', ['memory:big_moment']);
  if (day.newPlaceCount > 0 || signals.has('museum')) add('new_discovery', 'memory', 'New Discovery', 0.76, 'confirmed', ['places:new']);
  if ([...semanticTags].some((tag) => tag.includes('family')) || signals.has('parenting_care')) add('family_time', 'memory', 'Family Time', 0.9, 'explicit', ['prompt:family']);

  if (context.recoveryAfterBusy) add('recovery_day', 'recovery', 'Recovery Day', 0.9, 'inferred', ['history:recovery']);
  if (context.mood === 'tender') add('gentle_day', 'recovery', 'Gentle Day', 0.62, 'inferred', ['mood:tender']);
  if (context.mood === 'defiant' && day.sleep?.quality === 'low' && scores.energy >= 0.55) add('second_wind', 'recovery', 'Second Wind', 0.8, 'inferred', ['sleep:low', 'score:energy']);

  candidates.sort((left, right) =>
    right.strength - left.strength ||
    CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence] ||
    left.id.localeCompare(right.id)
  );

  const selected: CardTrait[] = [];
  const families = new Set<CardTraitFamily>();
  for (const candidate of candidates) {
    if (families.has(candidate.family)) continue;
    selected.push(candidate);
    families.add(candidate.family);
    if (selected.length === 3) break;
  }
  return selected;
}

function deriveCardScores(day: StoredHomeDayRecord): DayScores {
  const scores: DayScores = { energy: 0, calm: 0, social: 0, exploration: 0, focus: 0 };
  const add = (key: keyof DayScores, value: number) => {
    scores[key] = Math.min(1, scores[key] + value);
  };
  for (const moment of day.moments) {
    if (moment.type === 'walk') add('energy', 0.3);
    if (moment.type === 'new_place') add('exploration', 0.35);
    if (moment.type === 'social') add('social', 0.35);
    if (moment.type === 'calm' || moment.type === 'coffee') add('calm', 0.3);
    if (moment.type === 'focus') add('focus', 0.35);
  }
  for (const answer of day.promptAnswers) {
    if (answer.dismissed) continue;
    for (const key of Object.keys(scores) as Array<keyof DayScores>) add(key, answer.scoreBias[key] ?? 0);
  }
  for (const key of Object.keys(scores) as Array<keyof DayScores>) add(key, day.capturedEnergy?.[key] ?? 0);
  add('energy', Math.min(day.stepsCount / 5200, 1) * 0.34);
  add('exploration', Math.min(day.newPlaceCount * 0.18, 0.36));
  return scores;
}

function resolveCardFacets(
  day: StoredHomeDayRecord,
  state: CardState,
  scores: DayScores
): Record<CardFacetKey, CardFacet> {
  const mood = resolveMoodFacet(day, state);
  const energy = scores.energy >= 0.78 ? 'High' : scores.energy >= 0.56 ? 'Bright' : scores.energy >= 0.34 ? 'Steady' : scores.calm >= 0.5 ? 'Calm' : 'Low-key';
  const sleep = day.sleep?.totalSleepMinutes
    ? `${Math.floor(day.sleep.totalSleepMinutes / 60)}h ${day.sleep.totalSleepMinutes % 60}m`
    : day.sleep?.quality === 'good' ? 'Good' : day.sleep?.quality === 'low' ? 'Low' : day.sleep?.quality === 'normal' ? 'Steady' : 'Not logged';
  const confirmedPlace = day.confirmedPlaces?.[0];
  const location = day.locations.find((item) => item.label);
  const place = confirmedPlace?.name ?? confirmedPlace?.categoryLabel ?? confirmedPlace?.label ?? location?.label ?? (day.visitedPlaceCount <= 1 ? 'Home' : 'Out & about');
  const tags = new Set(day.promptAnswers.filter((answer) => !answer.dismissed).flatMap((answer) => answer.semanticTags));
  const hasFamily = [...tags].some((tag) => tag.includes('family'));
  const hasFriends = [...tags].some((tag) => tag.includes('friend'));
  const hasSolo = [...tags].some((tag) => tag.includes('solo') || tag.includes('alone'));
  const social = hasFamily ? 'Family time' : hasFriends ? 'With friends' : hasSolo ? 'Solo time' : day.moments.some((moment) => moment.type === 'social') ? 'Together' : 'Not noted';
  const facet = (key: CardFacetKey, label: string, value: string, iconKey: string, evidence: string[]): CardFacet => ({ key, label, value, iconKey, evidence });
  return {
    mood,
    energy: facet('energy', 'Energy', energy, 'energy:droplet', ['score:energy']),
    sleep: facet('sleep', 'Sleep', sleep, 'sleep:moon', day.sleep ? ['sleep:logged'] : []),
    place: facet('place', 'Place', place, 'place:arch', confirmedPlace ? ['place:confirmed'] : location ? ['place:sample'] : []),
    social: facet('social', 'Social', social, 'social:companions', social === 'Not noted' ? [] : ['social:explicit']),
  };
}

function resolveMoodFacet(day: StoredHomeDayRecord, state: CardState): CardFacet {
  const answer = [...(day.promptAnswers ?? [])]
    .reverse()
    .find((candidate) => !candidate.dismissed && candidate.kind === 'feeling' && candidate.choiceIds.length > 0);
  const rawMood = answer?.choiceIds[0] ?? answer?.labels[0] ?? day.hatchCheckIn?.moodLabel ?? TONE_LABEL[state.tone];
  const resolved = CARD_MOOD_STATE[rawMood.trim().toLowerCase()]
    ?? (state.tone === 'restless' ? CARD_MOOD_STATE.stormy : state.tone === 'bold' ? CARD_MOOD_STATE.radiant : CARD_MOOD_STATE.light);
  return {
    key: 'mood',
    label: 'Mood',
    value: resolved.label,
    iconKey: `mood:${resolved.iconState}`,
    evidence: answer ? ['mood:explicit'] : ['state:tone'],
  };
}

function resolveDayFacts(day: StoredHomeDayRecord, creature: LocalCreatureRecord, traits: CardTrait[]) {
  const bigMoment = day.bigMoments?.[0]?.label;
  const featured = day.featuredMemory ? 'A featured memory' : undefined;
  const explicitMoment = day.moments.find((moment) => moment.label)?.label;
  return {
    steps: day.stepsCount,
    stepsLabel: day.stepsInterpretation?.label ?? 'Steps',
    highlight: bigMoment ?? featured ?? creature.highlight ?? explicitMoment ?? 'A quiet day',
    highlightIconKey: bigMoment ? 'highlight:spark' : day.featuredMemory ? 'highlight:photo' : 'highlight:day',
    bonusTrait: traits[0] ?? null,
  };
}

function resolveStoryLine(
  day: StoredHomeDayRecord,
  state: CardState,
  traits: CardTrait[],
  facets: Record<CardFacetKey, CardFacet>
): string {
  const trait = traits[0]?.label.toLowerCase();
  const setting = facets.place.value === 'Not logged' ? null : facets.place.value.toLowerCase();
  const weather = day.weather?.condition;
  if (weather === 'rain') return `A ${state.tone} little companion born from a rain-softened day${setting ? ` around ${setting}` : ''}.`;
  if (trait && setting) return `A ${state.tone} companion shaped by ${trait} and a day around ${setting}.`;
  if (trait) return `A ${state.tone} companion shaped by a day of ${trait}.`;
  return `A ${state.tone} companion born from the day as it was lived.`;
}

function resolveScene(day: StoredHomeDayRecord, treatment: CardVisualTreatment, traits: CardTrait[]): CardScene {
  const lighting: CardScene['lighting'] = traits.some((trait) => trait.id === 'night_owl')
    ? 'night'
    : traits.some((trait) => trait.id === 'first_light')
      ? 'dawn'
      : traits.some((trait) => trait.id === 'wanderlust')
        ? 'golden_hour'
        : 'day';
  const weather: CardScene['weather'] = day.weather?.condition === 'rain' || day.weather?.condition === 'storm' || day.weather?.condition === 'snow'
    ? day.weather.condition
    : 'clear';
  return {
    backdrop: treatment.backdrop,
    lighting,
    weather,
    foregroundMotifs: traits.slice(0, 3).map((trait) => trait.id),
    compositionSeed: `${day.id}:${day.creature?.id ?? 'egg'}`,
    environment: day.creature
      ? resolveDailyCardEnvironment(day.creature)
      : undefined,
    atmosphere: resolveDailyCardAtmosphere(day),
  };
}

function resolveEpithet(traits: CardTrait[], creature: LocalCreatureRecord): string {
  const traitEpithet = traits[0] ? EPITHET_BY_TRAIT[traits[0].id] : null;
  if (traitEpithet) return traitEpithet;
  const fallback: Record<LocalCreatureRecord['primaryTrait'], string> = {
    calm: 'The Quiet Keeper',
    energy: 'The Bright Spirit',
    social: 'The Warm Companion',
    exploration: 'The Day Wanderer',
    focus: 'The Steady Maker',
  };
  return fallback[creature.primaryTrait];
}

function resolveMemorySpark(
  day: StoredHomeDayRecord,
  creature: Pick<LocalCreatureRecord, 'highlight' | 'reflection' | 'highlightMomentId'>,
): CardMemorySpark | null {
  const selectedPhoto = resolveDayPhoto(day);
  if (day.featuredMemory) {
    return {
      caption: creature.highlight || creature.reflection,
      photoUri: selectedPhoto?.uri ?? null,
      source: 'featured_memory',
      sourceId: day.featuredMemory.assetId ?? null,
    };
  }
  const bigMoment = day.bigMoments?.[0];
  if (bigMoment) {
    return { caption: bigMoment.label, photoUri: selectedPhoto?.uri ?? null, source: 'big_moment', sourceId: bigMoment.id };
  }
  if (creature.highlight) {
    return { caption: creature.highlight, photoUri: selectedPhoto?.uri ?? null, source: 'creature_highlight', sourceId: creature.highlightMomentId };
  }
  if (creature.reflection) {
    return { caption: creature.reflection, photoUri: selectedPhoto?.uri ?? null, source: 'creature_reflection', sourceId: null };
  }
  if (selectedPhoto) return { caption: 'A featured glimpse from this day.', photoUri: selectedPhoto.uri, source: 'featured_memory', sourceId: selectedPhoto.sourceId };
  return null;
}

function resolveDayPhoto(day: StoredHomeDayRecord): { sourceId: string | null; uri: string } | null {
  if (day.featuredMemory?.thumbnailUri) {
    return { sourceId: day.featuredMemory.assetId ?? null, uri: day.featuredMemory.thumbnailUri };
  }

  const records = [...(day.journalRecords ?? [])].reverse();
  for (const record of records) {
    if (record.source.kind === 'photo' && record.source.thumbnailUri) {
      return { sourceId: record.source.sourceId, uri: record.source.thumbnailUri };
    }
    const attachment = [...record.attachments].reverse().find((item) => item.kind === 'photo' && item.uri);
    if (attachment?.uri) return { sourceId: attachment.id, uri: attachment.uri };
  }

  const moments = [...(day.moments ?? [])].reverse();
  const photoMoment = moments.find((moment) => moment.type === 'photo' && (moment.metadata?.thumbnailUri || moment.metadata?.localUri));
  const momentUri = photoMoment?.metadata?.thumbnailUri ?? photoMoment?.metadata?.localUri;
  if (photoMoment && momentUri) return { sourceId: photoMoment.metadata?.assetId ?? photoMoment.id, uri: momentUri };
  return null;
}

function resolvePlaceLabel(day: StoredHomeDayRecord): string | null {
  const confirmed = day.confirmedPlaces?.[0];
  if (confirmed) return confirmed.name ?? confirmed.categoryLabel ?? confirmed.label;
  return day.locations.find((location) => location.label)?.label ?? null;
}

function resolveTreatment(
  day: StoredHomeDayRecord,
  creature: LocalCreatureRecord,
  traits: CardTrait[]
): CardVisualTreatment {
  const backdrop: CardVisualTreatment['backdrop'] =
    day.weather?.condition === 'storm'
      ? 'storm'
      : day.weather?.condition === 'rain'
        ? 'rain'
        : day.weather?.condition === 'snow'
          ? 'snow'
          : traits.some((trait) => trait.id === 'night_owl')
            ? 'night'
            : traits.some((trait) => trait.id === 'first_light')
              ? 'dawn'
              : traits.some((trait) => trait.id === 'nature_day')
                ? 'nature'
                : traits.some((trait) => trait.id === 'city_glow')
                  ? 'city'
                  : traits.some((trait) => trait.id === 'cozy_ritual')
                    ? 'cafe'
                    : day.visitedPlaceCount <= 1
                      ? 'home'
                      : 'meadow';
  const [paper, rarityAccent] = FRAME_PALETTE[creature.rarity];
  return {
    palette: [paper, mixAccent(rarityAccent, creature.accentColor)],
    frameTier: creature.rarity,
    backdrop,
    motifs: traits.map((trait) => trait.id),
  };
}

function mixAccent(rarityAccent: string, creatureAccent: string): string {
  return creatureAccent || rarityAccent;
}

export function formatMeetingLabel(card: Pick<DailyCreatureCard, 'meetingNumber' | 'bondStage'>): string {
  const stage = ['New', 'Familiar', 'Devoted', 'Kindred'][card.bondStage] ?? 'New';
  return `${ordinal(card.meetingNumber)} meeting · ${stage}`;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}
