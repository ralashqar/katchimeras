import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mossproutFtueStep } from '@/features/onboarding/mossprout-ftue-script';
import type { MergeWorldState } from '@/types/merge-world';
import { prioritizedVisibleMergeOrders } from '@/utils/merge-world/order-presentation';
import { MOSSPROUT_NATURE_ISLAND_IDS } from '@/constants/mossprout-nature-islands';

const NOW = Date.UTC(2026, 7, 18, 12);

function mossproutWorld(): MergeWorldState {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout']);
  return {
    ...fresh,
    coins: 2_000,
    characterProgress: {
      ...fresh.characterProgress,
      mossprout: { friendshipLevel: 4, completedChapterIds: ['mossprout-chapter-0'] },
    },
  };
}

test('the first Haven restoration is linear, story-gated, and reveals six Level 1 islands', () => {
  let state = mossproutWorld();
  const skipped = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 1 });
  assert.equal(skipped.changed, false);

  const first = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 2 });
  assert.equal(first.changed, true);
  assert.equal(first.state.haven.tileStages.mossprout, 1);
  assert.equal(first.state.coins, 1_950);
  assert.equal(first.state.haven.revealState, 'first_restore_complete');
  assert.deepEqual(Object.values(first.state.haven.mossproutNatureIslands), [1, 1, 1, 1, 1, 1]);
  state = reduceMergeWorld(first.state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  assert.equal(reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 2, now: NOW + 5 }).changed, false);
});

test('six Mossprout nature islands upgrade independently within the existing total Coin curve', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 1 }).state;
  assert.deepEqual(Object.values(state.haven.mossproutNatureIslands), [1, 1, 1, 1, 1, 1]);

  const storyReady = reduceMergeWorld(state, {
    type: 'reconcileHavenStory',
    characterId: 'mossprout',
    storyLevel: 4,
    now: NOW + 2,
  }).state;
  state = { ...storyReady, coins: 4_000 };

  const seed = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 3 });
  assert.equal(seed.changed, true);
  assert.equal(seed.state.coins, 3_940);
  assert.equal(seed.state.haven.mossproutNatureIslands['seed-nursery'], 2);
  assert.equal(seed.state.haven.mossproutNatureIslands['bloom-garden'], 1);
  assert.equal(seed.natureIslandUpgrade?.completedTier, false);
  assert.equal(seed.state.haven.tileStages.mossprout, 1);

  state = seed.state;
  const levelTwoCosts = [60, 65, 65, 75, 75];
  for (const [index, islandId] of MOSSPROUT_NATURE_ISLAND_IDS.slice(1).entries()) {
    const result = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 2, now: NOW + 4 + index });
    assert.equal(result.changed, true);
    state = result.state;
    if (index === 4) assert.equal(result.natureIslandUpgrade?.completedTier, true);
  }
  assert.equal(state.coins, 3_600);
  assert.equal(levelTwoCosts.reduce((sum, cost) => sum + cost, 60), 400);
  assert.equal(state.haven.tileStages.mossprout, 2);

  for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 3, now: NOW + 20 }).state;
  }
  assert.equal(state.coins, 2_700);
  assert.equal(state.haven.tileStages.mossprout, 3);
  for (const islandId of MOSSPROUT_NATURE_ISLAND_IDS) {
    state = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId, level: 4, now: NOW + 30 }).state;
  }
  assert.equal(state.coins, 900);
  assert.equal(state.haven.tileStages.mossprout, 4);
});

test('nature island upgrades reject skips, story locks, duplicate commands, and insufficient Coins', () => {
  let state = mossproutWorld();
  state = reduceMergeWorld(state, { type: 'upgradeHavenTile', characterId: 'mossprout', stage: 1, now: NOW + 1 }).state;
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 3, now: NOW + 2 }).changed, false);
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 3 }).changed, false);
  state = reduceMergeWorld(state, { type: 'reconcileHavenStory', characterId: 'mossprout', storyLevel: 2, now: NOW + 4 }).state;
  state = { ...state, coins: 59 };
  assert.equal(reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 5 }).changed, false);
  state = { ...state, coins: 60 };
  const upgraded = reduceMergeWorld(state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 6 });
  assert.equal(upgraded.changed, true);
  assert.equal(reduceMergeWorld(upgraded.state, { type: 'upgradeMossproutNatureIsland', islandId: 'seed-nursery', level: 2, now: NOW + 7 }).changed, false);
});

