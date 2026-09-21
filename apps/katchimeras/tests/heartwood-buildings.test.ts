import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

import {
  HEARTWOOD_BUILDINGS, HEARTWOOD_BUILDING_COSTS, HEARTWOOD_BUILDING_MAX_LEVEL, MERGE_ENERGY_BASE_CAP, MERGE_ENERGY_BASE_REGEN_MS,
  dewSpringEnergyCap, dewSpringRegenMs, heartwoodBuildingCost, heartwoodBuildingLevel, mergeEnergyCap, normalizeHeartwoodBuildings,
  type HeartwoodBuildings,
} from '@/constants/heartwood-buildings';
import { HEARTWOOD_PATCH_ITEM, HEARTWOOD_PATCH_ITEM_SCALE, heartwoodPatchItemPosition } from '@/constants/heartwood-patch-item';
import { buildFirstSpring, canUpgradeHeartwoodBuilding, firstSeedReadyForSpring, firstSpringAwake, firstSpringBuilt, growFirstSeedIntoSpring, upgradeHeartwoodBuilding, wakeFirstSpring } from '@/features/heartwood-buildings/buildings-world';
import { heartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { availableHeartwoodBeds } from '@/features/shared-adventure/heartwood-garden';
import { buildingUpgradeModel } from '@/features/upgrade-stage/upgrade-panel-model';
import type { MergeBoardItem, MergeWorldState } from '@/types/merge-world';
import { mergeEnergyStatus, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { createMossproutChapterZeroState } from '@/utils/merge-world/onboarding';

const NOW = Date.UTC(2026, 8, 20, 9);

/** A Garden past its first session: Heartwood has stirred, there is Glow to spend, and the item maker drops freely. */
function world(overrides: { coins?: number; buildings?: HeartwoodBuildings } = {}): MergeWorldState {
  const base = createMossproutChapterZeroState(NOW);
  return {
    ...base,
    coins: overrides.coins ?? 5_000,
    heartwoodBuildings: overrides.buildings,
    haven: { ...base.haven, tileStages: { ...base.haven.tileStages, mossprout: 1 } },
    generators: { ...base.generators, 'wild-garden': { ...base.generators['wild-garden'], forcedDropDefinitionId: null } },
  };
}
const tap = (state: MergeWorldState, seed: string, now = NOW + 1, spendEnergy?: boolean) => reduceMergeWorld(state, { type: 'tapGenerator', generatorId: 'wild-garden', now, seed, ...(spendEnergy == null ? {} : { spendEnergy }) });

test('five patches: four economy buildings beside the Lantern, each on its own patch with ten priced levels', () => {
  assert.deepEqual(HEARTWOOD_BUILDINGS.map((building) => building.id), ['dew-spring', 'seed-nursery', 'root-cellar', 'garden-stall']);
  const slots = HEARTWOOD_BUILDINGS.map((building) => building.slotId);
  assert.equal(new Set(slots).size, 4);
  assert.equal(slots.includes('front-right'), false, 'front-right is the Wisp Lantern\'s');
  assert.equal(HEARTWOOD_BUILDING_COSTS.length, HEARTWOOD_BUILDING_MAX_LEVEL);
  assert.ok(HEARTWOOD_BUILDING_COSTS.every((cost, index) => index === 0 || cost > HEARTWOOD_BUILDING_COSTS[index - 1]!));
  assert.equal(heartwoodBuildingCost(0), 20);
  assert.equal(heartwoodBuildingCost(HEARTWOOD_BUILDING_MAX_LEVEL), null);
  assert.equal(dewSpringEnergyCap(0), MERGE_ENERGY_BASE_CAP);
  assert.equal(dewSpringEnergyCap(10), 200);
  assert.equal(dewSpringRegenMs(0), MERGE_ENERGY_BASE_REGEN_MS);
  assert.deepEqual([3, 4, 7, 10].map(dewSpringRegenMs), [120_000, 105_000, 90_000, 75_000]);
});

test('saved buildings drop anything unknown, unbuilt or malformed', () => {
  assert.deepEqual(normalizeHeartwoodBuildings({ 'dew-spring': { level: 3, builtAt: 5 }, 'seed-nursery': { level: 0 }, 'root-cellar': { level: 99 }, shed: { level: 2 }, 'garden-stall': 'yes' }, NOW),
    { 'dew-spring': { level: 3, builtAt: 5 }, 'root-cellar': { level: 10, builtAt: NOW } });
  assert.equal(normalizeHeartwoodBuildings(null, NOW), undefined);
  assert.equal(normalizeHeartwoodBuildings({}, NOW), undefined);
});

test('a tap on the Garden spends one energy, and an empty spring refuses it', () => {
  const start = world();
  assert.equal(start.energy.value, MERGE_ENERGY_BASE_CAP);
  const tapped = tap(start, 'a');
  assert.equal(tapped.changed, true);
  assert.equal(tapped.state.energy.value, MERGE_ENERGY_BASE_CAP - 1);
  assert.equal(tapped.state.energy.lastRegenAt, NOW + 1, 'spending from a full spring starts the clock');

  const free = tap(start, 'b', NOW + 1, false);
  assert.equal(free.state.energy.value, MERGE_ENERGY_BASE_CAP, 'lesson and mission boards are never charged');

  const empty = tap({ ...start, energy: { ...start.energy, value: 0, lastRegenAt: NOW } }, 'c');
  assert.equal(empty.changed, false);
  assert.equal(empty.failureReason, 'out_of_energy');
  assert.equal(empty.spawnedCell, undefined);
});

test('energy comes back on its own up to the cap, and energy earned above the cap is kept', () => {
  const spent = { ...world(), energy: { value: 10, regenCap: 100, lastRegenAt: NOW, regenPaused: false } };
  assert.deepEqual(mergeEnergyStatus(spent, NOW + 5 * MERGE_ENERGY_BASE_REGEN_MS + 30_000), {
    value: 15, cap: 100, regenMs: MERGE_ENERGY_BASE_REGEN_MS, nextAt: NOW + 6 * MERGE_ENERGY_BASE_REGEN_MS, lastRegenAt: NOW + 5 * MERGE_ENERGY_BASE_REGEN_MS,
  });
  const later = reduceMergeWorld(spent, { type: 'refreshTime', now: NOW + 5 * MERGE_ENERGY_BASE_REGEN_MS + 30_000 }).state;
  assert.equal(later.energy.value, 15);
  assert.equal(later.energy.lastRegenAt, NOW + 5 * MERGE_ENERGY_BASE_REGEN_MS, 'the half-earned point is not lost');
  assert.equal(reduceMergeWorld(spent, { type: 'refreshTime', now: NOW + 24 * 3_600_000 }).state.energy.value, 100);

  const over = { ...spent, energy: { ...spent.energy, value: 140 } };
  assert.equal(mergeEnergyStatus(over, NOW + 24 * 3_600_000).value, 140);
  assert.equal(mergeEnergyStatus(over, NOW + 24 * 3_600_000).nextAt, null);

  // A tap made after a wait is paid from what came back, not refused on the stale saved value.
  const waited = tap({ ...spent, energy: { ...spent.energy, value: 0 } }, 'd', NOW + MERGE_ENERGY_BASE_REGEN_MS);
  assert.equal(waited.changed, true);
  assert.equal(waited.state.energy.value, 0);
});

test('a save from the years energy was switched off wakes up full', () => {
  const legacy = normalizeMergeWorldState({ ...world(), energy: { value: 0, regenCap: 0, lastRegenAt: NOW - 1_000_000, regenPaused: false } }, NOW);
  assert.deepEqual(legacy.energy, { value: 100, regenCap: 100, lastRegenAt: NOW, regenPaused: false });
  const live = normalizeMergeWorldState({ ...world(), energy: { value: 37, regenCap: 100, lastRegenAt: NOW - 5, regenPaused: false } }, NOW);
  assert.equal(live.energy.value, 37);
  assert.equal(live.energy.lastRegenAt, NOW - 5);
});

test('building takes Glow and the patch; a stale or repeated request changes nothing', () => {
  const base = world({ coins: 100 });
  const planted: MergeWorldState = { ...base, haven: { ...base.haven, plantableMemories: [{ id: 'memory:momentum', definitionId: 'momentum', status: 'planted', slotId: 'back-centre', growthPoints: 2, earnedAt: NOW - 10, plantedAt: NOW - 5 } as MergeWorldState['haven']['plantableMemories'][number]] } };
  assert.equal(canUpgradeHeartwoodBuilding(planted, 'dew-spring'), true);
  const built = upgradeHeartwoodBuilding(planted, 'dew-spring', 0, NOW + 1);
  assert.equal(built.coins, 80);
  assert.deepEqual(built.heartwoodBuildings, { 'dew-spring': { level: 1, builtAt: NOW + 1 } });
  assert.equal(built.energy.regenCap, 110);
  assert.equal(built.energy.value, planted.energy.value + 10, 'the new room arrives full');
  const plant = built.haven.plantableMemories[0]!;
  assert.deepEqual([plant.status, plant.slotId, plant.growthPoints], ['earned', null, 2], 'the plant goes back to the collection with its growth');
  assert.equal(planted.haven.plantableMemories[0]!.status, 'planted', 'the input world is untouched');

  assert.equal(upgradeHeartwoodBuilding(built, 'dew-spring', 0, NOW + 2), built, 'a second tap on Build is already done');
  const upgraded = upgradeHeartwoodBuilding(built, 'dew-spring', 1, NOW + 3);
  assert.equal(upgraded.coins, 40);
  assert.deepEqual(upgraded.heartwoodBuildings?.['dew-spring'], { level: 2, builtAt: NOW + 1 });
  assert.throws(() => upgradeHeartwoodBuilding(upgraded, 'dew-spring', 2, NOW + 4), /more Glow/);
  assert.throws(() => upgradeHeartwoodBuilding({ ...base, haven: { ...base.haven, tileStages: { ...base.haven.tileStages, mossprout: 0 } }, kingdomGoal: undefined }, 'dew-spring', 0, NOW), /not ready/);

  const full = world({ buildings: { 'garden-stall': { level: HEARTWOOD_BUILDING_MAX_LEVEL, builtAt: NOW } } });
  assert.equal(upgradeHeartwoodBuilding(full, 'garden-stall', HEARTWOOD_BUILDING_MAX_LEVEL, NOW), full);
  assert.equal(canUpgradeHeartwoodBuilding(full, 'garden-stall'), false);
});

test('a built patch is no longer a bed, for the list or for the engine', () => {
  const base = world();
  assert.equal(availableHeartwoodBeds(base).length, 5);
  const built = upgradeHeartwoodBuilding(base, 'seed-nursery', 0, NOW);
  assert.equal(availableHeartwoodBeds(built).includes('front-left'), false);
  assert.equal(availableHeartwoodBeds(built).length, 4);
  assert.equal(mergeEnergyCap(built), MERGE_ENERGY_BASE_CAP, 'only the Dew Spring moves the cap');
  assert.equal(heartwoodBuildingLevel(built, 'seed-nursery'), 1);
});

test('the Seed Nursery makes every item maker find better things more often', () => {
  const tiers = (state: MergeWorldState) => Array.from({ length: 300 }, (_, index) => tap(state, `nursery:${index}`, NOW + 1, false))
    .flatMap((result) => result.spawnedCell == null ? [] : [result.state.board[result.spawnedCell]!.occupant])
    .filter((occupant): occupant is MergeBoardItem => occupant?.kind === 'item')
    .map((item) => Number(item.definitionId.split(':').at(-1)));
  const plain = tiers(world());
  assert.deepEqual([...new Set(plain)], [1], 'a level-one maker with no Nursery only finds tier one');
  const tended = tiers(world({ buildings: { 'seed-nursery': { level: 10, builtAt: NOW } } }));
  const share = (tier: number) => tended.filter((value) => value === tier).length / tended.length;
  assert.ok(Math.abs(share(2) - 0.3) < 0.08, `tier two ${share(2)}`);
  assert.ok(share(3) > 0 && share(3) < 0.12, `tier three ${share(3)}`);
});

test('the Garden Stall adds its share of Glow to a served order, and the Root Cellar\'s shelves survive a recount', () => {
  const serve = (buildings?: HeartwoodBuildings) => {
    let state: MergeWorldState = { ...createMossproutChapterZeroState(NOW), heartwoodBuildings: buildings };
    // Put exactly what the order asks for on the board: this is about what serving pays, not how the items were made.
    const order = reduceMergeWorld(state, { type: 'refreshTime', now: NOW }).state.activeOrders.find((entry) => entry.id === 'mossprout:chapter-0:first-sprout')!;
    const open = state.board.flatMap((cell, index) => !cell.locked && !cell.occupant ? [index] : []);
    const wanted = order.requirements.flatMap((requirement) => Array.from({ length: requirement.quantity ?? 1 }, () => requirement.definitionId));
    state = { ...state, board: state.board.map((cell, index) => {
      const slot = open.indexOf(index);
      return slot >= 0 && slot < wanted.length ? { ...cell, occupant: { kind: 'item' as const, instanceId: `test:${slot}`, definitionId: wanted[slot]! } } : cell;
    }) };
    const before = state.coins;
    state = reduceMergeWorld(state, { type: 'serveOrder', orderId: 'mossprout:chapter-0:first-sprout', now: NOW + 2 }).state;
    return { paid: state.coins - before, storage: state.storageCapacity };
  };
  const plain = serve();
  assert.ok(plain.paid > 0);
  const stall = serve({ 'garden-stall': { level: 5, builtAt: NOW }, 'root-cellar': { level: 3, builtAt: NOW } });
  assert.equal(stall.paid, plain.paid + Math.round(plain.paid * 0.2));
  assert.equal(stall.storage, plain.storage + 3);
});

test('the panel model: an empty patch builds, a built one shows every number with what the next level makes it, a full one is done', () => {
  const empty = buildingUpgradeModel(world({ coins: 10 }), 'dew-spring');
  assert.deepEqual({ ...empty.level }, { current: 0, next: 1, max: 10 });
  assert.deepEqual(empty.primary, { label: 'Build', cost: 20, disabled: true });
  assert.equal(empty.progressLabel, '50%');
  assert.deepEqual(empty.benefits.map((benefit) => [benefit.label, benefit.icon, benefit.from, benefit.to, benefit.delta]), [
    ['Energy cap', 'bolt.fill', '100', '110', '+10'],
    ['Recovery', 'timer', '2:00', '2:00', undefined],
  ], 'a number this level does not move reads as a plain value, with no gain');
  assert.equal(empty.requirements[0]?.met, false);
  assert.equal(empty.levels.length, 10);
  assert.deepEqual(empty.levels.slice(0, 2).map((entry) => entry.state), ['next', 'ahead']);

  const milestone = buildingUpgradeModel(world({ buildings: { 'dew-spring': { level: 3, builtAt: NOW } } }), 'dew-spring');
  assert.deepEqual(milestone.primary, { label: 'Upgrade', cost: 140, disabled: false });
  assert.deepEqual(milestone.benefits.map((benefit) => [benefit.label, benefit.from, benefit.to, benefit.delta]), [['Energy cap', '130', '140', '+10'], ['Recovery', '2:00', '1:45', '-0:15']], 'a shorter wait reads as time taken off');
  const icons = Object.fromEntries((['seed-nursery', 'root-cellar', 'garden-stall'] as const).map((id) => [id, buildingUpgradeModel(world(), id).benefits.map((benefit) => [benefit.icon, benefit.delta])]));
  assert.deepEqual(icons, { 'seed-nursery': [['sparkles', '+3%'], ['star.fill', undefined]], 'root-cellar': [['shippingbox.fill', '+1']], 'garden-stall': [['glow', '+4%']] });

  const done = buildingUpgradeModel(world({ buildings: { 'root-cellar': { level: 10, builtAt: NOW } } }), 'root-cellar');
  assert.equal(done.complete, true);
  assert.deepEqual(done.benefits.map((benefit) => [benefit.from, benefit.to, benefit.delta]), [['+10', '+10', undefined]], 'fully grown, it still shows what it gives');
  assert.equal(done.primary, null);
  assert.equal(done.progressLabel, 'MAX');

  const early = buildingUpgradeModel({ ...world(), haven: { ...world().haven, tileStages: {} }, kingdomGoal: undefined } as MergeWorldState, 'garden-stall');
  assert.equal(early.primary, null);
  assert.ok(early.locked);
});

type Plant = MergeWorldState['haven']['plantableMemories'][number];
const firstSeed = (patch: Partial<Plant> = {}) => ({ id: 'memory-plant:ftue', definitionId: 'stillness', status: 'planted', slotId: 'back-centre', growthPoints: 1, earnedAt: NOW - 10, plantedAt: NOW - 5, source: { kind: 'ftue', sourceId: 'run-1' }, ...patch }) as Plant;
const withPlants = (plants: Plant[], base = world({ coins: 0 })): MergeWorldState => ({ ...base, haven: { ...base.haven, plantableMemories: plants } });

test('the first session builds the Dew Spring: dug out dormant and free, woken with the garden, and no memory seed anywhere', () => {
  const fresh = withPlants([], { ...world({ coins: 0 }), haven: { ...world().haven, tileStages: {} }, kingdomGoal: undefined } as MergeWorldState);
  assert.equal(firstSpringBuilt(fresh), false);

  // "Dig it out": the planting beat.
  const dug = buildFirstSpring(fresh, NOW + 1);
  assert.deepEqual(dug.heartwoodBuildings, { 'dew-spring': { level: 1, builtAt: NOW + 1, dormant: true } });
  assert.equal(dug.coins, 0, 'the first Spring costs nothing, and needs no Heartwood stage to be allowed');
  assert.equal(dug.haven.plantableMemories.length, 0, 'nothing is planted');
  assert.deepEqual([firstSpringBuilt(dug), firstSpringAwake(dug)], [true, false]);
  assert.equal(dug.energy.regenCap, 110);
  assert.equal(heartwoodStage(dug), 'dormant', 'a sleeping Spring has not stirred the Tree');
  assert.equal(availableHeartwoodBeds(dug).includes('back-centre'), false);
  assert.equal(buildFirstSpring(dug, NOW + 2), dug, 'a second tap, or the recovery after an interrupted effect, changes nothing');
  assert.deepEqual(normalizeHeartwoodBuildings(dug.heartwoodBuildings, NOW), dug.heartwoodBuildings, 'dormancy survives a save');

  // The garden wakes.
  const running = wakeFirstSpring(dug, NOW + 3);
  assert.deepEqual(running.heartwoodBuildings, { 'dew-spring': { level: 1, builtAt: NOW + 1 } });
  assert.equal(firstSpringAwake(running), true);
  assert.equal(heartwoodStage(running), 'stirring');
  assert.equal(wakeFirstSpring(running, NOW + 4), running);
  assert.equal(firstSpringAwake(wakeFirstSpring(fresh, NOW)), true, 'if the planting beat never landed, waking still leaves the story with its Spring');

  // After the first session it upgrades like any other building.
  const funded = { ...running, coins: 40, haven: { ...running.haven, tileStages: { mossprout: 1 } } } as MergeWorldState;
  assert.deepEqual(buildingUpgradeModel(funded, 'dew-spring').primary, { label: 'Upgrade', cost: 40, disabled: false });
  assert.equal(buildingUpgradeModel(funded, 'dew-spring').note, undefined);
  // Spending on a building that is still asleep (a story that never reached the waking beat) brings it to life.
  const paid = upgradeHeartwoodBuilding({ ...funded, heartwoodBuildings: dug.heartwoodBuildings }, 'dew-spring', 1, NOW + 5);
  assert.deepEqual(paid.heartwoodBuildings?.['dew-spring'], { level: 2, builtAt: NOW + 1 });

  // A save caught mid-session by this change, with the old seed already in the patch: the Spring takes the patch.
  const midSession = buildFirstSpring(withPlants([firstSeed({ growthPoints: 0 })]), NOW);
  assert.deepEqual([midSession.haven.plantableMemories[0]!.status, midSession.haven.plantableMemories[0]!.slotId], ['earned', null]);
  assert.equal(firstSpringBuilt(midSession), true);
});

test('a save that finished the old first session: its sprouted seed becomes a free Level 1 Dew Spring, once', () => {
  // Planted but not grown yet (the planting beat, the offer, the garden waking): nothing moves.
  const dormant = withPlants([firstSeed({ growthPoints: 0 })]);
  assert.equal(firstSeedReadyForSpring(dormant), undefined);
  assert.equal(growFirstSeedIntoSpring(dormant, NOW), dormant);
  // A seed of the player's own in that patch is not the first session's seed.
  const ownSeed = withPlants([firstSeed({ source: { kind: 'order', sourceId: 'x' } as unknown as Plant['source'] })]);
  assert.equal(growFirstSeedIntoSpring(ownSeed, NOW), ownSeed);

  const sprouted = withPlants([firstSeed()]);
  assert.equal(firstSeedReadyForSpring(sprouted)?.id, 'memory-plant:ftue');
  const rooted = growFirstSeedIntoSpring(sprouted, NOW + 1);
  assert.deepEqual(rooted.heartwoodBuildings, { 'dew-spring': { level: 1, builtAt: NOW + 1, from: 'stillness' } });
  assert.equal(rooted.coins, 0, 'the first Spring costs nothing');
  assert.equal(rooted.energy.regenCap, 110);
  assert.equal(rooted.energy.value, sprouted.energy.value + 10);
  const seed = rooted.haven.plantableMemories[0]!;
  assert.deepEqual([seed.status, seed.slotId, seed.growthPoints], ['earned', null, 1], 'the seed is kept, with its growth');
  assert.equal(sprouted.haven.plantableMemories[0]!.status, 'planted', 'the input world is untouched');
  assert.equal(growFirstSeedIntoSpring(rooted, NOW + 2), rooted, 'it only ever happens once');
  assert.equal(availableHeartwoodBeds(rooted).includes('back-centre'), false);

  // The Spring remembers its seed through a save, and the panel says so.
  assert.deepEqual(normalizeHeartwoodBuildings(rooted.heartwoodBuildings, NOW), rooted.heartwoodBuildings);
  assert.equal(buildingUpgradeModel(rooted, 'dew-spring').note, 'Grown from your Seed of Stillness.');
  assert.equal(buildingUpgradeModel(world(), 'dew-spring').note, undefined);
  assert.deepEqual(buildingUpgradeModel({ ...rooted, coins: 40 }, 'dew-spring').primary, { label: 'Upgrade', cost: 40, disabled: false });

  // A Spring the player already built is left alone.
  const alreadyBuilt = withPlants([firstSeed({ slotId: 'front-left' })], world({ buildings: { 'dew-spring': { level: 2, builtAt: NOW } } }));
  assert.equal(growFirstSeedIntoSpring(alreadyBuilt, NOW), alreadyBuilt);
});

test('Heartwood grows with its circle of buildings, and never falls back when a seed leaves its patch', () => {
  const sprouted = withPlants([firstSeed()]);
  assert.equal(heartwoodStage(sprouted), 'stirring');
  assert.equal(heartwoodStage(growFirstSeedIntoSpring(sprouted, NOW)), 'stirring', 'the Tree does not go dormant when the seed becomes the Spring');
  const levels = (level: number, count = 4): HeartwoodBuildings => Object.fromEntries(HEARTWOOD_BUILDINGS.slice(0, count).map((building) => [building.id, { level, builtAt: NOW }]));
  const bare = (buildings?: HeartwoodBuildings) => ({ ...withPlants([], world({ buildings })), kingdomGoal: undefined }) as MergeWorldState;
  assert.equal(heartwoodStage(bare()), 'dormant');
  assert.equal(heartwoodStage(bare(levels(1, 1))), 'stirring');
  assert.equal(heartwoodStage(bare(levels(1, 3))), 'rooted');
  assert.equal(heartwoodStage(bare(levels(3))), 'rooted');
  assert.equal(heartwoodStage(bare(levels(4))), 'blooming');
  assert.equal(heartwoodStage(bare({ ...levels(7), 'garden-stall': { level: 6, builtAt: NOW } })), 'blooming');
  assert.equal(heartwoodStage(bare(levels(7))), 'awakened');
});

test('every building has its own art for all three looks, and none of it is borrowed', () => {
  const source = readFileSync('constants/heartwood-building-art.ts', 'utf8');
  const specifiers = [...source.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]!);
  assert.equal(specifiers.length, HEARTWOOD_BUILDINGS.length * 3);
  assert.equal(new Set(specifiers).size, specifiers.length, 'no look is shared');
  const resolve = createRequire(join(process.cwd(), 'package.json')).resolve;
  for (const building of HEARTWOOD_BUILDINGS) {
    const own = specifiers.filter((specifier) => specifier.includes(`/heartwood-buildings/${building.id.replace('-', '_')}_`));
    assert.equal(own.length, 3, `${building.id} has three looks of its own`);
    for (const specifier of own) assert.ok(existsSync(resolve(specifier)), `${specifier} is in the art package`);
  }
  assert.doesNotMatch(source, /memory-plants|memoryNursery/, 'no stand-in art');
});

test('the five patch items share one size and seat, by layout on whole pixels, never by a transform', () => {
  assert.equal(HEARTWOOD_PATCH_ITEM_SCALE, 0.68, '20% smaller, then 15% smaller again');
  assert.deepEqual([HEARTWOOD_PATCH_ITEM.width, HEARTWOOD_PATCH_ITEM.art, HEARTWOOD_PATCH_ITEM.height], [71, 71, 84]);
  const seat = heartwoodPatchItemPosition({ left: 100.4, top: 200.7, width: 61, height: 47 });
  assert.deepEqual(seat, { position: 'absolute', left: 95, top: 180 });
  assert.ok(Object.values(seat).every((value) => typeof value !== 'number' || Number.isInteger(value)), 'a fractional position softens the art');
  assert.equal(seat.top + HEARTWOOD_PATCH_ITEM.height, Math.round(200.7 + 47 / 2 + HEARTWOOD_PATCH_ITEM.baseBelowCentre), 'the label sits below the patch centre, so the art stands in the patch');
  for (const file of ['components/katchadeck/world/heartwood-building-world.tsx', 'components/katchadeck/wisps/wisp-lantern.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /HEARTWOOD_PATCH_ITEM as ITEM/, `${file} takes its size from the shared constants`);
    assert.match(source, /allowDownscaling=\{false\}/, `${file} decodes its art at full size: the camera zooms the world`);
  }
  const canvas = readFileSync('components/katchadeck/world/kingdom-hex-canvas.tsx', 'utf8');
  const placements = canvas.split('heartwoodPatchItemPosition(').slice(1).map((rest) => rest.slice(0, 60));
  assert.ok(placements.length >= 2 && placements.every((rest) => !rest.includes('transform')), 'placed, not scaled');
});
