import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_TILES, frontierTileStates } from '@/constants/frontier-tiles';
import { HOLLOW_REACHES_HOMES, hexDistance, REGIONS, regionRing } from '@/constants/regions';
import { DAWNLE_FRIEND, REGION_FRIENDS, regionFriendHome, regionFriendRescueId } from '@/constants/region-friends';
import { abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { playableHeroes } from '@/constants/katchimera-progression';
import { lanesFairness } from '@/features/encounter/lanes-playtest';
import { regionRescueMission } from '@/features/regions/region-rescue';
import { HOLLOW_TREE_FINALE_ID } from '@/constants/finale';
import { createInitialMergeWorldState } from '@/utils/merge-world/engine';

test('the wide world is a flower: six landmarks four cells out, each region its own cells, none in the Sanctuary', () => {
  assert.equal(REGIONS.length, 6);
  for (const region of REGIONS) assert.equal(hexDistance(region.landmark, { q: 0, r: 0 }), 4, `${region.id} stands four out`);
  const seen = new Set<string>();
  for (const region of REGIONS) {
    for (const cell of [...regionRing(region.id, 1), ...regionRing(region.id, 2)]) {
      const key = `${cell.q},${cell.r}`;
      assert.ok(!seen.has(key), `${key} belongs to one region only`);
      seen.add(key);
      assert.ok(hexDistance(cell, { q: 0, r: 0 }) > 3, `${key} is outside the Sanctuary`);
    }
  }
  const homes = Object.values(HOLLOW_REACHES_HOMES).map((cell) => `${cell.q},${cell.r}`).sort();
  assert.deepEqual(homes, regionRing('hollow-reaches', 1).map((cell) => `${cell.q},${cell.r}`).sort(), 'the Reaches’ homes are the Hollow Tree’s first ring');
});

test('the Hollow Reaches’ land is lit once the Hollow Tree is awake', () => {
  const reaches = FRONTIER_TILES.filter((tile) => tile.region === 'hollow-reaches');
  assert.ok(reaches.length >= 5);
  const fresh = { ...createInitialMergeWorldState(0), heartTree: { receiptId: 't', restoredAt: 0, level: 8 } } as ReturnType<typeof createInitialMergeWorldState>;
  assert.ok(reaches.every((tile) => frontierTileStates(fresh)[tile.id] === 'dark'), 'dark before the finale');
  const awake = { ...fresh, encounters: { ...fresh.encounters!, clears: { [HOLLOW_TREE_FINALE_ID]: { firstClearedAt: 1, clears: 1, bestGrade: 'bright', lastKatchimeraId: 'mossprout' } } } } as typeof fresh;
  assert.ok(reaches.every((tile) => frontierTileStates(awake)[tile.id] === 'misted'), 'lit after it');
});

test('Dawnle, the Reaches’ keeper: a fair Lanes rescue, then a hero with First Light', () => {
  for (const friend of REGION_FRIENDS) {
    const encounter = regionRescueMission(friend).encounter;
    assert.equal(encounter.objective.kind, 'rescue');
    assert.ok(lanesFairness(encounter, 'careful', 6).wins >= 4, `${friend.name}: a careful player wins`);
    assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0);
    for (const line of friend.rescue.arrival?.lines ?? []) assert.ok(!line.text.includes('!'), 'the Mist’s voice');
  }
  const world = createInitialMergeWorldState(0);
  assert.equal(regionFriendHome(world, 'dawnle'), false);
  const home = { ...world, encounters: { ...world.encounters!, clears: { [regionFriendRescueId('dawnle')]: { firstClearedAt: 1, clears: 1, bestGrade: 'bright', lastKatchimeraId: 'mossprout' } } } } as typeof world;
  assert.ok(playableHeroes(home).includes('dawnle'), 'a hero once home');
  const ability = abilityForCompanion('dawnle')!;
  assert.equal(ability.id, 'first-light');
  assert.ok(abilityTier(ability, 10).chargeEvery < abilityTier(ability, 1).chargeEvery);
  assert.equal(DAWNLE_FRIEND.region, 'hollow-reaches');
});
