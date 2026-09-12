import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HATCHABLE_COMPANIONS, hatchableByCompanion, hatchableByMission, hatchableByTile, hatchableByUnlock } from '@/constants/hatchable-companions/registry';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { SHARED_WORLD_PURCHASES, SHARED_WORLD_TILES, STEPPLING_TILE } from '@/constants/shared-world';
import { GLOW_GATEWAY_ID } from '@/constants/glow-discovery-ids';
import { hatchableFlows } from '@/features/onboarding/hatchable-flows';
import { GLOW_DISCOVERY_FLOW, GLOW_DISCOVERY_RUN_ID, GLOW_LESSON } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_DAY_ONE_FLOW, STEPPLING_DAY_ONE_RUN_ID, STEPPLING_PARCEL_REWARD_ID } from '@/features/content-flow/steppling-day-one-flow';
import { STEPPLING_GARDEN_FLOW, STEPPLING_GARDEN_RUN_ID, STEPPLING_PARCEL_ID, STEPPLING_SHOE_ORDER_ID } from '@/features/onboarding/steppling-garden-lesson';
import { createMissionState, missionBoardStep } from '@/features/onboarding/steppling-mission';
import { OPENING_MERGE_WINDOW_CELLS } from '@/features/onboarding/opening-mist';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { hatchableAvailable, hatchableTileState } from '@/utils/merge-world/glow-discovery-policy';
import { gardenLessonRecord, lessonOrderServed } from '@/features/onboarding/steppling-garden-lesson';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import { MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { MergeWorldState } from '@/types/merge-world';

const NOW = Date.UTC(2026, 8, 12, 9);
const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/hatchable/${name}.json`, 'utf8'));

test('Steppling on the definition is Steppling exactly: the three generated flows equal the ones his saves were written against', () => {
  // Captured from the hand-written flows before the definition existed. A change here is a save migration, not a refactor.
  assert.deepEqual(JSON.parse(JSON.stringify(GLOW_DISCOVERY_FLOW)), fixture('glow-steppling-discovery'));
  assert.deepEqual(JSON.parse(JSON.stringify(STEPPLING_DAY_ONE_FLOW)), fixture('steppling-day-one'));
  assert.deepEqual(JSON.parse(JSON.stringify(STEPPLING_GARDEN_FLOW)), fixture('steppling-garden-lesson'));
  const flows = hatchableFlows(STEPPLING_HATCHABLE);
  assert.equal(flows.discovery, GLOW_DISCOVERY_FLOW, 'one instance per definition');
  assert.equal(flows.dayOne, STEPPLING_DAY_ONE_FLOW);
  assert.equal(flows.gardenLesson, STEPPLING_GARDEN_FLOW);
  // The ids his saves carry.
  assert.equal(GLOW_DISCOVERY_RUN_ID, 'story:glow-steppling-v1');
  assert.equal(STEPPLING_DAY_ONE_RUN_ID, 'journey:steppling:day-1');
  assert.equal(STEPPLING_PARCEL_REWARD_ID, 'journey:steppling:day-1:journey-locker');
  assert.equal(STEPPLING_PARCEL_ID, STEPPLING_PARCEL_REWARD_ID);
  assert.equal(STEPPLING_GARDEN_RUN_ID, 'ftue:steppling-garden:1');
  assert.equal(STEPPLING_SHOE_ORDER_ID, 'steppling:discovery:first-trail');
  assert.equal(STEPPLING_HATCHABLE.mission.storageKey, 'katchimeras.mist-mission.steppling.v3');
  assert.equal(STEPPLING_HATCHABLE.tile.unlockId, GLOW_GATEWAY_ID);
  assert.deepEqual(GLOW_LESSON.map((beat) => beat.kind), ['parcel', 'spawn', 'grow', 'serve']);
});

test('the shared world is read from the registry: Mossprout fixed, every other tile a hatchable companion’s', () => {
  assert.deepEqual(Object.keys(SHARED_WORLD_TILES), ['mossprout-home', ...HATCHABLE_COMPANIONS.map((definition) => definition.tile.id)]);
  assert.deepEqual(STEPPLING_TILE, { residentVisible: false, companion: 'steppling', coord: { q: 0, r: 0 }, unlockId: 'mossprout:overgrown-trail', price: 40, name: 'Misty clearing', revealPreset: 'mist-clear' });
  assert.deepEqual(SHARED_WORLD_PURCHASES.map((purchase) => purchase.tileId), HATCHABLE_COMPANIONS.map((definition) => definition.tile.id));
  for (const definition of HATCHABLE_COMPANIONS) {
    assert.equal(hatchableByCompanion(definition.companion), definition);
    assert.equal(hatchableByTile(definition.tile.id), definition);
    assert.equal(hatchableByUnlock(definition.tile.unlockId), definition);
    assert.equal(hatchableByMission(definition.mission.id), definition);
  }
  assert.equal(hatchableByCompanion('mossprout'), null);
});

test('every definition is sound: unique ids, tiles apart, flows that compile, and a lesson its spawner can feed', () => {
  const unique = (values: string[], what: string) => assert.equal(new Set(values).size, values.length, `${what} are unique`);
  unique(HATCHABLE_COMPANIONS.map((d) => d.companion), 'companions');
  unique(HATCHABLE_COMPANIONS.map((d) => d.tile.id), 'tile ids');
  unique(HATCHABLE_COMPANIONS.map((d) => `${d.tile.coord.q},${d.tile.coord.r}`), 'tile coords');
  unique(HATCHABLE_COMPANIONS.map((d) => d.tile.unlockId), 'unlock ids');
  unique(HATCHABLE_COMPANIONS.map((d) => d.mission.storageKey), 'mission storage keys');
  unique(HATCHABLE_COMPANIONS.flatMap((d) => [d.discoveryFlow.runId, d.dayOne.flow.runId, d.lesson.flow.runId]), 'run ids');
  unique(HATCHABLE_COMPANIONS.flatMap((d) => [d.discoveryFlow.id, d.dayOne.flow.id, d.lesson.flow.id]), 'flow ids');
  for (const definition of HATCHABLE_COMPANIONS) {
    const flows = hatchableFlows(definition);
    for (const flow of [flows.discovery, flows.dayOne, flows.gardenLesson]) {
      assert.deepEqual(validateContentFlowDefinition(flow), [], `${flow.id} compiles`);
    }
    assert.ok(definition.tile.price > 0);
    assert.equal(typeof definition.tile.art, 'function', 'tile art is resolved on demand: a definition never loads images');
    assert.ok(readFileSync('constants/hatchable-companions/' + definition.companion + '.ts', 'utf8').includes(definition.tile.alphaBoundsKey.replace('.webp', '')), 'the art the definition names is the art its bounds are generated for');
    assert.equal(definition.lesson.order.characterId, definition.companion);
    assert.equal(definition.dayOne.parcel.generatorId, definition.lesson.generatorId);
    assert.equal(definition.dayOne.parcel.rewardId, definition.lesson.parcelArrivalId);
    assert.equal(definition.economy.generatorId, definition.lesson.generatorId);
    assert.ok(MERGE_ITEMS_BY_ID.has(definition.lesson.growDefinitionId) && MERGE_ITEMS_BY_ID.has(definition.lesson.dropDefinitionId));
    assert.equal(MERGE_ITEMS_BY_ID.get(definition.lesson.dropDefinitionId)?.nextItemId, definition.lesson.growDefinitionId, 'the lesson grows the drop’s next tier');
    assert.equal(definition.lesson.order.requirements[0]?.definitionId, definition.lesson.growDefinitionId);
    assert.equal(definition.mission.wisps.length, 4);
    assert.equal(definition.mission.lines.fell.length, definition.mission.wisps.length - 1);
    for (const guide of [definition.mission.guides.wake, definition.mission.guides.merge]) assert.match(guide.title, /\{name\}/);
  }
});

test('every mission board can be played out: no move strands it, and after the first merge there is one thing to do', () => {
  for (const definition of HATCHABLE_COMPANIONS) {
    const { mission } = definition;
    const start = createMissionState(mission.seed, definition.companion, NOW);
    for (const { cell } of [...mission.seed.items, ...mission.seed.echoes, ...mission.seed.veiled]) assert.ok(OPENING_MERGE_WINDOW_CELLS.includes(cell), `${definition.companion}: cell ${cell} is in the window`);
    assert.equal(missionBoardStep(mission, start, 0)?.id, `mission.${definition.companion}.first_merge`);
    const key = (state: MergeWorldState) => JSON.stringify(state.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]));
    const seen = new Set<string>();
    const walk = (state: MergeWorldState, strikes: number) => {
      const signature = `${key(state)}:${strikes}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      if (strikes >= mission.required) return;
      const items = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item');
      const targets = OPENING_MERGE_WINDOW_CELLS.filter((index) => state.board[index]?.occupant?.kind === 'item' || state.board[index]?.mist?.kind === 'echo');
      // What the board holds, not where: the same merge landing on either of its two cells is one outcome.
      const holding = (next: MergeWorldState) => JSON.stringify(next.board.map((cell) => [cell.occupant?.kind === 'item' ? cell.occupant.definitionId : null, cell.mist?.kind ?? null, cell.mist?.kind === 'echo' ? cell.mist.definitionId : null]).filter((entry) => entry[0] != null || entry[1] === 'echo' || entry[1] === 'veiled').sort());
      const outcomes = new Map<string, MergeWorldState>();
      for (const from of items) for (const to of targets) {
        if (from === to) continue;
        const result = reduceMergeWorld(state, { type: 'move', from, to, now: NOW });
        if (!result.changed || result.mergedCell == null) continue;
        outcomes.set(holding(result.state), result.state);
      }
      assert.ok(outcomes.size > 0, `${definition.companion}: a dead end after ${strikes} strikes`);
      assert.equal(outcomes.size, 1, `${definition.companion}: strike ${strikes + 1} offers ${outcomes.size} outcomes, not one`);
      assert.ok(missionBoardStep(mission, state, strikes)?.cue, `${definition.companion}: the finger has somewhere to point at strike ${strikes + 1}`);
      for (const next of outcomes.values()) walk(next, strikes + 1);
    };
    walk(start, 0);
  }
});

