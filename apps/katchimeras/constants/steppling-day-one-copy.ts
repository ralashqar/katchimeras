export const STEPPLING_DAY_ONE_OPENING = 'I packed for a journey. The Mist packed me. Snacks survived. The trail starts at your door. What kind of day is it?';
export const STEPPLING_DAY_ONE_CHOICES = [
  { id: 'walk', label: '🥾 Boots on, a little walk' },
  { id: 'adapted', label: '🌿 Moving, my own way' },
  { id: 'rest', label: '🛋️ A gentle day, and that’s allowed' },
] as const;
export const STEPPLING_DAY_ONE_HANDOFFS = {
  walk: 'Boots on. Every step is light the Mist doesn’t get. I brought a parcel for the garden. Shall we look?',
  adapted: 'Your way, then. Steps are one way to make light. Time together is another. I brought a parcel for the garden.',
  rest: 'A gentle day, allowed. Rest makes its own light. I brought a parcel for the garden.',
} as const;
