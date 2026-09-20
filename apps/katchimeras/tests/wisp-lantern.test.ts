import { wispPackCards, wispPackFocus } from '@/utils/wisp-pack-presentation';
import { WISP_RARITY } from '@/constants/wisp-rarity';
import { heartwoodStage } from '@/features/shared-adventure/heartwood-progression';
import { availableHeartwoodBeds, heartwoodPlants, placeHeartwood, reconcileHeartwoodPlants } from '@/features/shared-adventure/heartwood-garden';
import { buildPlayerProfileFixtures } from '@/utils/player-profile-fixtures';
import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_WISP_STATE, normalizeWispState, applyWispGrant } from '@/utils/wisp-state';
import { reduceWispLantern, pendingLanternPack } from '@/utils/wisp-lantern-state';
import { LANTERN_VISITORS, ORDINARY_PACK, ORDINARY_PROTECTION, validateLanternPacks } from '@/constants/wisp-lantern';
import { WISP_CATALOG } from '@/constants/wisps';
import { wispOwnershipState } from '@/utils/wisp-ownership';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { placeLanternWorld, lanternEligible, startLanternWorld, projectLanternWorld, WELCOME_ORDER_IDS } from '@/features/wisps/lantern-world';
import { mergeCommandEvents } from '@/features/live-ops/merge-events';
import type { WispCollectionState } from '@/types/wisp';
import type { GameplayEvent } from '@/types/gameplay-event';
import { LANTERN_INTRO } from '@/features/wisps/lantern-definition';
import { validateContentFlowDefinition } from '@/features/content-flow/content-flow-compiler';
import { registerStoryCapability } from '@/features/content-flow/story-capability-registry';
import { createLocalEventPilot } from '@/features/live-ops/local-catalog';
import { validateLiveEvent } from '@/features/live-ops/validate';
import { reduceLocalEvent } from '@/features/live-ops/local-runtime';
import { emptyHarmony } from '@/features/live-ops/rules';

