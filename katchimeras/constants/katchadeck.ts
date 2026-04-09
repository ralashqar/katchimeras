import type { OnboardingProfile } from '@/utils/onboarding-state';

export type AspirationOption = {
  id: string;
  title: string;
  description: string;
  accent: string;
};

export type PainPointOption = {
  id: string;
  title: string;
  description: string;
};

export type PreferenceOption = {
  id: string;
  title: string;
  description: string;
  glyph: string;
  palette: [string, string];
};

export type DeckCard = {
  id: string;
  name: string;
  trait: string;
  location: string;
  rarity: string;
  palette: [string, string];
};

export const aspirationOptions: AspirationOption[] = [
  {
    id: 'adventurous',
    title: 'Feel more adventurous',
    description: 'Turn ordinary movement into moments that feel worth keeping.',
    accent: '#76d8b3',
  },
  {
    id: 'calm',
    title: 'Build a calmer rhythm',
    description: 'See rest and routine as part of a life that is taking shape.',
    accent: '#8db6ff',
  },
  {
    id: 'meaningful',
    title: 'Make daily life feel meaningful',
    description: 'Let repeated places and walks become part of a bigger pattern.',
    accent: '#f2b16a',
  },
  {
    id: 'remember',
    title: 'Remember where life happened',
    description: 'Collect the quiet imprint of places, moods, and days.',
    accent: '#f39db7',
  },
];

export const painPointOptions: PainPointOption[] = [
  {
    id: 'blur',
    title: 'My days blur together',
    description: 'I want a softer way to remember what my life is becoming.',
  },
  {
    id: 'invisible',
    title: 'My movement feels invisible',
    description: 'I do more than I realize, but nothing reflects it back to me.',
  },
  {
    id: 'motivation',
    title: 'I lose momentum fast',
    description: 'I want a sense of progression without turning life into a grind.',
  },
  {
    id: 'identity',
    title: 'I want something that feels like me',
    description: 'Most trackers feel generic instead of personal.',
  },
  {
    id: 'memory',
    title: 'I forget the places that mattered',
    description: 'I want location and routine to leave a mark.',
  },
];

export const preferenceOptions: PreferenceOption[] = [
  {
    id: 'nature',
    title: 'Nature',
    description: 'parks, trails, green edges',
    glyph: 'leaf',
    palette: ['#204c35', '#8ed9a0'],
  },
  {
    id: 'cozy',
    title: 'Cozy',
    description: 'cafes, corners, slow warmth',
    glyph: 'mug',
    palette: ['#5d2e20', '#f3b788'],
  },
  {
    id: 'urban',
    title: 'Urban',
    description: 'streets, signals, momentum',
    glyph: 'city',
    palette: ['#27374f', '#8ec5ff'],
  },
  {
    id: 'night',
    title: 'Night glow',
    description: 'late walks, lights, after-hours',
    glyph: 'moon',
    palette: ['#211e55', '#8d91ff'],
  },
  {
    id: 'seaside',
    title: 'Open air',
    description: 'water, wind, distance',
    glyph: 'wave',
    palette: ['#1a4353', '#83d7db'],
  },
  {
    id: 'home',
    title: 'Home rhythm',
    description: 'reset, recovery, quiet time',
    glyph: 'home',
    palette: ['#5a4c60', '#e9b6dd'],
  },
];

