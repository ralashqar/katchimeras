import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { GROVE_MISSION_ID } from '@/constants/regions/sleeping-grove';
import type { EncounterOutcome } from '@/features/encounter/outcome';
import { dailyTrack, groveTrack, islandTrack } from '@/features/level-tracks/level-track';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { greetIslandFriend, revealIsland } from './helpers/island-campaign';

const NOW = Date.UTC(2026, 8, 22, 9);
const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
const outcome = (grade: EncounterOutcome['grade']): EncounterOutcome => ({ cleared: true, grade, resolveLeft: 4, actions: 12, merges: 10, continues: 0, rescued: false });
const clear = (state: MergeWorldState, missionId: string, grade: EncounterOutcome['grade'] = 'cleared', campaignId?: string) => reduceMergeWorld(state, {
  type: 'completeEncounter', receiptId: `r:${missionId}:${grade}`, missionId, ...(campaignId ? { campaignId } : {}), katchimeraId: 'mossprout', helperWispId: null,
  outcome: outcome(grade), difficulty: 'calm', base: null, now: NOW,
}).state;

test('a misted friend island starts on lifting its Mist; winning it asks for the reveal; its chapters wait on their stories', () => {
  let world = createInitialMergeWorldState(NOW, ['mossprout']);
  let track = islandTrack(world, petalimp);
  assert.equal(track.levels[0]!.title, 'Lift the Mist');
  assert.equal(track.levels[0]!.state, 'next');
  assert.equal(track.levels[0]!.playable, true);
  assert.deepEqual(track.primary.kind === 'play' && track.primary.node.number, 1);
  assert.ok(track.levels.slice(1).every((node) => !node.playable), 'no chapter level before the story');
  assert.equal(track.chapters.length, petalimp.chapters.length + 1, 'the Mist, then every chapter');
  assert.ok(track.levels[0]!.reward!.glow > 0, 'lifting the Mist pays Glow: friends are never paid for');

  world = clear(world, `${petalimp.campaignId}:mist`, 'bright', petalimp.campaignId);
  track = islandTrack(world, petalimp);
  assert.equal(track.primary.kind, 'reveal', 'a won Mist level that has not lifted yet offers to lift it');
  assert.equal(track.levels[0]!.stars, 2);

  world = greetIslandFriend(revealIsland(world, petalimp, NOW + 1), petalimp, NOW + 2);
  track = islandTrack(world, petalimp);
  // No story button: the chapter's first level is the button, and its story plays on the way in.
  assert.equal(track.primary.kind, 'play');
  assert.equal(track.primary.kind === 'play' && track.primary.node.opensStory, true);
  assert.equal(track.primary.kind === 'play' && track.primary.node.number, 2);
  assert.equal(track.chapters[1]!.story, 'ready');
  assert.ok(!JSON.stringify(track).includes('Plan with'), 'no plan button anywhere');
  const activated = reduceMergeWorld(world, { type: 'activateIslandCampaignChapter', campaignId: petalimp.campaignId, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, level: 1, selectedOptionId: petalimp.chapters[0]!.choices[0]!.id, orders: [], now: NOW + 3 });
  track = islandTrack(activated.state, petalimp);
  assert.equal(track.primary.kind, 'play');
  assert.equal(track.primary.kind === 'play' && track.primary.node.number, 2);
  assert.equal(track.cleared, 1);
  assert.equal(track.stars, 2);
  assert.equal(track.maxStars, track.total * 3);
  assert.equal(track.milestones.length, 3);
});

test('the Grove track: its encounters are the levels, a chest opens when the stars are there, the Steppling level waits for him', () => {
  let world = createInitialMergeWorldState(NOW, ['mossprout']);
  let track = groveTrack(world, { ftueComplete: true });
  assert.equal(track.levels.length, 8);
  assert.equal(track.primary.kind === 'play' && track.primary.node.mission?.id, GROVE_MISSION_ID(2));
  world = clear(clear(world, GROVE_MISSION_ID(2), 'perfect'), GROVE_MISSION_ID(3), 'perfect');
  track = groveTrack(world, { ftueComplete: true });
  assert.equal(track.stars, 6);
  assert.equal(track.milestones[0]!.state, 'ready');
  assert.equal(track.levels[0]!.state, 'done');
  assert.equal(track.levels[0]!.playable, true, 'a cleared level can be played again');
});

