import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { WORLD_UPGRADE_DEFINITIONS, visibleWorldUpgradeOffers, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { WORLD_UPGRADE_FLOWS, worldUpgradeRunId } from '@/features/world-upgrades/world-upgrade-flows';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { MOSSPROUT_FTUE_FLOW } from '@/features/onboarding/mossprout-ftue-flow';
import { createContentFlowRun, reduceContentFlow, stabilizeContentFlow } from '@/features/content-flow/content-flow-interpreter';
import { GLOW_DISCOVERY_FLOW, glowDiscoveryResumeCamera, glowDiscoveryResumeWorld } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_MISSION_CAMERA } from '@/features/onboarding/steppling-mission';
import { MOSSPROUT_NATURE_ISLANDS, mossproutNatureIslandById } from '@/constants/mossprout-nature-islands';
import { PETALIMP_ISLAND_CAMPAIGN_ID, petalimpIslandChapterOrder } from '@/constants/petalimp-island-campaign';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { ISLAND_WAKE_ORDER, islandWakeState } from '@/constants/island-campaigns/wake-order';
import { acknowledgeChapterReturn, completeChapter, greetIslandFriend, startAndServeChapter } from './helpers/island-campaign';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldCommand, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { readFileSync } from './helpers/content-fs';
import { sharedResidentAnchor } from '@/components/katchadeck/world/shared-resident-presentation';
import type { KingdomHexScene } from '@/components/katchadeck/world/kingdom-hex-scene';
import { loadNativeModule, nativeViews } from './helpers/native-motion-harness';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const NOW = Date.UTC(2026, 8, 5);
function world(coins = 2000) {
  const initial = createInitialMergeWorldState(NOW, ['mossprout']);
  return { ...initial, coins, characterProgress: { ...initial.characterProgress,
    mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] } } };
}
function restored(coins = 2000) {
  return reduceMergeWorld(world(coins), { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW }).state;
}

function completeBloomCampaignRequest(state: MergeWorldState, level: MossproutNatureIslandLevel) {
  const order = petalimpIslandChapterOrder(level, NOW)!;
  const activated = reduceMergeWorld(state, {
    type: 'activateIslandCampaignChapter', campaignId: PETALIMP_ISLAND_CAMPAIGN_ID,
    islandId: 'bloom-garden', residentSkinId: 'petalimp', level, orders: [order], now: NOW,
  }).state;
  const campaign = activated.islandCampaigns![PETALIMP_ISLAND_CAMPAIGN_ID]!;
  const chapter = campaign.chapters[String(level)]!;
  return { ...activated, islandCampaigns: { ...activated.islandCampaigns, [PETALIMP_ISLAND_CAMPAIGN_ID]: {
    ...campaign, chapters: { ...campaign.chapters, [String(level)]: { ...chapter, servedOrderIds: [...chapter.orderIds] } },
  } } };
}

test('every island level uses the shared purchase flow in wake order, survives reload, and charges only once', () => {
  let state = restored(10_000);
  for (const entry of ISLAND_WAKE_ORDER) {
    const campaign = ISLAND_CAMPAIGNS.find((candidate) => candidate.islandId === entry.islandId);
    if (!campaign) break;
    const island = mossproutNatureIslandById.get(entry.islandId)!;
    const reveal = visibleWorldUpgradeOffers(worldUpgradeOffers(state), undefined, null).find((candidate) => candidate.id === `nature:${island.id}`)!;
    assert.equal(reveal.transition, 'island_reveal'); assert.equal(reveal.eligible, true); assert.equal(reveal.cost, island.levels[0]!.coinCost);
    assert.ok(WORLD_UPGRADE_FLOWS.some((flow) => flow.id === worldUpgradeRunId(reveal)));
    const revealCommand: MergeWorldCommand = { type: 'revealMossproutNatureIsland', islandId: island.id, campaignId: campaign.campaignId,
      residentSkinId: campaign.residentSkinId, cost: reveal.cost, receiptId: worldUpgradeRunId(reveal), now: NOW };
    const beforeReveal = state.coins;
    state = normalizeMergeWorldState(JSON.parse(JSON.stringify(reduceMergeWorld(state, revealCommand).state)), NOW);
    assert.equal(state.coins, beforeReveal - reveal.cost);
    assert.equal(reduceMergeWorld(state, revealCommand).state.coins, state.coins, 'a replayed reveal never charges twice');
    state = greetIslandFriend(state, campaign, NOW);
    for (const level of island.levels) {
      state = acknowledgeChapterReturn(startAndServeChapter(state, campaign, level.level, NOW), campaign, level.level, NOW);
      const offer = visibleWorldUpgradeOffers(worldUpgradeOffers(state), undefined, null).find((candidate) => candidate.id === `nature:${island.id}`)!;
      assert.ok(offer, `${island.id} level ${level.level} has a marker`);
      assert.equal(offer.cost, level.level === 1 ? 0 : level.coinCost);
      assert.equal(offer.nextLevel, level.level);
      assert.equal(offer.eligible, true);
      assert.equal(offer.action, level.level === 1 ? 'Restore' : 'Upgrade');
      assert.ok(WORLD_UPGRADE_FLOWS.some((flow) => flow.id === worldUpgradeRunId(offer)));
      const command: MergeWorldCommand = { type: 'upgradeMossproutNatureIsland', islandId: island.id, level: level.level,
        receiptId: worldUpgradeRunId(offer), now: NOW, ...(level.level === 1 ? { economyMode: 'free' } : {}) };
      const before = state.coins;
      const paid = reduceMergeWorld(state, command);
      assert.equal(paid.changed, true);
      assert.equal(paid.state.coins, before - offer.cost);
      state = normalizeMergeWorldState(JSON.parse(JSON.stringify(paid.state)), NOW);
      assert.equal(state.haven.mossproutNatureIslands[island.id], level.level);
      assert.equal(reduceMergeWorld(state, command).state.coins, state.coins);
      state = completeChapter(state, campaign, level.level, NOW);
    }
    assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === `nature:${island.id}`), false);
    assert.ok(state.ownedKatchimeraCards.some((card) => card.cardId === campaign.residentSkinId), `${campaign.residentName} is home`);
  }
  assert.equal(state.haven.tileStages.mossprout, MOSSPROUT_NATURE_ISLANDS.every((island) => state.haven.mossproutNatureIslands[island.id] === 4) ? 4 : 1);
});

