/**
 * Baristabbit's first conversation after the hatch: what kind of pause today
 * needs, then the parcel for the Garden. The same shape as Steppling's day
 * one (an opening, three choices, a handoff each, one closing line), in the
 * lore voice: present tense, one image a line, no exclamation marks.
 */
export const BARISTABBIT_DAY_ONE_OPENING = 'I kept a light on. The Mist did not mind. It sat closer, and the kettle held. The counter is open now. What kind of pause do you need today?';
export const BARISTABBIT_DAY_ONE_CHOICES = [
  { id: 'slow-start', label: '☕ A slow start' },
  { id: 'warm-pause', label: '🍵 Something warm, in the middle of it' },
  { id: 'reset', label: '🧋 A reset, then on' },
] as const;
export const BARISTABBIT_DAY_ONE_HANDOFFS = {
  'slow-start': 'A threshold, then. Nothing is asked of you before the first sip. I brought a parcel for the garden. Shall we look?',
  'warm-pause': 'A warm pause gives the day a softer edge. Every one is light the Mist does not get. I brought a parcel for the garden.',
  reset: 'Warm or cold, the useful part is the stop. I brought a parcel for the garden.',
} as const;
export const BARISTABBIT_DAY_ONE_END = 'A little parcel is waiting in our Garden. I kept it warm the whole way.';
