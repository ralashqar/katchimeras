import { localDayId } from '@/utils/world-identity-rules';
import { frontierOpen, frontierTileById, frontierTileState, nextFrontierTile } from '@/constants/frontier-tiles';
import { frontierMission, frontierRetakeMission, surgeDefenceMission } from '@/features/frontier/frontier-levels';
import { battleSourceCampaign } from '@/features/sanctuary/battle-source';
import { islandCampaignForIsland } from '@/constants/island-campaigns/registry';
import assert from 'node:assert/strict';
import test from 'node:test';

import { heroBuildingLevel } from '@/constants/hero-buildings';
import { heartTreeLevel } from '@/constants/heart-tree';
import { hatchableByTile } from '@/constants/hatchable-companions/registry';
import {
  ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS, islandCampaignChapter, islandCampaignChapterStatus, islandCampaignOpeningConversationId,
  islandCampaignPreviousStyle, islandCampaignResolutionConversationId, islandCampaignSelectedStyle, islandCampaignUpgradePanelState,
  pendingIslandCampaignCardReveal, pendingIslandCampaignDiscovery,
} from '@/constants/island-campaigns/helpers';
import { isMistLevel, regionRung } from '@/constants/island-campaigns/ladder';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';
import { islandCampaignForOffer } from '@/constants/island-campaigns/registry';
import { katchimeraLevel, playableHeroes } from '@/constants/katchimera-progression';
import { heartwoodBuildingLevel } from '@/constants/heartwood-buildings';
import { sanctuaryChapterState, SANCTUARY_CHAPTERS, type ChapterGoal } from '@/constants/sanctuary-chapters';
import { defaultPartner, heroSlots } from '@/features/encounter/team';
import { upgradeHeartwoodBuilding } from '@/features/heartwood-buildings/buildings-world';
import { islandTrack, type LevelNode } from '@/features/level-tracks/level-track';
import { goalNeed } from '@/features/sanctuary/goal-need';
import { kitchenOpen, supplyOrder, supplyRunSlots } from '@/features/supply-run/supply-run';
import { buildingUpgradeModel, companionUpgradeModel, heartTreeUpgradeModel, heroBuildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import { worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeCharacterId, MergeWorldCommand, MergeWorldCommandResult, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';

/**
 * A new player from the end of the first session to the last chapter, doing only what the game shows them: the chapter
 * card's goal, or, when the card says something is missing, the place it sends them (the latest friend island's levels,
 * or the Café). Every panel a goal opens must have something to press. A friend's island is played the way the Kingdom
 * plays it (`katchimera-kingdom-screen.tsx`): the Mist level, the free lift, the friend's discovery, then each chapter's
 * story (its opening activates it), its levels, and its closing conversation, the last one bringing the friend home.
 * It fails the way a player would get stuck: a goal with nothing to do, a shortfall with nowhere to earn it, a goal the
 * card never gets past, or a battle that is not plants that shoot.
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
type Pace = { battles: number; orders: number; steps: number };

/** The heroes who can come into a battle (the Kingdom's `playableHeroes`): Mossprout, and every playable friend who is home. */
// One rule for who can fight (`playableHeroes`), shared with the Kingdom.

const CONVERSATION_IDS = new Set(ALL_ISLAND_CAMPAIGN_CONVERSATION_DEFINITIONS.map((definition) => definition.id));
const STEP_CAP = 3000;
const MINUTE = 60_000;

test('a new player plays the main quest from Steppling home to the last chapter without ever getting stuck', () => {
  let world = endOfFirstSession();
  // A real clock (a battle takes minutes), so a day's replays roll over the way a player's would.
  let now = Date.UTC(2026, 8, 1, 8, 0, 0);
  const log: Log = [];
  const pace = new Map<string, Pace>();
  let chapterId = SANCTUARY_CHAPTERS[0]!.id;
  const tally = () => { const entry = pace.get(chapterId) ?? { battles: 0, orders: 0, steps: 0 }; pace.set(chapterId, entry); return entry; };
  const tail = (count = 16) => `\nLast steps:\n${log.slice(-count).join('\n')}`;
  const apply = (command: MergeWorldCommand, what: string): MergeWorldCommandResult => {
    const result = reduceMergeWorld(world, command);
    assert.ok(result.changed, `${what} did nothing (${result.message ?? 'no message'}) — stuck.${tail(12)}`);
    world = result.state;
    log.push(what);
    return result;
  };
  const cafeOpen = () => world.companionDiscovery.records.some((record) => record.characterId === 'baristabbit');
  const serveOrder = () => {
    assert.ok(cafeOpen(), `sent to the Café before it is open.${tail(12)}`);
    const slots = supplyRunSlots(world);
    const slot = ((world.supplyRun?.served ?? 0) % 2) as 0 | 1;
    const order = supplyOrder(slot, slots[slot], kitchenOpen(world));
    now += 2 * MINUTE;
    apply({ type: 'completeSupplyOrder', slot, index: slots[slot], timber: order.timber, glow: order.reward.coins, meals: order.meals, kitchen: kitchenOpen(world), now }, `serve ${order.title}`);
    tally().orders += 1;
  };

  /** Who goes into a battle: the hero the card is training when it is short of their XP, else Mossprout; a partner once the slot is open. */
  const team = (node: LevelNode, want: MergeCharacterId | null) => {
    const playable = playableHeroes(world);
    let lead: MergeCharacterId = want && playable.includes(want) ? want : 'mossprout';
    const eligible = node.mission?.eligible;
    if (eligible && !eligible.includes(lead)) lead = eligible[0] as MergeCharacterId;
    const partnerId = heroSlots(world) >= 2 ? defaultPartner(world, lead, playable) : null;
    return { lead, partnerId };
  };
  /** One level, as the Kingdom plays it: started, won, and whatever its win sets going (the Mist's lift, the chapter's close). */
  const playLevel = (campaign: IslandCampaignDefinition, node: LevelNode, want: MergeCharacterId | null) => {
    const mission = node.mission;
    assert.ok(mission, `${campaign.residentName}'s level ${node.number} has no battle.${tail()}`);
    assert.equal(mission.encounter?.mechanic?.kind, 'lanes', `every battle is plants that shoot: ${mission.id} is ${mission.encounter?.mechanic?.kind ?? 'no mechanic'}`);
    const { lead, partnerId } = team(node, want);
    now += 3 * MINUTE;
    const runId = `run:${now}`;
    apply({ type: 'startEncounter', missionId: mission.id, runId, campaignId: campaign.campaignId, katchimeraId: lead, helperWispId: null, partnerId, now } as MergeWorldCommand, `enter ${node.title}`);
    log.pop();
    const result = apply({ type: 'completeEncounter', receiptId: `encounter:${runId}`, missionId: mission.id, campaignId: campaign.campaignId, katchimeraId: lead, helperWispId: null, partnerId,
      outcome: { cleared: true, grade: 'bright' } as never, difficulty: mission.difficulty, base: mission.rewards, now } as MergeWorldCommand,
      `battle ${campaign.residentName} ${node.number} “${node.title}” (${lead}${partnerId ? ` + ${partnerId}` : ''})`);
    tally().battles += 1;
    const cleared = result.encounterCleared;
    assert.ok(cleared, `${mission.id} was won but paid nothing`);
    // A friend's first level lifts their island's Mist (`liftIslandMist`), and their discovery follows.
    if (isMistLevel(mission.id) && cleared.firstClear) liftMist(campaign);
    // A chapter's last level grows the island; its closing conversation opens on its own.
    if (cleared.islandRaised) closeChapter(campaign, cleared.islandRaised.level as MossproutNatureIslandLevel);
  };
  /** The free island_reveal the Kingdom buys after the Mist level (`purchaseWorldUpgrade` → `revealMossproutNatureIsland`). */
  const liftMist = (campaign: IslandCampaignDefinition) => {
    const offer = worldUpgradeOffers(world).find((candidate) => candidate.id === `nature:${campaign.islandId}` && candidate.transition === 'island_reveal');
    assert.ok(offer, `${campaign.residentName}'s Mist level was won but the island has no reveal to lift.${tail()}`);
    assert.equal(offer.cost, 0, `lifting ${campaign.residentName}'s Mist is free`);
    now += 10_000;
    apply({ type: 'revealMossproutNatureIsland', islandId: campaign.islandId, campaignId: campaign.campaignId, residentSkinId: campaign.residentSkinId, cost: 0,
      receiptId: `world-upgrade:nature:${campaign.islandId}:0`, now }, `the Mist lifts over ${campaign.residentName}'s island`);
    // The discovery panel (`continueFromIslandDiscovery`): greeted, then the first chapter's opening conversation.
    const pending = pendingIslandCampaignDiscovery(world);
    assert.equal(pending?.campaign.campaignId, campaign.campaignId, `${campaign.residentName}'s discovery never shows after the lift`);
    apply({ type: 'ackIslandCampaignResidentDiscovery', campaignId: campaign.campaignId, now: now++ }, `meet ${campaign.residentName}`);
    openChapter(campaign, Math.min(4, (world.haven.mossproutNatureIslands[campaign.islandId] ?? 0) + 1) as MossproutNatureIslandLevel);
  };
  /** A chapter's opening conversation: its first answer is chosen, and the chapter activates as levels. */
  const openChapter = (campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel) => {
    const chapter = islandCampaignChapter(campaign, level);
    assert.ok(chapter, `${campaign.residentName} has no chapter ${level}`);
    const conversationId = islandCampaignOpeningConversationId(campaign, level, islandCampaignPreviousStyle(world, campaign, level));
    assert.ok(conversationId && CONVERSATION_IDS.has(conversationId), `${campaign.residentName}'s chapter ${level} opening conversation (${conversationId}) does not exist`);
    const choice = chapter.choices[0];
    assert.ok(choice, `${campaign.residentName}'s chapter ${level} opening has no answer to pick`);
    apply({ type: 'activateIslandCampaignChapter', campaignId: campaign.campaignId, islandId: campaign.islandId, residentSkinId: campaign.residentSkinId, level,
      selectedOptionId: choice.id, orders: [], now: now++ }, `${campaign.residentName} chapter ${level} “${chapter.title}” opens`);
  };
  /** A chapter's closing conversation (`completeIslandCampaignConversation`, phase resolution): the chapter completes. */
  const closeChapter = (campaign: IslandCampaignDefinition, level: MossproutNatureIslandLevel) => {
    assert.equal(islandCampaignChapterStatus(world, campaign, level), 'resolution_ready', `${campaign.residentName}'s chapter ${level} grew the island but its story cannot close`);
    const selected = world.islandCampaigns?.[campaign.campaignId]?.chapters[String(level)]?.selectedOptionId;
    const finalLevel = campaign.chapters[campaign.chapters.length - 1]?.level;
    const conversationId = islandCampaignResolutionConversationId(campaign, level, selected, level === finalLevel ? islandCampaignSelectedStyle(world, campaign) : undefined);
    assert.ok(conversationId && CONVERSATION_IDS.has(conversationId), `${campaign.residentName}'s chapter ${level} closing conversation (${conversationId}) does not exist`);
    apply({ type: 'completeIslandCampaignChapter', campaignId: campaign.campaignId, level, now: now++ }, `${campaign.residentName} chapter ${level} closes`);
    const reveal = pendingIslandCampaignCardReveal(world);
    if (reveal?.campaign.campaignId === campaign.campaignId) apply({ type: 'ackIslandCampaignResidentCardReveal', campaignId: campaign.campaignId, now: now++ }, `${campaign.residentName} comes home`);
  };
  /**
   * The island's one button (its level track's primary): lift a Mist already won, play the next level (its story
   * first when one waits), or open a ready chest. With `replay`, a finished island is played again for Glow and XP
   * (the best-paying level). False when there is nothing to press.
   */
  const islandStep = (campaign: IslandCampaignDefinition, want: MergeCharacterId | null, replay: boolean): boolean => {
    const track = islandTrack(world, campaign);
    const primary = track.primary;
    if (primary.kind === 'reveal') { liftMist(campaign); return true; }
    if (primary.kind === 'play') {
      const node = primary.node;
      if (node.opensStory) {
        // The story in front of this level plays first (`enterTrackLevel` → `runIslandCampaignAction`).
        const panel = islandCampaignUpgradePanelState(world, campaign);
        assert.ok(panel?.action, `${campaign.residentName}'s level ${node.number} opens a story that has no action`);
        if (panel.action === 'start_story') openChapter(campaign, panel.level);
        else if (panel.action === 'continue_resolution') closeChapter(campaign, panel.level);
        else if (panel.action === 'continue_return') apply({ type: 'ackIslandCampaignChapterReturn', campaignId: campaign.campaignId, level: panel.level, now: now++ }, `${campaign.residentName} returns`);
        else assert.fail(`${campaign.residentName}'s level ${node.number} waits on a story whose action is ${panel.action}`);
        // `levelAfterStory`: the level starts only if the story opened its chapter; otherwise the track comes back.
        const rung = node.mission ? regionRung(campaign, node.mission.id) : null;
        const status = rung ? islandCampaignChapterStatus(world, campaign, rung.chapterLevel) : null;
        if (status === 'mission_available' || status === 'in_encounter') playLevel(campaign, islandTrack(world, campaign).levels.find((candidate) => candidate.key === node.key)!, want);
        return true;
      }
      playLevel(campaign, node, want);
      return true;
    }
    if (primary.kind === 'chest') {
      now += 10_000;
      apply({ type: 'claimTrackMilestone', trackId: campaign.campaignId, threshold: primary.threshold, now } as MergeWorldCommand, `open ${campaign.residentName}'s chest (${primary.threshold} stars)`);
      return true;
    }
    if (!replay) return false;
    const done = track.levels.filter((candidate) => candidate.playable && candidate.mission && candidate.state === 'done');
    if (!done.length) return false;
    const best = done.reduce((top, candidate) => ((candidate.reward?.glow ?? 0) + (candidate.reward?.xp ?? 0) > (top.reward?.glow ?? 0) + (top.reward?.xp ?? 0) ? candidate : top));
    playLevel(campaign, best, want);
    return true;
  };
  /** A Frontier tile's battle, as the Kingdom plays it (`startFrontierBattle`): in the light, under the Mist, won once for good. */
  const playFrontier = (tileId: string, want: MergeCharacterId | null) => {
    const tile = frontierTileById(tileId);
    assert.ok(tile, `${tileId} is not Frontier land`);
    const state = frontierTileState(world, tile);
    assert.ok(state === 'misted' || state === 'contested', `${tileId} is not in the light or is already ours`);
    const mission = state === 'contested' ? frontierRetakeMission(tile) : frontierMission(tile);
    assert.equal(mission.encounter?.mechanic?.kind, 'lanes', `every battle is plants that shoot: ${mission.id}`);
    // As the Kingdom does: the hero the card is training comes along (the partner once two go in).
    const heroes = playableHeroes(world);
    if (want) assert.ok(heroes.includes(want), `the card wants ${want} trained, who is not home`);
    const twoGo = heroSlots(world) >= 2;
    const lead: MergeCharacterId = want && !twoGo ? want : 'mossprout';
    const partnerId = twoGo ? (want && want !== lead ? want : defaultPartner(world, lead, heroes)) : null;
    now += 3 * MINUTE;
    const runId = `run:${now}`;
    apply({ type: 'startEncounter', missionId: mission.id, runId, katchimeraId: lead, helperWispId: null, partnerId, now } as MergeWorldCommand, `enter ${mission.title}`);
    log.pop();
    const result = apply({ type: 'completeEncounter', receiptId: `encounter:${runId}`, missionId: mission.id, katchimeraId: lead, helperWispId: null, partnerId,
      outcome: { cleared: true, grade: 'bright' } as never, difficulty: mission.difficulty, base: mission.rewards, now } as MergeWorldCommand, `frontier ${tile.id} “${mission.title}” (${lead}${partnerId ? ` + ${partnerId}` : ''})`);
    tally().battles += 1;
    assert.equal(result.encounterCleared?.reclaimed?.tileId, tile.id, `${tile.id} was won but not taken back`);
  };
  // Where the card sends a player short of Glow or XP: the Frontier, the latest friend island's levels (Lanes), or the Café before any.
  const playGrove = (want: MergeCharacterId | null = null) => {
    if (frontierOpen(world)) {
      const next = nextFrontierTile(world);
      if (next) { playFrontier(next.id, want); return; }
    }
    const battles = battleSourceCampaign(world);
    if (!battles) { serveOrder(); return; }
    const campaign = islandCampaignForIsland(battles.islandId)!;
    assert.ok(islandStep(campaign, want, true), `${battles.place} has nothing to play.${tail(12)}`);
  };
  const doable = (goal: ChapterGoal) => {
    const action = goal.action;
    const model = action.kind === 'building' ? buildingUpgradeModel(world, action.buildingId)
      : action.kind === 'hero_building' ? heroBuildingUpgradeModel(world, action.id)
      : action.kind === 'heart_tree' ? heartTreeUpgradeModel(world)
      : action.kind === 'hero' ? companionUpgradeModel(world, action.characterId) : null;
    if (!model) return;
    assert.equal(model.locked, undefined, `“${goal.title}” opens a locked panel: ${model.locked?.reason}`);
    const missing = model.requirements.find((requirement) => !requirement.met);
    assert.ok(model.primary && !model.primary.disabled, `Chapter “${chapterId}”: “${goal.title}” opens a panel with nothing to press, and the card names nothing missing${missing ? ` (unmet: ${missing.id} ${missing.current ?? ''}/${missing.total ?? ''})` : ''}.${tail(8)}`);
  };

  // PLAYTHROUGH_LOG=1 prints the pacing per chapter (battles, orders, steps) however the run ends; =full adds the route.
  const printPacing = () => {
    if (!process.env.PLAYTHROUGH_LOG) return;
    const rows = SANCTUARY_CHAPTERS.map((chapter) => {
      const entry = pace.get(chapter.id) ?? { battles: 0, orders: 0, steps: 0 };
      return `  Ch ${chapter.number} ${chapter.title.padEnd(24)} battles ${String(entry.battles).padStart(4)}  orders ${String(entry.orders).padStart(4)}  steps ${String(entry.steps).padStart(4)}`;
    });
    const total = [...pace.values()].reduce((sum, entry) => ({ battles: sum.battles + entry.battles, orders: sum.orders + entry.orders, steps: sum.steps + entry.steps }), { battles: 0, orders: 0, steps: 0 });
    console.log(`Pacing per chapter:\n${rows.join('\n')}\n  All${' '.repeat(29)}battles ${String(total.battles).padStart(4)}  orders ${String(total.orders).padStart(4)}  steps ${String(total.steps).padStart(4)}`);
    if (process.env.PLAYTHROUGH_LOG === 'full') console.log(log.join('\n'));
  };

  let bloomReached = false;
  try {
    for (let step = 0; step < STEP_CAP; step += 1) {
      const state = sanctuaryChapterState(world);
      if (!state) {
        // Every chapter paid: the whole main quest is done.
        assert.ok(bloomReached, 'the Bloom Garden was never reached');
        assert.equal(sanctuaryChapterState(world), null);
        return;
      }
      chapterId = state.chapter.id;
      tally().steps += 1;
      const surge = reduceMergeWorld(world, { type: 'mistSurge', dayId: localDayId(new Date(now)), now });
      if (surge.changed) { world = surge.state; log.push(`the Mist surges: ${surge.mistSurged?.join(', ') || 'nothing to take'}`); }
      if (state.openingPending) { apply({ type: 'markChapterOpened', chapterId: state.chapter.id, now: now++ }, `opening ${state.chapter.title}`); continue; }
      if (state.complete) { apply({ type: 'claimChapterReward', chapterId: state.chapter.id, glow: state.chapter.reward.glow, now: now++ }, `claim ${state.chapter.title}`); continue; }
      const goal = state.goal!;
      const need = goalNeed(world, goal);
      const action = goal.action;
      const training = action.kind === 'hero' ? action.characterId : null;
      if (need) {
        if (need.source === 'cafe') serveOrder();
        else if (need.source === 'building') {
          // The card sends a held-back hero's player to their building: build it up (its own shortfalls come first).
          assert.ok(need.buildingId, `“${goal.title}” names a building without saying which`);
          const model = heroBuildingUpgradeModel(world, need.buildingId);
          assert.ok(model.primary && !model.primary.disabled, `“${goal.title}” sends to ${need.buildingId}, which cannot be upgraded and names nothing missing`);
          apply({ type: 'upgradeHeroBuilding', id: need.buildingId, expectedLevel: heroBuildingLevel(world, need.buildingId), now: now++ }, `grow ${need.buildingId} for the hero`);
        } else if (need.source === 'frontier') {
          assert.ok(need.tileId, `“${goal.title}” sends to the Frontier without saying where`);
          playFrontier(need.tileId, training);
        } else playGrove(training);
        continue;
      }
      doable(goal);
      now += 30_000;
      if (action.kind === 'building') {
        world = upgradeHeartwoodBuilding(world, action.buildingId, heartwoodBuildingLevel(world, action.buildingId), now++);
        log.push(`build ${action.buildingId}`);
      } else if (action.kind === 'hero_building') apply({ type: 'upgradeHeroBuilding', id: action.id, expectedLevel: heroBuildingLevel(world, action.id), now: now++ }, `build ${action.id}`);
      else if (action.kind === 'heart_tree') apply({ type: 'upgradeHeartTree', expectedLevel: heartTreeLevel(world), now: now++ }, 'grow the Heart Tree');
      else if (action.kind === 'hero') apply({ type: 'upgradeKatchimera', characterId: action.characterId, expectedLevel: katchimeraLevel(world, action.characterId), now: now++ } as MergeWorldCommand, `train ${action.characterId}`);
      else if (action.kind === 'supply_run') serveOrder();
      else if (action.kind === 'grove') playGrove();
      else if (action.kind === 'surge_defence') {
        // The first Mist Surge: the defence under the Heart Tree, plants that shoot; the Mist takes two edge tiles meanwhile.
        const mission = surgeDefenceMission();
        assert.equal(mission.encounter?.mechanic?.kind, 'lanes', 'the Heart Tree is held with plants that shoot');
        now += 3 * MINUTE;
        const result = apply({ type: 'completeEncounter', receiptId: `encounter:surge:${now}`, missionId: mission.id, katchimeraId: 'mossprout', helperWispId: null, partnerId: null,
          outcome: { cleared: true, grade: 'bright' } as never, difficulty: mission.difficulty, base: mission.rewards, now } as MergeWorldCommand, 'hold the Heart Tree');
        tally().battles += 1;
        assert.ok((result.encounterCleared?.surged?.length ?? 0) >= 1, 'the first Surge takes Frontier land back');
      } else if (action.kind === 'frontier') {
        // The next tile in the light; with none, the card must say so (it opens the Heart Tree).
        const next = nextFrontierTile(world);
        assert.ok(next, `“${goal.title}” wants Frontier land but none is in the Tree's light.${tail(8)}`);
        playFrontier(next.id, null);
      }
      else if (action.kind === 'world_offer') {
        const hatchable = action.offerId.startsWith('mist:') ? hatchableByTile(action.offerId.slice('mist:'.length)) : null;
        if (hatchable) {
          const offer = worldUpgradeOffers(world).find((candidate) => candidate.id === action.offerId);
          assert.ok(offer, `“${goal.title}” points at ${action.offerId}, which is not on the map`);
          assert.equal(offer.lockedReason, undefined, `“${goal.title}” points at a locked tile: ${offer.lockedReason}`);
          // FTUE v2: a friend is rescued in a Lanes battle. Entering it costs nothing (the flow still records its start).
          assert.equal(offer.cost, 0, `${hatchable.displayName}'s rescue costs no Glow`);
          assert.equal(hatchable.mission.encounter?.mechanic?.kind, 'lanes', `${hatchable.displayName}'s rescue is a Lanes battle`);
          apply({ type: 'payHatchableMission', companion: hatchable.companion, receiptId: `ticket:${hatchable.companion}`, now: now++ }, `enter ${hatchable.displayName}'s rescue`);
          apply({ type: 'rescueWorldFriend', targetId: hatchable.tile.unlockId, now: now++ }, `${hatchable.displayName} joins`);
          tally().battles += 1;
          continue;
        }
        // A friend's island: its level track (the Mist level, then each chapter's story and levels).
        const campaign = islandCampaignForOffer(action.offerId);
        assert.ok(campaign, `${action.offerId} is not a friend's island`);
        const track = islandTrack(world, campaign);
        if (!bloomReached) {
          // The Bloom Garden: its levels open, and the first is there to play.
          assert.equal(track.primary.kind, 'play', `the ${campaign.residentName} island's levels have nothing to play`);
          assert.equal(state.chapter.id, 'the-signal');
          assert.ok(step < 200, `it took ${step} steps to get here: too much grinding.${tail(40)}`);
          if (process.env.PLAYTHROUGH_LOG) console.log(`Bloom Garden's first battle reached in ${step} steps`);
          bloomReached = true;
        }
        // No dead end: the island's marker is on the map and open, or its track has something to press.
        const offer = worldUpgradeOffers(world).find((candidate) => candidate.id === action.offerId);
        const onMap = Boolean(offer && offer.lockedReason === undefined);
        assert.ok(onMap || track.primary.kind !== 'none', `“${goal.title}” is a dead end: ${action.offerId} is ${offer ? `locked (${offer.lockedReason})` : 'not on the map'} and its track says “${track.primary.label}”.${tail()}`);
        assert.ok(islandStep(campaign, null, false), `“${goal.title}”: ${campaign.residentName}'s island has nothing to press (“${track.primary.label}”, ${track.cleared}/${track.total} cleared, island level ${world.haven.mossproutNatureIslands[campaign.islandId] ?? 0}).${tail()}`);
      } else assert.fail(`“${goal.title}” has an action the bot does not know: ${action.kind}`);
    }
  } finally { printPacing(); }
  assert.fail(`the main quest did not finish in ${STEP_CAP} steps (stuck at ${sanctuaryChapterState(world)?.chapter.title}: “${sanctuaryChapterState(world)?.goal?.title}”).${tail(30)}`);
});