test('mist islands are targetable and every reveal keeps other tiles and camera bounds stable', () => {
  const file = 'components/katchadeck/world/mossprout-hex-neighborhood-scene.ts';
  const mocks: Record<string, unknown> = {
    './shared-resident-presentation': { sharedResidentAnchor },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map() },
    '@/components/katchadeck/world/kingdom-hex-scene': {
      tileVisibleBounds: (x: number, y: number) => ({ left: x - 200, top: y - 200, right: x + 200, bottom: y + 200 }),
    },
  };
  for (const match of readFileSync(file, 'utf8').matchAll(/require\('([^']+)'\)/g)) mocks[match[1]] = match[1];
  const module = loadNativeModule(file, mocks);
  const levels = { ...restored().haven.mossproutNatureIslands };
  const build = () => module.buildMossproutHexNeighborhoodScene([], levels) as KingdomHexScene;
  const baseline = build();
  // The opening veil: same frame, footprint, anchor and envelope; only art and draw order change.
  const veiled = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeVeiled: true }) as KingdomHexScene;
  const home = (scene: KingdomHexScene) => scene.tileArtLayers.find((layer) => layer.id === scene.centerTile.id)!;
  const garden = (scene: KingdomHexScene) => scene.tileArtLayers.find((layer) => layer.id === 'structure:mossprout-hex-garden')!;
  assert.equal(veiled.width, baseline.width); assert.equal(veiled.height, baseline.height);
  assert.deepEqual(home(veiled).frame, home(baseline).frame);
  assert.deepEqual(home(veiled).residentAnchor, home(baseline).residentAnchor);
  assert.notEqual(home(veiled).source, home(baseline).source, 'the veiled home tile paints mist');
  assert.equal(veiled.tileArtLayers.find((layer) => layer.id === 'structure:mossprout-hex-garden'), undefined, 'the Garden is part of what the Mist hides');
  assert.equal(home(veiled).residentSource, undefined, 'nobody stands on the veiled tile');
  assert.ok(home(baseline).residentSource, 'unveiled, Mossprout stands on the tile as before');
  assert.ok(home(baseline).depth < garden(baseline).depth, 'unveiled, the Garden sits above the tile as before');
  const solo = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeSolo: true }) as KingdomHexScene;
  assert.equal(solo.tileArtLayers.map((layer) => layer.id).join(','), home(baseline).id, 'until the hatch Mossprout’s tile stands alone: no Garden, no neighbours, even unveiled');
  assert.equal(solo.width, baseline.width); assert.equal(solo.height, baseline.height);
  assert.deepEqual(home(solo).frame, home(baseline).frame, 'alone, the tile still sits where the world will grow around it');
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    const id = `nature:mossprout:${island.id}`;
    const locked = baseline.tileArtLayers.find((layer) => layer.id === id)!;
    assert.ok(locked.interactionFrame, `${id} must be tappable while covered in mist`);
    let fallback: unknown;
    for (const level of island.levels) {
      const before = build();
      levels[island.id] = level.level;
      const scene = build();
      assert.equal(scene.width, baseline.width);
      assert.equal(scene.height, baseline.height);
      for (const layer of before.tileArtLayers.filter((candidate) => candidate.id !== id)) {
        assert.deepEqual(scene.tileArtLayers.find((candidate) => candidate.id === layer.id)?.frame, layer.frame);
      }
      const revealed = scene.tileArtLayers.find((layer) => layer.id === id)!;
      assert.notEqual(revealed.source, locked.source);
      assert.deepEqual(revealed.interactionFrame, locked.interactionFrame);
      if (level.level === 1) fallback = revealed.source;
      else if (island.id === 'bloom-garden') assert.notEqual(revealed.source, fallback, 'Bloom Garden has a complete visual ladder');
      else assert.equal(revealed.source, fallback, 'missing bespoke art reuses the island fallback');
    }
  }
  const catalog = module.MOSSPROUT_NATURE_ISLAND_ART as unknown as typeof import('@/components/katchadeck/world/mossprout-hex-neighborhood-scene').MOSSPROUT_NATURE_ISLAND_ART;
  const seed = catalog['seed-nursery'];
  const bespoke = catalog['pond-sanctuary'];
  seed.levelArt = { 2: { sources: bespoke.sources, alphaBounds: bespoke.alphaBounds } };
  levels['seed-nursery'] = 2;
  const withBespoke = build();
  assert.equal(withBespoke.tileArtLayers.find((layer) => layer.id === 'nature:mossprout:seed-nursery')?.source, bespoke.sources.full);
  levels['seed-nursery'] = 3;
  const withFallback = build();
  assert.equal(withFallback.tileArtLayers.find((layer) => layer.id === 'nature:mossprout:seed-nursery')?.source, seed.sources.full);
  assert.equal(withBespoke.width, withFallback.width);
  assert.equal(withBespoke.height, withFallback.height);
});

