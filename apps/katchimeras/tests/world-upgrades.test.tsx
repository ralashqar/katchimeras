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
import { acknowledgeChapterReturn, completeChapter, completeRestoration, greetIslandFriend, startAndServeChapter } from './helpers/island-campaign';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldCommand, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';
import { readFileSync } from './helpers/content-fs';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { STORY_TILES } from '@/constants/story-tiles/registry';
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
    assert.equal(reveal.transition, 'island_reveal'); assert.equal(reveal.eligible, true); assert.equal(reveal.cost, 0, 'a friend’s mist never costs Glow');
    assert.ok(WORLD_UPGRADE_FLOWS.some((flow) => flow.id === worldUpgradeRunId(reveal)));
    const revealCommand: MergeWorldCommand = { type: 'revealMossproutNatureIsland', islandId: island.id, campaignId: campaign.campaignId,
      residentSkinId: campaign.residentSkinId, cost: reveal.cost, receiptId: worldUpgradeRunId(reveal), now: NOW };
    const beforeReveal = state.coins;
    state = normalizeMergeWorldState(JSON.parse(JSON.stringify(reduceMergeWorld(state, revealCommand).state)), NOW);
    assert.equal(state.coins, beforeReveal - reveal.cost);
    assert.equal(reduceMergeWorld(state, revealCommand).state.coins, state.coins, 'a replayed reveal never charges twice');
    state = greetIslandFriend(state, campaign, NOW);
    for (const level of island.levels) {
      // A friend's island never costs Glow: its boards open free and its levels grow free.
      const onBeds: boolean = campaign.chapters.some((entry) => entry.level === level.level && entry.restoration != null);
      const beforeStage = state.coins;
      state = acknowledgeChapterReturn(startAndServeChapter(state, campaign, level.level, NOW), campaign, level.level, NOW);
      if (onBeds) assert.equal(state.coins, beforeStage, `${island.id} level ${level.level}'s board opens free`);
      state = completeRestoration(state, campaign, level.level, NOW);
      const offer = visibleWorldUpgradeOffers(worldUpgradeOffers(state), undefined, null).find((candidate) => candidate.id === `nature:${island.id}`)!;
      assert.ok(offer, `${island.id} level ${level.level} has a marker`);
      assert.equal(offer.cost, 0);
      assert.equal(offer.nextLevel, level.level);
      assert.equal(offer.eligible, true);
      assert.equal(offer.action, level.level === 1 ? 'Restore' : 'Upgrade');
      assert.ok(WORLD_UPGRADE_FLOWS.some((flow) => flow.id === worldUpgradeRunId(offer)));
      const command: MergeWorldCommand = { type: 'upgradeMossproutNatureIsland', islandId: island.id, level: level.level,
        receiptId: worldUpgradeRunId(offer), now: NOW, ...(level.level === 1 || onBeds ? { economyMode: 'free' } : {}) };
      const before = state.coins;
      const paid = reduceMergeWorld(state, command);
      assert.equal(paid.changed, true, paid.message);
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

for (const compiler of ['typescript', 'babel'] as const) test(`mist islands are targetable and every reveal keeps other tiles and camera bounds stable (${compiler})`, () => {
  const file = 'components/katchadeck/world/mossprout-hex-neighborhood-scene.ts';
  const mocks: Record<string, unknown> = {
    '@/constants/heartwood-art': { HEARTWOOD_ART: Object.fromEntries(['dormant', 'stirring', 'rooted', 'blooming', 'awakened'].map(stage => [stage, { full: stage, medium: stage, thumb: stage }])) },
    './shared-resident-presentation': { sharedResidentAnchor },
    '@/constants/mossprout-memory-plants': { mossproutMemoryPlantById: new Map() },
    '@/constants/hatchable-companions/tile-art': { hatchableTileArt: (tileId: string) => ({ full: `${tileId}:full`, medium: `${tileId}:512`, thumb: `${tileId}:256` }) },
    '@/constants/story-tiles/tile-art': { storyTileArt: (tileId: string) => ({ full: `${tileId}:full`, medium: `${tileId}:512`, thumb: `${tileId}:256` }) },
    '@/components/katchadeck/world/kingdom-hex-scene': {
      tileVisibleBounds: (x: number, y: number) => ({ left: x - 200, top: y - 200, right: x + 200, bottom: y + 200 }),
    },
  };
  for (const match of readFileSync(file, 'utf8').matchAll(/require\('([^']+)'\)/g)) mocks[match[1]] = match[1];
  const module = loadNativeModule(file, mocks, {}, undefined, compiler);
  const levels = { ...restored().haven.mossproutNatureIslands };
  const build = () => module.buildMossproutHexNeighborhoodScene([], levels) as KingdomHexScene;
  const baseline = build();
  assert.ok(Number.isFinite(baseline.width) && baseline.width > 0, 'scene width must be finite and positive');
  assert.ok(Number.isFinite(baseline.height) && baseline.height > 0, 'scene height must be finite and positive');
  for (const layer of baseline.tileArtLayers) {
    assert.ok(Object.values(layer.frame).every(Number.isFinite), `${layer.id} must have finite coordinates`);
    assert.ok(layer.frame.width > 0 && layer.frame.height > 0, `${layer.id} must have visible dimensions`);
  }
  // The opening veil: same frame, footprint, anchor and envelope; only art and draw order change.
  const veiled = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeVeiled: true }) as KingdomHexScene;
  const home = (scene: KingdomHexScene) => scene.tileArtLayers.find((layer) => layer.id === scene.centerTile.id)!;
  const garden = (scene: KingdomHexScene) => scene.tileArtLayers.find((layer) => layer.id === 'structure:mossprout-hex-garden')!;
  assert.equal(veiled.width, baseline.width); assert.equal(veiled.height, baseline.height);
  assert.deepEqual(home(veiled).frame, home(baseline).frame);
  assert.deepEqual(home(veiled).residentAnchor, home(baseline).residentAnchor);
  assert.notEqual(home(veiled).source, home(baseline).source, 'the veiled home tile paints mist');
  assert.deepEqual(garden(veiled).frame, garden(baseline).frame, 'the combined Tree remains behind the opening Mist');
  assert.equal(home(veiled).residentSource, undefined, 'nobody stands on the veiled tile');
  assert.ok(home(baseline).residentSource, 'unveiled, Mossprout stands on the tile as before');
  assert.ok(home(baseline).depth > garden(baseline).depth, 'the home is in front of the central Tree');
  const solo = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeSolo: true }) as KingdomHexScene;
  assert.deepEqual(Array.from(solo.tileArtLayers.map((layer) => layer.id)), [home(baseline).id], 'only Mossprout’s supporting tile remains: no Tree or neighbours');
  assert.equal(solo.tiles.length, 1, 'no residents float over hidden neighbour tiles');
  const intro = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeSolo: true, revealWorldWithHome: true }) as KingdomHexScene;
  assert.deepEqual(Array.from(intro.tileArtLayers.map(layer => layer.id)).sort(), Array.from(baseline.tileArtLayers.map(layer => layer.id)).sort(), 'Heartwood and every surrounding tile reveal together at the first meeting');
  assert.deepEqual(home(intro).frame, home(solo).frame, 'revealing Heartwood never moves Mossprout');
  assert.equal(intro.width, solo.width); assert.equal(intro.height, solo.height);
  const veiledSolo = module.buildMossproutHexNeighborhoodScene([], levels, undefined, {}, { homeSolo: true, homeVeiled: true }) as KingdomHexScene;
  assert.equal(veiledSolo.tileArtLayers.length, 1, 'the Tree is absent before the Mist lifts too');
  assert.deepEqual(home(veiledSolo).frame, home(solo).frame, 'the supporting island never moves during the hatch');
  assert.equal(solo.width, baseline.width); assert.equal(solo.height, baseline.height);
  assert.deepEqual(home(solo).frame, home(baseline).frame, 'alone, the tile still sits where the world will grow around it');
  for (const stage of ['stirring', 'rooted', 'blooming', 'awakened']) {
    const changed = module.buildMossproutHexNeighborhoodScene([], levels, { level: 0, plantableMemories: [], heartwoodStage: stage }) as KingdomHexScene;
    assert.equal(changed.width, baseline.width);
    assert.equal(changed.height, baseline.height);
    for (const layer of baseline.tileArtLayers) assert.deepEqual(changed.tileArtLayers.find(candidate => candidate.id === layer.id)?.frame, layer.frame, 'Tree growth preserves every frame');
    assert.equal(garden(changed).source, stage);
  }
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
  // No two layers share a hex: a story tile has its own place beside the islands and the friends' tiles.
  const hexes = baseline.tileArtLayers.filter((layer) => !layer.id.endsWith(':growth')).map((layer) => `${layer.coord.q},${layer.coord.r}`);
  assert.equal(new Set(hexes).size, hexes.length, `every layer on its own hex: ${hexes.join(' ')}`);
  const radius = ({ q, r }: { q: number; r: number }) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  const occupied = new Set(hexes);
  const outerRadius = Math.max(...baseline.tileArtLayers.map(layer => radius(layer.coord)));
  for (let q = -outerRadius; q <= outerRadius; q++) {
    for (let r = -outerRadius; r <= outerRadius; r++) {
      if (radius({ q, r }) < outerRadius) assert.ok(occupied.has(`${q},${r}`), `no gaps inside the outer ring: ${q},${r}`);
    }
  }
  assert.equal(radius(garden(baseline).coord), 0, 'Heartwood occupies the centre');
  assert.equal(radius(home(baseline).coord), 1, 'Mossprout stays adjacent to Heartwood');
  assert.deepEqual(baseline.centerTile.coord, home(baseline).coord, 'camera target and tile use the same ring position');
  // A story tile: mist until its episode reveals it; revealing it moves nothing else and keeps the envelope.
  for (const tile of STORY_TILES) {
    const id = `structure:${tile.id}`;
    const before = build();
    const misted = before.tileArtLayers.find((layer) => layer.id === id)!;
    assert.ok(misted, `${id} is on the map under the Mist`);
    const revealedScene = module.buildMossproutHexNeighborhoodScene([], levels, { level: 0, plantableMemories: [], storyTiles: { [tile.id]: 'revealed' } }) as KingdomHexScene;
    assert.equal(revealedScene.width, baseline.width); assert.equal(revealedScene.height, baseline.height);
    const revealed = revealedScene.tileArtLayers.find((layer) => layer.id === id)!;
    assert.notEqual(revealed.source, misted.source, 'revealed, the tile paints its own art');
    assert.deepEqual(revealed.interactionFrame, misted.interactionFrame, 'the footprint never moves');
    assert.equal(revealed.residentAnchor, undefined, 'nobody stands on a story tile');
    for (const layer of before.tileArtLayers.filter((candidate) => candidate.id !== id)) assert.deepEqual(revealedScene.tileArtLayers.find((candidate) => candidate.id === layer.id)?.frame, layer.frame);
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
  // Resting friends and hatchable tiles still asleep under the Mist are on the map but not yet the player's business.
  const awake = (offer: { sleepingSkinId?: unknown; hatchable?: { state: string } }) => offer.sleepingSkinId == null && offer.hatchable?.state !== 'sleeping';
  assert.ok(initial.filter(awake).every((offer) => offer.eligible), 'every awake spot is eligible');
  assert.equal(initial.find((offer) => offer.id === 'nature:bloom-garden')?.transition, 'island_reveal');
  assert.equal(initial.find((offer) => offer.id === 'haven:mossprout')?.cost, 20);
  const offers = worldUpgradeOffers(restored());
  assert.equal(offers.some((offer) => offer.id === 'haven:mossprout'), false);
  assert.equal(offers.find((offer) => offer.id === 'mist:steppling-home')?.cost, 20);
  for (const island of MOSSPROUT_NATURE_ISLANDS) {
    const offer = offers.find((item) => item.id === `nature:${island.id}`)!;
    const open = islandWakeState(restored(), island.id) === 'open';
    assert.equal(offer.cost, 0, 'a friend’s mist never costs Glow');
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
  assert.equal(mist.eligible, true); assert.equal(mist.affordable, false); assert.equal(mist.missingGlow, 17);
  const locked = worldUpgradeOffers(createInitialMergeWorldState(NOW, ['mossprout']));
  assert.ok(locked.filter((offer) => offer.sleepingSkinId == null && offer.hatchable?.state !== 'sleeping').every((offer) => offer.eligible), 'every awake spot is eligible');
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
  assert.equal(mist.state.coins, 25);
  assert.equal(reduceMergeWorld({ ...state, coins: 19 }, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', now: NOW }).changed, false);
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
  const bubble = GLOW_DISCOVERY_FLOW.nodes.find((item) => item.id === 'gateway.pay')!;
  assert.equal(bubble.kind, 'task', 'the mist bubble waits for its ticket');
  assert.equal(bubble.kind === 'task' && bubble.next, 'mission.focus');
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
  for (const nodeId of ['gateway.ready', 'gateway.pay', 'gateway.return', 'gateway.offer']) {
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

const DISCOVERY_NODE_IDS = ['gateway.focus', 'garden.open', 'lesson.single.prepare', 'gateway.ready', 'gateway.pay', 'mission.focus', 'mission.clear', 'gateway.purchase.focus', 'gateway.purchase.commit', 'gateway.purchase.reveal', 'gateway.egg', 'egg.enter', 'complete'];
function mistUpgradeRuntime(initialNode = 'gateway.pay', initialStatus = 'active') {
  let run = { runId: 'story:glow-steppling-v1', revision: 1, nodeId: initialNode, status: initialStatus, error: null as string | null };
  let block = false;
  const commands: string[] = [];
  const runtime = loadNativeModule('features/onboarding/hatchable-runtime.ts', {
    'react': {},
    '@/features/content-flow/content-flow-catalog': { registerContentFlowDefinition() {} },
    '@/utils/merge-world/repository': {},
    '@/constants/hatchable-companions/registry': { HATCHABLE_COMPANIONS: [STEPPLING_HATCHABLE], hatchableByCompanion: () => null },
    './steppling-egg-policy': {}, './glow-discovery-flow': {}, './steppling-garden-lesson': {},
    './hatchable-flows': { hatchableFlows: () => ({ discovery: { nodes: DISCOVERY_NODE_IDS.map((id) => ({ id })) } }), HATCHABLE_LESSON_FINALE_NODE_IDS: ['closing', 'summary'], HATCHABLE_MISSION_CLEAR_NODE_ID: 'mission.clear', HATCHABLE_MISSION_CLEARED_EVENT: 'glow.mission.cleared', HATCHABLE_EGG_ENTERED_EVENT: 'glow.egg.entered', HATCHABLE_MISSION_PAID_EVENT: 'glow.mission.paid', HATCHABLE_MISSION_PAY_NODE_ID: 'gateway.pay' },
    '@/features/content-flow/content-flow-repository': { loadContentFlowRun: async () => run },
    '@/features/content-flow/content-flow-director': { dispatchContentFlowCommand: async (_id: string, command: { type: string; actionId?: string; event?: { type: string } }) => {
      commands.push(command.actionId ?? command.event?.type ?? command.type);
      if (block) return run;
      if (command.type === 'retry') run = { ...run, status: 'active', error: null, nodeId: ['gateway.return', 'gateway.offer'].includes(run.nodeId) ? 'gateway.pay' : run.nodeId };
      if (command.actionId === 'return') run = { ...run, nodeId: 'gateway.pay' };
      if (command.event?.type === 'glow.mission.paid' && run.nodeId === 'gateway.pay') run = { ...run, nodeId: 'mission.focus', revision: run.revision + 1 };
      return run;
    } },
    '@/utils/merge-world/glow-discovery-policy': { hatchableGatewayState: () => 'locked', hatchableTileState: () => 'ready' },
  });
  // Steppling's discovery, through the shared runtime and his definition.
  const resume = (world: unknown) => runtime.resumeHatchableDiscovery(STEPPLING_HATCHABLE, world);
  return { resume, commands, setBlocked: (value: boolean) => { block = value; }, current: () => run };
}
const ticketed = (state: MergeWorldState) => reduceMergeWorld(state, { type: 'payHatchableMission', companion: 'steppling', receiptId: 'story:glow-steppling-v1:ticket', now: NOW });

test('the ticket is the tile’s price, paid once at the bubble; the board opens on it and the reveal then charges nothing', () => {
  const initial = restored(100);
  const paid = ticketed(initial);
  assert.equal(paid.changed, true);
  assert.equal(paid.state.coins, initial.coins - 20, 'the tile’s 20 Glow left the counter');
  assert.deepEqual(paid.state.hatchableMissions?.steppling, { paidAt: NOW, paidCoins: 20, receiptId: 'story:glow-steppling-v1:ticket' });
  const again = ticketed(paid.state);
  assert.equal(again.changed, false, 'a second payment for the same run is a no-op');
  assert.equal(again.message, undefined);
  const short = ticketed({ ...initial, coins: 19 });
  assert.equal(short.changed, false);
  assert.match(short.message ?? '', /earn more Glow/);
  const asleep = reduceMergeWorld(initial, { type: 'payHatchableMission', companion: 'baristabbit', receiptId: 'story:glow-baristabbit-v1:ticket', now: NOW });
  assert.equal(asleep.changed, false, 'a sleeping tile sells no ticket');
  assert.match(asleep.message ?? '', /Mist keeps/);
  const revealed = reduceMergeWorld(paid.state, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'story-purchase', now: NOW + 1 });
  assert.equal(revealed.state.coins, paid.state.coins, 'the reveal after the board is free');
  assert.equal(revealed.storyWorldMutationReceipt?.coinCost, 0);
  assert.equal(revealed.storyWorldMutationReceipt?.economyMode, 'free');
  assert.equal(revealed.state.worldUnlocks?.['mossprout:overgrown-trail']?.paid, 20, 'the unlock remembers what the ticket cost');
  assert.equal(ticketed(revealed.state).changed, false, 'no ticket once the tile is revealed');
  const unpaidReveal = reduceMergeWorld(initial, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'old-save', now: NOW + 1 });
  assert.equal(unpaidReveal.state.coins, initial.coins - 20, 'a save mid-board without a ticket still pays at the reveal');
  assert.equal(unpaidReveal.storyWorldMutationReceipt?.economyMode, 'normal');
  // The ticket survives a normalize, and a free reveal receipt repairs a lost unlock like a paid one.
  const normalized = normalizeMergeWorldState(JSON.parse(JSON.stringify(paid.state)));
  assert.deepEqual(normalized.hatchableMissions, paid.state.hatchableMissions);
  const lostUnlock = normalizeMergeWorldState({ ...JSON.parse(JSON.stringify(revealed.state)), worldUnlocks: {} });
  assert.ok(lostUnlock.worldUnlocks?.['mossprout:overgrown-trail'], 'the unlock is rebuilt from its free receipt');
  assert.equal(worldUpgradeOffers(paid.state).find((offer) => offer.id === 'mist:steppling-home')?.cost, 0, 'nothing on the tile costs Glow again');
  assert.equal(worldUpgradeOffers(paid.state).find((offer) => offer.id === 'mist:steppling-home')?.action, 'Open the board');
  assert.equal(worldUpgradeOffers(paid.state).find((offer) => offer.id === 'mist:steppling-home')?.hatchable?.state, 'board');
});

test('a paid ticket opens the board once; repeated resumes never send another command, and an unpaid save never opens it', async () => {
  const { resume, commands } = mistUpgradeRuntime();
  const unpaid = await resume(restored());
  assert.equal(unpaid.run.nodeId, 'gateway.pay');
  assert.deepEqual(commands, [], 'nothing moves without the ticket');
  const paid = ticketed(restored()).state;
  const [first, second] = await Promise.all([resume(paid), resume(paid)]);
  assert.equal(first.run.nodeId, 'mission.focus');
  assert.equal(second.run.nodeId, 'mission.focus');
  assert.deepEqual(commands, ['glow.mission.paid'], 'the paid event is recorded once');
  assert.equal((await resume(paid)).run.nodeId, 'mission.focus');
  assert.deepEqual(commands, ['glow.mission.paid']);
});

test('mist retries failed saves and never throws on an unchanged node, so no panel stays busy for ever', async () => {
  const { resume, commands, setBlocked } = mistUpgradeRuntime('mission.clear', 'failed_recoverable');
  setBlocked(true);
  const stuck = await resume(restored());
  assert.equal(stuck.run.status, 'failed_recoverable', 'a blocked retry is reported, not thrown');
  setBlocked(false);
  assert.equal((await resume(restored())).run.status, 'active');
  assert.deepEqual(commands, ['retry', 'retry']);
  const garden = mistUpgradeRuntime('garden.open');
  assert.equal((await garden.resume(restored())).blockedBy, 'garden', 'the Garden lesson comes first');
  const unknown = mistUpgradeRuntime('gateway.offer');
  assert.equal((await unknown.resume(ticketed(restored()).state)).run.nodeId, 'mission.focus', 'an unmigrated node is retried into the pay step');
  assert.deepEqual(unknown.commands, ['retry', 'glow.mission.paid']);
});

test('already paid mist resumes its reveal without another charge; unpaid mist is never auto-purchased', async () => {
  const { resume, commands } = mistUpgradeRuntime('gateway.pay');
  const initial = restored();
  assert.equal((await resume(initial)).run.nodeId, 'gateway.pay');
  assert.deepEqual(commands, []);
  const paid = reduceMergeWorld(initial, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'earlier-purchase', now: NOW }).state;
  // An old paid save plays the mission too; its receipt-backed reveal then charges zero.
  assert.equal((await resume(paid)).run.nodeId, 'mission.focus');
  const resumed = reduceMergeWorld(paid, { type: 'unlockWorldTarget', targetId: 'mossprout:overgrown-trail', receiptId: 'recovered-story-purchase', now: NOW + 1 });
  assert.equal(resumed.state.coins, paid.coins);
  assert.equal(resumed.storyWorldMutationReceipt?.coinCost, 0);
});

test('enough Glow returns straight to the pay step with no camera acknowledgement', () => {
  const initial = { ...createContentFlowRun(GLOW_DISCOVERY_FLOW, { runId: 'return-with-glow', now: NOW }), nodeId: 'gateway.ready' };
  const ready = stabilizeContentFlow(GLOW_DISCOVERY_FLOW, initial).run;
  const returned = reduceContentFlow(GLOW_DISCOVERY_FLOW, ready, { type: 'submit_scene', actionId: 'return' });
  assert.equal(returned.run.nodeId, 'gateway.pay');
  assert.equal(returned.pendingWork.kind, 'none');
  assert.equal(GLOW_DISCOVERY_FLOW.migrations?.['gateway.return'], 'gateway.pay');
  assert.equal(GLOW_DISCOVERY_FLOW.migrations?.['gateway.offer'], 'gateway.pay');
});

test('a save stuck in the old return-camera or offer step pays first, with no camera callback', async () => {
  for (const nodeId of ['gateway.return', 'gateway.ready', 'gateway.offer']) {
    const { resume, commands } = mistUpgradeRuntime(nodeId);
    assert.equal((await resume(ticketed(restored()).state)).run.nodeId, 'mission.focus');
    assert.deepEqual(commands, [nodeId === 'gateway.ready' ? 'return' : 'retry', 'glow.mission.paid']);
    assert.equal(commands.includes('unlock'), false);
  }
});

test('returning to mist exposes the upgrade bubble until its ticket is paid', async () => {
  const offers = worldUpgradeOffers(restored());
  for (const nodeId of ['gateway.ready', 'gateway.pay', 'gateway.return', 'gateway.offer']) {
    const visible = visibleWorldUpgradeOffers(offers, 'companion.meditating', { nodeId, status: 'active' });
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, 'mist:steppling-home');
    assert.equal(visible[0].cost, 20, 'the bubble carries the price');
    const { resume, commands } = mistUpgradeRuntime(nodeId);
    assert.equal(commands.length, 0, 'showing the bubble does not open or purchase automatically');
    await resume(restored());
    assert.equal(commands.includes('glow.mission.paid'), false, 'no ticket, no board');
    assert.equal(commands.includes('unlock'), false);
    assert.equal(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'gateway.pay', status: 'active' })[0].id,
      'mist:steppling-home', 'the bubble stays until it is paid');
  }
  assert.equal(visibleWorldUpgradeOffers(offers, undefined, { nodeId: 'gateway.pay', status: 'active' }, 'baristabbit-home').some((offer) => offer.id === 'mist:steppling-home'), false, 'another friend’s discovery never shows Steppling’s bubble');
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
    assert.equal(purchase.state.coins, 35);
    assert.ok(purchase.state.worldUnlocks?.['mossprout:overgrown-trail']);
    assert.equal(reduceMergeWorld(purchase.state, command).state.coins, 35);
    const poor = reduceMergeWorld({ ...state, coins: 19 }, command);
    assert.equal(poor.changed, false);
  }
  assert.equal(worldUpgradeOffers({ ...initial, coins: 55 }).find((offer) => offer.id === 'mist:steppling-home')?.eligible, true);
});


