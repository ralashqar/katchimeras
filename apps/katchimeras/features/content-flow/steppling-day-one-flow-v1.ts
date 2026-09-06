import { defineStory, story } from './story-manifest';
import { STEPPLING_MOVEMENT_OPTIONS } from '@/features/onboarding/steppling-egg-policy';

export const STEPPLING_DAY_ONE_RUN_ID = 'journey:steppling:day-1';
export const STEPPLING_PARCEL_REWARD_ID = 'journey:steppling:day-1:journey-locker';
export const LEGACY_STEPPLING_DAY_ONE_FLOW = defineStory({
  id: 'steppling-day-one', version: 1, entryNodeId: 'welcome',
  metadata: { kind: 'journey_day', familyId: 'steppling', day: 1, title: 'A little way together' },
  nodes: [
    { id: 'welcome', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'welcome',
      payload: { text: 'Hi, I’m Steppling. We can find our own pace.' }, actions: [{ id: 'continue', next: 'reflection' }] },
    { id: 'reflection', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'reflection',
      payload: { text: 'What would feel good today?', options: STEPPLING_MOVEMENT_OPTIONS },
      actions: STEPPLING_MOVEMENT_OPTIONS.map((option) => ({ id: option.id, next: `response.${option.id}`, set: { movementChoice: option.id } })) },
    ...[
      ['walk', 'A little walk sounds lovely. There’s no hurry.'],
      ['adapted', 'A stretch or a seated wiggle counts, too. Let’s make it yours.'],
      ['rest', 'Rest belongs here, too. We can take today slowly.'],
    ].map(([id, text]) => ({ id: `response.${id}`, kind: 'scene' as const, capability: 'journey.reflection', surface: 'companion' as const,
      sceneId: `response.${id}`, payload: { text }, actions: [{ id: 'continue', next: 'closing' }] })),
    { id: 'closing', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'closing',
      payload: { text: 'Small counts. I brought something for our Garden. Then I’ll reflect on our first meeting. I’ll be back in eight hours, and a little help can bring me back sooner.' }, actions: [{ id: 'continue', next: 'parcel' }] },
    story.effect({ id: 'parcel', capability: 'journey.grant_generator_parcel', payload: { generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_REWARD_ID }, next: 'complete' }),
    story.complete(),
  ],
});
