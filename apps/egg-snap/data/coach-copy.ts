/**
 * What the in-battle coach says, and which saved lesson each state belongs to.
 *
 * One line per state, kept short enough to read mid-drag. Every state maps to a `mechanic:*` seen-record so a
 * lesson shows once per profile, however many fights carry the mechanic afterwards.
 */
export type CoachState = 'snap' | 'gust' | 'bomb-notice' | 'bomb-safe' | 'bomb-clear' | 'armour' | 'spin';

export const COACH_COPY: Record<CoachState, string> = {
  snap: 'Drag this block to its matching target.',
  gust: 'Gust! The target sways. Drop where it is now.',
  'bomb-notice': 'This one is rigged! Don’t snap it yet.',
  'bomb-safe': 'Snap this unmarked shape first to defuse it.',
  'bomb-clear': 'Safe now! Snap the remaining shape.',
  armour: 'Chip this armoured shape, then snap again!',
  spin: 'It’s turned! Wait for it to face your piece, then snap.',
};

export const COACH_LESSON: Record<CoachState, string> = {
  snap: 'mechanic:tap',
  gust: 'mechanic:drift',
  'bomb-notice': 'mechanic:bomb',
  'bomb-safe': 'mechanic:bomb',
  'bomb-clear': 'mechanic:bomb',
  armour: 'mechanic:armour',
  spin: 'mechanic:spin',
};

/** States whose target moves, so the hand guide would point at where it was. */
export const COACH_WITHOUT_HAND: readonly CoachState[] = ['bomb-notice', 'gust', 'spin'];