test('v20 restored Havens keep their main stage but restart all new satellites at Level 1', () => {
  const current = mossproutWorld();
  const legacy = {
    ...current,
    version: 20,
    haven: { ...current.haven, tileStages: { ...current.haven.tileStages, mossprout: 4 }, revealState: 'revealed' as const },
  };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 21);
  assert.equal(migrated.haven.tileStages.mossprout, 4);
  assert.deepEqual(Object.values(migrated.haven.mossproutNatureIslands), [1, 1, 1, 1, 1, 1]);
});

test('v13 Mossprout saves reset into the v21 personal-world contract', () => {
  const current = mossproutWorld();
  const legacy = { ...current, version: 13, haven: undefined };
  const migrated = normalizeMergeWorldState(legacy, NOW);
  assert.equal(migrated.version, 21);
  assert.equal(migrated.ownerCharacterId, 'mossprout');
  assert.equal(migrated.haven.tileStages.mossprout, undefined);
  assert.equal(migrated.haven.revealState, 'hidden');
});

test('procedural Merge orders fill three slots and remain separate from story orders', () => {
  const fresh = createInitialMergeWorldState(NOW, ['mossprout', 'steppling']);
  fresh.unlockedChains = ['nature:garden', 'nature:waterside', 'adventure:trail', 'adventure:travel'];
  const state = normalizeMergeWorldState(fresh, NOW);
  const procedural = state.activeOrders.filter((order) => !order.storyArcId);
  assert.equal(procedural.length, 3);
  assert.ok(procedural.every((order) => order.purpose === 'normal' && !order.signature && !order.chapterId));
});

test('Haven order islands share canonical chapter, journey, and character priority', () => {
  const fresh = normalizeMergeWorldState(createInitialMergeWorldState(NOW, ['mossprout', 'steppling']), NOW);
  const template = fresh.activeOrders[0]!;
  const normal = { ...template, id: 'normal:steppling', characterId: 'steppling' as const };
  const favourite = { ...template, id: 'normal:baristabbit', characterId: 'baristabbit' as const };
  const focused = { ...template, id: 'focus:mossprout', characterId: 'mossprout' as const };
  const sameCharacter = { ...template, id: 'normal:mossprout', characterId: 'mossprout' as const };
  const state = {
    ...fresh,
    activeOrders: [normal, favourite, sameCharacter, focused],
    favouriteCharacterId: 'baristabbit' as const,
  };

  assert.deepEqual(
    prioritizedVisibleMergeOrders(state, { focusOrderId: focused.id }).map((order) => order.id),
    [focused.id, sameCharacter.id, favourite.id, normal.id],
  );

  const journey = { ...normal, id: 'journey:only' };
  const resident = { ...favourite, id: 'resident:only', storyArcId: 'resident:active' };
  assert.deepEqual(
    prioritizedVisibleMergeOrders({ ...state, activeOrders: [normal, journey, resident] }, {
      activeResidentDiscoveryId: 'resident:active',
      exclusiveJourney: true,
      journeyOrderIds: new Set([journey.id]),
    }).map((order) => order.id),
    [resident.id, journey.id],
  );

  const chapter = { ...focused, id: 'mossprout:chapter-0:first-sprout' };
  assert.deepEqual(
    prioritizedVisibleMergeOrders({ ...state, activeOrders: [normal, chapter, favourite] }).map((order) => order.id),
    [chapter.id],
  );
});

