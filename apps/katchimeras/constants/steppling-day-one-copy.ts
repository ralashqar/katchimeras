export const STEPPLING_DAY_ONE_OPENING = 'I went to check Heartwood’s broken roots. The Mist checked me. Snacks survived. You lit my old marker! Before we scout the path, what kind of day is it?';
export const STEPPLING_DAY_ONE_CHOICES = [
  { id: 'walk', label: '🥾 Boots on, a little walk' },
  { id: 'adapted', label: '🌿 Moving, my own way' },
  { id: 'rest', label: '🛋️ A gentle day, and that’s allowed' },
] as const;
export const STEPPLING_DAY_ONE_HANDOFFS = {
  walk: 'Boots on. We’ll start with the old lantern footing. My Locker has what we need for the path.',
  adapted: 'Your way, then. Every path needs a different sort of explorer. Let’s unpack my Locker and prepare the lantern route.',
  rest: 'Then we plan from here. The lantern path needs supplies, not a step count. I brought my Locker for the Garden.',
} as const;
