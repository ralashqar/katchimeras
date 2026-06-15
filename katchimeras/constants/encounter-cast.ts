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
  {
    // Subject creatures — hatch from what filled the day's photos (vision
    // concepts), the axis sensors alone can't reach.
    profileId: 'subject_dog_companion_waglet',
    voice: 'a devoted, soft-hearted companion who asks for nothing but the day with you',
    seedId: 'dog_companion',
    categoryLabel: 'Dog',
    visualKey: 'waglet',
  },
  {
    profileId: 'subject_cat_companion_whiskit',
    voice: 'a cool, self-possessed companion who shows affection on its own quiet terms',
    seedId: 'cat_companion',
    categoryLabel: 'Cat',
    visualKey: 'whiskit',
  },
  {
    profileId: 'subject_baby_little_one_snuglet',
    voice: 'a tender, sleepy little spirit holding the soft warmth of caring for someone small',
    seedId: 'little_one',
    categoryLabel: 'Little one',
    visualKey: 'snuglet',
  },
  {
    profileId: 'subject_first_snow_driftkin',
    voice: 'a hushed winter wisp, wide-eyed with quiet wonder at the first snow',
    seedId: 'first_snow',
    categoryLabel: 'First snow',
    visualKey: 'driftkin',
  },
  {
    profileId: 'subject_golden_hour_duskle',
    voice: 'a warm, serene dusk spirit that lingers in the last gold light of the day',
    seedId: 'golden_hour',
    categoryLabel: 'Golden hour',
    visualKey: 'duskle',
  },
  {
    // Place creatures activated from the dormant bench — hatch from Apple-Maps
    // place categories and/or vision concepts (food spots read straight from
    // food photos).
    profileId: 'location_pizza_place_crustling',
    voice: 'a cheerful, melty little comfort-seeker who treats a good slice as a celebration',
    seedId: 'pizza_place',
    categoryLabel: 'Pizza',
    visualKey: 'crustling',
  },
  {
    profileId: 'location_sushi_place_nigirimp',
    voice: 'a tidy, precise little gourmand with calm, refined poise',
    seedId: 'sushi_place',
    categoryLabel: 'Sushi',
    visualKey: 'nigirimp',
  },
  {
    profileId: 'location_ramen_place_noodloo',
    voice: 'a steamy, comforting noodle spirit who loves a warm bowl on a busy night',
    seedId: 'ramen_place',
    categoryLabel: 'Ramen',
    visualKey: 'noodloo',
  },
  {
    profileId: 'location_dessert_shop_sundael',
    voice: 'a sweet, bubbly treatling who believes every day deserves a little reward',
    seedId: 'dessert_shop',
    categoryLabel: 'Dessert',
    visualKey: 'sundael',
  },
  {
    profileId: 'location_bubble_tea_shop_bobaloo',
    voice: 'a bouncy, playful boba companion brimming with cheerful energy',
    seedId: 'bubble_tea_shop',
    categoryLabel: 'Bubble tea',
    visualKey: 'bobaloo',
  },
  {
    profileId: 'location_bookstore_pagelet',
    voice: 'a paper-soft, curious browser who loves getting lost among the shelves',
    seedId: 'bookstore',
    categoryLabel: 'Bookstore',
    visualKey: 'pagelet',
  },
  {
    profileId: 'location_basketball_court_hooplet',
    voice: 'a lively, competitive court companion with bounce to spare',
    seedId: 'basketball_court',
    categoryLabel: 'Basketball',
    visualKey: 'hooplet',
  },
  {
    profileId: 'location_tennis_court_serveling',
    voice: 'a sharp, focused little rally spirit who loves a clean return',
    seedId: 'tennis_court',
    categoryLabel: 'Tennis',
    visualKey: 'serveling',
  },
  {
    profileId: 'location_garden_petalimp',
    voice: 'a gentle, blooming helper delighted by tended, growing things',
    seedId: 'garden',
    categoryLabel: 'Garden',
    visualKey: 'petalimp',
  },
  {
    profileId: 'location_forest_fernip',
    voice: 'a quiet green scout, calm and curious among the trees',
    seedId: 'forest',
    categoryLabel: 'Forest',
    visualKey: 'fernip',
  },
  {
    // Wave B — moments & seasons. Subject creatures from weather/nature photos.
    profileId: 'subject_rain_day_drizzlet',
    voice: 'a cozy rain wisp, content to wait out the weather under a little umbrella',
    seedId: 'rain_day',
    categoryLabel: 'Rainy day',
    visualKey: 'drizzlet',
  },
  {
    profileId: 'subject_autumn_day_amberleaf',
    voice: 'a warm autumn spirit who delights in the turning, golden season',
    seedId: 'autumn_day',
    categoryLabel: 'Autumn',
    visualKey: 'amberleaf',
  },
  {
    profileId: 'subject_spring_blossom_blossle',
    voice: 'a soft spring sprite, bright and fleeting as the cherry blossoms',
    seedId: 'spring_blossom',
    categoryLabel: 'Blossom',
    visualKey: 'blossle',
  },
  {
    profileId: 'subject_summit_peakle',
    voice: 'a sturdy summit-keeper, proud of every hard-earned view',
    seedId: 'summit',
    categoryLabel: 'Summit',
    visualKey: 'peakle',
  },
  {
    profileId: 'subject_still_water_stillo',
    voice: 'a calm water spirit, serene and mirror-still beside the lake',
    seedId: 'still_water',
    categoryLabel: 'Still water',
    visualKey: 'stillo',
  },
  {
    profileId: 'subject_starry_night_twinklet',
    voice: 'a wonderstruck night spirit, forever reaching for the brightest star',
    seedId: 'starry_night',
    categoryLabel: 'Starry night',
    visualKey: 'twinklet',
  },
  {
    profileId: 'subject_feast_feastle',
    voice: 'a hearty food spirit who treats every good meal as a small celebration',
    seedId: 'feast',
    categoryLabel: 'Feast',
    visualKey: 'feastle',
  },
  {
    // Wave C — life chapters. Subject creatures from what your day was about.
    profileId: 'subject_creative_day_museling',
    voice: 'an inspired little muse who lives for the marks of making something',
    seedId: 'creative_day',
    categoryLabel: 'Making',
    visualKey: 'museling',
  },
  {
    profileId: 'subject_focus_day_tasklet',
    voice: 'a determined, competent little doer who loves a checked-off list',
    seedId: 'focus_day',
    categoryLabel: 'Focus',
    visualKey: 'tasklet',
  },
  {
    profileId: 'subject_celebration_cheerlet',
    voice: 'a joyful party sprite who believes the good days deserve confetti',
    seedId: 'celebration',
    categoryLabel: 'Celebration',
    visualKey: 'cheerlet',
  },
  {
    profileId: 'subject_travel_day_voyagle',
    voice: 'an eager little wanderer, happiest when the world gets bigger',
    seedId: 'travel_day',
    categoryLabel: 'Travel',
    visualKey: 'voyagle',
  },
  {
    // Capstone — the last two common day-types: a city day and a gym day.
    profileId: 'subject_city_day_skylo',
    voice: 'a city-cool little wanderer, easy and confident in the downtown bustle',
    seedId: 'city_day',
    categoryLabel: 'City',
    visualKey: 'skylo',
  },
  {
    profileId: 'subject_gym_day_flexel',
    voice: 'a determined little powerhouse who is proud of every set you finish',
    seedId: 'gym_day',
    categoryLabel: 'Gym',
    visualKey: 'flexel',
  },
];

export const encounterCastBySeedId: ReadonlyMap<string, EncounterCastEntry> = new Map(
  encounterLiveCast.map((entry) => [entry.seedId, entry])
);

export const encounterCastByProfileId: ReadonlyMap<string, EncounterCastEntry> = new Map(
  encounterLiveCast.map((entry) => [entry.profileId, entry])
);
