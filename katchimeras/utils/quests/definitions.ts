import type { QuestCapabilityId } from '@/utils/capabilities/quest-capabilities';
import type { Criterion } from '@/utils/signals/facts';
import { qualityThresholds } from '@/utils/intelligence/quality-registry';

// Declarative companion-quest catalogue (docs/katchimera-engagement-v1.md
// refactor). A quest is DATA: id + copy + a list of criteria against facts.
// The same criteria drive both the journal checklist and completion — no more
// parallel switch statements. Add a quest = add an entry; add a capability =
// add a fact + provider and reference it here.

export type QuestDefinition = {
  id: string;
  family?: 'photo' | 'moment' | 'place' | 'movement' | 'note' | 'voice' | 'food' | 'studio' | 'sleep' | 'weather' | 'calendar';
  execution?:
    | { kind: 'evidence' }
    | { kind: 'live_steps'; challengeId: 'step_sprint' | 'step_time_trial'; difficultyCurveId: string }
    | { kind: 'trivia'; packIds: ('film' | 'books' | 'city')[]; questionCount: number }
    | { kind: 'paced_breathing'; patternId: 'bedrotte-calm-v1'; difficultyCurveId: string }
    | { kind: 'timing_zone'; challengeId: 'steppling-stride' | 'mossprout-tend'; difficultyCurveId: string }
    | { kind: 'pattern_memory'; gameId: 'gatherglow-lights'; difficultyCurveId: string }
    | { kind: 'sorting'; packId: 'feastle-table' | 'tasklet-triage'; difficultyCurveId: string }
    | { kind: 'matching'; packId: 'relicoon-gallery' | 'mossprout-garden' | 'feastle-food'; difficultyCurveId: string }
    | { kind: 'merge'; packId: 'feastle-kitchen'; difficultyCurveId: 'feastle-merge-v1' }
    | { kind: 'rhythm'; gameId: 'encora-echo'; difficultyCurveId: string }
    | {
        kind: 'word_game';
        gameId: 'pagelet_lost_word';
        rulesetId: 'lost-word-v1';
        answerLength: 5;
        maxGuesses: 6;
        difficultyCurveId: 'pagelet-lost-word-v1';
      }
    | {
        kind: 'word_connect';
        gameId: 'pagelet_word_paths';
        packId: 'pagelet-word-paths';
        rulesetId: 'word-paths-v1';
        difficultyCurveId: 'pagelet-word-paths-v1';
      };
  eligibility?: {
    creatureKeys?: string[];
    minimumHomeLevel?: number;
    cooldownDays?: number;
    weight?: number;
  };
  submissionMode?: 'manual' | 'auto';
  themes?: string[];
  title: string;
  hint: string;
  criteria: Criterion[];
  requiresCapabilities?: QuestCapabilityId[];
  optionalCapabilities?: QuestCapabilityId[];
  suggestedActions?: string[];
  evidencePolicy?: {
    minConfidence?: number;
    allowCorroboration?: boolean;
  };
};

function photoQualityCriterion(qualityId: string, label: string): Criterion {
  const thresholds = qualityThresholds(qualityId);
  return {
    fact: 'memory.qualities',
    op: 'qualityAtLeast',
    value: qualityId,
    qualityId,
    minimumScore: thresholds.ready,
    minConfidence: thresholds.ready,
    minimumCentrality: 'supporting',
    sourceTypes: ['photo'],
    label,
  };
}

