import { OPENING_MIST_OPEN_STEP_ID } from './opening-mist';

/**
 * The Last Clearing, the cozy 4X first session (`docs/cozy-4x-ftue-the-last-clearing.md`). Its beats keep the
 * opening's step ids where the world already knows them (the camera glide, the veil, the docked board), and add the
 * ones it did not have. Every line the player reads in these beats is here.
 */

/** The cold open: black, the lore in three lines, then the sink through the Mist to the clearing. */
export const COLD_OPEN_STEP_ID = OPENING_MIST_OPEN_STEP_ID;
export const COLD_OPEN_ACTION_ID = 'world.look_closer';
export const COLD_OPEN_LINES: readonly string[] = [
  'Once, every path led somewhere.',
  'Then the Mist came, and the world began to forget.',
  'One clearing still remembers.',
];

/** The guardian: Mossprout, worn out at the roots of the dying Heart Tree, meets the Wayfinder. */
export const GUARDIAN_STEP_ID = 'world.guardian';
export const GUARDIAN_ACTION_ID = 'world.meet_guardian';
export const GUARDIAN_TITLE = 'The Last Clearing';
export const GUARDIAN_LINES: readonly string[] = [
  'Oh! You’re real.',
  'The old stories said a Wayfinder would come when the paths were lost.',
  'I didn’t believe them either. Not really.',
  'This clearing is the last one still lit. I’ve been keeping the Mist out of it on my own.',
  'But lately it’s been getting closer.',
];
export const GUARDIAN_CONTINUE = 'Stand with Mossprout';

/** The first battle's words (until the scripted Lanes battle replaces the opening board). */
export const FIRST_BATTLE_EYEBROW = 'They found us';
export const FIRST_BATTLE_TITLE = 'Quick. Put two together: they grow into something that shines.';
export const FIRST_BATTLE_BODY = 'Drag one Seed onto its twin.';
export const MIST_RETREATS_TITLE = 'They’re pulling back.';
