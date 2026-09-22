import assert from 'node:assert/strict';
import test from 'node:test';

import { islandCampaignChapterStatus, islandCampaignPanelPresentation, islandCampaignUpgradePanelState, regionLadderProgress } from '@/constants/island-campaigns/helpers';
import { regionLadder } from '@/constants/island-campaigns/ladder';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { encounterRunId } from '@/features/encounter/run-id';
import { kingdomProgress } from '@/features/kingdom-progress/kingdom-progress';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { greetIslandFriend, revealIsland } from './helpers/island-campaign';

const NOW = Date.UTC(2026, 8, 22, 9);
const cleared = { cleared: true, grade: 'bright' as const, resolveLeft: 6, actions: 10, merges: 8, continues: 0, rescued: false };

test('a chapter started with no request plays as rungs: the Mist waits, the rung is up, the island grows on the last clear, the story resolves', () => {
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  const ladder = regionLadder(petalimp);
  const first = ladder[0]!;
  let world: MergeWorldState = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1);
  assert.equal(islandCampaignChapterStatus(world, petalimp, 1), 'available');
  const choice = petalimp.chapters[0]!.choices[0]!;
  const activated = reduceMergeWorld(world, { type: 'activateIslandCampaignChapter', campaignId: petalimp.campaignId, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, level: 1, selectedOptionId: choice.id, orders: [], now: NOW + 2 });
  assert.equal(activated.changed, true, activated.message);
  world = activated.state;
  assert.equal(world.coins, activated.state.coins, 'a chapter costs nothing');
  assert.equal(activated.state.coins, greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1).coins);
  assert.equal(world.activeOrders.length, 0, 'and asks the Main Board for nothing');
  assert.equal(world.islandCampaigns![petalimp.campaignId]!.chapters['1']!.restoration, undefined, 'no board of its own');
  assert.equal(islandCampaignChapterStatus(world, petalimp, 1), 'mission_available');
  const panel = islandCampaignUpgradePanelState(world, petalimp)!;
  assert.equal(panel.action, 'enter_mist');
  assert.equal(panel.actionLabel, 'Enter the Mist');
  assert.equal(panel.actionCost, 0);
  assert.equal(panel.mission?.id, first.mission.id);
  assert.equal(panel.ladder[0]?.state, 'next');
  assert.equal(panel.stateLabel, 'The Mist waits');
  assert.equal(islandCampaignPanelPresentation(world, petalimp)?.mission?.id, first.mission.id);
  assert.deepEqual(kingdomProgress(world).next, { kind: 'mist', label: `Enter the Mist at ${kingdomProgress(world).places.entries.find((entry) => entry.id === petalimp.islandId)!.name}`, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, campaignId: petalimp.campaignId });

  const loadout = { companionId: 'mossprout' as const, level: 1 };
  const runId = encounterRunId(first.mission.encounter, 1, loadout);
  world = reduceMergeWorld(world, { type: 'startEncounter', missionId: first.mission.id, runId, campaignId: petalimp.campaignId, katchimeraId: 'mossprout', helperWispId: null, now: NOW + 3 }).state;
  assert.equal(islandCampaignChapterStatus(world, petalimp, 1), 'in_encounter');
  assert.equal(islandCampaignUpgradePanelState(world, petalimp)?.action, 'resume_mist');
  assert.equal(kingdomProgress(world).next.kind, 'mist');
  assert.equal(regionLadderProgress(world, petalimp).next?.mission.id, first.mission.id, 'the rung that is up is the one to play');

  world = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: `encounter:${runId}`, missionId: first.mission.id, campaignId: petalimp.campaignId, katchimeraId: 'mossprout', helperWispId: null, outcome: cleared, difficulty: first.mission.difficulty, base: first.mission.rewards, now: NOW + 4 }).state;
  assert.equal(world.haven.mossproutNatureIslands[petalimp.islandId], 1, 'the last rung of the chapter grew the island');
  assert.equal(islandCampaignChapterStatus(world, petalimp, 1), 'resolution_ready');
  assert.equal(islandCampaignUpgradePanelState(world, petalimp)?.action, 'continue_resolution');
  assert.equal(regionLadderProgress(world, petalimp).ladder[0]?.state, 'done');
  assert.equal(regionLadderProgress(world, petalimp).ladder[0]?.bestGrade, 'bright');
  const closed = reduceMergeWorld(world, { type: 'completeIslandCampaignChapter', campaignId: petalimp.campaignId, level: 1, now: NOW + 5 });
  assert.equal(closed.changed, true, closed.message);
  assert.equal(islandCampaignChapterStatus(closed.state, petalimp, 1), 'complete');
  assert.equal(islandCampaignChapterStatus(closed.state, petalimp, 2), 'available', 'the next chapter waits for its conversation');
  // Playing the next chapter's rung is refused until it is opened: the ladder's next rung is chapter two's.
  assert.equal(regionLadderProgress(closed.state, petalimp).next?.chapterLevel, 2);
});

test('a chapter from before the pivot keeps its flow: a request published is served on the Main Board', () => {
  const petalimp = ISLAND_CAMPAIGNS.find((campaign) => campaign.campaignId.includes('petalimp'))!;
  const world = greetIslandFriend(revealIsland({ ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 200 }, petalimp, NOW), petalimp, NOW + 1);
  const choice = petalimp.chapters[0]!.choices[0]!;
  const order = { id: 'legacy-order', characterId: 'mossprout' as const, title: 'Legacy', difficulty: 'small' as const, requirements: [{ definitionId: 'nature:garden:2', quantity: 1 }], reward: { coins: 5, mergeXp: 0, friendshipXp: 0, energy: 0 }, createdAt: NOW, signature: false, purpose: 'normal' as const, storyArcId: petalimp.campaignId, storyTargetLevel: 1 as const };
  const activated = reduceMergeWorld(world, { type: 'activateIslandCampaignChapter', campaignId: petalimp.campaignId, islandId: petalimp.islandId, residentSkinId: petalimp.residentSkinId, level: 1, selectedOptionId: choice.id, orders: [order], now: NOW + 2 });
  assert.equal(activated.changed, true);
  assert.notEqual(islandCampaignChapterStatus(activated.state, petalimp, 1), 'mission_available');
});
