import type { KatchimeraFamilyId } from '@/types/katchimera';

/** Stable Journey ids for the 25 canonical life-area companions. */
export const CANONICAL_JOURNEY_ID_BY_FAMILY: Readonly<Record<KatchimeraFamilyId, string>> = Object.freeze({
  baristabbit: 'coffee-ritual-intentional-pause',
  feastle: 'feastle-meaningful-meals',
  steppling: 'steppling-everyday-momentum',
  flexel: 'flexel-stronger-rhythm',
  bedrotte: 'sleep-rest-gentle-recovery',
  dawnle: 'dawnle-kinder-beginnings',
  mendle: 'mendle-gentle-repair',
  gatherglow: 'gatherglow-tended-connection',
  heartmote: 'heartmote-life-area-focus',
  kindling: 'kindling-life-area-focus',
  snuglet: 'snuglet-everyday-care',
  waglet: 'waglet-shared-routine',
  tasklet: 'tasklet-focus-journey',
  errandimp: 'errandimp-lighter-loops',
  pagelet: 'pagelet-living-curiosity',
  relicoon: 'relicoon-cultural-trail',
  museling: 'museling-creative-practice',
  encora: 'encora-active-music',
  flickerbun: 'flickerbun-intentional-watching',
  pixooka: 'pixooka-intentional-play',
  mossprout: 'mossprout-nearby-nature',
  shellio: 'shellio-water-connection',
  skylo: 'skylo-local-discovery',
  voyagle: 'voyagle-travel-stories',
  cheerlet: 'cheerlet-visible-progress',
});

/**
 * The stage that repeatable real-world quests advance for each canonical
 * family. Some of the authored parent journeys use a more specific verb than
 * `practice`; keeping that vocabulary here lets legacy specialist quests join
 * the parent journey without retaining a dead specialist stage id.
 */
export const CANONICAL_PRACTICE_STAGE_BY_FAMILY: Readonly<Record<KatchimeraFamilyId, string>> = Object.freeze({
  baristabbit: 'practice',
  feastle: 'taste',
  steppling: 'walk',
  flexel: 'practice',
  bedrotte: 'practice',
  dawnle: 'practice',
  mendle: 'practice',
  gatherglow: 'practice',
  heartmote: 'practice',
  kindling: 'practice',
  snuglet: 'practice',
  waglet: 'practice',
  tasklet: 'momentum',
  errandimp: 'practice',
  pagelet: 'learn',
  relicoon: 'practice',
  museling: 'practice',
  encora: 'practice',
  flickerbun: 'practice',
  pixooka: 'practice',
  mossprout: 'return',
  shellio: 'practice',
  skylo: 'practice',
  voyagle: 'practice',
  cheerlet: 'practice',
});
