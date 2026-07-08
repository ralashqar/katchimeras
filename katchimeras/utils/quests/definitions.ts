import type { QuestCapabilityId } from '@/utils/capabilities/quest-capabilities';
import type { Criterion } from '@/utils/signals/facts';

// Declarative companion-quest catalogue (docs/katchimera-engagement-v1.md
// refactor). A quest is DATA: id + copy + a list of criteria against facts.
// The same criteria drive both the journal checklist and completion — no more
// parallel switch statements. Add a quest = add an entry; add a capability =
// add a fact + provider and reference it here.

export type QuestDefinition = {
  id: string;
  family?: 'photo' | 'place' | 'movement' | 'note' | 'voice' | 'food' | 'studio' | 'sleep' | 'weather' | 'calendar';
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

const RAW_QUEST_DEFINITIONS: Record<string, QuestDefinition> = {
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
    title: 'A new green spot',
    hint: 'Visit a park and snap a photo there to show me.',
    criteria: [
      { fact: 'places.categories', op: 'includes', value: 'park', label: 'Confirm a park' },
      {
        fact: 'evidence.items',
        op: 'evidenceIncludes',
        value: 'park',
        minConfidence: 0.55,
        sourceTypes: ['photo'],
        label: 'Snap a photo of the park',
      },
    ],
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
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'cat', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph a cat' }],
  },
  'quest-photo-dog': {
    id: 'quest-photo-dog',
    title: 'Good dog',
    hint: 'Snap a photo with a dog in it.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'dog', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph a dog' }],
  },
  'quest-photo-food': {
    id: 'quest-photo-food',
    title: 'Feast for the eyes',
    hint: 'Snap a photo of your food.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'food', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph a meal' }],
  },
  'quest-photo-flowers': {
    id: 'quest-photo-flowers',
    title: 'In bloom',
    hint: 'Snap a photo of some flowers.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'flowers', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph flowers' }],
  },
  'quest-photo-water': {
    id: 'quest-photo-water',
    title: 'By the water',
    hint: 'Snap a photo of the sea, a lake, or a river.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'water', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph water' }],
  },
  'quest-photo-mountains': {
    id: 'quest-photo-mountains',
    title: 'Reach the heights',
    hint: 'Snap a photo of mountains or hills.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'mountains', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph the hills' }],
  },
  'quest-photo-stars': {
    id: 'quest-photo-stars',
    title: 'Under the stars',
    hint: 'Snap a photo of the night sky.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'stars', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph the night sky' }],
  },
  'quest-photo-sunset': {
    id: 'quest-photo-sunset',
    title: 'Chase the light',
    hint: 'Snap a photo at sunset or sunrise.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'sunset', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph the golden hour' }],
  },
  'quest-photo-snow': {
    id: 'quest-photo-snow',
    title: 'First flurries',
    hint: 'Snap a photo of the snow.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'snow', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph snow' }],
  },
  'quest-photo-autumn': {
    id: 'quest-photo-autumn',
    title: 'Turning leaves',
    hint: 'Snap a photo of autumn colours.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'autumn', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph autumn' }],
  },
  'quest-photo-blossom': {
    id: 'quest-photo-blossom',
    title: 'Blossom season',
    hint: 'Snap a photo of spring blossom.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'blossom', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph blossom' }],
  },
  'quest-photo-baby': {
    id: 'quest-photo-baby',
    title: 'Little one',
    hint: 'Snap a photo of the little one.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'baby', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph the little one' }],
  },
  'quest-photo-city': {
    id: 'quest-photo-city',
    title: 'City lights',
    hint: 'Snap a photo of the city skyline.',
    criteria: [{ fact: 'evidence.items', op: 'evidenceIncludes', value: 'city', minConfidence: 0.62, sourceTypes: ['photo'], label: 'Photograph the city' }],
  },

  // Time-of-day (dawn / small-hours creatures) — from capture timestamps.
  'quest-dawn-capture': {
    id: 'quest-dawn-capture',
    title: 'Catch the dawn',
    hint: 'Capture a moment early — before 8am.',
    criteria: [{ fact: 'capture.earliestHour', op: 'lt', value: 8, label: 'A moment before 8am' }],
  },
  'quest-late-capture': {
    id: 'quest-late-capture',
    title: 'The small hours',
    hint: 'Capture a moment late — after 11pm.',
    criteria: [{ fact: 'capture.latestHour', op: 'gte', value: 23, label: 'A moment after 11pm' }],
  },
};

export const QUEST_DEFINITIONS: Record<string, QuestDefinition> = withQuestMetadata(RAW_QUEST_DEFINITIONS);

function withQuestMetadata(definitions: Record<string, QuestDefinition>): Record<string, QuestDefinition> {
  return Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => {
      const family = definition.family ?? inferFamily(definition);
      const requiresCapabilities = definition.requiresCapabilities ?? inferRequiredCapabilities(definition, family);
      const optionalCapabilities = definition.optionalCapabilities ?? inferOptionalCapabilities(definition, family);
      const suggestedActions = definition.suggestedActions ?? inferSuggestedActions(family);
      const themes = Array.from(new Set([...(definition.themes ?? []), ...inferThemes(definition, family)]));
      const evidencePolicy = definition.evidencePolicy ?? inferEvidencePolicy(definition);
      return [
        id,
        {
          ...definition,
          family: family ?? undefined,
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
  if (definition.criteria.some((criterion) => criterion.fact === 'evidence.items' && criterion.sourceTypes?.includes('photo'))) return 'photo';
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
  if (family === 'photo') required.add('camera.capture');
  if (family === 'place') required.add('location.foreground');
  if (family === 'movement') required.add('health.steps');
  if (family === 'sleep') required.add('health.sleep');
  if (family === 'voice') {
    required.add('microphone');
    required.add('speech.transcription');
  }
  if (definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo'))) required.add('camera.capture');
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
  if (family === 'photo' || definition.criteria.some((criterion) => criterion.sourceTypes?.includes('photo'))) {
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
  const evidenceCriteria = definition.criteria.filter((criterion) => criterion.fact === 'evidence.items');
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
