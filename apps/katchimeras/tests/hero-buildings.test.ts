import assert from 'node:assert/strict';
import test from 'node:test';

import { heroBuildingCost, heroBuildingLook, heroLevelCap, lodgeCrateGlowBonus, lodgeTimberBonus } from '@/constants/hero-buildings';
import { canUpgradeKatchimera } from '@/constants/katchimera-progression';
import { heroBuildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { MergeWorldState } from '@/types/merge-world';

const stepplingHome = (world: MergeWorldState): MergeWorldState => reduceMergeWorld(world, { type: 'rescueWorldFriend', targetId: 'mossprout:overgrown-trail', now: 1_500 }).state;

test('the Explorer’s Lodge is built with Glow and Timber, once Steppling is home, and grows through three looks', () => {
  const cost = heroBuildingCost(0)!;
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, materials: { timber: 100 } };
  assert.equal(reduceMergeWorld(base, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 0, now: 2_000 }).changed, false, 'not before Steppling is home');
  const home = stepplingHome(base);
  assert.equal(heroBuildingUpgradeModel(home, 'explorers-lodge').primary?.label, 'Build');
  assert.equal(reduceMergeWorld({ ...home, materials: { timber: cost.timber - 1 } }, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 0, now: 2_000 }).changed, false, 'short of Timber');
  const built = reduceMergeWorld(home, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 0, now: 2_000 });
  assert.equal(built.changed, true);
  assert.equal(built.state.heroBuildings?.['explorers-lodge']?.level, 1);
  assert.equal(built.state.coins, home.coins - cost.glow);
  assert.equal(built.state.materials?.timber, 100 - cost.timber);
  assert.equal(reduceMergeWorld(built.state, { type: 'upgradeHeroBuilding', id: 'explorers-lodge', expectedLevel: 0, now: 2_001 }).changed, false, 'a second tap is already done');
  assert.deepEqual([1, 3, 4, 6, 7, 10].map(heroBuildingLook), [0, 0, 1, 1, 2, 2], 'three looks: 1-3, 4-6, 7-10');
  assert.deepEqual([lodgeTimberBonus(1), lodgeTimberBonus(2), lodgeCrateGlowBonus(3)], [0, 1, 9]);
});

test('a hero grows no further than one past their building', () => {
  const home = stepplingHome({ ...createInitialMergeWorldState(1_000), coins: 5_000, materials: { timber: 0, meals: 500 } });
  assert.equal(heroLevelCap(home, 'steppling'), 1, 'no Lodge: Steppling stays at level 1');
  assert.equal(heroLevelCap(home, 'mossprout'), null, 'a hero with no building has no cap');
  const trained = { ...home, katchimeraProgress: { steppling: { level: 1, xp: 99_999, upgradedAt: null } } };
  const blocked = canUpgradeKatchimera(trained, 'steppling');
  assert.equal(blocked.ok, false);
  assert.equal(!blocked.ok && blocked.reason, 'building');
  assert.equal(reduceMergeWorld(trained, { type: 'upgradeKatchimera', characterId: 'steppling', expectedLevel: 1, now: 3_000 } as never).changed, false);
  const lodged = { ...trained, heroBuildings: { 'explorers-lodge': { level: 1, builtAt: 2_000 } } };
  assert.equal(canUpgradeKatchimera(lodged, 'steppling').ok, true, 'a Lodge at level 1 lets him reach level 2');
});