const NOW = new Date(2026, 8, 19, 12).getTime();
const lit = (seed = 123) => reduceWispLantern(EMPTY_WISP_STATE, { type: 'unlock' }, NOW, seed);
function pouch(state: WispCollectionState, id: string, seed: number) {
  state = reduceWispLantern(state, { type: 'grant_pack', receiptId: id, definitionId: ORDINARY_PACK, seed }, NOW);
  return reduceWispLantern(state, { type: 'open_pack', packId: id }, NOW);
}
function readyWorld() {
  const world = createInitialMergeWorldState(NOW);
  world.kingdomGoal = { introducedAt: NOW, coachmarkSeenAt: null };
  world.gardenLessons = { feastle: { preparedAt: NOW, servedAt: NOW } };
  return world;
}
test('only ready cosmetic visitors enter packs; intro compiles with registered capabilities', () => {
  validateLanternPacks(WISP_CATALOG);
  assert.throws(() => validateLanternPacks(WISP_CATALOG.map(w => w.id === 'crystal' ? { ...w, semanticClass: 'family_signature' } : w)));
  registerStoryCapability({ id: 'wisp.lantern.scene', kind: 'scene' });
  for (const id of ['wisp.lantern.light', 'wisp.lantern.finish']) registerStoryCapability({ id, kind: 'effect', idempotent: true });
  assert.deepEqual(validateContentFlowDefinition(LANTERN_INTRO), []);
});
test('welcome outcome is distinct, deterministic, persisted before reveal and replay safe', () => {
  for (let seed = 0; seed < 100; seed++) {
    const start = lit(seed);
    assert.throws(() => reduceWispLantern(start, { type: 'complete_intro' }, NOW));
    const opened = reduceWispLantern(start, { type: 'open_pack', packId: 'lantern:welcome:v2' }, NOW);
    const pack = opened.lantern!.packs['lantern:welcome:v2'];
    assert.equal(new Set(pack.outcomes!.map(o => o.id)).size, 1);
    assert.ok(pack.outcomes!.every(o => o.id !== 'crystal' && o.discovered));
    assert.deepEqual(opened.resonanceCounts, {});
    assert.equal(opened.pendingResonance, null);
    const resumed = normalizeWispState(JSON.parse(JSON.stringify(opened)));
    assert.deepEqual(pendingLanternPack(resumed), pack);
    assert.deepEqual(reduceWispLantern(resumed, { type: 'open_pack', packId: pack.id }, NOW + 1), resumed);
    assert.deepEqual(start.lantern!.packs[pack.id].outcomes, undefined);
    const revealed = reduceWispLantern(resumed, { type: 'acknowledge_reveal', packId: pack.id, revealed: 3 }, NOW);
    assert.equal(reduceWispLantern(revealed, { type: 'complete_intro' }, NOW).lantern!.introducedAt, NOW);
  }
});
test('duplicates give echoes; third dry pack guarantees missing; purchases never alter personal history', () => {
  let state = lit();
  for (const id of LANTERN_VISITORS.slice(0, 5)) state = applyWispGrant(state, id, `legacy:${id}`, 'experience', { now: NOW }).state;
  const history = structuredClone(state.resonanceCounts);
  state.lantern!.dryPacks = 2;
  state.lantern!.dryPacksByGroup[ORDINARY_PROTECTION] = 2;
  state = pouch(state, 'pity', 1);
  assert.ok(state.lantern!.packs.pity.outcomes!.some(o => o.id === 'crystal' && o.discovered));
  assert.equal(state.lantern!.dryPacks, 0);
  assert.deepEqual(state.resonanceCounts, history);
  const before = state.lantern!.echoes;
  state = pouch(state, 'dupes', 1);
  assert.equal(state.lantern!.echoes - before, state.lantern!.packs.dupes.outcomes!.reduce((sum, o) => sum + (o.id === 'crystal' ? 5 : 1), 0));
  assert.equal(state.lantern!.dryPacks, 0);
  const claimed = reduceWispLantern(state, { type: 'claim_collection' }, NOW);
  assert.equal(claimed.lantern!.cosmetics.filter(id => id === 'first-gathering').length, 1);
  assert.equal(reduceWispLantern(claimed, { type: 'claim_collection' }, NOW), claimed);
});
test('echo choices are explicit, scoped, replay safe and cannot buy personal wisps', () => {
  let state = lit(); state.lantern!.echoes = 35;
  assert.throws(() => reduceWispLantern(state, { type: 'exchange', receiptId: 'bad', wispId: 'sprout' }, NOW));
  state = reduceWispLantern(state, { type: 'exchange', receiptId: 'choice', wispId: 'crystal' }, NOW);
  assert.equal(state.lantern!.echoes, 20);
  assert.equal(reduceWispLantern(state, { type: 'exchange', receiptId: 'choice', wispId: 'crystal' }, NOW), state);
  state = reduceWispLantern(state, { type: 'exchange', receiptId: 'trail', cosmeticId: 'lantern-trail' }, NOW);
  assert.equal(state.lantern!.echoes, 0);
  assert.throws(() => reduceWispLantern(state, { type: 'exchange', receiptId: 'repeat', cosmeticId: 'lantern-trail' }, NOW));
  const bad = structuredClone(state); bad.lantern!.packs['lantern:welcome:v2'].definitionVersion = 99;
  assert.throws(() => reduceWispLantern(bad, { type: 'open_pack', packId: 'lantern:welcome:v2' }, NOW), /newer version/);
});
test('legacy ownership and server-only ownership contribute once without manufacturing local grants', () => {
  const legacy = normalizeWispState({ version: 1, unlocked: { sprout: { unlockedAt: 3, sourceDayId: 'old', seenReveal: true } }, equippedWispId: 'sprout' });
  const result = wispOwnershipState(legacy, [{ collectibleType: 'wisp', collectibleId: 'sprout', quantity: 1, source: 'purchase', grantedAt: '2026-09-19T12:00:00Z' }, { collectibleType: 'wisp', collectibleId: 'crystal', quantity: 1, source: 'purchase', grantedAt: NOW }]);
  assert.equal(result.inventory.sprout!.quantity, 1);
  assert.equal(result.inventory.crystal!.quantity, 1);
  assert.equal(legacy.inventory.crystal, undefined);
  assert.equal(result.equippedWispId, 'sprout');
  const local = lit();
  const assigned = reduceWispLantern(local, { type: 'residents', ids: ['crystal'] }, NOW, 1, ['crystal']);
  assert.deepEqual(assigned.lantern!.residents, ['crystal']);
  assert.equal(assigned.inventory.crystal, undefined, 'read-only external ownership never becomes a local grant');
  assert.throws(() => reduceWispLantern(local, { type: 'exchange', receiptId: 'already-owned', wispId: 'crystal' }, NOW, 1, ['crystal']));
});
test('eligibility requires Feastle and Heartwood, and welcome orders give exactly one pouch each', () => {
  assert.equal(lanternEligible(createInitialMergeWorldState(NOW)), false);
  let world = startLanternWorld(readyWorld(), NOW);
  assert.equal(startLanternWorld(world, NOW), world);
  for (const id of WELCOME_ORDER_IDS) {
    const order = world.activeOrders.find(o => o.id === id)!;
    let cell = 0;
    for (const requirement of order.requirements) for (let n = 0; n < requirement.quantity; n++) {
      world.board[cell] = { ...world.board[cell], locked: false, blocker: null, mist: null, occupant: { kind: 'item', definitionId: requirement.definitionId, instanceId: `supply:${cell}` } }; cell++;
    }
    const command = { type: 'serveOrder' as const, orderId: id, now: NOW };
    const result = reduceMergeWorld(world, command);
    assert.equal(result.changed, true, result.message);
    assert.deepEqual(result.state.externalRewardReceipts, world.externalRewardReceipts, 'visitor requests never create companion-story receipts');
    const events = mergeCommandEvents(world, command, result, 1);
    const coins = world.coins;
    world = projectLanternWorld(result.state, events);
    assert.equal(world.coins, coins);
    assert.equal(world.wispLanternProgress!.dailyOrders, 0);
    assert.deepEqual(projectLanternWorld(world, events), world);
  }
  assert.equal(Object.keys(world.wispLanternProgress!.rewards).length, 2);
  assert.ok(!world.activeOrders.some(o => WELCOME_ORDER_IDS.includes(o.id as typeof WELCOME_ORDER_IDS[number])));
});
test('daily rewards exclude untagged, historical and replayed events and resist clock rollback', () => {
  let world = startLanternWorld(readyWorld(), NOW);
  const event = (id: string, at: number, tags = ['lantern-daily-order']): GameplayEvent => ({ version: 1, id, kind: 'order_completed', source: 'merge-world', sourceRevision: 1, contentRevision: 1, occurredAt: at, quantity: 1, context: { targetId: id, tags } });
  world = projectLanternWorld(world, [event('story', NOW, []), { ...event('historic', NOW), historical: true }]);
  assert.equal(world.wispLanternProgress!.dailyOrders, 0);
  const first = Array.from({ length: 8 }, (_, n) => event(`first:${n}`, NOW));
  world = projectLanternWorld(world, first);
  assert.equal(Object.keys(world.wispLanternProgress!.rewards).length, 1);
  world = projectLanternWorld(world, first);
  world = projectLanternWorld(world, Array.from({ length: 5 }, (_, n) => event(`next:${n}`, NOW + 86_400_000)));
  world = projectLanternWorld(world, Array.from({ length: 5 }, (_, n) => event(`rollback:${n}`, NOW)));
  assert.equal(Object.keys(world.wispLanternProgress!.rewards).length, 2);
});