test('only the next authored level is offered, preserving costs and aggregate Haven progression', () => {
  const initial = worldUpgradeOffers(world());
  assert.ok(initial.filter((offer) => offer.sleepingSkinId == null).every((offer) => offer.eligible));
  assert.equal(initial.find((offer) => offer.id === 'nature:bloom-garden')?.transition, 'island_reveal');
  assert.equal(initial.find((offer) => offer.id === 'haven:mossprout')?.cost, 20);
  const offers = worldUpgradeOffers(restored());
  assert.equal(offers.some((offer) => offer.id === 'haven:mossprout'), false);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.cost, 40);
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    const offer = offers.find((item) => item.id === `nature:${island.id}`)!;
    const open = islandWakeState(restored(), island.id) === 'open';
    assert.equal(offer.cost, island.levels[0].coinCost);
    assert.equal(offer.eligible, open, `${island.id} is ${open ? 'open' : 'resting'}`);
    if (open) assert.equal(offer.nextLevel, 0);
    else assert.equal(offer.sleepingSkinId, ISLAND_WAKE_ORDER.find((entry) => entry.islandId === island.id)?.residentSkinId);
  }
  assert.equal(offers.filter((offer) => offer.eligible && offer.id.startsWith('nature:')).length, 1, 'exactly one island is the next step');
  assert.equal(new Set(WORLD_UPGRADE_DEFINITIONS.map(worldUpgradeRunId)).size, WORLD_UPGRADE_DEFINITIONS.length);
});

test('unaffordable spots remain discoverable without story or resident prerequisites', () => {
  const offers = worldUpgradeOffers({ ...restored(), coins: 3 });
  const mist = offers.find((offer) => offer.id === 'mist:steppling-home')!;
  assert.equal(mist.eligible, true); assert.equal(mist.affordable, false); assert.equal(mist.missingGlow, 37);
  const locked = worldUpgradeOffers(createInitialMergeWorldState(NOW, ['mossprout']));
  assert.ok(locked.filter((offer) => offer.sleepingSkinId == null).every((offer) => offer.eligible));
  assert.equal(locked.find((offer) => offer.id === 'nature:bloom-garden')?.eligible, true);
  assert.ok(visibleWorldUpgradeOffers(locked, undefined, null).some((offer) => offer.sleepingSkinId != null), 'resting friends stay visible on the map');
});

