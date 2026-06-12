import type { HomeVisualKey } from '@/types/home';

export type EncounterCastEntry = {
  profileId: string;
  seedId: string;
  categoryLabel: string;
  visualKey: HomeVisualKey;
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
    seedId: 'coffee_shop',
    categoryLabel: 'Coffee shop',
    visualKey: 'lattelet',
  },
  {
    profileId: 'location_park_mossprout',
    seedId: 'park',
    categoryLabel: 'Park',
    visualKey: 'mossprout',
  },
  {
    profileId: 'location_bakery_crumbun',
    seedId: 'bakery',
    categoryLabel: 'Bakery',
    visualKey: 'crumbun',
  },
  {
    profileId: 'location_farm_hayhorn',
    seedId: 'farm',
    categoryLabel: 'Farm market',
    visualKey: 'hayhorn',
  },
  {
    profileId: 'activity_run_session_sprintail',
    seedId: 'run_session',
    categoryLabel: 'Run',
    visualKey: 'sprintail',
  },
  {
    profileId: 'activity_high_steps_day_steppling',
    seedId: 'high_steps_day',
    categoryLabel: 'Big walking day',
    visualKey: 'voltstep',
    placeholderArt: true,
  },
  {
    profileId: 'location_home_evening_bedrotte',
    seedId: 'home_evening',
    categoryLabel: 'Home evening',
    visualKey: 'hearthsip',
    placeholderArt: true,
  },
  {
    profileId: 'landmark_eiffel_tower_ironette',
    seedId: 'eiffel_tower',
    categoryLabel: 'Landmark',
    visualKey: 'ironette',
  },
  {
    profileId: 'landmark_shibuya_crossing_neonpoko',
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
