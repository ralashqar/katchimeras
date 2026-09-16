import assert from 'node:assert/strict';
import test from 'node:test';
import { STORY_TILES, storyTileById, storyTileByUnlock, storyTileRevealed, storyTileStates } from '@/constants/story-tiles/registry';
import { STORY_TILE_ART_IDS } from '@/constants/story-tiles/tile-art';
import { KINGDOM_HEX_TILE_ALPHA_BOUNDS } from '@/constants/kingdom-hex-tile-bounds.gen';
import { SHARED_WORLD_PURCHASES, SHARED_WORLD_TILES, sharedWorldPurchase } from '@/constants/shared-world';
import { HATCHABLE_COMPANIONS, hatchableByUnlock, STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/registry';
import { WORLD_UPGRADE_DEFINITIONS, worldUpgradeOffers } from '@/features/world-upgrades/world-upgrade-offers';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { WORLD_UNLOCK_CATALOG } from '@/utils/merge-world/glow-discovery-policy';
import { JOURNEY_MISSION_CLEAR_NODE_ID, journeyConsequenceFlow, journeyConsequenceRunId, journeyMissionOf } from '@/constants/companion-journey-chapters/consequence-flow';
import { STEPPLING_CHAPTER } from '@/constants/companion-journey-chapters/steppling';
import { activeJourneyMission, journeyMissionResumeCamera } from '@/features/companion/journey-consequence-state';
import { journeyConditionHolds } from '@/features/companion/journey-triggers';
import { emptyRelationshipProgressState } from '@/game/katchimeras/relationship-progression';
import { emptyCompanionBondState } from '@/utils/companion-bond';
import { emptyCompanionContentState } from '@/utils/companion-content';
import type { CompanionJourneyChapterDefinition, JourneyEpisodeDefinition } from '@/types/companion-journey-chapter';
import type { ContentFlowRun } from '@/types/content-flow';

const NOW = Date.UTC(2026, 8, 16, 9);
const GROVE = storyTileById('mossprout-old-grove')!;

test('story tiles are registered once: unique ids and coords apart from every other tile, art and bounds present, free in the shared world, on no marker', () => {
  assert.ok(GROVE, 'the Old Grove is a story tile');
  const ids = new Set<string>();
  // Islands live in the scene; the scene test proves no two layers share a hex.
  const coords = new Set(Object.entries(SHARED_WORLD_TILES).filter(([id]) => !storyTileById(id)).map(([, tile]) => `${tile.coord.q},${tile.coord.r}`));
  for (const tile of STORY_TILES) {
    assert.ok(!ids.has(tile.id), `${tile.id} once`); ids.add(tile.id);
    const coord = `${tile.coord.q},${tile.coord.r}`;
    assert.ok(!coords.has(coord), `${tile.id} sits on its own hex`); coords.add(coord);
    assert.ok(STORY_TILE_ART_IDS.includes(tile.id), `${tile.id} has revealed art`);
    assert.ok(tile.alphaBoundsKey in KINGDOM_HEX_TILE_ALPHA_BOUNDS, `${tile.id} has generated bounds`);
    assert.equal(storyTileByUnlock(tile.unlockId), tile);
    assert.equal(hatchableByUnlock(tile.unlockId), null, 'a story tile is nobody’s Egg');
    const shared = SHARED_WORLD_TILES[tile.id]!;
    assert.deepEqual(shared, { residentVisible: false, story: true, companion: tile.companion, coord: tile.coord, unlockId: tile.unlockId, price: 0, name: tile.name, revealPreset: 'mist-clear' });
    assert.equal(sharedWorldPurchase(tile.id)?.story, true, 'the engine and the capability registry know the tile');
    assert.equal(WORLD_UNLOCK_CATALOG[tile.unlockId]?.destination, tile.companion);
    assert.equal(WORLD_UPGRADE_DEFINITIONS.some((definition) => definition.id === `mist:${tile.id}`), false, 'no offer, no marker, no price');
  }
  assert.deepEqual(SHARED_WORLD_PURCHASES.filter((purchase) => purchase.story).map((purchase) => purchase.tileId), STORY_TILES.map((tile) => tile.id));
  const world = createInitialMergeWorldState(NOW);
  assert.equal(worldUpgradeOffers(world).some((offer) => offer.id === `mist:${GROVE.id}`), false);
});

test('a story tile’s reveal is free and from the Mist whoever is home, once per receipt, and survives normalisation', () => {
  let world = createInitialMergeWorldState(NOW);
  world = { ...world, coins: 7, companionDiscovery: { ...world.companionDiscovery, records: [...world.companionDiscovery.records, { characterId: 'mossprout', gateId: 'ftue', pathId: 'ftue', discoveredAt: NOW } as never] } };
  assert.equal(storyTileRevealed(world, GROVE), false);
  assert.deepEqual(storyTileStates(world), { [GROVE.id]: 'misted' });
  const first = reduceMergeWorld(world, { type: 'unlockWorldTarget', targetId: GROVE.unlockId, receiptId: 'journey:mossprout:old-garden:consequence:reveal.commit', now: NOW });
  assert.equal(first.changed, true);
  assert.equal(first.state.coins, 7, 'nothing is charged');
  assert.deepEqual(first.storyWorldMutationReceipt && { from: first.storyWorldMutationReceipt.fromLevel, to: first.storyWorldMutationReceipt.toLevel, mode: first.storyWorldMutationReceipt.economyMode, cost: first.storyWorldMutationReceipt.coinCost, target: first.storyWorldMutationReceipt.target },
    { from: 0, to: 1, mode: 'free', cost: 0, target: { kind: 'haven_structure', structureId: GROVE.id } }, 'the reveal crossfades from the mist even though Mossprout is home');
  assert.equal(storyTileRevealed(first.state, GROVE), true);
  const replay = reduceMergeWorld(first.state, { type: 'unlockWorldTarget', targetId: GROVE.unlockId, receiptId: 'journey:mossprout:old-garden:consequence:reveal.commit', now: NOW + 1 });
  assert.equal(replay.changed, false);
  assert.equal(replay.storyWorldMutationReceipt?.id, first.storyWorldMutationReceipt?.id, 'a replayed receipt returns the saved one');
  const restored = normalizeMergeWorldState(JSON.parse(JSON.stringify(first.state)), NOW + 2);
  assert.equal(storyTileRevealed(restored, GROVE), true);
  assert.equal(restored.storyWorldMutationReceipts.some((receipt) => receipt.target.kind === 'haven_structure' && receipt.target.structureId === GROVE.id), true);
  const facts = { familyId: 'mossprout', now: NOW, world: first.state, relationships: emptyRelationshipProgressState(), bond: emptyCompanionBondState(), content: emptyCompanionContentState(), dayOneComplete: true };
  assert.equal(journeyConditionHolds({ kind: 'story_tile_revealed', tileId: GROVE.id }, STEPPLING_CHAPTER, 0, facts), true);
  assert.equal(journeyConditionHolds({ kind: 'story_tile_revealed', tileId: GROVE.id }, STEPPLING_CHAPTER, 0, { ...facts, world }), false);
});

const { camera: _camera, ...MISSION } = STEPPLING_HATCHABLE.mission;
const FIXTURE_CHAPTER: CompanionJourneyChapterDefinition = {
  ...STEPPLING_CHAPTER, familyId: 'steppling', chapterId: 'fixture', title: 'Fixture',
  episodes: [
    { id: 'reveal', title: 'The Old Garden', flavour: 'companion', unlock: [], consequence: { kind: 'reveal_story_tile', tileId: GROVE.id } },
    { id: 'wisp', title: 'The Wisp in the Grove', flavour: 'adventure', unlock: [], consequence: { kind: 'mist_mission', tileId: GROVE.id, mission: { ...MISSION, id: 'mission:fixture', storageKey: 'katchimeras.mist-mission.fixture.v1' } } },
    { id: 'island', title: 'Somewhere Found', flavour: 'adventure', unlock: [], consequence: { kind: 'reveal_island', islandId: 'seed-nursery' } },
    { id: 'gift', title: 'What the Grove Kept', flavour: 'companion', unlock: [], consequence: { kind: 'grant', generatorId: STEPPLING_HATCHABLE.economy.generatorId, rewardId: 'journey:fixture:gift' } },
    { id: 'plain', title: 'Nothing Changes', flavour: 'personal', unlock: [] },
  ],
};

test('every consequence kind compiles to a story flow the Kingdom can run: camera, board, free reveal, parcel', () => {
  const flows = FIXTURE_CHAPTER.episodes.map((episode) => [episode, journeyConsequenceFlow(FIXTURE_CHAPTER, episode)] as const);
  assert.equal(flows[4]![1], null, 'an episode without a consequence has no flow');
  for (const [episode, flow] of flows.slice(0, 4)) {
    assert.ok(flow, `${episode.id} has a flow`);
    assert.equal(flow.id, journeyConsequenceRunId('steppling', episode.id));
    assert.deepEqual(validateContentFlowDefinition(flow), [], `${flow.id} compiles`);
    assert.ok(flow.nodes.some((node) => node.kind === 'complete'));
    for (const node of flow.nodes) if (node.kind === 'effect' && node.capability === 'world.upgrade') assert.equal((node.payload as { economy: { mode: string } }).economy.mode, 'free', 'the episode was the price');
  }
  const reveal = flows[0]![1]!;
  assert.equal(reveal.entryNodeId, 'focus');
  assert.deepEqual(reveal.nodes.map((node) => node.id), ['focus', 'reveal.focus', 'reveal.commit', 'reveal.reveal', 'complete']);
  const wisp = flows[1]![1]!;
  assert.deepEqual(wisp.nodes.map((node) => node.id), ['mission.focus', JOURNEY_MISSION_CLEAR_NODE_ID, 'reveal.focus', 'reveal.commit', 'reveal.reveal', 'complete']);
  const task = wisp.nodes.find((node) => node.id === JOURNEY_MISSION_CLEAR_NODE_ID)!;
  assert.ok(task.kind === 'task' && task.capability === 'journey.mission' && task.surface === 'haven');
  const mission = journeyMissionOf(FIXTURE_CHAPTER.episodes[1]!)!;
  assert.deepEqual(mission.mission.camera, { kind: 'focus_target', target: { kind: 'haven_structure', structureId: GROVE.id }, zoom: 0.96, anchorY: mission.mission.camera.kind === 'focus_target' ? mission.mission.camera.anchorY : 0, durationMs: 900 });
  assert.equal(journeyMissionOf(FIXTURE_CHAPTER.episodes[0]!), null);
  assert.equal(activeJourneyMission({ ready: true, runs: {} }), null, 'no chapter has a Dark Wisp yet');
  assert.equal(journeyMissionResumeCamera(null), null);
  const island = flows[2]![1]!;
  const commit = island.nodes.find((node) => node.id === 'reveal.commit')!;
  assert.ok(commit.kind === 'effect' && (commit.payload as { transition?: string }).transition === 'island_reveal');
  const gift = flows[3]![1]!;
  assert.equal(gift.entryNodeId, 'grant');
  assert.throws(() => journeyConsequenceFlow(FIXTURE_CHAPTER, { ...FIXTURE_CHAPTER.episodes[0]!, consequence: { kind: 'reveal_story_tile', tileId: 'nowhere' } } as JourneyEpisodeDefinition), /unknown story tile/);
  void ({} as ContentFlowRun);
});

test('the shared world still lists every hatchable friend before the story tiles', () => {
  assert.deepEqual(Object.keys(SHARED_WORLD_TILES).slice(0, 1 + HATCHABLE_COMPANIONS.length), ['mossprout-home', ...HATCHABLE_COMPANIONS.map((definition) => definition.tile.id)]);
});