test('Glow alone cannot wake Pond Sanctuary before its turn, and the mist purchase still works', () => {
  const state = { ...createInitialMergeWorldState(NOW, []), coins: 45 };
  const offer = worldUpgradeOffers(state).find((candidate) => candidate.id === 'nature:pond-sanctuary')!;
  assert.equal(offer.eligible, false);
  assert.equal(offer.affordable, false);
  assert.equal(offer.sleepingSkinId, 'drizzlet');
  assert.match(offer.lockedReason ?? '', /resting here/);
  const command = { type: 'upgradeMossproutNatureIsland' as const, islandId: 'pond-sanctuary' as const,
    level: 1 as const, receiptId: 'pond:glow-only', now: NOW };
  const refused = reduceMergeWorld(state, command);
  assert.equal(refused.changed, false);
  assert.equal(refused.state.coins, 45);
  assert.equal(refused.state.haven.mossproutNatureIslands['pond-sanctuary'], 0);
  const mist = reduceMergeWorld(state, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'mist:glow-only', now: NOW });
  assert.equal(mist.changed, true);
  assert.equal(mist.state.coins, 5);
  assert.equal(reduceMergeWorld({ ...state, coins: 39 }, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', now: NOW }).changed, false);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW }).changed, true);
});

test('completed mist and max-level islands no longer expose upgrade offers', () => {
  let state = restored();
  state = reduceMergeWorld(state, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'test:mist', now: NOW }).state;
  assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === 'mist:steppling-home'), false);
  state = { ...state, haven: { ...state.haven, mossproutNatureIslands: { ...state.haven.mossproutNatureIslands, 'seed-nursery': 4 } } };
  assert.equal(worldUpgradeOffers(state).some((offer) => offer.id === 'nature:seed-nursery'), false);
});

test('every upgrade holds the old world before spending and replays its receipt-backed reveal', () => {
  for (const flow of WORLD_UPGRADE_FLOWS) {
    assert.deepEqual(validateContentFlowDefinition(flow), [], flow.id);
    const approach = flow.nodes.find((node) => node.id === 'approach')!;
    assert.equal(approach.kind === 'presentation' && approach.payload?.operation, 'preserve', 'confirmation keeps the marker close-up');
    const hold = flow.nodes.find((node) => node.id === 'upgrade.focus')!;
    assert.equal(hold.kind === 'presentation' && hold.payload?.holdWorldState, true);
    const commit = flow.nodes.find((node) => node.id === 'upgrade.commit')!;
    const giftedBy = ISLAND_CAMPAIGNS.find((campaign) => flow.id === `world-upgrade:nature:${campaign.islandId}:1`);
    assert.deepEqual(commit.kind === 'effect' && commit.payload?.economy,
      giftedBy
        ? { mode: 'free', reason: `${giftedBy.residentName} restores this part of the garden after the request.` }
        : { mode: 'normal' });
    const reveal = flow.nodes.find((node) => node.id === 'upgrade.reveal')!;
    assert.equal(reveal.kind === 'presentation' && reveal.replayPolicy, 'replay');
    assert.equal(reveal.kind === 'presentation' && reveal.payload?.sourceEffectNodeId, 'upgrade.commit');
  }
});

test('FTUE marker taps open a saved scene without spending: a confirmation for the Garden, the mission board for the mist', () => {
  const garden = MOSSPROUT_FTUE_FLOW.nodes.find((item) => item.id === 'world.first_bloom_offer')!;
  assert.equal(garden.kind, 'scene');
  assert.equal(garden.kind === 'scene' && garden.actions[0].next, 'world.first_bloom_restore');
  assert.equal(MOSSPROUT_FTUE_FLOW.nodes.find((item) => item.id === 'world.first_bloom_restore')?.kind, 'scene');
  const bubble = GLOW_DISCOVERY_FLOW.nodes.find((item) => item.id === 'gateway.offer')!;
  assert.equal(bubble.kind, 'scene');
  assert.equal(bubble.kind === 'scene' && bubble.actions[0].next, 'mission.focus');
  assert.equal(GLOW_DISCOVERY_FLOW.nodes.find((item) => item.id === 'mission.focus')?.kind, 'presentation', 'the camera frames the tile first');
  assert.equal(GLOW_DISCOVERY_FLOW.nodes.find((item) => item.id === 'mission.clear')?.kind, 'task', 'then the board waits for its bar');
  assert.equal(GLOW_DISCOVERY_FLOW.nodes.some((item) => item.id === 'gateway.buy'), false, 'no purchase sheet');
});

test('ordinary purchase deduplicates rapid taps, validates fresh balance, and resumes the existing journal', async () => {
  let starts = 0; let retries = 0; let existing: { status: string } | null = null; let state = world();
  const runtime = loadNativeModule('features/world-upgrades/world-upgrade-runtime.ts', {
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => state },
    '@/features/content-flow/content-flow-director': { startContentFlow: async () => { starts++; return { status: 'active' }; }, dispatchContentFlowCommand: async () => { retries++; return { status: 'active' }; } },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => existing, listContentFlowRuns: async () => [] },
    './world-upgrade-offers': { worldUpgradeOffers }, './world-upgrade-flows': { WORLD_UPGRADE_FLOWS, worldUpgradeRunId },
  });
  const offer = worldUpgradeOffers(state).find((item) => item.id === 'haven:mossprout')!;
  await Promise.all([runtime.purchaseWorldUpgrade(offer), runtime.purchaseWorldUpgrade(offer)]);
  assert.equal(starts, 1);
  state = { ...state, coins: 0 };
  await assert.rejects(runtime.purchaseWorldUpgrade(offer), /more Glow/); assert.equal(starts, 1);
  existing = { status: 'failed_recoverable' };
  await runtime.purchaseWorldUpgrade(offer); assert.equal(retries, 1); assert.equal(starts, 1);
  existing = { status: 'completed' };
  await runtime.purchaseWorldUpgrade(offer); assert.equal(retries, 1); assert.equal(starts, 1);
});

