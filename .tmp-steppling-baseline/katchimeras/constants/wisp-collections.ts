import type { WispCollectionDefinition } from '@/types/wisp-collections';

export const WISP_COLLECTIONS: readonly WispCollectionDefinition[] = [
  {
    id: 'little-adventures',
    name: 'Little Adventures',
    description: 'Small outings, warm stops and details worth noticing.',
    wispIds: ['sprout', 'steam', 'drizzle', 'sunset', 'page', 'crumb', 'wander', 'bloom'],
    rewardLabel: 'Little Adventurer Egg frame',
    seasonal: false,
  },
  {
    id: 'gentle-rhythms',
    name: 'Gentle Rhythms',
    description: 'Rest, movement and the patterns that carry a week.',
    wispIds: ['moonlit', 'dream', 'breeze', 'focus', 'nest', 'stride', 'dawn', 'starlit'],
    rewardLabel: 'Moonlit hatch glow',
    seasonal: false,
  },
  {
    id: 'shared-table',
    name: 'The Shared Table',
    description: 'Food, company and celebrations gathered in one place.',
    wispIds: ['heartlet', 'crumb', 'feast', 'sizzle', 'giggle', 'confetti'],
    rewardLabel: 'Feastle table accessory',
    seasonal: false,
  },
];