test('Petalimp’s Bloom House: built once her island campaign brings her home, it grows the island’s art and quickens Seeds in battle', async () => {
  const { bloomSeedPace, heroTileLayerId, heroTileSlot } = await import('@/constants/hero-buildings');
  const { heroTileLook } = await import('@/constants/hero-building-art');
  const { encounterProfile } = await import('@/features/encounter/spawner-profile');
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, materials: { timber: 100 }, heartTree: { receiptId: 't', restoredAt: 1, level: 1 } };
  assert.equal(reduceMergeWorld(base, { type: 'upgradeHeroBuilding', id: 'bloom-house', expectedLevel: 0, now: 2_000 }).changed, false, 'not before Petalimp is home');
  const home = { ...base, islandCampaigns: { 'island-campaign:petalimp-bloom': { cardEarnedAt: 1_500 } } } as unknown as MergeWorldState;
  assert.equal(heroBuildingUpgradeModel(home, 'bloom-house').primary?.label, 'Build');
  const built = reduceMergeWorld(home, { type: 'upgradeHeroBuilding', id: 'bloom-house', expectedLevel: 0, now: 2_000 });
  assert.equal(built.changed, true);
  assert.equal(encounterProfile(built.state, null).seedPace, bloomSeedPace(1));
  assert.equal(bloomSeedPace(10), 0.4);
  assert.equal(heroTileLayerId('bloom-garden'), 'nature:mossprout:bloom-garden', 'it stands on the island');
  assert.equal(heroTileLayerId('steppling-home'), 'structure:steppling-home');
  assert.deepEqual([0, 1, 4, 7].map(heroTileSlot), [0, 1, 2, 3]);
  assert.equal(heroTileLook('bloom-garden', 0), null, 'unbuilt: the island’s own art');
  assert.ok(heroTileLook('bloom-garden', 1), 'built: the Petal Cottage');
  assert.equal(heroTileLook('steppling-home', 1), null, 'the Lodge’s first look is the trailhead’s own hut');
});

test('Fernip’s Thicket: built once Fernip is home, it slows a Lanes battle’s wisps, and Chapter 5 asks for it first', async () => {
  const { fernWispSlow, heroTileLayerId } = await import('@/constants/hero-buildings');
  const { encounterProfile } = await import('@/features/encounter/spawner-profile');
  const { encounterMechanicHost } = await import('@/features/encounter/adapt');
  const { islandLevel } = await import('@/constants/island-campaigns/island-levels');
  const { SANCTUARY_CHAPTERS } = await import('@/constants/sanctuary-chapters');
  const base = { ...createInitialMergeWorldState(1_000), coins: 500, materials: { timber: 100 }, heartTree: { receiptId: 't', restoredAt: 1, level: 1 } };
  assert.equal(reduceMergeWorld(base, { type: 'upgradeHeroBuilding', id: 'fern-thicket', expectedLevel: 0, now: 2_000 }).changed, false, 'not before Fernip is home');
  const home = { ...base, islandCampaigns: { 'island-campaign:fernip-wildgrowth': { cardEarnedAt: 1_500 } } } as unknown as MergeWorldState;
  const built = reduceMergeWorld(home, { type: 'upgradeHeroBuilding', id: 'fern-thicket', expectedLevel: 0, now: 2_000 });
  assert.equal(built.changed, true);
  const profile = encounterProfile(built.state, null);
  assert.equal(profile.wispSlow, fernWispSlow(1));
  assert.equal(heroTileLayerId('wildgrowth-grove'), 'nature:mossprout:wildgrowth-grove');
  const encounter = islandLevel('test', 'lanes', { title: 'T', objective: 'O', difficulty: 'calm', pieces: [], mist: [], wisps: [], lanes: [{ id: 'a', column: 1, at: 0, hp: 3, step: 2 }] } as never).encounter;
  const plain = encounterMechanicHost(encounter).mechanic;
  const slowed = encounterMechanicHost(encounter, { wispSlow: 0.3 }).mechanic;
  assert.ok(plain?.kind === 'lanes' && slowed?.kind === 'lanes');
  assert.equal(slowed.wisps[0]!.stepMs, Math.round(plain.wisps[0]!.stepMs * 1.3), 'every row takes 30% longer');
  const blossle = SANCTUARY_CHAPTERS.find((chapter) => chapter.id === 'seed-keeper')!;
  assert.deepEqual(blossle.goals[0]!.action, { kind: 'hero_building', id: 'fern-thicket' });
});