test('Mossprout FTUE introduces one Bond answer before the Garden and ends on its world map', () => {
  assert.equal(mossproutFtueStep('egg.ready')?.actions[0]?.nextStepId, 'companion.first_meeting');
  assert.equal(mossproutFtueStep('companion.first_meeting')?.actions[0]?.nextStepId, 'companion.bond_spotlight');
  assert.equal(mossproutFtueStep('companion.bond_spotlight')?.actions[0]?.nextStepId, 'companion.day_one_action');
  assert.equal(mossproutFtueStep('companion.day_one_action')?.actions.find((action) => action.id === 'companion.choose_bond_share')?.options?.length, 4);
  assert.equal(mossproutFtueStep('companion.day_one_action')?.actions.find((action) => action.id === 'companion.complete_day_one_action')?.nextStepId, 'companion.garden_intro');
  assert.equal(mossproutFtueStep('companion.garden_intro')?.actions[0]?.nextStepId, 'companion.order_preview');
  assert.equal(mossproutFtueStep('companion.order_preview')?.actions[0]?.nextStepId, 'world.garden_arrival');
  assert.equal(mossproutFtueStep('world.garden_arrival')?.actions[0]?.nextStepId, 'world.garden_handoff');
  assert.equal(mossproutFtueStep('world.garden_handoff')?.actions[0]?.nextStepId, 'merge.seed_drag');
  assert.equal(mossproutFtueStep('merge.serve_sprout')?.edges?.[0]?.nextStepId, 'companion.chapter_zero_return');
  assert.equal(mossproutFtueStep('companion.chapter_zero_return')?.actions[0]?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueStep('haven.first_bloom'), null);
  // Retained as a recovery route for older resident-matching saves.
  assert.equal(mossproutFtueStep('companion.resident_affinity')?.actions[0]?.nextStepId, 'companion.resident_parcel_ready');
  assert.equal(mossproutFtueStep('companion.resident_parcel_ready')?.actions[0]?.nextStepId, 'merge.resident_parcel');
  assert.equal(mossproutFtueStep('merge.resident_card_reward')?.edges?.[0]?.nextStepId, 'companion.resident_match_result');
  assert.equal(mossproutFtueStep('companion.resident_match_result')?.actions[0]?.nextStepId, 'world.complete');
  assert.equal(mossproutFtueStep('world.complete')?.surface, 'haven');
  assert.equal(mossproutFtueStep('world.complete')?.actions[0]?.nextStepId, 'complete');
  assert.equal(mossproutFtueStep('world.complete')?.actions[0]?.title, 'Finish');
});

test('FTUE completion does not reveal, upgrade, or reopen the global Merge route', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const mergeRoute = readFileSync('components/katchadeck/games/merge-world-screen.tsx', 'utf8');

  assert.doesNotMatch(rosterRoute, /onFtueRestore|onFtueReveal|haven_upgrade_completed|haven\.reveal_world/);
  assert.match(rosterRoute, /stepId === 'world\.complete'[\s\S]*?actionId: 'world\.finish'[\s\S]*?completeFtueRun\(\)/);
  assert.match(mergeRoute, /ftueRun\.stepId !== 'companion\.chapter_zero_return'[\s\S]*?target: 'companion'/);
});

test('focused Haven owns one canonical Merge provider and no sandbox subscription', () => {
  const rosterRoute = readFileSync('components/katchadeck/roster/katchimera-roster-route-screen.tsx', 'utf8');
  const havenScreen = readFileSync('components/katchadeck/roster/katchimera-kingdom-screen.tsx', 'utf8');

  assert.match(rosterRoute, /return isFocused \? \([\s\S]*?<FocusedKatchimeraRosterBoundary[\s\S]*?\) : null/);
  assert.match(rosterRoute, /<MergeWorldProvider[\s\S]*?active[\s\S]*?<FocusedKatchimeraRoster/);
  assert.doesNotMatch(rosterRoute, /loadMergeWorldState|subscribeMergeWorldSnapshots/);
  assert.match(havenScreen, /mergeWorld: MergeWorldState/);
  assert.match(havenScreen, /prioritizedVisibleMergeOrders\(mergeWorld/);
  assert.doesNotMatch(havenScreen, /useHavenMergeSandbox/);
  assert.doesNotMatch(havenScreen, /useMergeWorldActions|loadMergeWorldState|subscribeMergeWorldSnapshots/);
});