test('saved mist checkpoints restore one stable close-up without replaying purchase or egg framing', () => {
  const expected = { kind: 'focus_target', target: { kind: 'haven_gateway' }, zoom: 1.2, anchorY: 0.46, durationMs: 900 };
  for (const nodeId of ['garden.open', 'lesson.prepare', 'lesson.spawn', 'lesson.repeat.serve', 'gateway.ready', 'gateway.pay', 'gateway.return', 'gateway.offer']) {
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'active' }), expected);
    assert.deepEqual(glowDiscoveryResumeCamera({ nodeId, status: 'failed_recoverable' }), expected);
    assert.equal(glowDiscoveryResumeCamera({ nodeId, status: 'completed' }), null);
  }
  assert.deepEqual(glowDiscoveryResumeCamera({ nodeId: 'mission.clear', status: 'active' }), STEPPLING_MISSION_CAMERA, 'the mission board resumes with the opening’s framing');
  assert.equal(glowDiscoveryResumeCamera({ nodeId: 'mission.clear', status: 'completed' }), null);
  for (const nodeId of ['gateway.focus', 'mission.focus', 'gateway.purchase.focus', 'gateway.egg', 'egg.enter', 'complete']) {
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
  const module = loadNativeModule('features/onboarding/hatchable-runtime.ts', {
    'react': React,
    '@/features/content-flow/content-flow-catalog': { registerContentFlowDefinition() {} },
    '@/features/content-flow/content-flow-director': {},
    '@/features/content-flow/content-flow-repository': {
      loadContentFlowRun: () => saved, subscribeContentFlowJournal: () => () => {},
    },
    '@/utils/merge-world/glow-discovery-policy': {},
    '@/utils/merge-world/repository': {},
    '@/constants/hatchable-companions/registry': { HATCHABLE_COMPANIONS: [STEPPLING_HATCHABLE], hatchableByCompanion: () => null },
    './steppling-egg-policy': {}, './glow-discovery-flow': {}, './steppling-garden-lesson': {},
    './hatchable-flows': { hatchableFlows: () => ({ gardenLesson: { nodes: [{ id: 'gateway.pay' }], version: 2, migrations: {} } }), HATCHABLE_LESSON_FINALE_NODE_IDS: ['closing', 'summary'], HATCHABLE_MISSION_CLEAR_NODE_ID: 'mission.clear', HATCHABLE_MISSION_CLEARED_EVENT: 'glow.mission.cleared', HATCHABLE_EGG_ENTERED_EVENT: 'glow.egg.entered', HATCHABLE_MISSION_PAID_EVENT: 'glow.mission.paid', HATCHABLE_MISSION_PAY_NODE_ID: 'gateway.pay' },
  });
  let snapshot: { run: null | { status: 'active' }; ready: boolean };
  function Host() { const runs = module.useHatchableRuns(); snapshot = { run: runs.discovery.steppling ?? null, ready: runs.ready }; return null; }
  let tree: ReactTestRenderer;
  await act(async () => { tree = create(<Host />); });
  assert.equal(snapshot!.ready, false, 'do not briefly mount the top-level selector while loading');
  await act(async () => { finishLoad({ nodeId: 'gateway.pay', status: 'active' }); });
  assert.equal(snapshot!.ready, true);
  assert.equal(glowDiscoveryResumeWorld(snapshot!.run), 'mossprout');
  await act(async () => tree!.unmount());
});
