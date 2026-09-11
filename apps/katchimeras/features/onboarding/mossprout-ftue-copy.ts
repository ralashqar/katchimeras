import type { FtueChoiceOption } from './ftue-types';

/** Shared by the authored graph and its native presentations. IDs are save data. */
export const MOSSPROUT_FTUE_COPY = {
  opening: 'Nobody has looked at this place in a very long time. The Mist came in behind them and stayed. Then you looked.',
  openingNoticed: 'Nobody has looked at this place in a very long time.',
  openingArrived: 'The Mist came in behind them and stayed. Then you looked.',
  lookCloser: 'Look closer',
  mistClearTitle: 'Three Mistwisps have this garden. Make light and they’ll flinch.',
  mistClearBody: 'Two of the same, together: that’s light. Drag one Seed onto the other.',
  mistThins: 'The last one goes, and the Mist has nothing left to hold with.',
  eggHeardYou: 'And something under it heard you looking.',
  dayQuestion: 'If today were weather over this garden, what was it?',
  helpQuestion: 'And the first thing we grow. What should it be for?',
  seedOrigin: 'You looked, and the Mist let go of me. What you just told me is the first light I’ve felt in years. Let’s give it soil.',
  bond: 'Every honest answer is light. That’s how I got out.',
  planted: 'There. It’ll grow if we keep looking at it. Light, then.',
  mergePurpose: 'Come. I’ll show you how we make more of it.',
  growth: 'Look. Your day is growing here. The Mist can’t hold a place someone is watching.',
  waterQuestion: 'Your turn. Look up from this for a moment.',
  farewell: 'I need to rest. Roots do, after they grow.\n\nBehind the Mist there are more of us. When I wake, I’ll show you the trail. Something in the Mist there moves when you do.',
  restAction: 'Rest, Mossprout',
  wakeAsk: 'May I wake you when I’m back? I’d like to show you what grew.',
  wakeAllow: 'Wake me',
  wakeDecline: 'Not now',
  meditation: 'Mossprout is resting',
  meditationAvailable: 'Mossprout is awake. Let’s see what’s nearby.',
  meditationHelp: 'The garden stays open. Past it, the Mist is still holding someone.',
  keepGrowing: 'Keep growing',
  nextRequest: 'Every request makes light. Light pushes the Mist back. Behind the Mist there are more of us.',
  freePlayHint: 'Make another Sprout, then merge the pair.',
} as const;

export const MOSSPROUT_DAY_OPTIONS = [
  { id: 'radiant', label: 'Full sun', icon: 'face.very_happy', domainChoiceId: 'energized' },
  { id: 'light', label: 'Mostly bright', icon: 'face.happy', domainChoiceId: 'good' },
  { id: 'meh', label: 'Grey and still', icon: 'face.neutral', domainChoiceId: 'meh' },
  { id: 'heavy', label: 'Heavy rain', icon: 'face.sad', domainChoiceId: 'drained' },
  { id: 'stormy', label: 'A proper storm', icon: 'face.very_sad', domainChoiceId: 'stressed' },
] as const satisfies readonly FtueChoiceOption[];

export const MOSSPROUT_HELP_OPTIONS = [
  { id: 'progress', label: 'Getting something moving', icon: 'leaf.fill' },
  { id: 'calm', label: 'A bit of quiet', icon: 'wind' },
  { id: 'unsure', label: 'Surprise me. I don’t know yet', icon: 'questionmark' },
] as const satisfies readonly FtueChoiceOption[];

export const MOSSPROUT_GREETING_OPTIONS = [
  { id: 'hello', label: 'Hi, Mossprout.', reply: 'Hi. I’m glad you’re here.' },
  { id: 'garden', label: 'What is this place?', reply: 'My garden. The Mist had it for years. It’s ours again now, mostly.' },
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