test('a tile’s state is read from its definition: asleep until its turn, saving, ready, an Egg, open', () => {
  const world = createInitialMergeWorldState(NOW, ['mossprout']);
  const later: HatchableCompanionDefinition = { ...STEPPLING_HATCHABLE, companion: 'baristabbit', availability: { kind: 'kingdom_goal_introduced' },
    tile: { ...STEPPLING_HATCHABLE.tile, id: 'later-home', unlockId: 'later:unlock', price: 60 }, discovery: { gateId: 'gate-3-first-choice', pathId: 'warm-light' } };
  const afterFriend: HatchableCompanionDefinition = { ...later, availability: { kind: 'after_companion', companion: 'steppling' } };
  // Steppling wakes with the first session; a later friend waits for Mossprout's wish, or for a friend before them.
  assert.equal(hatchableAvailable(world, STEPPLING_HATCHABLE), true);
  assert.equal(hatchableAvailable(world, later), false);
  assert.equal(hatchableAvailable({ ...world, kingdomGoal: { introducedAt: NOW, coachmarkSeenAt: null } }, later), true);
  assert.equal(hatchableAvailable(world, afterFriend), false);
  assert.equal(hatchableAvailable({ ...world, companionDiscovery: { ...world.companionDiscovery, records: [{ characterId: 'steppling', source: 'ftue_hatch', gateId: 'gate-2-steppling', pathId: 'overgrown-trail', discoveredAt: NOW, revealSeenAt: NOW, firstOrderCompletedAt: null, permanentFeatureId: null }] } }, afterFriend), true);
  // The state machine, on the definition's price.
  assert.equal(hatchableTileState(world, later), 'sleeping');
  const woken = { ...world, kingdomGoal: { introducedAt: NOW, coachmarkSeenAt: null } };
  assert.equal(hatchableTileState({ ...woken, coins: 59 }, later), 'saving');
  assert.equal(hatchableTileState({ ...woken, coins: 60 }, later), 'ready');
  assert.equal(hatchableTileState({ ...woken, coins: 0, worldUnlocks: { 'later:unlock': { unlockedAt: NOW, paid: 60, destination: 'baristabbit', transferredAt: null, hatchedAt: null } } }, later), 'egg');
  assert.equal(hatchableTileState({ ...woken, companionDiscovery: { ...woken.companionDiscovery, records: [{ characterId: 'baristabbit', source: 'ftue_hatch', gateId: 'gate-3-first-choice', pathId: 'warm-light', discoveredAt: NOW, revealSeenAt: NOW, firstOrderCompletedAt: null, permanentFeatureId: null }] } }, later), 'open');
  // Steppling, never asleep: saving at 39, ready at 40.
  assert.equal(hatchableTileState({ ...world, coins: 39 }, STEPPLING_HATCHABLE), 'saving');
  assert.equal(hatchableTileState({ ...world, coins: 40 }, STEPPLING_HATCHABLE), 'ready');
  // The engine refuses a purchase while the tile sleeps, in the tile's own words, and records the definition's gate at the hatch.
  const policy = readFileSync('utils/merge-world/glow-discovery-policy.ts', 'utf8');
  assert.match(policy, /if \(hatchable && !existing && !owned && !hatchableAvailable\(state, hatchable\)\) return no\(hatchable\.tile\.markerLines\.sleeping\);/);
  assert.match(policy, /const discovery = hatchableByUnlock\(command\.targetId\)\?\.discovery \?\? STEPPLING_HATCHABLE\.discovery;/);
  assert.doesNotMatch(policy, /gateId: 'gate-2-steppling'/);
});

