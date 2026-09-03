import type { FtueChoiceOption } from './ftue-types';

/** Shared by the authored graph and its native presentations. IDs are save data. */
export const MOSSPROUT_FTUE_COPY = {
  opening: 'A little of your day can wake something here.',
  dayQuestion: 'How has today felt?',
  helpQuestion: 'What would feel good right now?',
  seedOrigin: 'This Seed came from what you shared.',
  bond: 'Your Bond grows through little moments together.',
  planted: 'There. A place of its own. Let’s wake the Garden so it can grow.',
  mergePurpose: 'Merge matching pieces to grow a Plant for the Garden.',
  growth: 'Look—your Seed is growing. A little of your world, growing in mine.',
  waterQuestion: 'We’ve watered the Garden. Fancy a drink of water too?',
  farewell: 'Roots need a little quiet. I’ll reflect on what we started, then we can try the next part of our story together.',
  restAction: 'Rest, Mossprout',
  meditation: 'Mossprout is meditating',
  meditationAvailable: 'Merge and small activities are still open.',
  meditationHelp: 'Some Bond activities shorten the wait. They’re optional.',
  keepGrowing: 'Keep growing',
  nextRequest: 'Grow another Plant to repair the path and bring the spring back.',
  freePlayHint: 'Make another Sprout, then merge the pair.',
} as const;

export const MOSSPROUT_DAY_OPTIONS = [
  { id: 'pretty_good', label: 'Pretty good', icon: 'sun.max.fill' },
  { id: 'too_much_at_once', label: 'A lot going on', icon: 'cloud.rain.fill' },
  { id: 'taking_today_as_it_comes', label: 'Taking it as it comes', icon: 'cloud.sun.fill' },
] as const satisfies readonly FtueChoiceOption[];

export const MOSSPROUT_HELP_OPTIONS = [
  { id: 'progress', label: 'A little progress', icon: 'leaf.fill' },
  { id: 'calm', label: 'A little calm', icon: 'wind' },
  { id: 'unsure', label: 'I’m not sure yet', icon: 'questionmark' },
] as const satisfies readonly FtueChoiceOption[];

export const MOSSPROUT_GREETING_OPTIONS = [
  { id: 'hello', label: 'Hi, Mossprout.', reply: 'Hi. I’m glad you’re here.' },
  { id: 'garden', label: 'What is this place?', reply: 'My Garden. It’s been quiet for a while.' },
  { id: 'tiny', label: 'You’re tiny.', reply: 'The Garden is enormous. Both things can be true.' },
] as const;

export const MOSSPROUT_WATER_OPTIONS = [
  { id: 'could_use_water', icon: 'drop.fill', label: 'I’ll get some.', reply: 'Me too. One little watering.' },
  { id: 'already_good', icon: 'checkmark.circle.fill', label: 'Already had some.', reply: 'Excellent. You’re ahead of the plants.' },
  { id: 'dont_start', icon: 'face.smiling.fill', label: 'Not now, Mossprout.', reply: 'Fair enough. I’ll mind my leaves.' },
] as const;

export function mossproutSeedIntroduction(intentId: string | null | undefined) {
  switch (intentId?.replace('desired-help:', '')) {
    case 'calm': return 'A little calm. We can make room for that.';
    case 'feel_like_myself': return 'Something just for you. Let’s start here.';
    case 'unsure': return 'We don’t need the whole answer. A little curiosity will do.';
    default: return 'A little progress. Let’s give it somewhere to grow.';
  }
}

export function normalizeMossproutIntent(id: string) {
  return id.startsWith('desired-help:') ? id : `desired-help:${id}`;
}
