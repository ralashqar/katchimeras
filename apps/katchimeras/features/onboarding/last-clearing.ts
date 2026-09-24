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

/** The first battle: a scripted Lanes level (`constants/last-clearing-battle.ts`) that cannot be lost. */
export const FIRST_BATTLE_ID = 'last-clearing:first-battle';
export const FIRST_BATTLE_EYEBROW = 'They found us';
export const FIRST_BATTLE_TITLE = 'Quick. Put two together: they grow into something that shines.';
export const FIRST_BATTLE_BODY = 'Drag one Seed onto its twin.';

/** What Mossprout says over the first battle, as it goes. */
export const FIRST_BATTLE_LINES = {
  found: 'They found us. Quick: put two Seeds together. They grow into something that shines.',
  aim: 'It shoots Glow straight up its column. Keep it under that wisp.',
  works: 'It works! They hate the light.',
  another: 'Another one. Get something growing under it.',
  spitting: 'It’s spitting Mist at us. Grow something right beside it: the light burns it off.',
  lastStand: 'Three of them. Every lane. Two small ones cover more ground. One big one hits harder.',
  pushed: 'Hold on! I pushed it back. Keep going!',
} as const;

/** The Mist retreats (beat 7): the veil lift, and Mossprout can hardly believe it. */
export const MIST_RETREAT_LINES: readonly string[] = ['We did it.', 'We actually did it.'];

/** The Heart Tree (beat 8): the camera pushes in on it, and the light you won can wake it. */
export const HEART_TREE_STEP_ID = 'world.heart_tree';
export const HEART_TREE_ACTION_ID = 'world.restore_heart_tree';
export const HEART_TREE_TITLE = 'The Heart Tree';
export const HEART_TREE_LINES: readonly string[] = [
  'This is the Heart Tree. Every Sanctuary had one.',
  'Ours is barely holding on. Your light could wake it.',
];
export const HEART_TREE_RESTORE = 'Restore the Heart Tree';

/** The Sanctuary (beat 9): the title card after the Tree wakes. */
export const SANCTUARY_STEP_ID = 'world.sanctuary_founded';
export const SANCTUARY_ACTION_ID = 'world.found_sanctuary';
export const SANCTUARY_TITLE = 'Sanctuary Founded';
export const SANCTUARY_LINE = 'A Sanctuary again. The first one in… a very long time.';
