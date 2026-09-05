import type { KingdomState } from '@/types/kingdom';
import { themedQuestOffer, themedQuestOffers, type ThemedQuestOffer } from '@/utils/quests/themed';

// Katchimera Engagement T1 rule engine (docs/katchimera-engagement-v1.md):
// one engagement unit per companion-card open, computed from the user's own
// lifetime signals. Voice stays template-owned here; the Foundation Models
// pass (V1b) will rephrase these in persona without changing the facts.

export type CompanionUnit = {
  /** Short line in the creature's voice — the insight/suggestion. */
  line: string;
  /** Optional quest offer (V1a: copy only; store + evaluators come next). */
  quest?: ThemedQuestOffer;
  questOptions?: ThemedQuestOffer[];
};

// The encounter registry records WHY each katchimera hatches (its trigger
// category — cafe, movement, rest, moment, park…), which is exactly what the
// companion should talk about. No guessing: resolve creatureId → category →
// engagement archetype.
const ENCOUNTER_CAST: { id: string; name: string; triggerCategory: string; triggerSubtype: string; visualKey?: string }[] = require('../data/katchimeras/encounter-katchimeras.json');

const CATEGORY_ARCHETYPE: Record<string, string> = {
  cafe: 'food',
  food_spot: 'food',
  farm: 'food',
  movement: 'journey',
  sport: 'journey',
  park: 'places',
  forest: 'places',
  beach: 'places',
  garden: 'places',
  riverwalk: 'places',
  culture: 'culture',
  global_landmark: 'places',
  rest: 'night',
  time: 'night',
  moment: 'memory',
  connection: 'memory',
  companion: 'memory',
  emotion: 'celebrate',
  hobby: 'craft',
};

// Some categories are too broad — the SUBTYPE decides (e.g. 'moment' spans
// Cheerlet/celebration and Tasklet/focus_work, which deserve their own units).
const SUBTYPE_ARCHETYPE: Record<string, string> = {
  celebration: 'celebrate',
  focus_work: 'craft',
  creative: 'craft',
  food: 'food',
  gym: 'journey',
  travel: 'places',
  city: 'places',
  mountains: 'places',
};

function resolveCategory(category: string, subtype: string): string {
  return SUBTYPE_ARCHETYPE[subtype] ?? CATEGORY_ARCHETYPE[category] ?? '';
}

function visualKeyForEntry(entry: { id: string; visualKey?: string }): string {
  return (entry.visualKey ?? entry.id.split('_').at(-1) ?? '').toLowerCase();
}

let castIndex: Map<string, string> | null = null;
let nameIndex: Map<string, string> | null = null;
let visualIndex: Map<string, string> | null = null;
export function archetypeForCreature(creatureId: string, fallbackText = ''): string {
  if (!castIndex) {
    castIndex = new Map(ENCOUNTER_CAST.map((entry) => [entry.id, resolveCategory(entry.triggerCategory, entry.triggerSubtype)]));
  }
  const fromRegistry = castIndex.get(creatureId);
  if (fromRegistry) return fromRegistry;
  // Profile creatureIds don't always match registry ids across hatch-system
  // generations — the NAME is stable, so try it next (fallbackText starts
  // with the creature's name).
  const nameKey = fallbackText.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!nameIndex) {
    nameIndex = new Map(ENCOUNTER_CAST.map((entry) => [entry.name.toLowerCase(), resolveCategory(entry.triggerCategory, entry.triggerSubtype)]));
    visualIndex = new Map(ENCOUNTER_CAST.map((entry) => [visualKeyForEntry(entry), resolveCategory(entry.triggerCategory, entry.triggerSubtype)]));
  }
  const fromName = nameIndex.get(nameKey);
  if (fromName) return fromName;
  const visualKey = fallbackText.trim().split(/\s+/).find((part) => visualIndex!.has(part.toLowerCase()))?.toLowerCase();
  if (visualKey) return visualIndex!.get(visualKey) ?? '';
  // Legacy-profile creatures predate the encounter registry (old hatch-system
  // ids) — fall back to a keyword read of the name/visualKey.
  const s = `${creatureId} ${fallbackText}`.toLowerCase();
  if (/(bar|brew|crumb|chef|snack|berry|spice|food|cafe)/.test(s)) return 'food';
  if (/(stroll|trek|dash|step|wander|hike|storm|journey)/.test(s)) return 'journey';
  if (/(luna|noct|dream|snooze|night|dusk|sleep|fog)/.test(s)) return 'night';
  if (/(snap|lens|memo|photo|tender)/.test(s)) return 'memory';
  if (/(park|garden|beach|forest|travel|place)/.test(s)) return 'places';
  return '';
}