const cardLibrary: Record<string, DeckCard[]> = {
  nature: [
    {
      id: 'nature-mosskeeper',
      name: 'Mosskeeper',
      trait: 'Park path affinity',
      location: 'Riverside Park',
      rarity: 'Rooted',
      palette: ['#1c3b2a', '#7cc88f'],
    },
    {
      id: 'nature-fernrunner',
      name: 'Fernrunner',
      trait: 'Morning trail pull',
      location: 'Tree-lined loop',
      rarity: 'Shaped',
      palette: ['#264b34', '#8fe3ae'],
    },
  ],
  cozy: [
    {
      id: 'cozy-bramblecup',
      name: 'Bramblecup',
      trait: 'Comfort pocket',
      location: 'Favorite cafe',
      rarity: 'Warm',
      palette: ['#5a291f', '#eea77b'],
    },
    {
      id: 'cozy-embermoth',
      name: 'Embermoth',
      trait: 'Slow-hour glow',
      location: 'Window seat',
      rarity: 'Soft',
      palette: ['#72352b', '#f2c0a4'],
    },
  ],
  urban: [
    {
      id: 'urban-signalfox',
      name: 'Signalfox',
      trait: 'Cityline instinct',
      location: 'Cross-town route',
      rarity: 'Keen',
      palette: ['#25354d', '#8fb5f4'],
    },
    {
      id: 'urban-neonrook',
      name: 'Neonrook',
      trait: 'Street rhythm',
      location: 'Night district',
      rarity: 'Rare',
      palette: ['#1a2740', '#6bc6ff'],
    },
  ],
  night: [
    {
      id: 'night-velowl',
      name: 'Velowl',
      trait: 'After-dark drift',
      location: 'Lantern streets',
      rarity: 'Glimmer',
      palette: ['#251e61', '#8f93ff'],
    },
    {
      id: 'night-lumenhare',
      name: 'Lumenhare',
      trait: 'Quiet-hour energy',
      location: 'Late walk loop',
      rarity: 'Bright',
      palette: ['#36296e', '#bbb4ff'],
    },
  ],
  seaside: [
    {
      id: 'seaside-tidewhorl',
      name: 'Tidewhorl',
      trait: 'Open-air pull',
      location: 'Waterside edge',
      rarity: 'Rare',
      palette: ['#1b4555', '#7de0e4'],
    },
    {
      id: 'seaside-skylarkel',
      name: 'Skylarkel',
      trait: 'Distance hunger',
      location: 'Coast road',
      rarity: 'Bright',
      palette: ['#28566a', '#a4f0f1'],
    },
  ],
  home: [
    {
      id: 'home-softden',
      name: 'Softden',
      trait: 'Recovery shelter',
      location: 'Home base',
      rarity: 'Calm',
      palette: ['#5a4860', '#ddb2db'],
    },
    {
      id: 'home-restroot',
      name: 'Restroot',
      trait: 'Stillness gain',
      location: 'Evening reset',
      rarity: 'Grounded',
      palette: ['#4f3f52', '#efc5ea'],
    },
  ],
};

type RevealContent = {
  greeting: string;
  narrative: string;
  identityInsight: string;
  premiumTease: string;
  cards: DeckCard[];
  collection: DeckCard[];
};

function getSelectedPreferences(profile: OnboardingProfile) {
  const selected = preferenceOptions.filter((option) => profile.preferenceIds.includes(option.id));

  if (selected.length > 0) {
    return selected;
  }

  return preferenceOptions.slice(0, 3);
}

function getSelectedAspiration(profile: OnboardingProfile) {
  return aspirationOptions.find((option) => option.id === profile.aspirationId) ?? aspirationOptions[0];
}

export function createStarterReveal(profile: OnboardingProfile): RevealContent {
  const selectedPreferences = getSelectedPreferences(profile);
  const selectedAspiration = getSelectedAspiration(profile);

  const cards = selectedPreferences.slice(0, 3).map((preference, index) => {
    const variants = cardLibrary[preference.id];

    return variants[index % variants.length];
  });

  const collection = selectedPreferences.flatMap((preference) => cardLibrary[preference.id]).slice(0, 6);

  const frictionTone = profile.painPointIds.includes('blur')
    ? 'Your life already has texture. It just needed a shape.'
    : profile.painPointIds.includes('invisible')
      ? 'More of your day is alive than any tracker usually shows.'
      : 'Your routine is already becoming a world of its own.';

  const identityInsight =
    selectedAspiration.id === 'calm'
      ? 'You are building a steadier rhythm, and the deck is starting to notice.'
      : selectedAspiration.id === 'remember'
        ? 'Your deck is leaning toward places with memory, warmth, and return.'
        : selectedAspiration.id === 'meaningful'
          ? 'The pattern emerging here is depth, not just activity.'
          : selectedAspiration.id === 'adventurous'
            ? 'You are becoming more exploratory without losing your center.'
            : 'Your deck is beginning to reflect a life with more shape and presence.';

  return {
    greeting: 'Your day is ready',
    narrative: `${selectedAspiration.title.replace('Feel more ', '').replace('Build a ', '').replace('Make ', '').replace('Remember ', '')} is beginning to leave a mark. ${frictionTone}`,
    identityInsight,
    premiumTease: 'Unlock the full version of your life for deeper identity reads, evolved variants, and story comics.',
    cards,
    collection,
  };
}