test('ordinary purchase flushes optimistic world progress before fresh eligibility validation', async () => {
  let ready = false;
  let starts = 0;
  const offer = { id: 'nature:bloom-garden', nextLevel: 3, eligible: true, affordable: true };
  const runtime = loadNativeModule('features/world-upgrades/world-upgrade-runtime.ts', {
    '@/utils/merge-world/repository': { loadMergeWorldState: async () => ({ ready }) },
    '@/features/content-flow/content-flow-director': {
      startContentFlow: async () => { starts += 1; return { status: 'active' }; },
      dispatchContentFlowCommand: async () => ({ status: 'active' }),
    },
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: async () => null,
      listContentFlowRuns: async () => [],
      subscribeContentFlowJournal: () => () => {},
    },
    './world-upgrade-offers': {
      worldUpgradeOffers: (state: { ready: boolean }) => [{ ...offer, eligible: state.ready }],
    },
    './world-upgrade-flows': {
      WORLD_UPGRADE_FLOWS: [{ id: 'world-upgrade:nature:bloom-garden:3' }],
      worldUpgradeRunId: () => 'world-upgrade:nature:bloom-garden:3',
    },
  });

  await runtime.purchaseWorldUpgrade(offer, { beforeValidation: async () => { ready = true; } });
  assert.equal(starts, 1);
});

test('a legacy confirmation checkpoint crosses the new marker scene without replaying spending', async () => {
  let run = { runId: 'flow:old-ftue', definitionId: MOSSPROUT_FTUE_FLOW.id, definitionVersion: MOSSPROUT_FTUE_FLOW.version,
    nodeId: 'world.first_bloom_offer', status: 'active', phase: 'awaiting_scene' };
  const actions: string[] = [];
  const runtime = loadNativeModule('features/content-flow/ftue-content-flow-runtime.ts', {
    '@/features/onboarding/mossprout-ftue-flow': { MOSSPROUT_FTUE_VARIANTS: { id: 'test', variants: [] } },
    './content-flow-catalog': { contentFlowDefinition: () => MOSSPROUT_FTUE_FLOW },
    './content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: { actionId: string }) => {
      actions.push(command.actionId); run = { ...run, nodeId: 'world.first_bloom_restore' }; return run;
    } },
    './content-flow-interpreter': {},
    './content-flow-repository': { loadContentFlowRun: async () => run },
    './story-variant-registry': { registerStoryVariantSet() {}, selectedStoryVariant: () => ({ definition: MOSSPROUT_FTUE_FLOW }) },
  });
  const result = await runtime.reconcileFtueCheckpoint({ runId: 'old-ftue', stepId: 'world.first_bloom_restore',
    receipts: [{ stepId: 'merge.serve_sprout', scriptVersion: 47, status: 'committed' }] });
  assert.equal(result.nodeId, 'world.first_bloom_restore');
  assert.deepEqual(actions, ['world.open_first_bloom_upgrade']);
});


test('mist upgrade stays available with a lagging FTUE or legacy chapter snapshot', () => {
  const state = restored();
  state.characterProgress.mossprout = { friendshipLevel: 1, completedChapterIds: [] };
  const offers = worldUpgradeOffers(state);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.eligible, true);
  assert.equal(offers.some((offer) => offer.id.startsWith('nature:') && offer.eligible), true);
  for (const nodeId of ['gateway.ready', 'gateway.return', 'gateway.offer']) {
    assert.deepEqual(visibleWorldUpgradeOffers(offers, 'companion.meditating', { nodeId, status: 'active' }).map((offer) => offer.id), ['mist:steppling-home']);
  }
  assert.deepEqual(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'lesson.spawn', status: 'active' }), []);
  for (const nodeId of ['mission.focus', 'mission.clear']) {
    assert.deepEqual(visibleWorldUpgradeOffers(offers, undefined, { nodeId, status: 'active' }), [], 'no markers while the mission board is up');
  }
});

