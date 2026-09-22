import assert from 'node:assert/strict';
import test from 'node:test';

import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { canUpgradeKatchimera, KATCHIMERA_LEVEL_GLOW, KATCHIMERA_LEVEL_XP, KATCHIMERA_MAX_LEVEL, katchimeraLevel, katchimeraProgress, katchimeraUpgradeCost, katchimeraXpForLevel, PLAYABLE_KATCHIMERAS } from '@/constants/katchimera-progression';
import type { MergeWorldState } from '@/types/merge-world';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';

const NOW = Date.UTC(2026, 8, 22, 9);

test('the curves climb, every playable Katchimera has an ability, and a fresh Katchimera is level one with nothing spent', () => {
  assert.equal(KATCHIMERA_LEVEL_XP.length, KATCHIMERA_MAX_LEVEL);
  assert.equal(KATCHIMERA_LEVEL_GLOW.length, KATCHIMERA_MAX_LEVEL - 1);
  for (let index = 1; index < KATCHIMERA_LEVEL_XP.length; index += 1) assert.ok(KATCHIMERA_LEVEL_XP[index]! > KATCHIMERA_LEVEL_XP[index - 1]!);
  for (let index = 1; index < KATCHIMERA_LEVEL_GLOW.length; index += 1) assert.ok(KATCHIMERA_LEVEL_GLOW[index]! > KATCHIMERA_LEVEL_GLOW[index - 1]!);
  for (const id of PLAYABLE_KATCHIMERAS) assert.ok(abilityForCompanion(id), `${id} has an ability`);
  const world = createInitialMergeWorldState(NOW, ['mossprout']);
  assert.deepEqual(katchimeraProgress(world, 'mossprout'), { level: 1, xp: 0, upgradedAt: null });
  assert.equal(katchimeraLevel(null, 'steppling'), 1);
  assert.equal(katchimeraXpForLevel(1), 0);
  assert.equal(katchimeraXpForLevel(2), 40);
  assert.equal(katchimeraUpgradeCost(1), 15);
  assert.equal(katchimeraUpgradeCost(KATCHIMERA_MAX_LEVEL), null);
});

test('a level-up needs the experience and the Glow, spends the Glow, changes nothing on a stale expected level, and stops at the top', () => {
  let world: MergeWorldState = { ...createInitialMergeWorldState(NOW, ['mossprout']), coins: 100 };
  assert.deepEqual(canUpgradeKatchimera(world, 'mossprout'), { ok: false, reason: 'xp', message: '40 more experience in the Mist first.' });
  const refused = reduceMergeWorld(world, { type: 'upgradeKatchimera', characterId: 'mossprout', expectedLevel: 1, now: NOW });
  assert.equal(refused.changed, false);
  assert.match(refused.message ?? '', /more experience/);
  world = { ...world, katchimeraProgress: { mossprout: { level: 1, xp: 45, upgradedAt: null } } };
  assert.deepEqual(canUpgradeKatchimera({ ...world, coins: 3 }, 'mossprout'), { ok: false, reason: 'glow', message: 'You need 12 more Glow.' });
  assert.deepEqual(canUpgradeKatchimera(world, 'mossprout'), { ok: true });
  const stale = reduceMergeWorld(world, { type: 'upgradeKatchimera', characterId: 'mossprout', expectedLevel: 2, now: NOW });
  assert.equal(stale.changed, false, 'a request against an older world does nothing');
  const upgraded = reduceMergeWorld(world, { type: 'upgradeKatchimera', characterId: 'mossprout', expectedLevel: 1, now: NOW });
  assert.equal(upgraded.changed, true);
  assert.equal(upgraded.state.coins, 85);
  assert.deepEqual(upgraded.state.katchimeraProgress?.mossprout, { level: 2, xp: 45, upgradedAt: NOW });
  assert.deepEqual(upgraded.katchimeraUpgraded, { characterId: 'mossprout', level: 2, cost: 15 });
  assert.equal(abilityTier(abilityForCompanion('mossprout')!, 2).chargeEvery, 7, 'the ability’s next tier comes with the level');
  // Experience keeps its total: the next step needs the cumulative amount.
  assert.deepEqual(canUpgradeKatchimera(upgraded.state, 'mossprout'), { ok: false, reason: 'xp', message: '55 more experience in the Mist first.' });
  const top: MergeWorldState = { ...world, coins: 10_000, katchimeraProgress: { mossprout: { level: KATCHIMERA_MAX_LEVEL, xp: 9_999, upgradedAt: NOW } } };
  assert.deepEqual(canUpgradeKatchimera(top, 'mossprout'), { ok: false, reason: 'top', message: 'Nothing more to learn here.' });
  assert.equal(reduceMergeWorld(top, { type: 'upgradeKatchimera', characterId: 'mossprout', expectedLevel: KATCHIMERA_MAX_LEVEL, now: NOW }).changed, false);
  // The progress survives a save.
  assert.deepEqual(normalizeMergeWorldState(JSON.parse(JSON.stringify(upgraded.state)), NOW).katchimeraProgress, upgraded.state.katchimeraProgress);
});
