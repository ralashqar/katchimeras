import { TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

import type { FtueActionDefinition, FtueScriptDefinition } from './ftue-types';

const privateChoice = { id: 'private', label: 'Prefer not to say', icon: 'lock.fill', private: true } as const;

const openingActions: readonly FtueActionDefinition[] = [
  {
    id: 'egg.feeling', title: 'How do you feel?', description: 'Pick one.', icon: 'face.smiling',
    presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'feeling', growthSource: 'mood', growthReward: TODAY_GROWTH_REWARDS.mood,
    nextStepId: 'egg.context', backendEvent: true,
    options: [
      { id: 'great', label: 'Great', icon: 'face.very_happy', domainChoiceId: 'energized' },
      { id: 'good', label: 'Good', icon: 'face.happy', domainChoiceId: 'good' },
      { id: 'okay', label: 'Okay', icon: 'face.neutral', domainChoiceId: 'meh' },
      { id: 'tired', label: 'Tired', icon: 'face.sad', domainChoiceId: 'drained' },
      { id: 'rough', label: 'Rough', icon: 'cloud.rain.fill', domainChoiceId: 'stressed' },
      privateChoice,
    ],
  },
];

export const MOSSPROUT_FTUE_SCRIPT: FtueScriptDefinition = {
  id: 'mossprout-first-session',
  version: 5,
  entryStepId: 'egg.opening',
  terminalStepId: 'complete',
  steps: [
    {
      id: 'egg.opening', surface: 'today',
      guide: { eyebrow: 'A tiny spark', title: 'Something is waiting.', body: 'Share one piece of today.' },
      actions: openingActions,
    },
    {
      id: 'egg.context', surface: 'today',
      guide: { eyebrow: 'It felt that', title: 'The Egg is stirring.', body: 'Give it one more piece.' },
      actions: [{
        id: 'egg.context.activity', title: 'What was part of today?', description: 'Pick one.', icon: 'leaf.fill',
        presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'activity', growthSource: 'reflection', growthReward: TODAY_GROWTH_REWARDS.reflection,
        nextStepId: 'egg.mind', backendEvent: true,
        options: [
          { id: 'work', label: 'Work', icon: 'briefcase.fill', domainChoiceId: 'work' },
          { id: 'family', label: 'Family', icon: 'person.2.fill', domainChoiceId: 'family' },
          { id: 'outside', label: 'Outside', icon: 'leaf.fill', domainChoiceId: 'outdoors' },
          { id: 'friends', label: 'Friends', icon: 'bubble.left.and.bubble.right.fill', domainChoiceId: 'friends' },
          { id: 'relaxing', label: 'Relaxing', icon: 'moon.stars.fill', domainChoiceId: 'resting' },
          { id: 'something_else', label: 'Something else', icon: 'sparkles', domainChoiceId: 'new' },
          privateChoice,
        ],
      }],
    },
    {
      id: 'egg.mind', surface: 'today',
      guide: { eyebrow: 'Almost awake', title: 'One last thing.', body: 'What has your attention?' },
      actions: [{
        id: 'egg.mind.focus', title: "What's on your mind?", description: 'Pick one.', icon: 'sparkles',
        presentation: 'inline_choice', handlerId: 'day_prompt', promptKind: 'day_focus', growthSource: 'reflection', growthReward: TODAY_GROWTH_REWARDS.reflection,
        nextStepId: 'egg.ready', backendEvent: true,
        options: [
          { id: 'people', label: 'People', icon: 'person.2.fill', domainChoiceId: 'people' },
          { id: 'progress', label: 'Something to do', icon: 'briefcase.fill', domainChoiceId: 'progress' },
          { id: 'places', label: 'Somewhere', icon: 'mappin.and.ellipse', domainChoiceId: 'places' },
          { id: 'rest', label: 'Getting some rest', icon: 'moon.stars.fill', domainChoiceId: 'rest' },
          { id: 'fun', label: 'Something fun', icon: 'party.popper.fill', domainChoiceId: 'fun' },
          { id: 'getting_through', label: 'Getting through today', icon: 'cloud.rain.fill', domainChoiceId: 'getting_through' },
          privateChoice,
        ],
      }],
    },
    {
      id: 'egg.ready', surface: 'today',
      guide: { eyebrow: 'A new beginning', title: "It's ready to meet you.", body: 'Your day woke the Egg.' },
      actions: [{ id: 'egg.hatch', title: 'Hatch the Egg', description: 'Meet your new friend.', icon: 'sparkles', presentation: 'cta_action', handlerId: 'discovery_hatch', nextStepId: 'hatch.reveal', backendEvent: true }],
    },
    {
      id: 'hatch.reveal', surface: 'hatch',
      guide: { eyebrow: 'A new friend', title: 'Mossprout', body: 'A tiny spirit ready to grow.' },
      actions: [{ id: 'hatch.talk_to_mossprout', title: 'Say hello', description: 'Meet Mossprout.', icon: 'bubble.left.fill', presentation: 'cta_action', handlerId: 'companion_conversation', nextStepId: 'companion.first_meeting' }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'companion.first_meeting', surface: 'companion',
      guide: { eyebrow: 'Say hello', title: 'Meet Mossprout.', body: 'It remembers what you shared.' },
      actions: [{ id: 'companion.complete_first_meeting', title: 'Let’s look', description: 'Open Mossprout’s real Merge board.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'companion_conversation', nextStepId: 'merge.first', backendEvent: true }],
      blockingBeat: 'mossprout_intro',
    },
    {
      id: 'merge.first', surface: 'merge',
      guide: { eyebrow: 'First request', title: 'Make a Sprout.', body: 'Merge the two Seeds.' },
      actions: [{ id: 'merge.serve_sprout', title: 'Something to plant', description: 'Serve the Sprout.', icon: 'leaf.fill', presentation: 'observed_game_action', handlerId: 'merge_order_served', nextStepId: 'chapter.complete', backendEvent: true }],
    },
    {
      id: 'chapter.complete', surface: 'merge',
      guide: { eyebrow: 'Chapter complete', title: 'A little place to begin', body: 'Mossprout has somewhere to grow.' },
      actions: [{ id: 'chapter.finish', title: 'Follow the footprints', description: 'See what comes next.', icon: 'pawprint.fill', presentation: 'acknowledgement', handlerId: 'acknowledgement', nextStepId: 'complete', backendEvent: true }],
      blockingBeat: 'chapter_complete',
    },
    { id: 'complete', surface: 'today', guide: { eyebrow: '', title: '', body: '' }, actions: [] },
  ],
};

const stepsById = new Map(MOSSPROUT_FTUE_SCRIPT.steps.map((step) => [step.id, step]));
export function mossproutFtueStep(stepId: string) { return stepsById.get(stepId) ?? null; }
export function mossproutFtueAction(stepId: string, actionId: string) { return mossproutFtueStep(stepId)?.actions.find((action) => action.id === actionId) ?? null; }

export function validateMossproutFtueScript(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) {
    if (ids.has(step.id)) errors.push(`Duplicate step: ${step.id}`);
    ids.add(step.id);
    const actionIds = new Set<string>();
    for (const action of step.actions) {
      if (actionIds.has(action.id)) errors.push(`Duplicate action in ${step.id}: ${action.id}`);
      actionIds.add(action.id);
      if (action.nextStepId && !MOSSPROUT_FTUE_SCRIPT.steps.some((candidate) => candidate.id === action.nextStepId)) errors.push(`Missing next step ${action.nextStepId}`);
      if (action.presentation === 'inline_choice' && !action.options?.length) errors.push(`Choice action has no options: ${action.id}`);
      const optionIds = new Set<string>();
      for (const option of action.options ?? []) {
        if (optionIds.has(option.id)) errors.push(`Duplicate option in ${action.id}: ${option.id}`);
        optionIds.add(option.id);
      }
    }
  }
  if (!ids.has(MOSSPROUT_FTUE_SCRIPT.entryStepId)) errors.push('Missing entry step');
  if (!ids.has(MOSSPROUT_FTUE_SCRIPT.terminalStepId)) errors.push('Missing terminal step');
  const reachable = new Set<string>();
  const pending = [MOSSPROUT_FTUE_SCRIPT.entryStepId];
  while (pending.length) {
    const stepId = pending.pop()!;
    if (reachable.has(stepId)) continue;
    reachable.add(stepId);
    mossproutFtueStep(stepId)?.actions.forEach((action) => { if (action.nextStepId) pending.push(action.nextStepId); });
  }
  for (const step of MOSSPROUT_FTUE_SCRIPT.steps) if (!reachable.has(step.id)) errors.push(`Unreachable step: ${step.id}`);
  return errors;
}
