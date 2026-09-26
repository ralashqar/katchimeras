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

test('a Surge’s battles are fair: every retake, and the Heart Tree’s defence', async () => {
  const { frontierRetakeMission, surgeDefenceMission } = await import('@/features/frontier/frontier-levels');
  for (const encounter of [...FRONTIER_TILES.map((tile) => frontierRetakeMission(tile).encounter), surgeDefenceMission().encounter]) {
    assert.equal(encounter.mechanic?.kind, 'lanes', encounter.id);
    const careful = lanesFairness(encounter, 'careful', 6);
    assert.ok(careful.wins >= 4, `${encounter.id}: the careful player won ${careful.wins} of 6`);
    assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0, `${encounter.id}: doing nothing must lose`);
  }
});

test('the first Surge is held at the Heart Tree and takes two edge tiles; then one a day, retaken for good', async () => {
  const { SURGE_DEFENCE_MISSION_ID, frontierRetakeMissionId, frontierHeldCount, frontierReclaimedCount, frontierContestedTiles } = await import('@/constants/frontier-tiles');
  const { frontierRetakeMission, surgeDefenceMission } = await import('@/features/frontier/frontier-levels');
  const { lodgeTimberWaiting, LODGE_PRODUCTION_INTERVAL_MS } = await import('@/constants/hero-buildings');
  let world = createInitialMergeWorldState(0);
  const clears = Object.fromEntries(['frontier-1', 'frontier-2', 'frontier-3', 'frontier-4'].map((id) => [frontierMissionId(id), { firstClearedAt: 1, clears: 1, bestGrade: 'bright', lastKatchimeraId: 'mossprout' }]));
  world = { ...world, heartTree: { receiptId: 't', restoredAt: 0, level: 2 }, encounters: { ...world.encounters, clears }, heroBuildings: { 'explorers-lodge': { level: 1, builtAt: 0 } } } as typeof world;
  assert.equal(reduceMergeWorld(world, { type: 'mistSurge', dayId: '2026-09-27', now: 5 }).changed, false, 'no Surge before the first is held');
  const defence = surgeDefenceMission();
  const held = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'd', missionId: SURGE_DEFENCE_MISSION_ID, katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'bright' } as never, difficulty: defence.difficulty, base: defence.rewards, now: Date.UTC(2026, 8, 26, 12) });
  assert.equal(held.encounterCleared?.surged?.length, 2, 'the Mist took two edge tiles while the Tree was held');
  world = held.state;
  assert.equal(frontierContestedTiles(world).length, 2);
  assert.equal(frontierReclaimedCount(world), 4, 'the chapters still count them');
  assert.equal(frontierHeldCount(world), 2, 'the Lodge does not');
  assert.equal(lodgeTimberWaiting(world, LODGE_PRODUCTION_INTERVAL_MS * 100), 4 + 4 + 2, 'store: the Lodge’s own and the held land');
  assert.equal(nextFrontierTile(world)?.id, frontierContestedTiles(world)[0]!.id, 'contested land is fought for first');
  assert.equal(reduceMergeWorld(world, { type: 'mistSurge', dayId: world.frontierSurges!.lastDay!, now: 6 }).changed, false, 'one Surge a day');
  const tile = frontierContestedTiles(world)[0]!;
  const retake = frontierRetakeMission(tile);
  const retaken = reduceMergeWorld(world, { type: 'completeEncounter', receiptId: 'r', missionId: frontierRetakeMissionId(tile.id), katchimeraId: 'mossprout', helperWispId: null, outcome: { cleared: true, grade: 'bright' } as never, difficulty: retake.difficulty, base: retake.rewards, now: 7 });
  assert.equal(retaken.encounterCleared?.reclaimed?.tileId, tile.id);
  assert.equal(frontierTileStates(retaken.state)[tile.id], 'reclaimed');
  const next = reduceMergeWorld(retaken.state, { type: 'mistSurge', dayId: '2099-01-01', now: 8 });
  assert.equal(next.mistSurged?.length, 1, 'a new day takes one');
  assert.ok(frontierContestedTiles(next.state).length <= 3, 'never more than three at once');
});
