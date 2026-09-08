import assert from 'node:assert/strict';
import test from 'node:test';

import { ISLAND_CAMPAIGNS, islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import { ISLAND_WAKE_ORDER } from '@/constants/island-campaigns/wake-order';
import { MOSSPROUT_RESIDENT_IDS } from '@/constants/mossprout-residents';
import { kingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { completeIslandCampaign, greetIslandFriend, revealIsland, startAndServeChapter } from './helpers/island-campaign';

const NOW = Date.parse('2026-09-08T12:00:00Z');
function afterFtue() {
  const state = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 5_000 };
  return reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW }).state;
}

test('right after onboarding only Mossprout is home and the first island is the next step', () => {
  const progress = kingdomProgress(afterFtue());
  assert.equal(progress.friends.total, MOSSPROUT_RESIDENT_IDS.length);
  assert.equal(progress.friends.home, 1);
  assert.equal(progress.friends.met, 1);
  assert.deepEqual(progress.friends.entries.map((friend) => friend.skinId), [...MOSSPROUT_RESIDENT_IDS], 'roster order is stable');
  assert.equal(progress.places.total, 7);
  assert.equal(progress.places.restored, 1);
  assert.equal(progress.places.entries[0]?.id, 'mossprout-garden');
  const first = ISLAND_WAKE_ORDER[0]!;
  assert.equal(progress.friends.entries.find((friend) => friend.skinId === first.residentSkinId)?.status, 'waiting');
  assert.equal(progress.friends.entries.find((friend) => friend.skinId === ISLAND_WAKE_ORDER[1]!.residentSkinId)?.status, 'resting');
  assert.equal(progress.friends.entries.find((friend) => friend.skinId === 'driftkin')?.status, 'away');
  assert.deepEqual({ kind: progress.next.kind, islandId: progress.next.islandId }, { kind: 'clear_mist', islandId: first.islandId });
  assert.equal(progress.places.entries.find((place) => place.id === first.islandId)?.status, 'open');
});

test('meeting a friend moves them to helping and the next step follows the chapter', () => {
  const campaign = ISLAND_CAMPAIGNS[0]!;
  let state = revealIsland(afterFtue(), campaign, NOW);
  assert.equal(kingdomProgress(state).next.kind, 'talk', 'a discovered friend wants greeting first');
  state = greetIslandFriend(state, campaign, NOW + 1);
  let progress = kingdomProgress(state);
  assert.equal(progress.friends.entries.find((friend) => friend.skinId === campaign.residentSkinId)?.status, 'helping');
  assert.equal(progress.friends.met, 2);
  assert.equal(progress.friends.home, 1);
  assert.equal(progress.next.kind, 'talk');
  state = startAndServeChapter(state, campaign, 1, NOW + 2);
  progress = kingdomProgress(state);
  assert.equal(progress.next.kind, 'talk');
  assert.equal(progress.next.campaignId, campaign.campaignId);
  assert.equal(progress.places.entries.find((place) => place.id === campaign.islandId)?.status, 'growing');
});

test('a friend coming home advances both counters and points at the next island', () => {
  const campaign = ISLAND_CAMPAIGNS[0]!;
  const state = completeIslandCampaign(afterFtue(), campaign, NOW);
  const progress = kingdomProgress(state);
  assert.equal(progress.friends.home, 2);
  assert.equal(progress.places.restored, 2);
  assert.equal(progress.friends.entries.find((friend) => friend.skinId === campaign.residentSkinId)?.status, 'home');
  const next = ISLAND_WAKE_ORDER[1]!;
  if (islandCampaignForIsland(next.islandId)) {
    assert.deepEqual({ kind: progress.next.kind, islandId: progress.next.islandId }, { kind: 'clear_mist', islandId: next.islandId });
  } else {
    assert.equal(progress.next.kind, 'journey');
  }
  assert.notEqual(progress.next.kind, 'complete');
});

test('Kingdom progress feeds the Mossprout achievement ladders', async () => {
  const { buildCompanionAchievementContexts } = await import('@/utils/companion-achievements-context');
  const sources = {
    days: [],
    bond: { schemaVersion: 1, events: [] },
    quests: { schemaVersion: 4, quests: [], submissions: [], offerCycles: [], attempts: [] },
    journey: { schemaVersion: 3, goals: [], conversations: [], questEvents: [], reflectionEvents: [], checkIns: [], momentEvents: [] },
    quickGoals: { schemaVersion: 3, goals: [], completions: [], dismissals: [] },
  } as unknown as Parameters<typeof buildCompanionAchievementContexts>[0];
  const withoutKingdom = buildCompanionAchievementContexts(sources).get('mossprout')!;
  assert.equal(withoutKingdom.values['mossprout.friendsHome'], undefined);
  const campaign = ISLAND_CAMPAIGNS[0]!;
  const kingdom = kingdomProgress(completeIslandCampaign(afterFtue(), campaign, NOW));
  const context = buildCompanionAchievementContexts({ ...sources, kingdom }).get('mossprout')!;
  assert.equal(context.values['mossprout.friendsHome'], 2);
  assert.equal(context.values['mossprout.placesRestored'], 2);
});
