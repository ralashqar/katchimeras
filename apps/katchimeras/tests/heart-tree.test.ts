import assert from 'node:assert/strict';
import test from 'node:test';

import { buildingLevelCap, heartTreeCost, heartTreeLevel, heartTreeStage } from '@/constants/heart-tree';
import { LODGE_PRODUCTION_INTERVAL_MS, lodgeTimberStore, lodgeTimberWaiting } from '@/constants/hero-buildings';
import { sanctuaryChapterState } from '@/constants/sanctuary-chapters';
import { heartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { heartTreeUpgradeModel, heroBuildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

const awake = (world: MergeWorldState, level = 1): MergeWorldState => ({ ...world, heartTree: { receiptId: 'test:heart-tree', restoredAt: 1_000, level } });
const stepplingHome = (world: MergeWorldState): MergeWorldState => reduceMergeWorld(world, { type: 'rescueWorldFriend', targetId: 'mossprout:overgrown-trail', now: 1_500 }).state;

test('the Heart Tree grows a level with Glow and Timber, once per level, and its stage follows', () => {
  const cost = heartTreeCost(1)!;
  const base = { ...createInitialMergeWorldState(1_000), coins: 1_000, materials: { timber: 100 } };
  assert.equal(heartTreeLevel(base), 0);
  assert.equal(reduceMergeWorld(base, { type: 'upgradeHeartTree', expectedLevel: 0, now: 2_000 }).changed, false, 'still asleep: the first session wakes it');
  const tree = awake(base);
  assert.equal(heartTreeUpgradeModel(tree).primary?.label, 'Grow');
  const short = reduceMergeWorld({ ...tree, materials: { timber: cost.timber - 1 } }, { type: 'upgradeHeartTree', expectedLevel: 1, now: 2_000 });
  assert.equal(short.changed, false);
  assert.match(short.message ?? '', /Timber/);
  const grown = reduceMergeWorld(tree, { type: 'upgradeHeartTree', expectedLevel: 1, now: 2_000 });
  assert.equal(grown.changed, true);
  assert.equal(heartTreeLevel(grown.state), 2);
  assert.equal(grown.state.coins, 1_000 - cost.glow);
  assert.equal(grown.state.materials?.timber, 100 - cost.timber);
  assert.equal(reduceMergeWorld(grown.state, { type: 'upgradeHeartTree', expectedLevel: 1, now: 2_001 }).changed, false, 'a second tap is already done');
  assert.deepEqual([1, 2, 3, 5, 7, 8].map(heartTreeStage), ['stirring', 'stirring', 'rooted', 'blooming', 'awakened', 'awakened']);
  assert.equal(heartwoodStage(awake(base, 3)), 'rooted', 'the Heartwood art follows the Tree');
  assert.equal(heartTreeCost(8), null, 'fully grown');
});

test('nothing grows more than one level past the Heart Tree', () => {
  assert.equal(buildingLevelCap(1), 2);
  const home = awake(stepplingHome({ ...createInitialMergeWorldState(1_000), coins: 5_000, materials: { timber: 500 } }));
  const lodged = { ...home, heroBuildings: { 'explorers-lodge': { level: 2, builtAt: 2_000 } } };
  const blocked = reduceMergeWorld(lodged, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 2, now: 3_000 });
  assert.equal(blocked.changed, false);
  assert.equal(blocked.message, 'Grow the Heart Tree first.');
  const model = heroBuildingUpgradeModel(lodged, 'explorers-lodge');
  assert.equal(model.requirements.find((row) => row.id === 'heart-tree')?.met, false);
  assert.equal(model.primary?.disabled, true);
  const tall = awake(lodged, 2);
  assert.equal(reduceMergeWorld(tall, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 2, now: 3_000 }).changed, true, 'a level 2 Tree lets the Lodge reach 3');
});

test('the Explorer’s Lodge makes Timber while you are away, up to its store, collected once', () => {
  const built = 10_000;
  const world = { ...createInitialMergeWorldState(1_000), materials: { timber: 3 }, heroBuildings: { 'explorers-lodge': { level: 2, builtAt: built, collectedAt: built } } };
  assert.equal(lodgeTimberWaiting(world, built + LODGE_PRODUCTION_INTERVAL_MS - 1), 0, 'nothing before the first half hour');
  assert.equal(lodgeTimberWaiting(world, built + LODGE_PRODUCTION_INTERVAL_MS * 3 + 5), 6, 'level 2: two each half hour');
  assert.equal(lodgeTimberWaiting(world, built + LODGE_PRODUCTION_INTERVAL_MS * 100), lodgeTimberStore(2), 'capped at the store');
  const now = built + LODGE_PRODUCTION_INTERVAL_MS * 3 + 5;
  const collected = reduceMergeWorld(world, { type: 'collectHeroBuilding', id: 'explorers-lodge', now });
  assert.equal(collected.changed, true);
  assert.equal(collected.state.materials?.timber, 9);
  assert.equal(lodgeTimberWaiting(collected.state, now), 0);
  assert.equal(lodgeTimberWaiting(collected.state, built + LODGE_PRODUCTION_INTERVAL_MS * 4), 2, 'the part-made batch keeps its time');
  assert.equal(reduceMergeWorld(collected.state, { type: 'collectHeroBuilding', id: 'explorers-lodge', now }).changed, false, 'nothing left to collect');
});

test('Chapter 2 asks for the Heart Tree at level 2', () => {
  const chapter2 = { ...awake(createInitialMergeWorldState(1_000)), chaptersClaimed: ['home-for-two'] } as MergeWorldState;
  assert.equal(sanctuaryChapterState(chapter2)?.chapter.id, 'explorers-lodge');
  const withLodge = { ...chapter2, heroBuildings: { 'explorers-lodge': { level: 2, builtAt: 1 }, 'baristabbit-cafe': { level: 1, builtAt: 1 } }, supplyRun: { slots: [], served: 5, crates: 1 } } as unknown as MergeWorldState;
  assert.equal(sanctuaryChapterState(withLodge)?.goal?.action.kind, 'heart_tree');
  assert.equal(sanctuaryChapterState(awake(withLodge, 2))?.complete, true);
});