// The raw hatch subtype (sushi_place, cinema, dawn…) — lets a companion offer
// a quest specific to WHY it hatched, not just its broad archetype.
let subtypeById: Map<string, string> | null = null;
let subtypeByName: Map<string, string> | null = null;
let subtypeByVisual: Map<string, string> | null = null;
export function subtypeForCreature(creatureId: string, fallbackText = ''): string {
  if (!subtypeById) {
    subtypeById = new Map(ENCOUNTER_CAST.map((entry) => [entry.id, entry.triggerSubtype]));
    subtypeByName = new Map(ENCOUNTER_CAST.map((entry) => [entry.name.toLowerCase(), entry.triggerSubtype]));
    subtypeByVisual = new Map(ENCOUNTER_CAST.map((entry) => [visualKeyForEntry(entry), entry.triggerSubtype]));
  }
  const nameKey = fallbackText.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const visualKey = fallbackText.trim().split(/\s+/).find((part) => subtypeByVisual!.has(part.toLowerCase()))?.toLowerCase();
  return subtypeById.get(creatureId) ?? subtypeByName!.get(nameKey) ?? (visualKey ? subtypeByVisual!.get(visualKey) : undefined) ?? '';
}

// Declarative quest-offer resolution: subtype wins, else archetype default.
// The quest COPY comes from QUEST_DEFINITIONS (single source of truth) — this
// only decides WHICH quest a given creature offers.
const SUBTYPE_QUEST: Record<string, string> = {
  coffee_shop: 'quest-new-cafe',
  sushi_place: 'quest-cuisine-japanese',
  ramen_place: 'quest-cuisine-japanese',
  pizza_place: 'quest-cuisine-italian',
  bakery: 'quest-cuisine-any-new',
  dessert_shop: 'quest-cuisine-any-new',
  bubble_tea_shop: 'quest-cuisine-any-new',
  bookstore: 'quest-read-book',
  library: 'quest-read-book',
  cinema: 'quest-watch-film',
  dawn: 'quest-dawn-capture',
  small_hours: 'quest-late-capture',
  good_sleep: 'quest-early-night',
  // Subject-photo creatures → snap-that-subject quests (Apple Vision labels).
  cat: 'quest-photo-cat',
  dog: 'quest-photo-dog',
  food: 'quest-photo-food',
  blossom: 'quest-photo-blossom',
  water: 'quest-photo-water',
  mountains: 'quest-photo-mountains',
  stars: 'quest-photo-stars',
  sunset: 'quest-photo-sunset',
  snow: 'quest-photo-snow',
  autumn: 'quest-photo-autumn',
  baby: 'quest-photo-baby',
  city: 'quest-photo-city',
  // Location creatures → confirm-that-place quests (place-category signal).
  park: 'quest-new-park',
  beach: 'quest-visit-beach',
  forest: 'quest-visit-forest',
  garden: 'quest-visit-garden',
  museum: 'quest-visit-museum',
  // Weather creatures → catch-that-weather quests.
  storm: 'quest-weather-storm',
  fog: 'quest-weather-fog',
};
const ARCHETYPE_QUEST: Record<string, string> = {
  food: 'quest-new-cafe',
  journey: 'quest-long-walk',
  places: 'quest-new-park',
  celebrate: 'quest-celebrate-note',
  craft: 'quest-goal-note',
  culture: 'quest-any-inspiration',
  night: 'quest-early-night',
  memory: 'quest-snap-today',
};

function questOffer(subtype: string, archetype: string, creatureKey = ''): CompanionUnit['quest'] {
  return themedQuestOffer(subtype, archetype, creatureKey);
}

