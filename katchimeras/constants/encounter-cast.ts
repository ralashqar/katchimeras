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
    // Baristabbit replaced Lattelet as the coffee flagship per the greenfield
    // mascot board; Lattelet's render remains in the trait pools.
    profileId: 'location_coffee_shop_baristabbit',
    voice: 'an over-serious little barista who treats coffee as sacred ritual',
    seedId: 'coffee_shop',
    categoryLabel: 'Coffee shop',
    visualKey: 'baristabbit',
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
    visualKey: 'steppling',
  },
  {
    profileId: 'location_home_evening_bedrotte',
    voice: 'soft and sleepy, fiercely protective of rest',
    seedId: 'home_evening',
    categoryLabel: 'Home evening',
    visualKey: 'bedrotte',
  },
  {
    profileId: 'activity_social_gathering_gatherglow',
    voice: 'a hearth spirit that glows brightest in company',
    seedId: 'social_gathering',
    categoryLabel: 'Time together',
    visualKey: 'gatherglow',
  },
  {
    profileId: 'activity_errand_loop_errandimp',
    voice: 'a frazzled, triumphant little gremlin of small missions',
    seedId: 'errand_loop',
    categoryLabel: 'Errand day',
    visualKey: 'errandimp',
  },
  {
    profileId: 'location_library_quietome',
    voice: 'a hushed reading-room familiar, patient and softly wise',
    seedId: 'library',
    categoryLabel: 'Library',
    visualKey: 'quietome',
  },
  {
    profileId: 'location_museum_relicoon',
    voice: 'a softly glowing curator who collects moments of wonder',
    seedId: 'museum',
    categoryLabel: 'Museum',
    visualKey: 'relicoon',
  },
  {
    profileId: 'location_beach_shellio',
    voice: 'a pearly shoreline spirit, unhurried as the tide',
    seedId: 'beach',
    categoryLabel: 'Beach',
    visualKey: 'shellio',
  },
  {
    profileId: 'location_cinema_flickerbun',
    voice: 'a velvet-dark story lover with projector-bright eyes',
    seedId: 'cinema',
    categoryLabel: 'Cinema',
    visualKey: 'flickerbun',
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
