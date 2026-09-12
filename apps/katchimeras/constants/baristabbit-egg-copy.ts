import type { HatchableEggPolicy } from '@/types/hatchable-companion';

/**
 * Baristabbit's Egg: it warms when you pause. It asks what a drink moment is
 * for, then what you drank today; either answer is light, and the second
 * readies it. No sensor and no permission: an answer-only Egg.
 */
export const BARISTABBIT_EGG_POLICY: HatchableEggPolicy = {
  accentColor: '#F2B457',
  guides: {
    intent: { eyebrow: 'Under the Mist', title: 'This one warms when you pause.', body: '' },
    reading: { eyebrow: 'A pause', title: 'Listening for the kettle…', body: '' },
    feed: { eyebrow: 'A pause', title: 'A pause is light the Mist never got.', body: '' },
    permission: { eyebrow: 'A pause', title: 'May it keep the kettle on?', body: '' },
    alternative: { eyebrow: 'Today’s drink', title: 'Any drink counts. The pause is the light.', body: '' },
    ready: { eyebrow: 'Awake', title: 'The Mist is off it. Someone’s putting the kettle on.', body: '' },
  },
  intent: {
    actionId: 'egg.baristabbit.intent', title: 'A drink moment. What is it for, lately?', bond: 10,
    options: [
      { id: 'beginning', label: 'A clear beginning', icon: 'sparkles' },
      { id: 'comfort', label: 'Comfort', icon: 'heart.fill' },
      { id: 'reset', label: 'A reset', icon: 'sparkles' },
    ],
  },
  alternative: {
    actionId: 'egg.baristabbit.drink', title: 'What did you drink today?', bond: 20,
    options: [
      { id: 'tea', label: 'Tea', icon: 'heart.fill' },
      { id: 'coffee', label: 'Coffee', icon: 'sparkles' },
      { id: 'cold', label: 'Something cold', icon: 'sparkles' },
      { id: 'water', label: 'Just water', icon: 'heart.fill' },
    ],
  },
  feed: { kind: 'answer' },
  hatch: { actionId: 'egg.baristabbit.hatch', title: 'Hatch', description: 'Your little friend is ready.' },
};
