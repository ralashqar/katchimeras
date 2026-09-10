import type { FtueChoiceOption } from './ftue-types';

/** Shared by the authored graph and its native presentations. IDs are save data. */
export const MOSSPROUT_FTUE_COPY = {
  opening: 'Nothing here has been noticed in a long while. Then you arrived.',
  openingNoticed: 'Nothing here has been noticed in a long while.',
  openingArrived: 'Then you arrived.',
  lookCloser: 'Look closer',
  mistClearTitle: 'Two of the same, put together.',
  mistClearBody: 'Drag one onto the other.',
  mistThins: 'The Mist thins where someone is being noticed.',
  eggHeardYou: 'And this one heard you.',
  dayQuestion: 'How was your day, honestly?',
  helpQuestion: 'And what would help right now?',
  seedOrigin: 'What you told me is already something. Let’s give it soil.',
  bond: 'Every honest answer is a little light. I felt it.',
  planted: 'There. Now it needs a little light around it.',
  mergePurpose: 'Come, I’ll show you how we make some.',
  growth: 'Look. Your day is growing in my garden. That’s how this works.',
  waterQuestion: 'Your turn. Look up from this for a moment.',
  farewell: 'I need to rest. Roots do, after they grow.\n\nWhen I wake, I’ll show you where the others went. Someone’s close. Look at the mist.',
  restAction: 'Rest, Mossprout',
  wakeAsk: 'May I wake you when I’m back? I’d like to show you what grew.',
  wakeAllow: 'Wake me',
  wakeDecline: 'Not now',
  meditation: 'Mossprout is resting',
  meditationAvailable: 'Mossprout is awake. Let’s see what’s nearby.',
  meditationHelp: 'The garden stays open. Something in the mist is still waiting.',
  keepGrowing: 'Keep growing',
  nextRequest: 'Every request makes a little light. Light wakes places, and places wake friends.',
  freePlayHint: 'Make another Sprout, then merge the pair.',
} as const;

export const MOSSPROUT_DAY_OPTIONS = [
  { id: 'radiant', label: 'Radiant', icon: 'face.very_happy', domainChoiceId: 'energized' },
  { id: 'light', label: 'Light', icon: 'face.happy', domainChoiceId: 'good' },
  { id: 'meh', label: 'Meh', icon: 'face.neutral', domainChoiceId: 'meh' },
  { id: 'heavy', label: 'Heavy', icon: 'face.sad', domainChoiceId: 'drained' },
  { id: 'stormy', label: 'Stormy', icon: 'face.very_sad', domainChoiceId: 'stressed' },
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
