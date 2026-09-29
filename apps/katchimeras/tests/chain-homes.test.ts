import { lanesFairness } from '@/features/encounter/lanes-playtest';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAIN_HOMES, claimFrontierSalvage, chainDiscoveryAvailable, chainUnlocked, chainBenefits, chainHomeLevel, unlockChainHome, upgradeChainHome } from '@/features/encounter/chain-homes';
import { chainDiscoveryMission } from '@/features/encounter/chain-discovery';
import { authoredCombatEncounter } from '@/features/encounter/combat-loadout';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createEncounterState, encounterWindow } from '@/features/encounter/create-state';
import { createEncounterRun } from '@/features/encounter/encounter-run';
import { encounterMechanicHost } from '@/features/encounter/adapt';
import { settleAction } from '@/features/encounter/settle';
import { createLanesState, lanesTick } from '@/features/mission-mechanics/lanes';
import { combatLessonMission } from '@/constants/combat-campaign';
import { encounterProfile } from '@/features/encounter/spawner-profile';

const world = (): import('@/types/merge-world').MergeWorldState => ({ ...createInitialMergeWorldState(1), heartTree: { receiptId: 'tree', level: 8, restoredAt: 1 }, coins: 10000 });
test('new saves discover supports; migration preserves old chapter access and investment once', () => {
 const fresh = world();
 assert.equal(chainUnlocked(fresh, 'storm'), false);
 const legacy = { ...fresh, chainProgress: undefined, chaptersClaimed: ['explorers-lodge'], heartwoodBuildings: { 'root-cellar': { level: 6, builtAt: 1 } } };
 const migrated = normalizeMergeWorldState(legacy, 100);
 assert.equal(chainUnlocked(migrated, 'storm'), true);
 assert.equal(chainUnlocked(migrated, 'bulwark'), true);
 assert.equal(chainUnlocked(migrated, 'dew'), false);
 assert.equal(chainHomeLevel(migrated, 'bulwark'), 6);
 assert.deepEqual(normalizeMergeWorldState(migrated, 200).chainProgress, migrated.chainProgress);
});
test('home upgrades are transactional, capped, and apply only to their own chain', () => {
 let state = unlockChainHome(world(), 'frontier-2', 5);
 const before = state.coins;
 state = upgradeChainHome(state, 'storm', 1, 6);
 assert.equal(state.coins, before - 40);
 assert.equal(chainHomeLevel(state, 'storm'), 2);
 assert.equal(upgradeChainHome(state, 'storm', 1, 7), state);
 assert.equal(upgradeChainHome(state, 'dew', 1, 7), state);
 const profile = encounterProfile(state, null);
 assert.equal(profile.chains!.storm!.power, 1.05);
 assert.equal(profile.chains!.garden!.power, 1);
 assert.equal(chainBenefits(10).recharge, 0.15000000000000002);
});
test('authored battles never offer unearned support and keep repeatable selection deterministic', () => {
 const encounter = combatLessonMission(4).encounter;
 const fresh = world();
 assert.deepEqual(authoredCombatEncounter(encounter, fresh).spawners.map(s => s.generatorId), ['seed-sprinkler']);
 const earned = unlockChainHome(fresh, 'frontier-4', 3);
 assert.deepEqual(authoredCombatEncounter(encounter, earned).spawners.map(s => s.generatorId), ['seed-sprinkler', 'dew-well']);
 const daily = { ...encounter, id: 'daily:2026-09-29:1' };
 assert.deepEqual(authoredCombatEncounter(daily, earned), authoredCombatEncounter(daily, earned));
});
for (const home of CHAIN_HOMES) test(`${home.chain} discovery: matching-mist path, live pressure, one generator, and active play`, () => {
 const mission = chainDiscoveryMission(home.chain), encounter = mission.encounter;
 assert.deepEqual(encounter.spawners.map(s => s.drops), [[`nature:${home.chain}:1`]]);
 assert.equal(encounter.mechanic?.kind, 'lanes');
 if (encounter.mechanic?.kind !== 'lanes') return;
 const mechanic = encounter.mechanic, window = encounterWindow(encounter), host = encounterMechanicHost(encounter);
 let board = createEncounterState(encounter, 'mossprout', 1), state = createLanesState(mechanic), run = createEncounterRun(encounter);
 assert.equal(lanesTick(mechanic, state, board, 100, window).state.clock, 100);
 assert.equal(mechanic.wisps.length, 16);
 for (const [from, to] of [[43,38],[38,31],[31,24]]) {
  const command = { type: 'move' as const, from: from!, to: to!, now: 2 };
  const reduced = reduceMergeWorld(board, command);
  assert.ok(reduced.changed, `${from} -> ${to}`);
  const settled = settleAction({ encounter, window, host }, { state: board, mechanicState: state, run }, command, reduced);
  board = settled.state; state = settled.mechanicState as typeof state; run = settled.run;
 }
 assert.ok(mechanic.discoveryCells!.every(cell => !board.board[cell]!.mist));
 if (home.chain === 'dew') {
  const command = { type: 'move' as const, from: 23, to: 22, now: 3 };
  assert.equal(settleAction({encounter, window, host}, {state:board, mechanicState:state, run}, command, reduceMergeWorld(board, command)).state, board);
 }
 // Active demonstrations require continued merging and positioning, not watching a tutorial piece win.
 assert.ok(lanesFairness(encounter, 'careful', 6).wins >= 5);
 assert.ok(lanesFairness(encounter, 'careless', 6).wins >= 3);
 assert.equal(lanesFairness(encounter, 'idle', 1).wins, 0);

});

test('discovery gates cannot trap the three-tile Lodge chapter; victory and salvage survive replays', () => {
 let state = world();
 assert.equal(chainDiscoveryAvailable(state, 'storm'), false);
 const mission = chainDiscoveryMission('garden');
 const win = reduceMergeWorld(state, {type:'completeEncounter', receiptId:'garden-win', missionId:mission.id, katchimeraId:'mossprout', helperWispId:null, outcome:{cleared:true,grade:'bright'} as never, difficulty:mission.difficulty, base:mission.rewards, now:10});
 state=win.state;
 assert.equal(chainDiscoveryAvailable(state, 'storm'), true);
 assert.equal(chainDiscoveryAvailable({...state,heroBuildings:{'explorers-lodge':{level:1,builtAt:1}}}, 'bulwark'), true);
 const claimed=claimFrontierSalvage(state,mission.id,'glow',11);
 assert.equal(state.chainProgress?.salvage[mission.id], 'timber', 'discovery supplies are paid with victory, without a choice screen');
 assert.equal(claimed, state, 'a second choice cannot pay twice');
 const oldSave = { ...state, chainProgress: { ...state.chainProgress!, salvage: {} } };
 const recovered = claimFrontierSalvage(oldSave, mission.id, 'timber', 12);
 assert.equal(recovered.materials!.timber, oldSave.materials!.timber + 4);
 assert.equal(claimFrontierSalvage(recovered, mission.id, 'timber', 13), recovered);
 assert.equal(claimFrontierSalvage(claimed,mission.id,'timber',12),claimed);
 assert.equal(claimFrontierSalvage(state,'frontier:frontier-9','glow',13),state);
});