test('resting friends stay on the map through the whole FTUE while every other marker waits', () => {
  const state = { ...createInitialMergeWorldState(NOW, []), coins: 45 };
  const offers = worldUpgradeOffers(state);
  assert.ok(offers.some((offer) => offer.sleepingSkinId != null), 'the fixture has resting friends');
  assert.ok(offers.some((offer) => offer.eligible && offer.sleepingSkinId == null), 'and at least one open marker');
  for (const stepId of ['world.mist_open', 'world.mist_clear', 'egg.opening', 'companion.first_rest']) {
    const visible = visibleWorldUpgradeOffers(offers, stepId, null);
    assert.ok(visible.length > 0, `${stepId}: silhouettes visible`);
    assert.ok(visible.every((offer) => offer.sleepingSkinId != null), `${stepId}: only resting friends`);
  }
  const restoreBeat = visibleWorldUpgradeOffers([...offers, { ...offers[0]!, id: 'haven:mossprout', eligible: true, sleepingSkinId: undefined }], 'world.first_bloom_offer', null);
  assert.ok(restoreBeat.some((offer) => offer.id === 'haven:mossprout'), 'the first restore keeps its own marker');
});

function mistUpgradeRuntime(initialNode = 'gateway.offer', initialStatus = 'active') {
  let run = { nodeId: initialNode, status: initialStatus, error: null as string | null };
  let block = false;
  const commands: string[] = [];
  const runtime = loadNativeModule('features/onboarding/glow-upgrade-runtime.ts', {
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => run },
    '@/features/content-flow/content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: { type: string; actionId?: string }) => {
      commands.push(command.actionId ?? command.type);
      if (block) return run;
      if (command.type === 'retry') run = { ...run, status: 'active', error: null, nodeId: run.nodeId === 'gateway.return' ? 'gateway.offer' : run.nodeId };
      if (command.actionId === 'return') run = { ...run, nodeId: 'gateway.offer' };
      if (command.actionId === 'open_upgrade') run = { ...run, nodeId: 'mission.focus' };
      return run;
    } },
    './glow-discovery-flow': {
      GLOW_DISCOVERY_RUN_ID: 'story:glow-steppling-v1',
      GLOW_GATEWAY_NODE_IDS: ['gateway.ready', 'gateway.return', 'gateway.offer'],
      glowDiscoveryMissionNode: (nodeId: string) => nodeId === 'mission.focus' || nodeId === 'mission.clear',
    },
    '@/utils/merge-world/glow-discovery-policy': { GLOW_GATEWAY_ID: 'mossprout:overgrown-trail' },
  });
  return { runtime, commands, setBlocked: (value: boolean) => { block = value; } };
}

test('the bubble opens the mission board without buying, and repeated taps never send another command', async () => {
  const { runtime, commands } = mistUpgradeRuntime();
  assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'mission.focus');
  assert.deepEqual(commands, ['open_upgrade']);
  await Promise.all([runtime.advanceGlowUpgrade('confirm'), runtime.advanceGlowUpgrade('confirm')]);
  assert.deepEqual(commands, ['open_upgrade'], 'there is no confirm step: the mission is the price');
});

test('mist retries failed saves and rejects unchanged commands instead of leaving a permanent busy panel', async () => {
  const { runtime, commands, setBlocked } = mistUpgradeRuntime('mission.clear', 'failed_recoverable');
  setBlocked(true);
  await assert.rejects(runtime.advanceGlowUpgrade('confirm'), /paused/);
  setBlocked(false);
  assert.equal((await runtime.advanceGlowUpgrade('confirm')).nodeId, 'mission.clear');
  assert.deepEqual(commands, ['retry', 'retry']);
  const stalled = mistUpgradeRuntime();
  stalled.setBlocked(true);
  await assert.rejects(stalled.runtime.advanceGlowUpgrade('open'), /did not advance/);
  stalled.setBlocked(false);
  assert.equal((await stalled.runtime.advanceGlowUpgrade('open')).nodeId, 'mission.focus');
});

test('already paid mist resumes its reveal without another charge; unpaid mist is never auto-purchased', async () => {
  const { runtime, commands } = mistUpgradeRuntime('gateway.offer');
  const initial = restored();
  assert.equal(await runtime.recoverPaidGlowUpgrade(initial), null);
  assert.deepEqual(commands, []);
  const paid = reduceMergeWorld(initial, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'earlier-purchase', now: NOW }).state;
  // An old paid save plays the mission too; its receipt-backed reveal then charges zero.
  assert.equal((await runtime.recoverPaidGlowUpgrade(paid)).nodeId, 'mission.focus');
  const resumed = reduceMergeWorld(paid, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'recovered-story-purchase', now: NOW + 1 });
  assert.equal(resumed.state.coins, paid.coins);
  assert.equal(resumed.storyWorldMutationReceipt?.coinCost, 0);
});


