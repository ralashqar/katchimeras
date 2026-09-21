import type { FtueChoiceOption } from './ftue-types';

/** Shared by the authored graph and its native presentations. IDs are save data. */
export const MOSSPROUT_FTUE_COPY = {
  opening: 'Once, every path led home. Then the lights went out. A flicker beneath the Mist is still holding on.',
  openingNoticed: 'Once, every path led home. Then the lights went out.',
  openingArrived: 'A flicker beneath the Mist. Someone is still in there.',
  lookCloser: 'Look closer',
  mistClearTitle: 'Someone is trapped beneath these wisps. Merge to reach them.',
  mistClearBody: '',
  mistThins: 'The Mist has cleared.',
  eggHeardYou: 'The Mist has cleared.',
  dayQuestion: 'If today were weather over this garden, what was it?',
  helpQuestion: 'And the first thing we grow. What should it be for?',
  seedOrigin: 'Five empty patches around Heartwood… and under one of them, the old spring. Let’s dig it out beside the Tree. Everything here grew from that water.',
  bond: 'You found me. Now we can find the others. And perhaps stop my leaves rustling with excitement.',
  planted: 'There. The old spring, right beside Heartwood. Still asleep. Four patches waiting. We’ll bring this whole circle back to life.',
  mergePurpose: 'The trail needs light. Let’s grow what our friends need and send it farther.',
  growth: 'Look! The spring is running again. Heartwood’s first root is glowing. And the same light is reaching that broken trail marker.',
  waterQuestion: 'Your turn. Look up from this for a moment.',
  farewell: 'Three notches. Steppling’s trail! Find him beyond that marker. He knows how the old roots connect our homes.\n\nI’ll rest and keep our roots bright. You needn’t wait for me. We’ve a path to bring back.',
  restAction: 'Rest, Mossprout',
  wakeAsk: 'May I wake you when I’m back? I’d like to show you what grew.',
  wakeAllow: 'Wake me',
  wakeDecline: 'Not now',
  meditation: 'Mossprout is resting',
  meditationAvailable: 'Mossprout is awake. Let’s see what’s nearby.',
  meditationHelp: 'Find Steppling at the broken trail. Our living Heartwood starts there.',
  keepGrowing: 'Keep growing',
  nextRequest: 'Grow supplies, serve a friend, restore the path. Every connection helps Heartwood grow.',
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
  { id: 'hello', label: '🌳 What happened to it?', reply: 'The Mist cut Heartwood off from our homes. Its roots are hungry for life. This Garden can feed the first one.' },
  { id: 'garden', label: '🏮 Can we light it again?', reply: 'Together, I think we can. Heartwood needs all our friends, each tending something different. We start here, with a living Garden.' },
  { id: 'tiny', label: '🥾 Then where do we start?', reply: 'This Garden. A seed, some light, then Heartwood’s first living root. Fortunately, I packed a seed. Less fortunately, I ate the map.' },
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
