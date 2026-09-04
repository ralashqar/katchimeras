import { defineStory, story } from './story-manifest';
import { lifeQuestion, lifeHabitOfferNodes } from './companion-life-flow';
import { STEPPLING_LIFE_EPISODES } from '@/constants/steppling-life-chapter';

export const STEPPLING_DAY_ONE_RUN_ID = 'journey:steppling:day-1';
export const STEPPLING_PARCEL_REWARD_ID = 'journey:steppling:day-1:journey-locker';
const script = STEPPLING_LIFE_EPISODES[1];
export const STEPPLING_DAY_ONE_FLOW = defineStory({
  id: 'steppling-day-one', version: 2, entryNodeId: 'welcome',
  metadata: { kind: 'journey_day', familyId: 'steppling', day: 1, title: 'A little way together' },
  nodes: [
    { id: 'welcome', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'welcome',
      payload: { text: 'Hi, I’m Steppling. I packed for a journey. Mostly snacks.' }, actions: [{ id: 'continue', next: 'reflection' }] },
    ...lifeQuestion('reflection', 'What would feel good today?', script.choices, 'closing').map((node) => node.kind === 'scene' && node.id === 'reflection' ? { ...node, actions: node.actions?.map((action) => ({ ...action, set: { ...action.set, movementChoice: action.id } })) } : node),
    ...lifeQuestion('cue.walk', script.followup, script.followupChoices, 'habit.steppling:ten-minute-walk'),
    ...lifeQuestion('cue.adapted', script.followup, script.followupChoices, 'habit.steppling:adapted-break'),
    ...lifeQuestion('cue.rest', script.followup, script.followupChoices, 'habit.steppling:rest-break'),
    ...lifeHabitOfferNodes('steppling', 'closing'),
    { id: 'closing', kind: 'scene', capability: 'journey.reflection', surface: 'companion', sceneId: 'closing',
      payload: { text: script.bridge }, actions: [{ id: 'continue', next: 'parcel' }] },
    story.effect({ id: 'parcel', capability: 'journey.grant_generator_parcel', payload: { generatorId: 'journey-locker', rewardId: STEPPLING_PARCEL_REWARD_ID }, next: 'complete' }),
    story.complete(),
  ],
  migrations: { 'response.walk': 'closing', 'response.adapted': 'closing', 'response.rest': 'closing' },
});
