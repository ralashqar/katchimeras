import assert from 'node:assert/strict';
import test from 'node:test';
import { FRONTIER_TILES, frontierMissionId, frontierTileStates, nextFrontierTile, nextFrontierTreeLevel, frontierReclaimTimber } from '@/constants/frontier-tiles';
import { frontierMission } from '@/features/frontier/frontier-levels';
import { lanesFairness } from '@/features/encounter/lanes-playtest';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';

test('the Frontier fills the empty second ring and all of the third, never twice on a cell', () => {
  const cells = FRONTIER_TILES.map((tile) => `${tile.coord.q},${tile.coord.r}`);
  assert.equal(new Set(cells).size, cells.length);
  assert.equal(FRONTIER_TILES.filter((tile) => tile.ring === 2).length, 5);
  assert.equal(FRONTIER_TILES.filter((tile) => tile.ring === 3).length, 18);
  for (const tile of FRONTIER_TILES) {
    const d = Math.max(Math.abs(tile.coord.q), Math.abs(tile.coord.r), Math.abs(tile.coord.q + tile.coord.r));
    assert.equal(d, tile.ring, `${tile.id} sits on its ring`);
  }
  // The Hollow Tree's doorstep is the last lit.
  const last = [...FRONTIER_TILES].sort((a, b) => b.tree - a.tree)[0]!;
  assert.deepEqual(last.coord, { q: 0, r: -3 });
});

test('every Frontier battle is plants that shoot, fair to a careful player and lost by doing nothing', () => {
  for (const tile of FRONTIER_TILES) {
    const encounter = frontierMission(tile).encounter;
    assert.equal(encounter.mechanic?.kind, 'lanes', tile.id);
    const careful = lanesFairness(encounter, 'careful', 6);
    assert.ok(careful.wins >= 4, `${tile.id} (${tile.variant}, power ${tile.power}): the careful player won ${careful.wins} of 6`);
    assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0, `${tile.id}: doing nothing must lose`);
    if (encounter.difficulty === 'calm') {
      const novice = lanesFairness(encounter, 'careless', 6).wins;
      assert.ok(novice >= 3, `${tile.id}: a novice won ${novice} of 6`);
    }
  }
});

test('the Tree’s light reaches the Frontier ring by ring; a won battle takes the land back, with its Timber, once', () => {
  let world = createInitialMergeWorldState(0);
  world = { ...world, heartTree: { receiptId: 't', restoredAt: 0, level: 1 } } as typeof world;
  const states = frontierTileStates(world);
  assert.equal(Object.values(states).filter((state) => state === 'misted').length, 5, 'Tree 1 lights the second ring');
  assert.equal(nextFrontierTreeLevel(world), 2);
  const tile = nextFrontierTile(world)!;
  assert.equal(tile.id, 'frontier-1');
  const mission = frontierMission(tile);
  const win = (receiptId: string) => reduceMergeWorld(world, { type: 'completeEncounter', receiptId, missionId: frontierMissionId(tile.id), katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'bright' } as never, difficulty: mission.difficulty, base: mission.rewards, now: 10 });
  const won = win('a');
  assert.equal(won.encounterCleared?.reclaimed?.tileId, tile.id);
  assert.equal(won.state.materials?.timber ?? 0, (world.materials?.timber ?? 0) + frontierReclaimTimber(tile));
  assert.equal(frontierTileStates(won.state)[tile.id], 'reclaimed');
  world = won.state;
  const again = win('b');
  assert.equal(again.encounterCleared?.reclaimed, undefined, 'the land is given once');
  assert.equal(nextFrontierTile(won.state)?.id, 'frontier-2');
});
