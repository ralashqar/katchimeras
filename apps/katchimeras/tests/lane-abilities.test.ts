import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPANION_ABILITIES, abilityForCompanion, abilityTier } from '@/constants/companion-abilities';
import { ISLAND_HEROES, PLAYABLE_KATCHIMERAS, playableHeroes } from '@/constants/katchimera-progression';
import { islandLevel } from '@/constants/island-campaigns/island-levels';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { applyBattleAbility } from '@/features/encounter/abilities';
import { createLanesState, laneAlive, lanesTick, type LanesMechanic, type LanesState } from '@/features/mission-mechanics/lanes';
import { resolveMechanic } from '@/features/mission-mechanics/mechanic';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { createInitialMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import type { EncounterRunState } from '@/features/encounter/encounter-run';

const encounter = islandLevel('test', 'abilities', {
  title: 'T', objective: 'T.', difficulty: 'calm', pieces: [[36, 1], [37, 2], [38, 1]], mist: [{ cell: 31, type: 'light' }], seeds: { every: 30 }, wisps: [],
  lanes: [{ id: 'a', column: 1, at: 0, hp: 9, step: 2 }, { id: 'b', column: 3, at: 0, hp: 9, step: 2 }],
}).encounter;
const window = encounterWindow(encounter);
const mechanic = resolveMechanic(encounterMechanicHost(encounter)) as LanesMechanic;

function setup(ms = 9_000) {
  let board = createEncounterState(encounter, 'mossprout', 0);
  let lanes: LanesState = createLanesState(mechanic);
  for (let t = 0; t < ms; t += 100) { const next = lanesTick(mechanic, lanes, board, 100, window); lanes = next.state; board = next.board; }
  const run = { ability: { charge: 99, uses: 0 }, merges: 0, actions: 0 } as unknown as EncounterRunState;
  return { board, lanes, run };
}
const use = (companion: string, level = 1) => {
  const definition = abilityForCompanion(companion)!;
  const { board, lanes, run } = setup();
  return { before: { board, lanes }, applied: applyBattleAbility(definition, abilityTier(definition, level), board, window, run, null, { mechanic, state: lanes }) };
};

test('every friend brought home is a hero with an ability', () => {
  for (const id of ['mossprout', 'steppling', 'baristabbit', 'feastle', ...Object.keys(ISLAND_HEROES)]) {
    assert.ok(PLAYABLE_KATCHIMERAS.includes(id), `${id} is playable`);
    assert.ok(abilityForCompanion(id), `${id} has an ability`);
    assert.ok(abilityForCompanion(id)!.callout && !abilityForCompanion(id)!.callout!.includes('!'), `${id} says something as they use it, calmly`);
  }
  const world = createInitialMergeWorldState(0);
  assert.deepEqual(playableHeroes(world), ['mossprout'], 'only Mossprout at first');
  const petalimpHome = { ...world, islandCampaigns: { [ISLAND_HEROES.petalimp!]: { cardEarnedAt: 5 } } } as never;
  assert.ok(playableHeroes(petalimpHome).includes('petalimp'), 'an island friend is a hero once home');
  const trained = reduceMergeWorld({ ...(petalimpHome as object), heroBuildings: { 'bloom-house': { level: 1, builtAt: 0 } }, coins: 999, materials: { timber: 0, meals: 99 }, katchimeraProgress: { petalimp: { level: 1, xp: 999, upgradedAt: null } } } as never, { type: 'upgradeKatchimera', characterId: 'petalimp', expectedLevel: 1, now: 1 });
  assert.equal(trained.changed, true, 'and trains like any hero');
  assert.equal(COMPANION_ABILITIES.filter((ability) => ability.lanes).length, 7);
});

test('the friends’ abilities act on the battle in play', () => {
  const burst = use('petalimp').applied!;
  assert.equal(burst.effects[0]!.kind, 'lane');
  const sprouted = (burst.effects[0] as { effect: { kind: string; cells: number[] } }).effect;
  assert.equal(sprouted.kind, 'sprouted');
  for (const cell of sprouted.cells) assert.equal(burst.board.board[cell]!.occupant?.kind, 'item');

  const snare = use('fernip');
  const held = snare.applied!.lanes!;
  assert.ok(held.wisps.some((wisp, index) => wisp.holdUntil > snare.before.lanes.wisps[index]!.holdUntil), 'the nearest wisp is held');

  const helpings = use('feastle').applied!;
  assert.ok(Object.values(helpings.lanes!.ready).some((at) => at === helpings.lanes!.clock), 'plants fire now');

  const seeds = use('blossle').applied!;
  assert.ok((seeds.effects[0] as { effect: { cells: number[] } }).effect.cells.length >= 1, 'Seeds grow');

  const rain = use('drizzlet');
  assert.ok(rain.applied!.lanes!.wisps.every((wisp, index) => wisp.row <= rain.before.lanes.wisps[index]!.row), 'every wisp pushed back');

  const leaves = use('amberleaf', 10);
  assert.ok(leaves.applied!.lanes!.wisps.every((wisp, index) => wisp.damage >= rain.before.lanes.wisps[index]!.damage), 'damage lands');

  const forget = use('mistle');
  assert.ok(forget.applied!.lanes!.wisps.some((wisp, index) => wisp.row < forget.before.lanes.wisps[index]!.row), 'the nearest wisp goes back');
  assert.ok(forget.applied!.lanes!.wisps.every((_, index) => laneAlive(mechanic, forget.applied!.lanes!, index)));
});

test('a lane ability needs its charge and a battle to act on', () => {
  const definition = abilityForCompanion('fernip')!;
  const { board, lanes } = setup();
  const empty = { ability: { charge: 0, uses: 0 } } as unknown as EncounterRunState;
  assert.equal(applyBattleAbility(definition, abilityTier(definition, 1), board, window, empty, null, { mechanic, state: lanes }), null, 'not charged');
  assert.equal(applyBattleAbility(definition, abilityTier(definition, 1), board, window, { ability: { charge: 99, uses: 0 } } as never, null, null), null, 'no lanes');
});