test('garden lessons live in one map keyed by companion, with Steppling’s older field read and mirrored', () => {
  // Steppling unlocked but not yet grandfathered as discovered: the lesson's request must still be owed.
  const base = createInitialMergeWorldState(NOW, ['mossprout']);
  const world: MergeWorldState = { ...base, unlockedCharacters: [...base.unlockedCharacters, 'steppling'] };
  const viaSteppling = reduceMergeWorld(world, { type: 'prepareStepplingGardenLesson', now: NOW });
  const viaCompanion = reduceMergeWorld(world, { type: 'prepareGardenLesson', companion: 'steppling', now: NOW });
  assert.equal(viaSteppling.changed, true);
  assert.deepEqual(viaCompanion.state.gardenLessons, viaSteppling.state.gardenLessons, 'the same command under either name');
  assert.deepEqual(viaSteppling.state.gardenLessons, { steppling: { preparedAt: NOW } });
  assert.deepEqual(viaSteppling.state.stepplingGardenLesson, { preparedAt: NOW }, 'mirrored for older builds');
  assert.equal(viaSteppling.state.activeOrders.some((order) => order.id === STEPPLING_SHOE_ORDER_ID), true, 'the lesson’s request is on the rail');
  assert.equal(reduceMergeWorld(viaSteppling.state, { type: 'prepareGardenLesson', companion: 'steppling', now: NOW + 1 }).changed, false, 'prepared once');
  assert.equal(reduceMergeWorld(world, { type: 'prepareGardenLesson', companion: 'mossprout', now: NOW }).changed, false, 'no lesson for a friend without a definition');
  assert.equal(gardenLessonRecord(viaSteppling.state, 'steppling')?.preparedAt, NOW);
  // A save from before the map: only the old field. It is read into the map and stays mirrored.
  const legacy = JSON.parse(JSON.stringify({ ...world, stepplingGardenLesson: { preparedAt: NOW, servedAt: NOW + 5 } }));
  delete legacy.gardenLessons;
  const migrated = normalizeMergeWorldState(legacy, NOW + 10);
  assert.deepEqual(migrated.gardenLessons, { steppling: { preparedAt: NOW, servedAt: NOW + 5 } });
  assert.deepEqual(migrated.stepplingGardenLesson, { preparedAt: NOW, servedAt: NOW + 5 });
  assert.equal(lessonOrderServed(migrated, STEPPLING_HATCHABLE), true);
  // And the map survives a round trip on its own.
  const round = normalizeMergeWorldState(JSON.parse(JSON.stringify(viaSteppling.state)), NOW + 10);
  assert.deepEqual(round.gardenLessons, { steppling: { preparedAt: NOW } });
});
