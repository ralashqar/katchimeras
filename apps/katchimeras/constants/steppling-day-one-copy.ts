export const STEPPLING_DAY_ONE_OPENING = 'I packed for a journey, then the Mist packed me. Mostly snacks survived. What would feel good today?';
export const STEPPLING_DAY_ONE_CHOICES = [
  { id: 'walk', label: 'A little walk' },
  { id: 'adapted', label: 'Movement my way' },
  { id: 'rest', label: 'A gentle day' },
] as const;
export const STEPPLING_DAY_ONE_HANDOFFS = {
  walk: 'Your pace, then. Every step is light the Mist doesn’t get. I brought a parcel for the garden. Shall we look?',
  adapted: 'Your way, then. Steps are one way to make light; time together is another. I brought a parcel for the garden.',
  rest: 'A gentle day it is. Rest makes its own light. I brought a parcel for the garden.',
} as const;
