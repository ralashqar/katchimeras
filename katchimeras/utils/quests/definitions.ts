import type { Criterion } from '@/utils/signals/facts';

// Declarative companion-quest catalogue (docs/katchimera-engagement-v1.md
// refactor). A quest is DATA: id + copy + a list of criteria against facts.
// The same criteria drive both the journal checklist and completion — no more
// parallel switch statements. Add a quest = add an entry; add a capability =
// add a fact + provider and reference it here.

export type QuestDefinition = {
  id: string;
  title: string;
  hint: string;
  criteria: Criterion[];
};

export const QUEST_DEFINITIONS: Record<string, QuestDefinition> = {
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
    hint: 'Visit a park you haven’t confirmed before and snap a photo there to show me.',
    criteria: [
      { fact: 'places.confirmed', op: 'gte', value: 1, label: 'Confirm a place today' },
      { fact: 'moments.captured', op: 'gte', value: 1, label: 'Snap a moment there' },
    ],
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
    title: 'Worth celebrating',
    hint: 'Record a voice note about a moment worth celebrating — yours or someone you love.',
    criteria: [{ fact: 'notes.added', op: 'gte', value: 1, label: 'Add a note (or voice note) today' }],
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
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'cat', label: 'Photograph a cat' }],
  },
  'quest-photo-dog': {
    id: 'quest-photo-dog',
    title: 'Good dog',
    hint: 'Snap a photo with a dog in it.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'dog', label: 'Photograph a dog' }],
  },
  'quest-photo-food': {
    id: 'quest-photo-food',
    title: 'Feast for the eyes',
    hint: 'Snap a photo of your food.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'food', label: 'Photograph a meal' }],
  },
  'quest-photo-flowers': {
    id: 'quest-photo-flowers',
    title: 'In bloom',
    hint: 'Snap a photo of some flowers.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'flowers', label: 'Photograph flowers' }],
  },
  'quest-photo-water': {
    id: 'quest-photo-water',
    title: 'By the water',
    hint: 'Snap a photo of the sea, a lake, or a river.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'water', label: 'Photograph water' }],
  },
  'quest-photo-mountains': {
    id: 'quest-photo-mountains',
    title: 'Reach the heights',
    hint: 'Snap a photo of mountains or hills.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'mountains', label: 'Photograph the hills' }],
  },
  'quest-photo-stars': {
    id: 'quest-photo-stars',
    title: 'Under the stars',
    hint: 'Snap a photo of the night sky.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'stars', label: 'Photograph the night sky' }],
  },
  'quest-photo-sunset': {
    id: 'quest-photo-sunset',
    title: 'Chase the light',
    hint: 'Snap a photo at sunset or sunrise.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'sunset', label: 'Photograph the golden hour' }],
  },
  'quest-photo-snow': {
    id: 'quest-photo-snow',
    title: 'First flurries',
    hint: 'Snap a photo of the snow.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'snow', label: 'Photograph snow' }],
  },
  'quest-photo-autumn': {
    id: 'quest-photo-autumn',
    title: 'Turning leaves',
    hint: 'Snap a photo of autumn colours.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'autumn', label: 'Photograph autumn' }],
  },
  'quest-photo-blossom': {
    id: 'quest-photo-blossom',
    title: 'Blossom season',
    hint: 'Snap a photo of spring blossom.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'blossom', label: 'Photograph blossom' }],
  },
  'quest-photo-baby': {
    id: 'quest-photo-baby',
    title: 'Little one',
    hint: 'Snap a photo of the little one.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'baby', label: 'Photograph the little one' }],
  },
  'quest-photo-city': {
    id: 'quest-photo-city',
    title: 'City lights',
    hint: 'Snap a photo of the city skyline.',
    criteria: [{ fact: 'photo.labels', op: 'includes', value: 'city', label: 'Photograph the city' }],
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

export function questDefinition(questId: string): QuestDefinition | null {
  return QUEST_DEFINITIONS[questId] ?? null;
}
