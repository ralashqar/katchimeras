import type { HatchableEggPolicy } from '@/types/hatchable-companion';

/**
 * Steppling's Egg, as content: the questions it asks, the light it is fed
 * with (yesterday's steps), and what it says at each beat. A leaf on purpose:
 * his definition reads it, and nothing here reaches the engine.
 */
export const STEPPLING_EGG_GUIDES = {
  intent: { eyebrow: 'Under the Mist', title: 'This one moves when you do.', body: '' },
  reading: { eyebrow: 'Yesterday’s steps', title: 'Counting yesterday’s steps…', body: '' },
  steps: { eyebrow: 'Yesterday’s steps', title: 'Steps are light the Mist never got. Feed them in.', body: '' },
  permission: { eyebrow: 'Yesterday’s steps', title: 'Your steps are light too. May it count them?', body: '' },
  movement: { eyebrow: 'Your own rhythm', title: 'Steps are one way to make light. Not the only one.', body: '' },
  ready: { eyebrow: 'Awake', title: 'The Mist is off it. Someone’s waking.', body: '' },
} as const;

/** Spoken before the system Motion prompt; both answers keep the Egg hatchable. */
export const STEPPLING_STEP_ACCESS_OPTIONS = {
  allow: { id: 'egg.steppling.allow_steps', title: 'Count my steps', description: 'Steps stay on your phone. They only wake the Egg.' },
  decline: { id: 'egg.steppling.decline_steps', title: 'Not today', description: 'Steppling will ask what moved you instead.' },
} as const;
export const STEPPLING_EGG_TARGET = 500;
export const STEPPLING_STEPS_PER_BOND = 300;
export const STEPPLING_INTENT_BOND = 10;
export const STEPPLING_MOVEMENT_BOND = 20;
export const STEPPLING_INTENT_OPTIONS = [
  { id: 'breaks', label: 'Out and back, between everything else' },
  { id: 'exploring', label: 'Wherever the path goes' },
  { id: 'own-pace', label: 'Slowly, and only my way' },
] as const;
export const STEPPLING_MOVEMENT_OPTIONS = [
  { id: 'walk', label: 'A walk, even a short one' },
  { id: 'adapted', label: 'A stretch, sitting or standing' },
  { id: 'rest', label: 'Nothing much, on purpose' },
] as const;

const movementChoice = (option: { id: string; label: string }) => ({
  ...option, icon: option.id === 'rest' || option.id === 'own-pace' ? 'heart.fill' : 'figure.walk',
  domainChoiceId: option.id === 'rest' || option.id === 'own-pace' ? 'rest' : option.id === 'exploring' ? 'outdoors' : 'full',
});

export const STEPPLING_EGG_POLICY: HatchableEggPolicy = {
  accentColor: '#FFD76A',
  guides: { intent: STEPPLING_EGG_GUIDES.intent, reading: STEPPLING_EGG_GUIDES.reading, feed: STEPPLING_EGG_GUIDES.steps, permission: STEPPLING_EGG_GUIDES.permission, alternative: STEPPLING_EGG_GUIDES.movement, ready: STEPPLING_EGG_GUIDES.ready },
  intent: { actionId: 'egg.steppling.intent', title: 'The door’s open and there’s an hour. Which way do you go?', bond: STEPPLING_INTENT_BOND, options: STEPPLING_INTENT_OPTIONS.map(movementChoice) },
  alternative: { actionId: 'egg.steppling.movement', title: 'What actually moved you today?', bond: STEPPLING_MOVEMENT_BOND, options: STEPPLING_MOVEMENT_OPTIONS.map(movementChoice) },
  access: { allow: { ...STEPPLING_STEP_ACCESS_OPTIONS.allow, icon: 'figure.walk' }, decline: { ...STEPPLING_STEP_ACCESS_OPTIONS.decline, icon: 'heart.fill' } },
  feed: { kind: 'steps', target: STEPPLING_EGG_TARGET, perBond: STEPPLING_STEPS_PER_BOND, actionTitle: 'Feed steps', readingTitle: 'Reading yesterday’s steps…' },
  hatch: { actionId: 'egg.steppling.hatch', title: 'Hatch', description: 'Your little friend is ready.' },
};
