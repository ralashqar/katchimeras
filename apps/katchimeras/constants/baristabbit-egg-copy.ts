import type { HatchableEggPolicy } from '@/types/hatchable-companion';

/**
 * Baristabbit's Egg, as content: it warms when you pause. It asks what a cup
 * is for, then what was in the cup today; two answers and it is ready. No
 * sensor, no camera, no permission: the photo of today's drink is a daily
 * card once he is home, never a hatch requirement. A leaf on purpose: the
 * definition reads it, and nothing here reaches the engine. Lore voice:
 * present tense, one image a line, no exclamation marks.
 */
export const BARISTABBIT_EGG_GUIDES = {
  intent: { eyebrow: 'Under the Mist', title: 'This one warms when you pause.', body: '' },
  reading: { eyebrow: 'Today’s drink', title: 'Listening for the kettle…', body: '' },
  photo: { eyebrow: 'Today’s drink', title: 'A pause is light the Mist never got.', body: '' },
  ask: { eyebrow: 'Today’s drink', title: 'A drink is light too. Tell it.', body: '' },
  told: { eyebrow: 'Today’s drink', title: 'Any cup counts. The pause is the light.', body: '' },
  ready: { eyebrow: 'Awake', title: 'The Mist is off it. Someone is putting the kettle on.', body: '' },
} as const;

export const BARISTABBIT_INTENT_BOND = 10;
export const BARISTABBIT_DRINK_BOND = 20;

/** What a cup is for, lately: the first thing the Egg wants to know. */
export const BARISTABBIT_INTENT_OPTIONS = [
  { id: 'slow-start', label: 'A slow start, before the day asks anything', icon: 'cup.and.saucer.fill' },
  { id: 'warm-pause', label: 'A warm pause in the middle of it', icon: 'heart.fill' },
  { id: 'reset', label: 'A reset, then on again', icon: 'sparkles' },
] as const;

/** Told instead of shown: any of these is the same light. */
export const BARISTABBIT_DRINK_OPTIONS = [
  { id: 'tea', label: 'Tea', icon: 'cup.and.saucer.fill' },
  { id: 'coffee', label: 'Coffee', icon: 'cup.and.saucer.fill' },
  { id: 'cold', label: 'Something cold', icon: 'sparkles' },
  { id: 'water', label: 'Just water', icon: 'heart.fill' },
] as const;

export const BARISTABBIT_EGG_POLICY: HatchableEggPolicy = {
  accentColor: '#F2B457',
  guides: {
    intent: BARISTABBIT_EGG_GUIDES.intent, reading: BARISTABBIT_EGG_GUIDES.reading, feed: BARISTABBIT_EGG_GUIDES.photo,
    permission: BARISTABBIT_EGG_GUIDES.ask, alternative: BARISTABBIT_EGG_GUIDES.told, ready: BARISTABBIT_EGG_GUIDES.ready,
  },
  intent: { actionId: 'egg.baristabbit.intent', title: 'The kettle is on and there is a cup. What is it for, today?', bond: BARISTABBIT_INTENT_BOND, options: BARISTABBIT_INTENT_OPTIONS },
  alternative: { actionId: 'egg.baristabbit.drink', title: 'What was in the cup today?', bond: BARISTABBIT_DRINK_BOND, options: BARISTABBIT_DRINK_OPTIONS },
  /** Answers only: the cup's purpose, then what was in it. */
  feed: { kind: 'answer' },
  hatch: { actionId: 'egg.baristabbit.hatch', title: 'Hatch', description: 'Your little friend is ready.' },
};
