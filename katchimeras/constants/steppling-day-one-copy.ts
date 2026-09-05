export const STEPPLING_DAY_ONE_OPENING = 'I packed for a journey. Mostly snacks. What would feel good today?';
export const STEPPLING_DAY_ONE_CHOICES = [
  { id: 'walk', label: 'A little walk' },
  { id: 'adapted', label: 'Movement my way' },
  { id: 'rest', label: 'A gentle day' },
] as const;
export const STEPPLING_DAY_ONE_HANDOFFS = {
  walk: 'Your pace, then. Today’s steps count here. I brought a parcel for our Garden—shall we take a look?',
  adapted: 'Your way, then. Steps are only one way to spend time together. I brought a parcel for our Garden.',
  rest: 'A gentle day it is. No steps needed to spend time together. I brought a parcel for our Garden.',
} as const;
