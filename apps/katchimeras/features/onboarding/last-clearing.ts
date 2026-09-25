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
export const FIRST_BATTLE_TITLE = 'Quick. Wake what sleeps under the Mist: it grows into something that shines.';
export const FIRST_BATTLE_BODY = 'Drag a Seed onto the one under the Mist.';

/** What Mossprout says over the first battle, as it goes. */
export const FIRST_BATTLE_LINES = {
  found: 'They found us. Quick: that Seed under the Mist. Bring it its twin and it wakes.',
  wake: 'It woke up, and it shoots! Wake the others. Each one opens the Mist beside it.',
  aim: 'It shoots Glow straight up its column. Keep it under that wisp.',
  works: 'It works! They hate the light.',
  another: 'More of them! Keep something shooting under every one.',
  spitting: 'It’s spitting Mist at us. Grow something right beside it: the light burns it off.',
  lastStand: 'Every lane at once! Hold them. Merge anything new that lands.',
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

/** The frontier (beat 10): the camera pulls out over a world of Mist, to the Hollow Tree far away. */
export const FRONTIER_STEP_ID = 'world.frontier';
export const FRONTIER_ACTION_ID = 'world.see_frontier';
export const FRONTIER_TITLE = 'The First Grove';
export const FRONTIER_LINES: readonly string[] = [
  'That’s all Mist. All of it.',
  'And that… is the Hollow Tree. Nobody goes near it anymore.',
];

/** The tracks (beat 11): a trail at the clearing's edge, footprints going in and none coming out. */
export const LOST_TRAIL_TILE_ID = 'lost-trail';
export const LOST_TRACKS_STEP_ID = 'world.lost_tracks';
export const LOST_TRACKS_ACTION_ID = 'world.follow_tracks';
export const LOST_TRACKS_TITLE = 'The Lost Trail';
export const LOST_TRACKS_LINES: readonly string[] = [
  'Wait.',
  'Someone came through here. Recently.',
  'Someone’s still in there.',
];
export const LOST_TRACKS_LOOK = 'Look closer';

/** The mission (beat 12): the Lost Trail's card. Its levels are step 5; until then the first session ends here. */
export const LOST_TRAIL_MISSION_STEP_ID = 'world.lost_trail_mission';
export const LOST_TRAIL_MISSION_ACTION_ID = 'world.accept_lost_trail';
export const LOST_TRAIL_MISSION_EYEBROW = 'New mission';
export const LOST_TRAIL_MISSION_TITLE = 'Follow the Lost Trail';
export const LOST_TRAIL_MISSION_LINE = 'We can’t leave them out there. Let’s go.';

/** The Lost Trail (beats 12 to 13): three short battles down the trail, docked under its tile, the last a rescue. */
export const LOST_TRAIL_STONE_STEP_IDS = ['world.trail_stone_1', 'world.trail_stone_2', 'world.trail_stone_3'] as const;
export const LOST_TRAIL_STONE_BATTLE_IDS = ['last-clearing:lost-trail-1', 'last-clearing:lost-trail-2', 'last-clearing:lost-trail-3'] as const;
export const LOST_TRAIL_EYEBROW = 'The Lost Trail';
/** What each Lost Trail battle pays: enough, with the first light, for the Sanctuary's first building after home. */
export const LOST_TRAIL_STONE_GLOW = [15, 20, 30] as const;
export const LOST_TRAIL_STONES = [
  { title: 'The Trail In', line: 'Out here they move faster. Watch for the quick one.' },
  { title: 'Mist Rows', line: 'The Mist lies in rows here. Merge beside it to burn it off.' },
  { title: 'Someone’s in There', line: 'There, under the thick Mist. Clear the wisps, then burn it off them.' },
] as const;
/** What is said over each trail battle as it goes. */
export const LOST_TRAIL_LINES = {
  quick: 'That one’s fast! Get something shooting under it.',
  rows: 'Merge right beside the Mist. The light burns it away.',
  voice: 'Hello? Is someone out there?',
  rescue: 'They’re right under there! Merge beside the thick Mist. Twice!',
  clearing: 'The wisps are gone. Now the Mist. Merge next to it!',
  pushed: 'Hold on! I pushed it back. Keep going!',
} as const;

/** The rescue (beat 14): the Mist bursts off the cell, the trail clears, and Steppling tumbles out. */
export const STEPPLING_RESCUED_STEP_ID = 'world.steppling_rescued';
export const STEPPLING_RESCUED_ACTION_ID = 'world.free_steppling';
export const STEPPLING_MEETS_STEP_ID = 'world.steppling_meets';
export const STEPPLING_MEETS_ACTION_ID = 'world.meet_steppling';
export const STEPPLING_MEETS_TITLE = 'Steppling';
export const STEPPLING_MEETS_LINES: readonly { speaker: 'steppling' | 'mossprout'; text: string }[] = [
  { speaker: 'steppling', text: 'You came for me? Nobody comes into the Mist!' },
  { speaker: 'mossprout', text: 'The Wayfinder does.' },
  { speaker: 'steppling', text: 'That path used to go all the way to the sea.' },
  { speaker: 'steppling', text: 'Guess we’ll have to make it go there again.' },
];
export const STEPPLING_MEETS_CONTINUE = 'Welcome, Steppling';
export const STEPPLING_JOINED_STEP_ID = 'world.steppling_joined';
export const STEPPLING_JOINED_ACTION_ID = 'world.welcome_steppling';
export const STEPPLING_JOINED_EYEBROW = 'A new hero';
export const STEPPLING_JOINED_TITLE = 'Steppling has joined your Sanctuary';

/** Home (beat 15): back at the Sanctuary, two now. The first session ends here. */
export const HOME_STEP_ID = 'world.home';
export const HOME_ACTION_ID = 'world.come_home';
export const HOME_TITLE = 'Home';
export const HOME_LINES: readonly string[] = ['Welcome home, Wayfinder.', 'The Mist took a lot. Let’s take it back.'];