const RAW_QUEST_DEFINITIONS: Record<string, QuestDefinition> = {
  'quest-step-sprint': {
    id: 'quest-step-sprint',
    family: 'movement',
    title: 'Quick feet',
    hint: 'See how many steps you can take before the minute runs out.',
    criteria: [],
    requiresCapabilities: ['health.steps'],
    execution: { kind: 'live_steps', challengeId: 'step_sprint', difficultyCurveId: 'step-sprint-v1' },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 3 },
  },
  'quest-step-time-trial': {
    id: 'quest-step-time-trial',
    family: 'movement',
    title: 'Beat the trail clock',
    hint: 'Reach the step target and see how long it takes.',
    criteria: [],
    requiresCapabilities: ['health.steps'],
    execution: { kind: 'live_steps', challengeId: 'step_time_trial', difficultyCurveId: 'step-time-trial-v1' },
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 2 },
  },
  'quest-film-trivia': {
    id: 'quest-film-trivia',
    family: 'studio',
    title: 'Five frames of film trivia',
    hint: 'Answer five quick film questions. Finishing the round completes the quest.',
    criteria: [],
    execution: { kind: 'trivia', packIds: ['film'], questionCount: 5 },
    eligibility: { creatureKeys: ['flickerbun'], cooldownDays: 1, weight: 3 },
  },
  'quest-book-trivia': {
    id: 'quest-book-trivia',
    family: 'studio',
    title: 'Five questions from the shelves',
    hint: 'Answer five quick book questions. Finishing the round completes the quest.',
    criteria: [],
    execution: { kind: 'trivia', packIds: ['books'], questionCount: 5 },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-pagelet-lost-word': {
    id: 'quest-pagelet-lost-word',
    family: 'studio',
    title: 'Pagelet\'s Lost Word',
    hint: 'Find a five-letter word from Pagelet\'s shelves. Finishing the round completes the quest.',
    criteria: [],
    execution: {
      kind: 'word_game',
      gameId: 'pagelet_lost_word',
      rulesetId: 'lost-word-v1',
      answerLength: 5,
      maxGuesses: 6,
      difficultyCurveId: 'pagelet-lost-word-v1',
    },
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-pagelet-word-paths': {
    id: 'quest-pagelet-word-paths',
    family: 'studio',
    title: 'Pagelet\'s Word Paths',
    hint: 'Link the shelf letters to uncover every crossing word.',
    criteria: [],
    execution: {
      kind: 'word_connect',
      gameId: 'pagelet_word_paths',
      packId: 'pagelet-word-paths',
      rulesetId: 'word-paths-v1',
      difficultyCurveId: 'pagelet-word-paths-v1',
    },
    requiresCapabilities: [],
    submissionMode: 'auto',
    eligibility: { creatureKeys: ['pagelet'], cooldownDays: 1, weight: 3 },
  },
  'quest-bedrotte-breathe': {
    id: 'quest-bedrotte-breathe', family: 'sleep', title: 'Breathe with Bedrotte',
    hint: 'Settle into a few slow breaths with Bedrotte.', criteria: [],
    execution: { kind: 'paced_breathing', patternId: 'bedrotte-calm-v1', difficultyCurveId: 'bedrotte-calm-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['bedrotte'], cooldownDays: 1, weight: 3 },
  },
  'quest-steppling-stride': {
    id: 'quest-steppling-stride', family: 'movement', title: 'Catch the stride',
    hint: 'Tap as the marker crosses Steppling’s stride zone.', criteria: [],
    execution: { kind: 'timing_zone', challengeId: 'steppling-stride', difficultyCurveId: 'steppling-stride-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['steppling'], cooldownDays: 1, weight: 3 },
  },
  'quest-mossprout-tend': {
    id: 'quest-mossprout-tend', family: 'place', title: 'Tend Mossprout’s patch',
    hint: 'Time each drop so the little patch gets just enough water.', criteria: [],
    execution: { kind: 'timing_zone', challengeId: 'mossprout-tend', difficultyCurveId: 'mossprout-tend-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 1, weight: 3 },
  },
  'quest-mossprout-memory': {
    id: 'quest-mossprout-memory', family: 'place', title: 'Mossprout’s garden pairs',
    hint: 'Turn over the garden cards and find every matching plant.', criteria: [],
    execution: { kind: 'matching', packId: 'mossprout-garden', difficultyCurveId: 'mossprout-memory-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['mossprout'], cooldownDays: 1, weight: 3 },
  },
  'quest-skylo-city-trivia': {
    id: 'quest-skylo-city-trivia', family: 'place', title: 'Skylo’s city circuit',
    hint: 'Take a five-stop trip through cities around the world.', criteria: [],
    execution: { kind: 'trivia', packIds: ['city'], questionCount: 5 }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['skylo'], cooldownDays: 1, weight: 3 },
  },
  'quest-gatherglow-pattern': {
    id: 'quest-gatherglow-pattern', family: 'moment', title: 'Follow Gatherglow’s lights',
    hint: 'Watch the glow pattern, then play it back.', criteria: [],
    execution: { kind: 'pattern_memory', gameId: 'gatherglow-lights', difficultyCurveId: 'gatherglow-lights-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['gatherglow'], cooldownDays: 1, weight: 3 },
  },
  'quest-feastle-sort': {
    id: 'quest-feastle-sort', family: 'food', title: 'Set Feastle’s table',
    hint: 'Sort food, drinks and tableware into their proper places.', criteria: [],
    execution: { kind: 'sorting', packId: 'feastle-table', difficultyCurveId: 'feastle-table-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 3 },
  },
  'quest-feastle-merge': {
    id: 'quest-feastle-merge', family: 'food', title: 'Feastle’s Merge Feast',
    hint: 'Merge matching ingredients into bigger dishes and serve two hungry orders.', criteria: [],
    execution: { kind: 'merge', packId: 'feastle-kitchen', difficultyCurveId: 'feastle-merge-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 4 },
  },
  'quest-tasklet-sort': {
    id: 'quest-tasklet-sort', family: 'studio', title: 'Clear Tasklet’s desk',
    hint: 'Sort each task by what it needs next.', criteria: [],
    execution: { kind: 'sorting', packId: 'tasklet-triage', difficultyCurveId: 'tasklet-triage-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['tasklet'], cooldownDays: 1, weight: 3 },
  },
  'quest-feastle-memory': {
    id: 'quest-feastle-memory', family: 'food', title: 'Feastle’s matching feast',
    hint: 'Turn over the table cards and find every matching food.', criteria: [],
    execution: { kind: 'matching', packId: 'feastle-food', difficultyCurveId: 'feastle-memory-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['feastle'], cooldownDays: 1, weight: 2 },
  },
  'quest-relicoon-match': {
    id: 'quest-relicoon-match', family: 'place', title: 'Relicoon’s gallery pairs',
    hint: 'Turn over the gallery cards and reunite each pair.', criteria: [],
    execution: { kind: 'matching', packId: 'relicoon-gallery', difficultyCurveId: 'relicoon-gallery-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['relicoon'], cooldownDays: 1, weight: 3 },
  },
  'quest-encora-rhythm': {
    id: 'quest-encora-rhythm', family: 'studio', title: 'Echo Encora’s rhythm',
    hint: 'Remember the phrase and tap it back in time.', criteria: [],
    execution: { kind: 'rhythm', gameId: 'encora-echo', difficultyCurveId: 'encora-echo-v1' }, requiresCapabilities: [], submissionMode: 'auto',
    eligibility: { creatureKeys: ['encora'], cooldownDays: 1, weight: 3 },
  },
  'quest-new-place': {
    id: 'quest-new-place',
    title: 'Somewhere new',
    hint: 'Visit a spot you haven’t confirmed before and give it meaning.',
    criteria: [{ fact: 'places.confirmedNew', op: 'isTrue', label: 'Reach a new place' }],
  },
  'quest-new-cafe': {
    id: 'quest-new-cafe',
    title: 'Try somewhere new',
    hint: 'Visit a café you haven’t been to and snap a moment there.',
    criteria: [
      { fact: 'places.confirmed', op: 'gte', value: 1, label: 'Confirm a place today' },
      { fact: 'food.moments', op: 'gte', value: 1, label: 'Log a food moment' },
    ],
  },
  'quest-new-park': {
    id: 'quest-new-park',
    family: 'photo',
    submissionMode: 'manual',
    suggestedActions: ['take_photo'],
    title: 'A green spot',
    hint: 'Snap a photo of a park or green space to show me.',
    criteria: [photoQualityCriterion('place.park', 'Photograph a park')],
  },
  'quest-visit-beach': {
    id: 'quest-visit-beach',
    title: 'To the shore',
    hint: 'Spend time by the beach and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'beach', label: 'Confirm a beach' }],
  },
  'quest-visit-forest': {
    id: 'quest-visit-forest',
    title: 'Into the trees',
    hint: 'Walk in a forest or woodland and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'forest', label: 'Confirm a forest' }],
  },
  'quest-visit-garden': {
    id: 'quest-visit-garden',
    title: 'Among the beds',
    hint: 'Visit a garden and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'garden', label: 'Confirm a garden' }],
  },
  'quest-visit-museum': {
    id: 'quest-visit-museum',
    title: 'A wander through the halls',
    hint: 'Visit a museum or gallery and confirm it on your map.',
    criteria: [{ fact: 'places.categories', op: 'includes', value: 'museum', label: 'Confirm a museum' }],
  },
  'quest-weather-storm': {
    id: 'quest-weather-storm',
    title: 'Weather the storm',
    hint: 'Catch a stormy day — a photo of the rain and clouds counts.',
    criteria: [{ fact: 'weather.condition', op: 'equals', value: 'storm', label: 'A stormy day' }],
  },
  'quest-weather-fog': {
    id: 'quest-weather-fog',
    title: 'Into the mist',
    hint: 'Catch a foggy morning — a hazy photo counts.',
    criteria: [{ fact: 'weather.condition', op: 'equals', value: 'fog', label: 'A foggy day' }],
  },
  'quest-long-walk': {
    id: 'quest-long-walk',
    title: 'One long wander',
    hint: 'Take a walk that beats your recent daily average.',
    criteria: [{ fact: 'steps.count', op: 'gte', value: 8000, label: 'Walk 8,000+ steps today' }],
  },
  'quest-snap-today': {
    id: 'quest-snap-today',
    title: 'Catch today',
    hint: 'Capture one moment before the day ends.',
    criteria: [{ fact: 'moments.captured', op: 'gte', value: 1, label: 'Capture a moment today' }],
  },
  'quest-celebrate-note': {
    id: 'quest-celebrate-note',
    family: 'voice',
    title: 'Worth celebrating',
    hint: 'Record a voice note about a moment worth celebrating — yours or someone you love.',
    criteria: [{ fact: 'notes.voiceAdded', op: 'gte', value: 1, label: 'Record a voice note today' }],
    requiresCapabilities: ['microphone'],
    optionalCapabilities: ['speech.transcription', 'appleFoundation'],
    suggestedActions: ['record_voice', 'add_note'],
  },
  'quest-goal-note': {
    id: 'quest-goal-note',
    title: 'One goal, done',
    hint: 'Capture a note about a goal you moved forward today.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Add a note (or voice note) today' }],
  },
  'quest-early-night': {
    id: 'quest-early-night',
    title: 'An early night',
    hint: 'Get to sleep before midnight tonight.',
    criteria: [{ fact: 'sleep.quality', op: 'equals', value: 'good', label: 'Sleep well tonight' }],
  },

  // Cuisine explorers (food_spot creatures) — each wants ITS cuisine family.
  'quest-cuisine-japanese': {
    id: 'quest-cuisine-japanese',
    title: 'A taste of Japan',
    hint: 'Log a Japanese food moment — sushi, ramen, anything.',
    criteria: [{ fact: 'food.cuisines', op: 'includes', value: 'japanese', label: 'Log a Japanese meal' }],
  },
  'quest-cuisine-italian': {
    id: 'quest-cuisine-italian',
    title: 'Buon appetito',
    hint: 'Log an Italian food moment.',
    criteria: [{ fact: 'food.cuisines', op: 'includes', value: 'italian', label: 'Log an Italian meal' }],
  },
  'quest-cuisine-any-new': {
    id: 'quest-cuisine-any-new',
    title: 'Somewhere flavourful',
    hint: 'Log any food moment and tag its cuisine.',
    criteria: [{ fact: 'food.cuisines', op: 'gte', value: 1, label: 'Tag a cuisine today' }],
  },

  // Culture / inspiration (bookstore, cinema, library, museum creatures).
  'quest-read-book': {
    id: 'quest-read-book',
    title: 'Between the pages',
    hint: 'Log a book in your Studio.',
    criteria: [{ fact: 'studio.media', op: 'includes', value: 'book', label: 'Log a book' }],
  },
  'quest-watch-film': {
    id: 'quest-watch-film',
    title: 'Roll the reel',
    hint: 'Log a film or show in your Studio.',
    criteria: [{ fact: 'studio.media', op: 'includes', value: 'film', label: 'Log a film' }],
  },
  'quest-any-inspiration': {
    id: 'quest-any-inspiration',
    title: 'Something that moved you',
    hint: 'Log any inspiration — a book, film, show, or game.',
    criteria: [{ fact: 'studio.media', op: 'gte', value: 1, label: 'Log an inspiration' }],
  },

  // Subject photos (subject/moment creatures) — Apple Vision labels via the
  // photo-labels provider. `includes` matches the canonical concept.
  'quest-photo-cat': {
    id: 'quest-photo-cat',
    title: 'A cat in the frame',
    hint: 'Snap a photo with a cat in it.',
    criteria: [photoQualityCriterion('subject.cat', 'Photograph a cat')],
  },
  'quest-photo-dog': {
    id: 'quest-photo-dog',
    title: 'Good dog',
    hint: 'Snap a photo with a dog in it.',
    criteria: [photoQualityCriterion('subject.dog', 'Photograph a dog')],
  },
  'quest-photo-food': {
    id: 'quest-photo-food',
    title: 'Feast for the eyes',
    hint: 'Snap a photo of your food.',
    criteria: [photoQualityCriterion('subject.food', 'Photograph a meal')],
  },
  'quest-photo-flowers': {
    id: 'quest-photo-flowers',
    title: 'In bloom',
    hint: 'Snap a photo of some flowers.',
    criteria: [photoQualityCriterion('nature.flowers', 'Photograph flowers')],
  },
  'quest-photo-water': {
    id: 'quest-photo-water',
    title: 'By the water',
    hint: 'Snap a photo of the sea, a lake, or a river.',
    criteria: [photoQualityCriterion('nature.water', 'Photograph water')],
  },
  'quest-photo-mountains': {
    id: 'quest-photo-mountains',
    title: 'Reach the heights',
    hint: 'Snap a photo of mountains or hills.',
    criteria: [photoQualityCriterion('nature.mountains', 'Photograph the hills')],
  },
  'quest-photo-stars': {
    id: 'quest-photo-stars',
    title: 'Under the stars',
    hint: 'Snap a photo of the night sky.',
    criteria: [photoQualityCriterion('nature.stars', 'Photograph the night sky')],
  },
  'quest-photo-sunset': {
    id: 'quest-photo-sunset',
    title: 'Chase the light',
    hint: 'Snap a photo at sunset or sunrise.',
    criteria: [photoQualityCriterion('nature.sunset', 'Photograph the golden hour')],
  },
  'quest-photo-snow': {
    id: 'quest-photo-snow',
    title: 'First flurries',
    hint: 'Snap a photo of the snow.',
    criteria: [photoQualityCriterion('nature.snow', 'Photograph snow')],
  },
  'quest-photo-autumn': {
    id: 'quest-photo-autumn',
    title: 'Turning leaves',
    hint: 'Snap a photo of autumn colours.',
    criteria: [photoQualityCriterion('nature.autumn', 'Photograph autumn')],
  },
  'quest-photo-blossom': {
    id: 'quest-photo-blossom',
    title: 'Blossom season',
    hint: 'Snap a photo of spring blossom.',
    criteria: [photoQualityCriterion('nature.blossom', 'Photograph blossom')],
  },
  'quest-photo-baby': {
    id: 'quest-photo-baby',
    title: 'Little one',
    hint: 'Snap a photo of the little one.',
    criteria: [photoQualityCriterion('subject.baby', 'Photograph the little one')],
  },
  'quest-photo-city': {
    id: 'quest-photo-city',
    title: 'City lights',
    hint: 'Snap a photo of the city skyline.',
    criteria: [photoQualityCriterion('place.city', 'Photograph the city')],
  },

  // Time-of-day (dawn / small-hours creatures) — from capture timestamps.
  'quest-dawn-capture': {
    id: 'quest-dawn-capture',
    title: 'Catch the dawn',
    hint: 'Capture a moment early — before 8am.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'time.before_8am', sourceTypes: ['photo'], label: 'A photo before 8am' }],
  },
  'quest-late-capture': {
    id: 'quest-late-capture',
    title: 'The small hours',
    hint: 'Capture a moment between 11pm and 5am.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'time.late_night', sourceTypes: ['photo'], label: 'A photo between 11pm and 5am' }],
  },
};

const PHOTO_QUALITY_IDS: Record<string, string> = {
  cat: 'subject.cat', dog: 'subject.dog', food: 'subject.food', flowers: 'nature.flowers',
  water: 'nature.water', mountains: 'nature.mountains', stars: 'nature.stars', sunset: 'nature.sunset',
  snow: 'nature.snow', autumn: 'nature.autumn', blossom: 'nature.blossom', baby: 'subject.baby',
  city: 'place.city', park: 'place.park',
};

export const QUEST_DEFINITIONS: Record<string, QuestDefinition> = withQuestMetadata(RAW_QUEST_DEFINITIONS);

function withQuestMetadata(definitions: Record<string, QuestDefinition>): Record<string, QuestDefinition> {
  return Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => {
      const criteria = definition.criteria.map((criterion) => {
        const qualityId =
          criterion.fact === 'evidence.items' && criterion.sourceTypes?.includes('photo')
            ? PHOTO_QUALITY_IDS[String(criterion.value ?? '')]
            : null;
        return qualityId
          ? {
              ...criterion,
              fact: 'memory.qualities' as const,
              op: 'qualityAtLeast' as const,
              value: qualityId,
              minConfidence: qualityThresholds(qualityId).ready,
            }
          : criterion;
      });
      const normalizedDefinition = { ...definition, criteria };
      const family = definition.family ?? inferFamily(normalizedDefinition);
      const requiresCapabilities = definition.requiresCapabilities ?? inferRequiredCapabilities(definition, family);
      const optionalCapabilities = definition.optionalCapabilities ?? inferOptionalCapabilities(definition, family);
      const suggestedActions = definition.suggestedActions ?? inferSuggestedActions(family);
      const themes = Array.from(new Set([...(definition.themes ?? []), ...inferThemes(definition, family)]));
      const evidencePolicy = definition.evidencePolicy ?? inferEvidencePolicy(normalizedDefinition);
      return [
        id,
        {
          ...normalizedDefinition,
          family: family ?? undefined,
          submissionMode: definition.submissionMode ?? inferSubmissionMode(family),
          themes,
          requiresCapabilities,
          optionalCapabilities,
          suggestedActions,
          evidencePolicy,
        },
      ];
    })
  );
}

function inferFamily(definition: QuestDefinition): QuestDefinition['family'] | undefined {
  if (definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) return 'place';
  if (definition.criteria.some((criterion) => criterion.fact === 'memory.qualities')) return 'photo';
  if (definition.criteria.some((criterion) => criterion.fact === 'evidence.items' && criterion.sourceTypes?.includes('photo'))) return 'photo';
  if (definition.criteria.some((criterion) => criterion.fact === 'moments.captured')) return 'moment';
  if (definition.criteria.some((criterion) => criterion.fact === 'steps.count')) return 'movement';
  if (definition.criteria.some((criterion) => criterion.fact === 'notes.added')) {
    return definition.id.includes('celebrate') ? 'voice' : 'note';
  }
  if (definition.criteria.some((criterion) => criterion.fact === 'food.cuisines' || criterion.fact === 'food.moments')) return 'food';
  if (definition.criteria.some((criterion) => criterion.fact === 'studio.media')) return 'studio';
  if (definition.criteria.some((criterion) => criterion.fact === 'sleep.quality')) return 'sleep';
  if (definition.criteria.some((criterion) => criterion.fact === 'weather.condition')) return 'weather';
  if (definition.criteria.some((criterion) => criterion.fact === 'capture.earliestHour' || criterion.fact === 'capture.latestHour')) return 'photo';
  return undefined;
}

function inferRequiredCapabilities(
  definition: QuestDefinition,
  family: QuestDefinition['family'] | undefined
): QuestCapabilityId[] {
  const required = new Set<QuestCapabilityId>();
  if (family === 'photo' || family === 'moment') required.add('camera.capture');
  if (family === 'place') required.add('location.foreground');
  if (family === 'movement') required.add('health.steps');
  if (family === 'sleep') required.add('health.sleep');
  if (family === 'voice') {
    required.add('microphone');
    required.add('speech.transcription');
  }
  if (definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo') || criterion.fact === 'memory.qualities')) required.add('camera.capture');
  if (definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) {
    required.add('location.foreground');
  }
  return [...required];
}

function inferOptionalCapabilities(
  definition: QuestDefinition,
  family: QuestDefinition['family'] | undefined
): QuestCapabilityId[] {
  const optional = new Set<QuestCapabilityId>();
  if (family === 'photo' || definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo') || criterion.fact === 'memory.qualities')) {
    optional.add('photos.read');
    optional.add('appleVision');
  }
  if (family === 'place' || definition.criteria.some((criterion) => criterion.fact === 'places.categories' || criterion.fact === 'places.confirmed')) {
    optional.add('location.background');
  }
  if (family === 'voice') optional.add('appleFoundation');
  return [...optional];
}

function inferSuggestedActions(family: QuestDefinition['family'] | undefined): string[] {
  switch (family) {
    case 'photo':
    case 'moment':
      return ['take_photo'];
    case 'place':
      return ['confirm_place'];
    case 'voice':
      return ['record_voice'];
    case 'note':
      return ['add_note'];
    case 'movement':
    case 'sleep':
      return ['open_health'];
    default:
      return [];
  }
}

function inferSubmissionMode(family: QuestDefinition['family'] | undefined): QuestDefinition['submissionMode'] {
  switch (family) {
    case 'photo':
    case 'moment':
    case 'note':
    case 'voice':
    case 'food':
    case 'studio':
      return 'manual';
    default:
      return 'auto';
  }
}

function inferThemes(definition: QuestDefinition, family: QuestDefinition['family'] | undefined): string[] {
  const themes = new Set<string>();
  if (family) themes.add(family);
  for (const criterion of definition.criteria) {
    if (typeof criterion.value === 'string') themes.add(criterion.value);
    if (criterion.fact === 'weather.condition') themes.add('weather');
    if (criterion.fact === 'studio.media') themes.add('culture');
  }
  if (definition.id.includes('cuisine')) themes.add('food');
  if (definition.id.includes('dawn')) themes.add('morning');
  if (definition.id.includes('late')) themes.add('night');
  return [...themes];
}

function inferEvidencePolicy(definition: QuestDefinition): QuestDefinition['evidencePolicy'] | undefined {
  const evidenceCriteria = definition.criteria.filter((criterion) => criterion.fact === 'evidence.items' || criterion.fact === 'memory.qualities');
  if (evidenceCriteria.length === 0) return undefined;
  const confidenceValues = evidenceCriteria
    .map((criterion) => criterion.minConfidence)
    .filter((value): value is number => typeof value === 'number');
  return {
    minConfidence: confidenceValues.length ? Math.min(...confidenceValues) : 0.6,
    allowCorroboration: evidenceCriteria.some((criterion) => criterion.op === 'evidenceCorroborated'),
  };
}

export function questDefinition(questId: string): QuestDefinition | null {
  return QUEST_DEFINITIONS[questId] ?? null;
}