test('the Daily Mist track: three patches, all open, no chests', () => {
  const track = dailyTrack(createInitialMergeWorldState(NOW, ['mossprout']), '2026-09-22');
  assert.equal(track.levels.length, 3);
  assert.ok(track.levels.every((node) => node.playable));
  assert.deepEqual(track.milestones, []);
});

test('the Kingdom opens a friend’s island on its level track, and one sheet serves the Grove and the Daily Mist', () => {
  const screen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');
  assert.match(screen, /setTrackOpen\(\{ kind: 'island', campaignId: offerCampaignId \}\)/);
  assert.match(screen, /<LevelTrackSheet /);
  assert.doesNotMatch(screen, /GroveSheet|DailyMistSheet/);
  assert.match(screen, /isMistLevel\(focus\.mission\.id\) && cleared\?\.firstClear\) \{ void liftIslandMist/);
  // Nothing of the world's comes back over a level: the goal's guide is done when its island is tapped, and it,
  // the goal popup and shared adventures all stand down while a level or a track is up.
  assert.match(screen, /&& !islandEncounter && !trackOpen\);\s*const goalFocusStartedRef/);
  assert.match(screen, /tapping its island is the guide done[\s\S]{0,600}acknowledgeStoredKingdomGoalCoachmark/);
  assert.match(screen, /!pendingIslandDiscovery && !islandEncounter && !trackOpen;/);
  assert.match(screen, /!rushSheetOpen && !rushSpec && !islandEncounter && !trackOpen;/);
  // A hatch story under way keeps the camera: a friend's island tap goes back to it, and no level starts under it.
  assert.match(screen, /if \(hatchableStoryOpenRef\.current\) \{\s*setSelectedUpgrade\(null\);\s*setGlowPanelOpen\(true\);/);
  assert.match(screen, /\(islandEncounter \|\| trackOpen \? islandEncounterCamera : null\) \?\? \(mistResumeCamera/);
  // A level holds the world like every docked board (no markers, no tile taps, the camera still), and its board,
  // which draws no lesson, is free from the first move.
  assert.match(screen, /const missionBoardDocked = [^\n]*\|\| islandEncounterActive;/);
  assert.match(screen, /\|\| Boolean\(rushSpec\) \|\| islandEncounterActive\}/);
  assert.match(screen, /useMistMission\(\{ guided: false, [^\n]*active: islandEncounterActive/);
  // After a level or a story beat the game goes on: a chapter played as levels closes its opening conversation
  // (it once threw looking for a Merge request), a won level lands back on its track unless a story takes over,
  // and the story never opens on its own under a level or a track.
  assert.doesNotMatch(screen, /request could not be opened/);
  assert.match(screen, /The campaign pivot: the chapter plays as levels[\s\S]{0,900}setLevelAfterStory\([\s\S]{0,300}requestResidentInteractionExit\(\);/);
  assert.match(screen, /if \(campaign && node\.opensStory\) \{/);
  assert.match(screen, /if \(cleared\?\.islandRaised\) return;\s*setTrackReopen\(/);
  assert.match(screen, /if \(!screenFocused \|\| pendingIslandDiscovery \|\| islandEncounter \|\| trackOpen/);
});

test('a board with no words for its first merge has no first-merge lesson: every touch is the player’s', async () => {
  const { missionBoardStep } = await import('@/features/onboarding/steppling-mission');
  const { STEPPLING_HATCHABLE } = await import('@/constants/hatchable-companions/registry');
  const { createMissionState } = await import('@/features/onboarding/steppling-mission');
  const mission = STEPPLING_HATCHABLE.mission;
  const state = createMissionState(mission.seed, 'steppling', NOW);
  assert.equal(missionBoardStep(mission, state, 0)?.interaction?.mode, 'exclusive', 'a taught board still holds its first drag');
  const blank = { eyebrow: '', title: '', body: '' };
  const unguided = { ...mission, guides: { ...mission.guides, firstMerge: blank } };
  assert.notEqual(missionBoardStep(unguided, state, 0)?.interaction?.mode, 'exclusive');
});
