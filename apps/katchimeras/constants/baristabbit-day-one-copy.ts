/**
 * Baristabbit's first conversation after the hatch: what a pause is for, then
 * the parcel for the Garden. In the lore voice: present tense, one image a
 * line, no exclamation marks.
 */
export const BARISTABBIT_DAY_ONE_OPENING = 'I kept a light on. The Mist didn’t mind. It just sat closer. The kettle survived. What kind of pause do you need today?';
export const BARISTABBIT_DAY_ONE_CHOICES = [
  { id: 'beginning', label: '☕ A clear beginning' },
  { id: 'comfort', label: '🍵 Something warm and familiar' },
  { id: 'reset', label: '🧋 A reset, then on' },
] as const;
export const BARISTABBIT_DAY_ONE_HANDOFFS = {
  beginning: 'A threshold, then. Not a demand to be productive. I brought a parcel for the garden. Shall we look?',
  comfort: 'Something familiar gives the day a softer edge. I brought a parcel for the garden.',
  reset: 'Warm or cold, the useful part is the pause. I brought a parcel for the garden.',
} as const;
export const BARISTABBIT_DAY_ONE_END = 'A little parcel is waiting in our Garden. I kept it warm the whole way.';
