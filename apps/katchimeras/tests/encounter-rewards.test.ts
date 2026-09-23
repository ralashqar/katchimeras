import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { regionLadder } from '@/constants/island-campaigns/ladder';
import { ENCOUNTER_BASE_GLOW, ENCOUNTER_BASE_XP, encounterRewards, GRADE_MULTIPLIER, REPLAY_GLOW_FACTOR } from '@/features/encounter/encounter-rewards';
import { mergeCommandEvents } from '@/features/live-ops/merge-events';
import type { EncounterOutcome } from '@/features/encounter/outcome';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { greetIslandFriend, revealIsland } from './helpers/island-campaign';

const NOW = Date.UTC(2026, 8, 22, 9);
const cleared = (grade: EncounterOutcome['grade'] = 'cleared'): EncounterOutcome => ({ cleared: true, grade, resolveLeft: 4, actions: 12, merges: 10, continues: 0, rescued: false });

test('rewards follow the difficulty, the grade, the first clear and the Glow bonus, and a rung’s own base wins over the default', () => {
  assert.deepEqual(encounterRewards({ difficulty: 'calm', grade: 'cleared', firstClear: true }), { glow: ENCOUNTER_BASE_GLOW.calm, xp: ENCOUNTER_BASE_XP.calm });
  assert.deepEqual(encounterRewards({ difficulty: 'thick', grade: 'perfect', firstClear: true }), { glow: Math.round(20 * GRADE_MULTIPLIER.perfect), xp: Math.round(12 * GRADE_MULTIPLIER.perfect) });
  assert.deepEqual(encounterRewards({ difficulty: 'boss', grade: 'cleared', firstClear: false }), { glow: Math.round(60 * REPLAY_GLOW_FACTOR), xp: Math.round(30 * 0.6) });
  assert.deepEqual(encounterRewards({ difficulty: 'calm', base: { glow: 40, xp: 5 }, grade: 'cleared', firstClear: true, glowBonus: 0.25 }), { glow: 50, xp: 5 });
  assert.deepEqual(encounterRewards({ difficulty: 'calm', base: { glow: 0, xp: 0 }, grade: 'cleared', firstClear: true }), { glow: 12, xp: 8 }, 'a zero base is the default');
});

test('completeEncounter pays once per receipt, records the clear and the best grade, and a failed attempt pays nothing', () => {
  const world: MergeWorldState = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 10 };
  const command: MergeWorldCommand = { type: 'completeEncounter', receiptId: 'r1', missionId: 'test:rung', katchimeraId: 'mossprout', helperWispId: null, outcome: cleared('bright'), difficulty: 'thick', now: NOW };
  const first = reduceMergeWorld(world, command);
  assert.equal(first.changed, true);
  assert.equal(first.state.coins, 10 + 25);
  assert.equal(first.state.katchimeraProgress?.mossprout?.xp, 15);
  assert.deepEqual(first.state.encounters?.clears['test:rung'], { firstClearedAt: NOW, clears: 1, bestGrade: 'bright', lastKatchimeraId: 'mossprout' });
  assert.deepEqual(first.encounterCleared, { missionId: 'test:rung', glow: 25, xp: 15, grade: 'bright', firstClear: true, katchimeraId: 'mossprout', trackId: 'test:rung' });
  assert.equal(first.state.encounters?.lastOutcome?.ackedAt, null);
  const again = reduceMergeWorld(first.state, command);
  assert.equal(again.changed, false, 'the same receipt pays nothing more');
  const replay = reduceMergeWorld(first.state, { ...command, receiptId: 'r2', outcome: cleared('cleared') });
  assert.equal(replay.state.coins, first.state.coins + 8, 'a replay pays the fraction');
  assert.equal(replay.state.encounters?.clears['test:rung']?.bestGrade, 'bright', 'the best grade stays');
  assert.equal(replay.state.encounters?.clears['test:rung']?.clears, 2);
  const failed = reduceMergeWorld(first.state, { ...command, receiptId: 'r3', outcome: { ...cleared(), cleared: false } });
  assert.equal(failed.changed, false);
  const acked = reduceMergeWorld(replay.state, { type: 'ackEncounterOutcome', now: NOW + 1 });
  assert.equal(acked.state.encounters?.lastOutcome?.ackedAt, NOW + 1);
  assert.equal(reduceMergeWorld(acked.state, { type: 'ackEncounterOutcome', now: NOW + 2 }).changed, false);
  const events = mergeCommandEvents(world, command, first, 0);
  assert.equal(events[0]?.kind, 'encounter_cleared');
  assert.deepEqual(events[0]?.context.tags, ['first-clear']);
  assert.equal(events[0]?.context.level, 1);
});

