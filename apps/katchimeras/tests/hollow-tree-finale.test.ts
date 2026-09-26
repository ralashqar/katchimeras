import assert from 'node:assert/strict';
import test from 'node:test';
import { HOLLOW_TREE_FINALE_SPEC, hollowTreeFinaleMission } from '@/features/finale/hollow-tree';
import { lanesFairness } from '@/features/encounter/lanes-playtest';
import { laneWisps } from '@/constants/island-campaigns/island-levels';

test('the finale plays in three phases: each comes where the last fell', () => {
  const wisps = laneWisps(HOLLOW_TREE_FINALE_SPEC.lanes!);
  const index = (id: string) => wisps.findIndex((wisp) => wisp.id === id);
  assert.deepEqual(wisps[index('remembering')]!.spawn, { by: index('heart'), on: 'death' });
  assert.deepEqual(wisps[index('light')]!.spawn, { by: index('remembering'), on: 'death' });
  assert.ok(wisps.some((wisp) => wisp.spawn?.on === 'call' && wisp.spawn.by === index('remembering')), 'the remembering keeper calls');
});

test('the finale is a boss: a careful player wins it, a novice rarely does, doing nothing never', () => {
  const encounter = hollowTreeFinaleMission().encounter;
  const careful = lanesFairness(encounter, 'careful', 6).wins;
  const novice = lanesFairness(encounter, 'careless', 6).wins;
  assert.ok(careful >= 4, `careful ${careful}/6`);
  assert.ok(novice <= 2, `novice ${novice}/6`);
  assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0);
});
