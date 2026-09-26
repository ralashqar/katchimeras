import { battleSourceCampaign } from '@/features/sanctuary/battle-source';
import { islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import assert from 'node:assert/strict';
import test from 'node:test';

import { heroBuildingLevel } from '@/constants/hero-buildings';
import { heartTreeLevel } from '@/constants/heart-tree';
import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import { islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import { katchimeraLevel } from '@/constants/katchimera-progression';
import { heartwoodBuildingLevel } from '@/constants/heartwood-buildings';
import { sanctuaryChapterState, type ChapterGoal } from '@/constants/sanctuary-chapters';
import { upgradeHeartwoodBuilding } from '@/features/heartwood-buildings/buildings-world';
import { groveTrack, islandTrack } from '@/features/level-tracks/level-track';
import { goalNeed } from '@/features/sanctuary/goal-need';
import { kitchenOpen, supplyOrder, supplyRunSlots } from '@/features/supply-run/supply-run';
import { buildingUpgradeModel, companionUpgradeModel, heartTreeUpgradeModel, heroBuildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import { worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldCommand, MergeWorldState } from '@/types/merge-world';

/**
 * A new player from the end of the first session, doing only what the game shows them: the chapter card's goal, or,
 * when the card says something is missing, the place it sends them (the Grove's levels, or the Café). Every panel a
 * goal opens must have something to press. It fails the way a player would get stuck: a goal with nothing to do, a
 * shortfall with nowhere to earn it, or a goal the card never gets past.
 */
function endOfFirstSession(): MergeWorldState {
  let world = createInitialMergeWorldState(1_000);
  const run = (command: MergeWorldCommand) => { world = reduceMergeWorld(world, command).state; };
  run({ type: 'grantOpeningGlow', receiptId: 'ftue:opening-glow', amount: 20, now: 1_100 });
  // FTUE v2: both first-session battles train Mossprout too (10, then 35 on the Lost Trail).
  run({ type: 'grantStoryGlow', receiptId: 'ftue:first-battle-xp', amount: 0, xp: { katchimeraId: 'mossprout', amount: 10 }, now: 1_150 });
  run({ type: 'restoreHeartTree', receiptId: 'ftue:heart-tree', cost: 20, now: 1_200 } as MergeWorldCommand);
  // The Lost Trail's one battle, Steppling's rescue.
  run({ type: 'grantStoryGlow', receiptId: 'ftue:trail-rescue', amount: 65, xp: { katchimeraId: 'mossprout', amount: 35 }, now: 1_300 });
  run({ type: 'rescueWorldFriend', targetId: 'mossprout:overgrown-trail', now: 1_400 });
  return world;
}

type Log = string[];

test('a new player gets from Steppling home to the Bloom Garden’s first battle without ever getting stuck', () => {
  let world = endOfFirstSession();
  let now = 10_000;
  const log: Log = [];
  const apply = (command: MergeWorldCommand, what: string) => {
    const result = reduceMergeWorld(world, command);
    assert.ok(result.changed, `${what} did nothing (${result.message ?? 'no message'}) — stuck. Log:\n${log.slice(-12).join('\n')}`);
    world = result.state;
    log.push(what);
  };
  const cafeOpen = () => world.companionDiscovery.records.some((record) => record.characterId === 'baristabbit');
  const serveOrder = () => {
    assert.ok(cafeOpen(), `sent to the Café before it is open. Log:\n${log.slice(-12).join('\n')}`);
    const slots = supplyRunSlots(world);
    const slot = ((world.supplyRun?.served ?? 0) % 2) as 0 | 1;
    const order = supplyOrder(slot, slots[slot], kitchenOpen(world));
    apply({ type: 'completeSupplyOrder', slot, index: slots[slot], timber: order.timber, glow: order.reward.coins, meals: order.meals, kitchen: kitchenOpen(world), now: now++ }, `serve ${order.title}`);
  };
  // Where the card sends a player short of Glow or XP: the latest friend island's levels (Lanes), or the Café before any.
  const playGrove = () => {
    const battles = battleSourceCampaign(world);
    if (!battles) { serveOrder(); return; }
    const campaign = islandCampaignForIsland(battles.islandId)!;
    const track = islandTrack(world, campaign);
    const node = track.primary.kind === 'play' ? track.primary.node : track.levels.find((candidate) => candidate.playable && candidate.mission);
    assert.ok(node?.mission, `${battles.place} has nothing to play. Log:\n${log.slice(-12).join('\n')}`);
    assert.equal(node.mission.encounter?.mechanic?.kind, 'lanes', `every battle is plants that shoot: ${node.mission.id}`);
    apply({ type: 'completeEncounter', receiptId: `battle:${now}`, missionId: node.mission.id, campaignId: campaign.campaignId, katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'bright' } as never, difficulty: node.mission.difficulty, base: node.mission.rewards, now: now++ } as MergeWorldCommand, `battle ${node.title}`);
  };
  const doable = (goal: ChapterGoal) => {
    const action = goal.action;
    const model = action.kind === 'building' ? buildingUpgradeModel(world, action.buildingId)
      : action.kind === 'hero_building' ? heroBuildingUpgradeModel(world, action.id)
      : action.kind === 'heart_tree' ? heartTreeUpgradeModel(world)
      : action.kind === 'hero' ? companionUpgradeModel(world, action.characterId) : null;
    if (!model) return;
    assert.equal(model.locked, undefined, `“${goal.title}” opens a locked panel: ${model.locked?.reason}`);
    assert.ok(model.primary && !model.primary.disabled, `“${goal.title}” opens a panel with nothing to press, and the card names nothing missing`);
  };

  for (let step = 0; step < 400; step += 1) {
    const state = sanctuaryChapterState(world);
    assert.ok(state, 'the chapters ran out before the Bloom Garden');
    if (state.openingPending) { apply({ type: 'markChapterOpened', chapterId: state.chapter.id, now: now++ }, `opening ${state.chapter.title}`); continue; }
    if (state.complete) { apply({ type: 'claimChapterReward', chapterId: state.chapter.id, glow: state.chapter.reward.glow, now: now++ }, `claim ${state.chapter.title}`); continue; }
    const goal = state.goal!;
    const need = goalNeed(world, goal);
    if (need) { if (need.source === 'cafe') serveOrder(); else playGrove(); continue; }
    doable(goal);
    const action = goal.action;
    if (action.kind === 'building') {
      world = upgradeHeartwoodBuilding(world, action.buildingId, heartwoodBuildingLevel(world, action.buildingId), now++);
      log.push(`build ${action.buildingId}`);
    } else if (action.kind === 'hero_building') apply({ type: 'upgradeHeroBuilding', id: action.id, expectedLevel: heroBuildingLevel(world, action.id), now: now++ }, `build ${action.id}`);
    else if (action.kind === 'heart_tree') apply({ type: 'upgradeHeartTree', expectedLevel: heartTreeLevel(world), now: now++ }, 'grow the Heart Tree');
    else if (action.kind === 'hero') apply({ type: 'upgradeKatchimera', characterId: action.characterId, expectedLevel: katchimeraLevel(world, action.characterId), now: now++ } as MergeWorldCommand, `train ${action.characterId}`);
    else if (action.kind === 'supply_run') serveOrder();
    else if (action.kind === 'grove') playGrove();
    else if (action.kind === 'world_offer') {
      const offer = worldUpgradeOffers(world).find((candidate) => candidate.id === action.offerId);
      assert.ok(offer, `“${goal.title}” points at ${action.offerId}, which is not on the map`);
      assert.equal(offer.lockedReason, undefined, `“${goal.title}” points at a locked tile: ${offer.lockedReason}`);
      const hatchable = action.offerId.startsWith('mist:') ? hatchableByTile(action.offerId.slice('mist:'.length)) : null;
      if (hatchable) {
        // FTUE v2: a friend is rescued in a Lanes battle. Entering it costs nothing (the flow still records its start).
        assert.equal(offer.cost, 0, `${hatchable.displayName}'s rescue costs no Glow`);
        assert.equal(hatchable.mission.encounter?.mechanic?.kind, 'lanes', `${hatchable.displayName}'s rescue is a Lanes battle`);
        apply({ type: 'payHatchableMission', companion: hatchable.companion, receiptId: `ticket:${hatchable.companion}`, now: now++ }, `enter ${hatchable.displayName}'s rescue`);
        apply({ type: 'rescueWorldFriend', targetId: hatchable.tile.unlockId, now: now++ }, `${hatchable.displayName} joins`);
        continue;
      }
      // A friend's island: its levels open, and the first is there to play. That is the Bloom Garden, and far enough.
      const campaign = islandCampaignForOffer(action.offerId);
      assert.ok(campaign, `${action.offerId} is not a friend's island`);
      const track = islandTrack(world, campaign);
      assert.equal(track.primary.kind, 'play', `the ${campaign.residentName} island's levels have nothing to play`);
      // PLAYTHROUGH_LOG=1 prints the route: what a new player did, in order.
      if (process.env.PLAYTHROUGH_LOG) console.log(`${step} steps\n${log.join('\n')}`);
      assert.equal(state.chapter.id, 'the-signal');
      assert.ok(step < 200, `it took ${step} steps to get here: too much grinding. Log:\n${log.join('\n')}`);
      return;
    }
  }
  assert.fail(`never reached the Bloom Garden. Last steps:\n${log.slice(-20).join('\n')}`);
});
