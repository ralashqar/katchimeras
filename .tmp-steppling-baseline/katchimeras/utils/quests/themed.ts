import {
  questActivityLane,
  questDefinition,
  questPresentation,
  type QuestDefinition,
} from './definitions';
import { bespokeFamilyQuestPackByFamilyId } from '@/constants/katchimera-bespoke-quests';
import { katchimeraRoleByFamilyId } from '@/constants/katchimera-roles';
import { katchimeraSkinByVisualKey } from '@/constants/katchimera-skins';
import type { HomeVisualKey } from '@/types/home';

export type ThemedQuestOffer = {
  id: string;
  title: string;
  hint: string;
  weight?: number;
  family?: QuestDefinition['family'];
  categoryLabel: string;
  estimatedMinutes: number;
  artworkKey?: string;
  lane: NonNullable<QuestDefinition['lane']>;
  minimumBondLevel: NonNullable<QuestDefinition['minimumBondLevel']>;
  presentationVariantId?: string;
};

const CREATURE_QUEST_POOL: Record<string, string[]> = {
  baristabbit: [
    'quest-coffee-ritual-pause', 'quest-coffee-ritual-note', 'quest-coffee-ritual-redesign',
    'quest-coffee-ritual-weekly-review', 'quest-coffee-ritual-brew-sequence',
  ],
  lattelet: [
    'quest-coffee-ritual-pause', 'quest-coffee-ritual-note', 'quest-coffee-ritual-redesign',
    'quest-coffee-ritual-weekly-review', 'quest-coffee-ritual-brew-sequence',
  ],
  hearthsip: [
    'quest-coffee-ritual-pause', 'quest-coffee-ritual-note', 'quest-coffee-ritual-redesign',
    'quest-coffee-ritual-weekly-review', 'quest-coffee-ritual-brew-sequence',
  ],
  bedrotte: [
    'quest-rest-restored-detail',
    'quest-bedrotte-rest-note',
    'quest-rest-wind-down',
    'quest-rest-boundary',
    'quest-rest-recovery-checkin',
    'quest-early-night',
    'quest-rest-weekly-review',
    'quest-bedrotte-breathe',
  ],
  snoozle: [
    'quest-rest-restored-detail',
    'quest-bedrotte-rest-note',
    'quest-rest-wind-down',
    'quest-rest-boundary',
    'quest-rest-recovery-checkin',
    'quest-early-night',
    'quest-rest-weekly-review',
    'quest-bedrotte-breathe',
  ],
  steppling: [
    'quest-steppling-walk-detail',
    'quest-steppling-gentle-walk',
    'quest-steppling-walk-note',
    'quest-long-walk',
    'quest-steppling-weekly-review',
    'quest-steppling-stride',
    'quest-step-sprint',
    'quest-step-time-trial',
  ],
  flickerbun: [
    'quest-flickerbun-watch',
    'quest-flickerbun-scene-note',
    'quest-flickerbun-new-perspective',
    'quest-flickerbun-weekly-review',
    'quest-film-trivia',
  ],
  pagelet: [
    'quest-read-book',
    'quest-pagelet-curiosity-note',
    'quest-pagelet-learning-note',
    'quest-pagelet-weekly-review',
    'quest-book-trivia',
    'quest-pagelet-word-paths',
    'quest-pagelet-lost-word',
  ],
  mossprout: [
    'quest-mossprout-living-detail',
    'quest-mossprout-green-photo',
    'quest-mossprout-nature-note',
    'quest-mossprout-return',
    'quest-mossprout-weekly-review',
    'quest-mossprout-memory',
  ],
  skylo: [
    'quest-skylo-city-detail',
    'quest-skylo-city-photo',
    'quest-skylo-local-stop',
    'quest-skylo-neighbourhood-note',
    'quest-skylo-weekly-review',
    'quest-skylo-city-trivia',
  ],
  gatherglow: [
    'quest-gatherglow-reach-out',
    'quest-gatherglow-shared-moment',
    'quest-gatherglow-deeper-checkin',
    'quest-gatherglow-weekly-review',
    'quest-gatherglow-pattern',
  ],
  feastle: [
    'quest-feastle-meal-detail',
    'quest-feastle-merge',
    'quest-feastle-meal-photo',
    'quest-feastle-meal-note',
    'quest-feastle-new-flavour',
    'quest-feastle-weekly-review',
    'quest-feastle-sort',
    'quest-feastle-memory',
  ],
  tasklet: [
    'quest-tasklet-progress-detail',
    'quest-tasklet-next-action',
    'quest-goal-note',
    'quest-tasklet-clear-three',
    'quest-tasklet-focus',
    'quest-tasklet-tomorrow-first',
    'quest-tasklet-weekly-review',
    'quest-tasklet-sort',
    'quest-tasklet-desk-jam',
  ],
  cheerlet: [
    'quest-cheerlet-progress-detail',
    'quest-cheerlet-name-progress',
    'quest-cheerlet-celebrate-note',
    'quest-cheerlet-mark-chapter',
    'quest-cheerlet-weekly-review',
    'quest-cheerlet-block-party',
  ],
  relicoon: [
    'quest-relicoon-object-note',
    'quest-relicoon-museum-visit',
    'quest-relicoon-context-note',
    'quest-relicoon-weekly-review',
    'quest-relicoon-match',
  ],
  encora: [
    'quest-encora-listening-note',
    'quest-encora-music-moment',
    'quest-encora-practice-note',
    'quest-encora-weekly-review',
    'quest-encora-rhythm',
  ],
  errandimp: [
    'quest-errandimp-close-loop', 'quest-errandimp-reset-note', 'quest-errandimp-maintenance',
    'quest-errandimp-weekly-review', 'quest-errandimp-sort',
  ],
  dawnle: [
    'quest-dawnle-first-light-photo', 'quest-dawnle-morning-note', 'quest-dawnle-prepare-start',
    'quest-dawnle-weekly-review', 'quest-dawnle-first-light',
  ],
  mendle: [
    'quest-mendle-honest-checkin', 'quest-mendle-kind-action', 'quest-mendle-repair-note',
    'quest-mendle-weekly-review', 'quest-mendle-breathe',
  ],
  quietome: [
    'quest-quietome-one-line', 'quest-quietome-solo-pause', 'quest-quietome-returning-question',
    'quest-quietome-weekly-review', 'quest-quietome-still-signals',
  ],
  vesperitt: [
    'quest-vesperitt-night-detail',
    'quest-late-capture',
    'quest-vesperitt-night-note',
    'quest-vesperitt-next-day-note',
    'quest-vesperitt-weekly-review',
    'quest-vesperitt-moon-signals',
  ],
  shellio: [
    'quest-shellio-water-detail',
    'quest-visit-beach',
    'quest-photo-water',
  ],
  flexel: [
    'quest-flexel-session-note', 'quest-flexel-training-detail',
    'quest-flexel-recovery-note', 'quest-flexel-weekly-review',
  ],
  sprintail: [
    'quest-sprintail-run-day', 'quest-sprintail-run-detail',
    'quest-sprintail-recovery', 'quest-sprintail-weekly-review',
  ],
  hooplet: [
    'quest-hooplet-court-note', 'quest-hooplet-skill-detail',
    'quest-hooplet-team-moment', 'quest-hooplet-weekly-review',
  ],
  serveling: [
    'quest-serveling-session-note', 'quest-serveling-rally-detail',
    'quest-serveling-reset-note', 'quest-serveling-weekly-review',
  ],
  snuglet: [
    'quest-snuglet-care-photo', 'quest-snuglet-care-detail',
    'quest-snuglet-caregiver-pause', 'quest-snuglet-weekly-review',
  ],
  waglet: [
    'quest-waglet-companion-photo', 'quest-waglet-care-detail',
    'quest-waglet-routine-note', 'quest-waglet-weekly-review',
  ],
  whiskit: [
    'quest-whiskit-companion-photo', 'quest-whiskit-enrichment-detail',
    'quest-whiskit-pattern-note', 'quest-whiskit-weekly-review',
  ],
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
  const normalizedCreatureKey = creatureKey.toLowerCase();
  const skin = katchimeraSkinByVisualKey.get(normalizedCreatureKey as HomeVisualKey);
  const familyId = skin?.familyId;
  const role = familyId ? katchimeraRoleByFamilyId.get(familyId) : null;
  const familyOwnedPool = role
    ? [...role.realLifeQuestIds, ...role.miniGameQuestIds]
    : [];
  const manuallyCuratedPool = CREATURE_QUEST_POOL[normalizedCreatureKey] ?? [];
  const dedicatedPool = familyId && bespokeFamilyQuestPackByFamilyId.has(familyId)
    ? familyOwnedPool
    : manuallyCuratedPool.length
      ? manuallyCuratedPool
      : familyOwnedPool;
  const ids = [
    ...dedicatedPool,
    ...(dedicatedPool.length ? [] : THEME_QUEST_POOL[subtype] ?? []),
    ...(dedicatedPool.length ? [] : ARCHETYPE_QUEST_POOL[archetype] ?? []),
    ...(dedicatedPool.length ? [] : ['quest-snap-today']),
  ];
  return ids
    .filter((id, index) => ids.indexOf(id) === index)
    .map((id) => questDefinition(id))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition))
    .filter((definition) => {
      const keys = definition.eligibility?.creatureKeys;
      return !keys?.length || keys.includes(normalizedCreatureKey);
    })
    .map((definition) => ({
      id: definition.id,
      title: definition.title,
      hint: definition.hint,
      weight: definition.eligibility?.weight,
      family: definition.family,
      lane: questActivityLane(definition),
      minimumBondLevel: definition.minimumBondLevel ?? 1,
      ...questPresentation(definition),
    }));
}

export function themedQuestOffer(subtype: string, archetype: string, creatureKey = ''): ThemedQuestOffer | undefined {
  return themedQuestOffers(subtype, archetype, creatureKey)[0];
}
