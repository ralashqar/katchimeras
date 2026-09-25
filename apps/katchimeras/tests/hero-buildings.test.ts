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
  const home = stepplingHome({ ...createInitialMergeWorldState(1_000), coins: 5_000 });
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