test('enough Glow returns straight to an actionable scene with no camera acknowledgement', () => {
  const initial = { ...createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'return-with-glow', now: NOW }), nodeId: 'gateway.ready' };
  const ready = stabilizeContentFlow(GLOW_DISCOVERY_FLOW, initial).run;
  const returned = reduceContentFlow(GLOW_DISCOVERY_FLOW, ready, { type: 'submit_scene', actionId: 'return' });
  assert.equal(returned.run.nodeId, 'gateway.offer');
  assert.equal(returned.run.phase, 'awaiting_input');
  assert.equal(returned.pendingWork.kind, 'none');
  assert.equal(GLOW_DISCOVERY_FLOW.migrations?.['gateway.return'], 'gateway.offer');
});

test('a save stuck in the old return-camera step can open the new panel without a camera callback', async () => {
  for (const nodeId of ['gateway.return', 'gateway.ready']) {
    const { runtime, commands } = mistUpgradeRuntime(nodeId);
    assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'mission.focus');
    assert.deepEqual(commands, [nodeId === 'gateway.return' ? 'retry' : 'return', 'open_upgrade']);
    assert.equal(commands.includes('unlock'), false);
  }
});

test('returning to mist exposes the upgrade bubble until tapped, including resumed confirmation', async () => {
  const offers = worldUpgradeOffers(restored());
  for (const nodeId of ['gateway.ready', 'gateway.return', 'gateway.offer']) {
    const visible = visibleWorldUpgradeOffers(offers, 'companion.meditating', { nodeId, status: 'active' });
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, 'mist:steppling-home');
    const { runtime, commands } = mistUpgradeRuntime(nodeId);
    assert.equal(commands.length, 0, 'showing the bubble does not open or purchase automatically');
    assert.equal((await runtime.advanceGlowUpgrade('open')).nodeId, 'mission.focus');
    assert.equal(commands.includes('unlock'), false, 'tapping opens the mission board without payment');
    assert.equal(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'gateway.offer', status: 'active' })[0].id,
      'mist:steppling-home', 'the bubble stays until it is tapped');
  }
});