test('local event pouch rewards validate, claim once and reject verified scope', () => {
  const definition = createLocalEventPilot(new Date(NOW - 1000).toISOString()).liveEvents![0];
  definition.enabled = true;
  definition.minHarmony = 0;
  definition.requiresRestoredGarden = false;
  delete definition.encounters;
  definition.tiers = [{ id: 'pouch', points: 0, free: { id: 'pouch-reward', items: [{ kind: 'wisp_pack', scope: 'local-lantern-v1', packId: ORDINARY_PACK }] } }];
  assert.deepEqual(validateLiveEvent(definition).issues, []);
  let world = startLanternWorld(readyWorld(), NOW);
  world = reduceLocalEvent(world, { type: 'join', eventId: definition.id }, emptyHarmony(), [definition], NOW).world;
  const claim = { type: 'claim' as const, eventId: definition.id, tierId: 'pouch' };
  world = reduceLocalEvent(world, claim, emptyHarmony(), [definition], NOW).world;
  world = reduceLocalEvent(world, claim, emptyHarmony(), [definition], NOW).world;
  assert.equal(Object.keys(world.wispLanternProgress!.rewards).length, 1);
  definition.tiers[0].free.items = [{ kind: 'wisp_pack', scope: 'verified', packId: ORDINARY_PACK }];
  assert.ok(validateLiveEvent(definition).issues.length > 0);
});

test('existing welcome pouches retain their original contents and never receive a second grant', () => {
  let state = lit();
  const pack = state.lantern!.packs['lantern:welcome:v2'];
  delete state.lantern!.packs[pack.id];
  pack.id = 'lantern:welcome:v1'; pack.definitionVersion = 1;
  state.lantern!.packs[pack.id] = pack;
  state = reduceWispLantern(state, { type: 'unlock' }, NOW);
  assert.equal(Object.keys(state.lantern!.packs).length, 1);
  state = reduceWispLantern(state, { type: 'open_pack', packId: pack.id }, NOW);
  assert.equal(state.lantern!.packs[pack.id].outcomes!.length, 3);
  const saved = normalizeWispState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(reduceWispLantern(saved, { type: 'unlock' }, NOW).lantern!.packs, saved.lantern!.packs);
});

