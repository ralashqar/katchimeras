import type { FtueChoiceOption } from './ftue-types';

/** Shared by the authored graph and its native presentations. IDs are save data. */
export const MOSSPROUT_FTUE_COPY = {
  opening: 'A little of your day can wake something here.',
  dayQuestion: 'How has today felt?',
  helpQuestion: 'What would feel good right now?',
  seedOrigin: 'Your answer became a Memory Seed. Let’s give it a place in the Garden.',
  bond: 'Your Bond grows through little moments together.',
  planted: 'There. A place of its own. Let’s help the Garden wake up around it.',
  mergePurpose: 'Merge a Plant. Complete its request to earn Glow and restore the Garden.',
  growth: 'Look—your Memory Seed is growing. You gave it a beginning. We made it bloom together.',
  waterQuestion: 'We made something for the Garden. Let’s make a little room for you, too.',
  farewell: 'I’m going to rest for eight hours. You can keep tending the Garden while I’m quiet. There’s something beyond that mist…',
  restAction: 'Rest, Mossprout',
  meditation: 'Mossprout is meditating',
  meditationAvailable: 'Mossprout is resting. Let’s see what’s nearby.',
  meditationHelp: 'Only our next Journey waits. Optional activities can shorten my rest; your gift is already earned.',
  keepGrowing: 'Keep growing',
  nextRequest: 'Complete requests to earn Glow. Restore places, or clear a path through the mist.',
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
  { id: 'garden', label: 'What is this place?', reply: 'My Garden. It’s been quiet for a while. I think we could give it some stories.' },
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
