import { defineStory, story } from './story-manifest';
import { STEPPLING_DAY_ONE_CHOICES, STEPPLING_DAY_ONE_HANDOFFS, STEPPLING_DAY_ONE_OPENING } from '@/constants/steppling-day-one-copy';

export const STEPPLING_DAY_ONE_RUN_ID = 'journey:steppling:day-1';
export const STEPPLING_PARCEL_REWARD_ID = 'journey:steppling:day-1:journey-locker';
export const STEPPLING_DAY_ONE_FLOW = defineStory({
  id: 'steppling-day-one', version: 3, entryNodeId: 'reflection',
  metadata: { kind: 'journey_day', familyId: 'steppling', day: 1, title: 'A little way together' },
  // Catalog registration validates removed nodes even when older definitions
  // remain available. Keep every released v1/v2 checkpoint explicitly mapped.
  migrations: {
    welcome: 'reflection',
    closing: 'parcel',
    'habit.picker': 'reflection',
    'habit.added': 'parcel',
    ...Object.fromEntries(['walk', 'adapted', 'rest'].flatMap((choice) => [
      [`response.${choice}`, `handoff.${choice}`],
      [`reflection.reply.${choice}`, `handoff.${choice}`],
      [`cue.${choice}`, `handoff.${choice}`],
      ...['after', 'break', 'choose'].map((cue) => [`cue.${choice}.reply.${cue}`, `handoff.${choice}`]),
    ])),
    ...Object.fromEntries([
      ['ten-minute-walk', 'walk'], ['adapted-break', 'adapted'], ['rest-break', 'rest'],
      ['walk-one-journey', 'walk'], ['two-minute-walk', 'walk'],
    ].flatMap(([habit, choice]) => [
      [`habit.steppling:${habit}`, `handoff.${choice}`],
      [`habit.accept.steppling:${habit}`, `handoff.${choice}`],
    ])),
  },
  nodes: [
    { id: 'reflection', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'reflection',
      payload: { text: STEPPLING_DAY_ONE_OPENING, options: STEPPLING_DAY_ONE_CHOICES },
      actions: STEPPLING_DAY_ONE_CHOICES.map(({ id, label }) => ({ id, next: `handoff.${id}`,
        set: { movementChoice: id, 'fact.reflection': `You chose “${label}”.` } })) },
    ...STEPPLING_DAY_ONE_CHOICES.map(({ id }) => ({ id: `handoff.${id}`, kind: 'scene' as const,
      capability: 'journey.reflection', surface: 'companion' as const, sceneId: `handoff.${id}`,
      payload: { text: STEPPLING_DAY_ONE_HANDOFFS[id], options: [{ id: 'garden', label: 'Tend garden' }] },
      actions: [{ id: 'garden', next: 'parcel' }] })),
    story.effect({ id: 'parcel', capability: 'journey.grant_generator_parcel', payload: { generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_REWARD_ID }, next: 'complete' }),
    story.complete(),
  ],
});