test('an encounter that is up is remembered with its loadout, and put down again', () => {
  const world = createInitialMergeWorldState(NOW, ['mossprout']);
  const started = reduceMergeWorld(world, { type: 'startEncounter', missionId: 'test:rung', runId: 'run-1', campaignId: 'c', katchimeraId: 'mossprout', helperWispId: 'sprout', now: NOW });
  assert.deepEqual(started.state.encounters?.active, { missionId: 'test:rung', runId: 'run-1', campaignId: 'c', katchimeraId: 'mossprout', helperWispId: 'sprout', startedAt: NOW });
  assert.deepEqual(started.state.encounters?.loadout, { katchimeraId: 'mossprout', helperWispId: 'sprout' });
  assert.equal(reduceMergeWorld(started.state, { type: 'startEncounter', missionId: 'test:rung', runId: 'run-1', katchimeraId: 'mossprout', helperWispId: 'sprout', now: NOW + 1 }).changed, false);
  const done = reduceMergeWorld(started.state, { type: 'completeEncounter', receiptId: 'r', missionId: 'test:rung', katchimeraId: 'mossprout', helperWispId: 'sprout', outcome: cleared(), difficulty: 'calm', now: NOW + 2 });
  assert.equal(done.state.encounters?.active, null, 'cleared, the board is down');
  const abandoned = reduceMergeWorld(started.state, { type: 'abandonEncounter', now: NOW + 3 });
  assert.equal(abandoned.state.encounters?.active, null);
  assert.equal(reduceMergeWorld(abandoned.state, { type: 'abandonEncounter', now: NOW + 4 }).changed, false);
  // A daily slot is written to the day.
  const daily = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'd', missionId: 'daily:2026-09-22:1', katchimeraId: 'mossprout', helperWispId: null, outcome: cleared('perfect'), difficulty: 'thick', now: NOW });
  assert.deepEqual(daily.state.encounters?.daily['2026-09-22'], { slots: { '1': { clearedAt: NOW, grade: 'perfect' } } });
  assert.deepEqual(mergeCommandEvents(world, { type: 'completeEncounter', receiptId: 'd', missionId: 'daily:2026-09-22:1', katchimeraId: 'mossprout', helperWispId: null, outcome: cleared('perfect'), difficulty: 'thick', now: NOW }, daily, 0)[0]?.context.tags, ['first-clear', 'daily-mist']);
});

test('the last rung of a chapter raises the island to the chapter’s level, free, on its first clear', () => {
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  const ladder = regionLadder(petalimp);
  // The first chapter's last level grows the island.
  const first = ladder.find((rung) => rung.chapterLevel === 1 && rung.lastOfChapter)!;
  assert.equal(ladder.filter((rung) => rung.chapterLevel === 1).length, 2);
  const world: MergeWorldState = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1);
  const done = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'r', missionId: first.mission.id, campaignId: petalimp.campaignId, katchimeraId: 'mossprout', helperWispId: null, outcome: cleared(), difficulty: first.mission.difficulty, now: NOW });
  assert.equal(done.changed, true);
  assert.equal(done.state.haven.mossproutNatureIslands[petalimp.islandId], 1, 'the island grew');
  assert.deepEqual(done.encounterCleared?.islandRaised, { islandId: petalimp.islandId, level: 1 });
  assert.equal(done.state.coins, world.coins + done.encounterCleared!.glow, 'and the Glow was paid, none spent on the level');
});
