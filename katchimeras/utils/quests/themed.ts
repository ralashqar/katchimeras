import { questDefinition } from './definitions';

export type ThemedQuestOffer = { id: string; title: string; hint: string };

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

export function themedQuestOffer(subtype: string, archetype: string): ThemedQuestOffer | undefined {
  const ids = [...(THEME_QUEST_POOL[subtype] ?? []), ...(ARCHETYPE_QUEST_POOL[archetype] ?? []), 'quest-snap-today'];
  const questId = ids.find((id, index) => ids.indexOf(id) === index && questDefinition(id));
  const def = questId ? questDefinition(questId) : null;
  return def ? { id: def.id, title: def.title, hint: def.hint } : undefined;
}

