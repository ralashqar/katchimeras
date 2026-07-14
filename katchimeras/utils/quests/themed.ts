import { questDefinition } from './definitions';

export type ThemedQuestOffer = { id: string; title: string; hint: string; weight?: number };

const CREATURE_QUEST_POOL: Record<string, string[]> = {
  bedrotte: ['quest-bedrotte-breathe', 'quest-early-night'],
  steppling: ['quest-steppling-stride', 'quest-step-sprint', 'quest-step-time-trial', 'quest-long-walk'],
  flickerbun: ['quest-film-trivia', 'quest-watch-film', 'quest-any-inspiration'],
  pagelet: ['quest-book-trivia', 'quest-pagelet-lost-word', 'quest-read-book', 'quest-any-inspiration'],
  mossprout: ['quest-mossprout-memory', 'quest-new-park'],
  skylo: ['quest-skylo-city-trivia', 'quest-photo-city'],
  gatherglow: ['quest-gatherglow-pattern', 'quest-snap-today'],
  feastle: ['quest-feastle-sort', 'quest-feastle-memory', 'quest-photo-food', 'quest-cuisine-any-new'],
  tasklet: ['quest-tasklet-sort', 'quest-goal-note'],
  relicoon: ['quest-relicoon-match', 'quest-visit-museum'],
  encora: ['quest-encora-rhythm', 'quest-any-inspiration'],
};

const THEME_QUEST_POOL: Record<string, string[]> = {
  coffee_shop: ['quest-new-cafe', 'quest-photo-food'],
  sushi_place: ['quest-cuisine-japanese', 'quest-photo-food'],
  ramen_place: ['quest-cuisine-japanese', 'quest-photo-food'],
  pizza_place: ['quest-cuisine-italian', 'quest-photo-food'],
  bakery: ['quest-cuisine-any-new', 'quest-new-cafe'],
  dessert_shop: ['quest-cuisine-any-new', 'quest-photo-food'],
  bubble_tea_shop: ['quest-cuisine-any-new', 'quest-new-cafe'],
  bookstore: ['quest-read-book', 'quest-any-inspiration'],
  library: ['quest-read-book', 'quest-any-inspiration'],
  cinema: ['quest-watch-film', 'quest-any-inspiration'],
  dawn: ['quest-dawn-capture', 'quest-snap-today'],
  small_hours: ['quest-late-capture', 'quest-snap-today'],
  good_sleep: ['quest-early-night'],
  cat: ['quest-photo-cat'],
  dog: ['quest-photo-dog'],
  food: ['quest-photo-food', 'quest-cuisine-any-new'],
  blossom: ['quest-photo-blossom'],
  water: ['quest-photo-water'],
  mountains: ['quest-photo-mountains'],
  stars: ['quest-photo-stars'],
  sunset: ['quest-photo-sunset'],
  snow: ['quest-photo-snow'],
  autumn: ['quest-photo-autumn'],
  baby: ['quest-photo-baby'],
  city: ['quest-photo-city'],
  park: ['quest-new-park'],
  beach: ['quest-visit-beach', 'quest-photo-water'],
  forest: ['quest-visit-forest'],
  garden: ['quest-visit-garden', 'quest-photo-flowers'],
  museum: ['quest-visit-museum', 'quest-any-inspiration'],
  storm: ['quest-weather-storm'],
  fog: ['quest-weather-fog'],
};

const ARCHETYPE_QUEST_POOL: Record<string, string[]> = {
  food: ['quest-new-cafe', 'quest-cuisine-any-new'],
  journey: ['quest-long-walk'],
  places: ['quest-new-park', 'quest-snap-today'],
  celebrate: ['quest-celebrate-note'],
  craft: ['quest-goal-note'],
  culture: ['quest-any-inspiration'],
  night: ['quest-early-night'],
  memory: ['quest-snap-today'],
};

export function themedQuestOffers(subtype: string, archetype: string, creatureKey = ''): ThemedQuestOffer[] {
  const ids = [
    ...(CREATURE_QUEST_POOL[creatureKey.toLowerCase()] ?? []),
    ...(THEME_QUEST_POOL[subtype] ?? []),
    ...(ARCHETYPE_QUEST_POOL[archetype] ?? []),
    'quest-snap-today',
  ];
  return ids
    .filter((id, index) => ids.indexOf(id) === index)
    .map((id) => questDefinition(id))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition))
    .filter((definition) => {
      const keys = definition.eligibility?.creatureKeys;
      return !keys?.length || keys.includes(creatureKey.toLowerCase());
    })
    .map((definition) => ({ id: definition.id, title: definition.title, hint: definition.hint, weight: definition.eligibility?.weight }));
}

export function themedQuestOffer(subtype: string, archetype: string, creatureKey = ''): ThemedQuestOffer | undefined {
  return themedQuestOffers(subtype, archetype, creatureKey)[0];
}