// The insight LINE per archetype (the quest is chosen separately by subtype →
// questOffer, so a sushi creature and a bakery creature share the food voice
// but offer different quests).
function insightLine(archetype: string, kingdom: KingdomState): string {
  const t = kingdom.totals;
  switch (archetype) {
    case 'food':
    case 'savour':
      return t.foodMoments > 0
        ? `You've savoured ${t.foodMoments} food moments together. The best ones were somewhere new…`
        : `We haven't logged a single tasty moment yet. Let's fix that.`;
    case 'journey':
    case 'active':
      return `${Math.round(t.steps / 1000)}k steps walked in this life so far. Every ring of this kingdom is paved with them.`;
    case 'places':
      return t.places > 0
        ? `${t.places} places given meaning so far. The map still has green corners calling us.`
        : `We haven't marked a single place yet — the whole map is waiting.`;
    case 'celebrate':
      return t.bigMoments > 0
        ? `${t.bigMoments} big moments celebrated together already. There's always one more hiding in an ordinary day.`
        : `We haven't celebrated anything yet — surely something deserves it.`;
    case 'craft':
      return t.notes > 0
        ? `${t.notes} notes kept so far. Progress loves being written down.`
        : `Nothing written yet — even one line about today's work counts.`;
    case 'culture':
      return t.studioMoments > 0
        ? `${t.studioMoments} stories, films and ideas kept in the Studio so far. What's the next one?`
        : `The Studio shelves are bare — give me a book or a film to remember.`;
    case 'night':
    case 'sleep':
      return `The quiet hours build us too. Guard tonight's sleep and I'll grow stronger.`;
    case 'memory':
    case 'tender':
      return t.photos > 0
        ? `${t.photos} moments kept safe so far. The unphotographed days fade fastest…`
        : `Not one photo yet — give me something to keep.`;
    default:
      return `This corner of the kingdom exists because of the day we met. ${t.daysHatched} days lived and counting.`;
  }
}

// The full companion engagement: archetype-voiced insight + the creature's
// most specific quest (subtype-first). Every companion ALWAYS has an offer —
// a lifeless card reads as broken.
export function companionUnit(archetype: string, kingdom: KingdomState, subtype = '', creatureKey = ''): CompanionUnit {
  const questOptions = themedQuestOffers(subtype, archetype, creatureKey);
  return { line: insightLine(archetype, kingdom), quest: questOffer(subtype, archetype, creatureKey), questOptions };
}

// A gentle open question in the creature's theme — invites the user to reflect
// (and optionally answer in a note). The FM voice pass (slice 2) rephrases
// these in persona; this rule text is the fallback.
export function reflectionLine(archetype: string): string {
  switch (archetype) {
    case 'food':
      return `What did the last meal you truly savoured taste like — and who were you with?`;
    case 'journey':
    case 'active':
      return `When did a walk last clear your head? Where did your feet take you?`;
    case 'places':
      return `Which place have you kept returning to lately — and what pulls you back?`;
    case 'celebrate':
      return `What small thing this week deserved more of a celebration than it got?`;
    case 'craft':
      return `What are you quietly proud of finishing lately, even if no one noticed?`;
    case 'culture':
      return `What's a story, film or idea that's stayed with you this week?`;
    case 'night':
    case 'sleep':
      return `What helps you truly rest — and when did you last let yourself have it?`;
    case 'memory':
    case 'tender':
      return `Which ordinary moment lately do you wish you'd kept a photo of?`;
    default:
      return `Looking back on today — what's one thing you don't want to forget?`;
  }
}

// The opening speech-bubble line, keyed to the resident's interaction state.
export function openingLine(name: string, state: 'offer' | 'active' | 'ready' | 'idle'): string {
  switch (state) {
    case 'offer':
      return `Oh — good, you're here. I've been meaning to ask you something…`;
    case 'active':
      return `Still on it? No rush. Come tell me how it's going.`;
    case 'ready':
      return `You did it! Come here, let me hear all about it.`;
    default:
      return `Hey, friend. Just glad you stopped by.`;
  }
}
