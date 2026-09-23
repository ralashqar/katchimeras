import assert from 'node:assert/strict';
import test from 'node:test';

import { trackMilestones } from '@/constants/level-track-milestones';
import { GROVE_MISSION_ID } from '@/constants/regions/sleeping-grove';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { encounterRewards, REPLAY_GLOW_FACTOR } from '@/features/encounter/encounter-rewards';
import type { EncounterOutcome } from '@/features/encounter/outcome';
import { GROVE_TRACK_ID, gradeStars, trackIdFor, trackMissionIds, trackStars } from '@/features/level-tracks/track-ids';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 22, 9);
const outcome = (grade: EncounterOutcome['grade']): EncounterOutcome => ({ cleared: true, grade, resolveLeft: 4, actions: 12, merges: 10, continues: 0, rescued: false });
const clear = (state: MergeWorldState, missionId: string, grade: EncounterOutcome['grade'], receipt: string, extra: { campaignId?: string; difficulty?: 'calm' | 'boss'; now?: number } = {}) => reduceMergeWorld(state, {
  type: 'completeEncounter', receiptId: receipt, missionId, ...(extra.campaignId ? { campaignId: extra.campaignId } : {}), katchimeraId: 'mossprout', helperWispId: null,
  outcome: outcome(grade), difficulty: extra.difficulty ?? 'calm', base: null, now: extra.now ?? NOW,
});

test('every level belongs to one track, and stars are the grade', () => {
  assert.equal(trackIdFor(GROVE_MISSION_ID(4)), GROVE_TRACK_ID);
  assert.equal(trackIdFor('daily:2026-09-22:1'), 'daily-mist');
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  assert.equal(trackIdFor(`${petalimp.campaignId}:mist`, petalimp.campaignId), petalimp.campaignId);
  assert.equal(trackMissionIds(petalimp.campaignId)[0], `${petalimp.campaignId}:mist`, 'an island track starts with lifting its Mist');
  assert.equal(trackMissionIds(GROVE_TRACK_ID).length, 8, 'the Grove’s eight played levels');
  assert.deepEqual([gradeStars('cleared'), gradeStars('bright'), gradeStars('perfect'), gradeStars(undefined)], [1, 2, 3, 0]);
  assert.deepEqual(trackMilestones(8).map((entry) => entry.threshold), [6, 12, 24]);
  assert.deepEqual(trackMilestones(1).map((entry) => entry.threshold), [1, 2, 3]);
});

test('replays pay their share for the first three each day on a tile, then a trickle; the count resets the next day', () => {
  const base = { difficulty: 'thick' as const, grade: 'cleared' as const, firstClear: false };
  assert.equal(encounterRewards({ ...base, replaysToday: 2 }).glow, Math.round(20 * REPLAY_GLOW_FACTOR));
  assert.equal(encounterRewards({ ...base, replaysToday: 3 }).glow, 2);
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  const mission = GROVE_MISSION_ID(2);
  state = clear(state, mission, 'cleared', 'first').state;
  const paid: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const before = state.coins;
    state = clear(state, mission, 'cleared', `replay-${index}`).state;
    paid.push(state.coins - before);
  }
  assert.deepEqual(paid, [5, 5, 5, 1, 1]);
  assert.equal(state.encounters?.replays?.byTrack[GROVE_TRACK_ID], 5);
  const tomorrow = clear(state, mission, 'cleared', 'tomorrow', { now: NOW + 86_400_000 });
  assert.equal(tomorrow.state.coins - state.coins, 5, 'a new day, a full-rate replay again');
});

test('star milestones open once each, only when the stars are there, and name the pack for the caller', () => {
  let state = createInitialMergeWorldState(NOW, ['mossprout']);
  const refused = reduceMergeWorld(state, { type: 'claimTrackMilestone', trackId: GROVE_TRACK_ID, threshold: 6, now: NOW });
  assert.equal(refused.changed, false);
  for (const rung of [2, 3]) state = clear(state, GROVE_MISSION_ID(rung), 'perfect', `perfect-${rung}`).state;
  assert.equal(trackStars(state.encounters!.clears, GROVE_TRACK_ID).stars, 6);
  const before = state.coins;
  const claimed = reduceMergeWorld(state, { type: 'claimTrackMilestone', trackId: GROVE_TRACK_ID, threshold: 6, now: NOW + 1 });
  assert.equal(claimed.changed, true);
  assert.equal(claimed.state.coins, before + 20);
  assert.deepEqual(claimed.milestoneClaimed, { trackId: GROVE_TRACK_ID, threshold: 6, glow: 20, pack: 'gift', familyId: 'mossprout', receiptId: `friend:mossprout:track:${GROVE_TRACK_ID}:6` });
  const again = reduceMergeWorld(claimed.state, { type: 'claimTrackMilestone', trackId: GROVE_TRACK_ID, threshold: 6, now: NOW + 2 });
  assert.equal(again.changed, false);
  assert.equal(reduceMergeWorld(claimed.state, { type: 'claimTrackMilestone', trackId: GROVE_TRACK_ID, threshold: 7, now: NOW }).changed, false, 'no chest at a made-up threshold');
  const reloaded = normalizeMergeWorldState(JSON.parse(JSON.stringify(claimed.state)), NOW + 3);
  assert.deepEqual(reloaded.encounters?.milestones, { [GROVE_TRACK_ID]: [6] }, 'claimed chests survive a reload');
});

test('a boss down for the first time names a friend pack; a replay does not', () => {
  const state = createInitialMergeWorldState(NOW, ['mossprout']);
  const first = clear(state, GROVE_MISSION_ID(8), 'cleared', 'boss-1', { difficulty: 'boss' });
  assert.deepEqual(first.encounterCleared?.bossPack, { receiptId: `friend:mossprout:boss:${GROVE_MISSION_ID(8)}`, familyId: 'mossprout' });
  assert.equal(first.encounterCleared?.trackId, GROVE_TRACK_ID);
  assert.equal(clear(first.state, GROVE_MISSION_ID(8), 'cleared', 'boss-2', { difficulty: 'boss' }).encounterCleared?.bossPack, undefined);
});
