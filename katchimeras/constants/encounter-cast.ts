import type { HomeVisualKey } from '@/types/home';

export type EncounterCastEntry = {
  profileId: string;
  seedId: string;
  categoryLabel: string;
  visualKey: HomeVisualKey;
  // Short voice descriptor fed to the reflection generator (M3).
  voice: string;
  // True when the bundled render belongs to a different character and the
  // dedicated flagship render is still pending (M2 of the implementation plan).
  placeholderArt?: boolean;
};

// The live cast: encounter profiles the hatch is allowed to match, limited to
// identities we can show real art for today. Expanding the cast = rendering a
// new flagship (art-lab pipeline) and adding one entry here.
export const encounterLiveCast: readonly EncounterCastEntry[] = [
  {
    profileId: 'location_coffee_shop_lattelet',
    voice: 'warm and ritual-loving, quietly proud of small routines',
    seedId: 'coffee_shop',
    categoryLabel: 'Coffee shop',
    visualKey: 'lattelet',
  },
  {
    profileId: 'location_park_mossprout',
    voice: 'gentle and grounded, delighted by green detours',
    seedId: 'park',
    categoryLabel: 'Park',
    visualKey: 'mossprout',
  },
  {
    profileId: 'location_bakery_crumbun',
    voice: 'cozy and comfort-seeking, a little possessive of treats',
    seedId: 'bakery',
    categoryLabel: 'Bakery',
    visualKey: 'crumbun',
  },
  {
    profileId: 'location_farm_hayhorn',
    voice: 'sturdy and wholesome, plainspoken warmth',
    seedId: 'farm',
    categoryLabel: 'Farm market',
    visualKey: 'hayhorn',
  },
  {
    profileId: 'activity_run_session_sprintail',
    voice: 'bright and encouraging, in love with momentum',
    seedId: 'run_session',
    categoryLabel: 'Run',
    visualKey: 'sprintail',
  },
  {
    profileId: 'activity_high_steps_day_steppling',
    voice: 'a cheerful wanderer who counts the world in steps',
    seedId: 'high_steps_day',
    categoryLabel: 'Big walking day',
    visualKey: 'voltstep',
    placeholderArt: true,
  },
  {
    profileId: 'location_home_evening_bedrotte',
    voice: 'soft and sleepy, fiercely protective of rest',
    seedId: 'home_evening',
    categoryLabel: 'Home evening',
    visualKey: 'hearthsip',
    placeholderArt: true,
  },
  {
    profileId: 'landmark_eiffel_tower_ironette',
    voice: 'elegant and theatrical, a collector of grand moments',
    seedId: 'eiffel_tower',
    categoryLabel: 'Landmark',
    visualKey: 'ironette',
  },
  {
    profileId: 'landmark_shibuya_crossing_neonpoko',
    voice: 'playful night-city energy, easily dazzled by lights',
    seedId: 'shibuya_crossing',
    categoryLabel: 'Night city',
    visualKey: 'neonpoko',
  },
];

export const encounterCastBySeedId: ReadonlyMap<string, EncounterCastEntry> = new Map(
  encounterLiveCast.map((entry) => [entry.seedId, entry])
);

export const encounterCastByProfileId: ReadonlyMap<string, EncounterCastEntry> = new Map(
  encounterLiveCast.map((entry) => [entry.profileId, entry])
);