test('currency button renders project art and amount, announces cost, and retains cost while loading', async () => {
  let haptics = 0;
  let hapticsUnavailable = false;
  const host = (name: string) => name as unknown as React.ComponentType<Record<string, unknown>>;
  const module = loadNativeModule('components/katchadeck/ui/katcha-button.tsx', {
    'react-native': { ...nativeViews, Pressable: 'Pressable', ActivityIndicator: 'Spinner' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' } },
    'expo-image': { Image: 'Image' },
    'expo-haptics': { selectionAsync: async () => {
      haptics++;
      if (hapticsUnavailable) throw new Error('Haptics unavailable');
    } },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '@/components/katchadeck/motion': { usePressMotion: () => ({}) },
    '@/components/katchadeck/ui/katcha-surface': { useKatchaSurface: () => ({ tokens: {} }) },
    '@/components/themed-text': { ThemedText: 'Text' },
    '@/components/ui/icon-symbol': { IconSymbol: 'Icon' },
    './animated-border-highlight': { AnimatedBorderHighlight: 'BorderHighlight' },
    '@/constants/game-cta': loadNativeModule('constants/game-cta.ts', {
      '@/constants/theme': { AppFontFamilies: { fredokaBold: 'FredokaBold' } },
    }),
    '@/constants/game-currency-art': { GAME_CURRENCY_ART: { coins: 'glow-art', energy: 'energy-art' } },
  });
  const Button = module.KatchaButton as React.ComponentType<Record<string, unknown>>;
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Button fullWidth label="Restore" cost={{ currency: 'coins', amount: 20 }} />); });
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Restore, 20 Glow');
  assert.equal(tree!.root.findByType(host('Image')).props.source, 'glow-art');
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 1);
  assert.deepEqual(tree!.root.findAllByType(host('Text')).map((node) => node.props.children), ['Restore', '20']);
  await act(async () => tree!.update(<Button label="Feed" loading size="compact" cost={{ currency: 'energy', amount: 5 }} />));
  assert.equal(tree!.root.findByType(host('Pressable')).props.disabled, true);
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Feed, 5 Energy');
  assert.equal(tree!.root.findByType(host('Image')).props.source, 'energy-art');
  assert.equal(tree!.root.findAllByType(host('Spinner')).length, 1);
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  await act(async () => tree!.update(<Button label="Continue" />));
  assert.equal(tree!.root.findAllByType(host('Image')).length, 0);
  assert.equal(tree!.root.findByType(host('Pressable')).props.accessibilityLabel, 'Continue');
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 1);
  await act(async () => tree!.update(<Button label="Restore" disabled />));
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  await act(async () => tree!.update(<Button label="Cancel" variant="secondary" />));
  assert.equal(tree!.root.findAllByType(host('BorderHighlight')).length, 0);
  let presses = 0;
  await act(async () => tree!.update(<Button label="Continue" onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 1);
  assert.equal(haptics, 1, 'one haptic per accepted CTA tap');
  await act(async () => tree!.update(<Button label="Continue" disabled onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  await act(async () => tree!.update(<Button label="Continue" loading onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 1, 'disabled and loading CTAs cannot dispatch');
  assert.equal(haptics, 1, 'disabled and loading CTAs stay silent');
  hapticsUnavailable = true;
  await act(async () => tree!.update(<Button label="Continue" onPress={() => presses++} />));
  await act(async () => tree!.root.findByType(host('Pressable')).props.onPress());
  assert.equal(presses, 2, 'unavailable haptics never block the action');
  await act(async () => tree!.unmount());
});


test('legacy Garden restoration and finished mist requests enable the same paid unlock as the panel', () => {
  const initial = createInitialMergeWorldState(NOW, ['mossprout']);
  const structureRestored = reduceMergeWorld(initial, {
    type: 'upgradeHavenStructure', structureId: 'mossprout-garden', level: 1,
    receiptId: 'legacy-garden-restore', now: NOW,
  }).state;
  const completedLesson = { ...initial, glowDiscoveryLesson: { preparedAt: NOW,
    servedOrderIds: ['mossprout:glow:plant-1', 'mossprout:glow:plant-2'] } };
  const missingResident = { ...restored(), unlockedCharacters: [] };
  for (const saved of [structureRestored, completedLesson, missingResident]) {
    const state = { ...saved, coins: 55 };
    const offer = worldUpgradeOffers(state).find((candidate) => candidate.id === 'mist:steppling-home')!;
    assert.equal(offer.eligible, true);
    assert.equal(offer.affordable, true);
    const command = { type: 'unlockWorldTarget' as const, targetId: 'mossprout:overgrown-trail', receiptId: 'clear-mist', now: NOW };
    const purchase = reduceMergeWorld(state, command);
    assert.equal(purchase.changed, true);
    assert.equal(purchase.state.coins, 15);
    assert.ok(purchase.state.worldUnlocks?.['mossprout:overgrown-trail']);
    assert.equal(reduceMergeWorld(purchase.state, command).state.coins, 15);
    const poor = reduceMergeWorld({ ...state, coins: 39 }, command);
    assert.equal(poor.changed, false);
  }
  assert.equal(worldUpgradeOffers({ ...initial, coins: 55 }).find((offer) => offer.id === 'mist:steppling-home')?.eligible, true);
});


test('saved mist checkpoints restore one stable close-up without replaying purchase or egg framing', () => {
  const expected = { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: 1.2, anchorY: 0.46, durationMs: 900 };
  for (const nodeId of ['garden.open', 'lesson.prepare', 'lesson.spawn', 'lesson.repeat.serve', 'gateway.ready', 'gateway.return', 'gateway.offer']) {
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), expected);
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'failed_recoverable' }), expected);
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'completed' }), null);
  }
  for (const nodeId of ['mission.focus', 'mission.clear']) {
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), STEPPLING_MISSION_CAMERA, 'the mission board resumes with the opening’s framing');
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'completed' }), null);
  }
  for (const nodeId of ['gateway.focus', 'gateway.purchase.focus', 'gateway.egg', 'egg.enter', 'complete']) {
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), null);
  }
  assert.equal(glowDiscoveryResumeCamera(null), null);
});


test('unfinished Glow discovery owns the Mossprout map even after the original FTUE completes', () => {
  assert.equal(glowDiscoveryResumeWorld({ status: 'active' }), 'mossprout');
  assert.equal(glowDiscoveryResumeWorld({ status: 'failed_recoverable' }), 'mossprout');
  assert.equal(glowDiscoveryResumeWorld({ status: 'completed' }), null);
  assert.equal(glowDiscoveryResumeWorld(null), null);
});

test('startup waits for the saved Glow journal before choosing the selector or Mossprout world', async () => {
  let finishLoad: (run: unknown) => void = () => {};
  const saved = new Promise((resolve) => { finishLoad = resolve; });
  const module = loadNativeModule('features/onboarding/glow-discovery-runtime.ts', {
    '@/features/content-flow/content-flow-director': {},
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: () => saved, subscribeContentFlowJournal: () => () => {},
    },
    '@/utils/merge-world/glow-discovery-policy': {},
    '@/utils/merge-world/repository': {},
    './glow-discovery-flow': { GLOW_DISCOVERY_RUN_ID: 'story:glow-steppling-v1' },
  });
  let snapshot: { run: null | { status: 'active' }; ready: boolean };
  function Host() { snapshot = module.useGlowDiscoveryState(); return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host />); });
  assert.equal(snapshot!.ready, false, 'do not briefly mount the top-level selector while loading');
  await act(async () => { finishLoad({ nodeId: 'gateway.offer', status: 'active' }); });
  assert.equal(snapshot!.ready, true);
  assert.equal(glowDiscoveryResumeWorld(snapshot!.run), 'mossprout');
  await act(async () => tree!.unmount());
});