test('Lantern placement reserves one bed without losing the first seed or displaced growth', () => {
  const input = buildPlayerProfileFixtures(NOW).find(f => f.id === 'fixture:kingdom-before-wisp-lantern')!.domains.mergeWorld.state;
  assert.equal(input.wispLanternPlacement, undefined);
  const first = input.haven.plantableMemories.find(p => p.status === 'planted')!;
  input.haven.plantableMemories.push({ ...first, id: 'displaced', definitionId: 'warmth', source: { kind: 'tending', sourceId: 'test' }, slotId: 'front-right', growthPoints: 3 });
  const placed = placeLanternWorld(input, NOW);
  assert.equal(placed.wispLanternPlacement?.slotId, 'front-right');
  const restored = normalizeMergeWorldState(JSON.parse(JSON.stringify(placed)), NOW + 1);
  assert.deepEqual(restored.wispLanternPlacement, placed.wispLanternPlacement);
  assert.equal(availableHeartwoodBeds(restored).length, 4);
  assert.equal(availableHeartwoodBeds(placed).length, 4);
  assert.deepEqual(placed.haven.plantableMemories.find(p => p.id === first.id), first);
  assert.equal(placed.haven.plantableMemories.find(p => p.id === 'displaced')!.status, 'earned');
  assert.equal(heartwoodPlants(placed).find(p => p.category === 'warmth')!.achievedGrowth, 3);
  assert.equal(placeLanternWorld(placed, NOW + 1), placed);
  assert.throws(() => placeHeartwood(placed, 'warmth', 'front-right', null, NOW), /available/);
  assert.equal(reduceMergeWorld(placed, { type: 'placePlantableMemory', instanceId: 'displaced', slotId: 'front-right', receiptId: 'bad', now: NOW }).changed, false);
  reconcileHeartwoodPlants(placed);
  assert.ok(!placed.haven.plantableMemories.some(p => p.status === 'planted' && p.slotId === 'front-right'));
  assert.equal(placeHeartwood(placed, 'warmth', 'front-left', null, NOW), true);
  assert.equal(heartwoodPlants(placed).find(p => p.category === 'warmth')!.achievedGrowth, 3);
});

test('four plant beds can still awaken Heartwood through five historical blooms', () => {
  const world = placeLanternWorld(readyWorld(), NOW);
  const beds = availableHeartwoodBeds(world);
  const categories = ['momentum', 'stillness', 'renewal', 'warmth', 'curiosity'] as const;
  world.haven.plantableMemories = categories.map((category, i) => ({
    id: `bloom:${category}`, definitionId: category, status: i === 4 ? 'earned' : 'planted',
    slotId: i === 4 ? null : beds[i], growthPoints: 3, source: { kind: 'tending', sourceId: 'test' }, earnedAt: NOW, plantedAt: NOW,
  }));
  assert.equal(heartwoodStage(world), 'awakened');
  assert.equal(placeHeartwood(world, 'curiosity', beds[1], 'bloom:stillness', NOW + 1), true);
  assert.equal(heartwoodStage(world), 'awakened');
  assert.equal(world.haven.plantableMemories.filter(p => p.status === 'planted').length, 4);
});

test('pack decks retain duplicate slot identities and saved focus without consuming the reveal', () => {
  let state = pouch(lit(), 'duplicates-deck', 1);
  const pack = state.lantern!.packs['duplicates-deck'];
  pack.outcomes = [{ id: 'dewdrop', discovered: true, echoes: 0 }, { id: 'dewdrop', discovered: false, echoes: 1 }, { id: 'crystal', discovered: true, echoes: 0 }];
  const cards = wispPackCards(pack);
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map(card => card.id)).size, 3);
  assert.equal(cards[0].wispId, cards[1].wispId);
  const before = structuredClone(state.inventory);
  state = reduceWispLantern(state, { type: 'focus_pack_card', packId: pack.id, index: 2 }, NOW);
  const restored = normalizeWispState(JSON.parse(JSON.stringify(state)));
  assert.equal(wispPackFocus(restored.lantern!.packs[pack.id]), 2);
  assert.equal(restored.lantern!.packs[pack.id].revealed, 0);
  assert.deepEqual(restored.inventory, before);
  assert.throws(() => reduceWispLantern(state, { type: 'focus_pack_card', packId: pack.id, index: 3 }, NOW));
  assert.throws(() => reduceWispLantern(state, { type: 'focus_pack_card', packId: pack.id, index: -1 }, NOW));
  state = reduceWispLantern(state, { type: 'acknowledge_reveal', packId: pack.id, revealed: 3 }, NOW);
  assert.equal(state.lantern!.packs[pack.id].revealed, 3);
});

test('rarity has readable labels, distinct symbols, and stable current duplicate values', () => {
  assert.deepEqual(Object.keys(WISP_RARITY), ['common', 'rare', 'epic', 'legendary']);
  assert.equal(new Set(Object.values(WISP_RARITY).map(rarity => rarity.symbol)).size, 4);
  for (const id of LANTERN_VISITORS) {
    const definition = WISP_CATALOG.find(wisp => wisp.id === id)!;
    assert.equal(WISP_RARITY[definition.rarity].echoes, id === 'crystal' ? 5 : 1);
  }
});
