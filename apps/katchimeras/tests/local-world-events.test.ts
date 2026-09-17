import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalEventPilot, DEFAULT_HARMONY } from '@/features/live-ops/local-catalog';
import { localOrderId, projectLocalEvents, reduceLocalEvent } from '@/features/live-ops/local-runtime';
import { applyHarmonyEvent } from '@/features/live-ops/rules';
import { validateLiveEvent } from '@/features/live-ops/validate';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import { createInitialMergeWorldState, normalizeMergeWorldState, reduceMergeWorld } from '@/utils/merge-world/engine';
import { mergeCommandEvents } from '@/features/live-ops/merge-events';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { GameplayEvent } from '@/types/gameplay-event';
import type { LocalEventCommand } from '@/types/local-live-ops';

const now = Date.parse('2026-10-02T12:00:00Z');
const catalog = createLocalEventPilot().liveEvents!.map(e => ({ ...e, enabled: true }));
const harmony = { version: 1 as const, points: 100, milestones: {} };
function initial() { const world = createInitialMergeWorldState(now); world.haven.tileStages.mossprout = 1; return world; }
function action(id: string): GameplayEvent { return { version: 1, id, kind: 'order_completed', source: 'merge-world', sourceRevision: 1, contentRevision: 1, occurredAt: now, quantity: 1, context: {} }; }

test('both designer templates validate; legacy clients cannot accept playable local content', () => {
  const pack = createLocalEventPilot();
  assert.deepEqual(normalizeContentRelease([pack]).issues, []);
  assert.ok(normalizeContentRelease([{ ...pack, contentSchemaVersion: 2 }]).issues.some(i => i.includes('schema 3')));
  for (const event of catalog) assert.deepEqual(validateLiveEvent(event).issues, []);
  assert.ok(validateLiveEvent({ ...catalog[0], tiers: [{ id: 'bad', points: 1, free: { id: 'bad', items: [{ kind: 'gems', amount: 1 }] } }] }).issues.length);
});

test('garden and Harmony gates preserve existing stories; joining pins a definition', () => {
  assert.throws(() => reduceLocalEvent(createInitialMergeWorldState(now), { type: 'join', eventId: catalog[0].id }, harmony, catalog, now), /Restore/);
  assert.throws(() => reduceLocalEvent(initial(), { type: 'join', eventId: catalog[0].id }, { ...harmony, points: 99 }, catalog, now), /Harmony/);
  const world = reduceLocalEvent(initial(), { type: 'join', eventId: catalog[0].id }, harmony, catalog, now).world;
  const copy = structuredClone(catalog); copy[0].title = 'Replacement';
  const next = reduceLocalEvent(world, { type: 'join', eventId: catalog[0].id }, harmony, copy, now).world;
  assert.equal(next.localLiveOps!.runs[catalog[0].id].definition.title, catalog[0].title);
});

test('one committed action advances overlapping events once; historical actions cannot score', () => {
  let world = initial();
  for (const e of catalog) world = reduceLocalEvent(world, { type: 'join', eventId: e.id }, harmony, catalog, now).world;
  world = projectLocalEvents(world, [action('one'), { ...action('old'), historical: true }], now);
  world = projectLocalEvents(world, [action('one')], now);
  for (const run of Object.values(world.localLiveOps!.runs)) assert.equal(run.progress.points, 20);
});

test('full incursion: real order delivery, persistent merge board, three resolutions and permanent keepsake', () => {
  let world = initial();
  const apply = (command: LocalEventCommand) => { world = normalizeMergeWorldState(JSON.parse(JSON.stringify(reduceLocalEvent(world, command, harmony, catalog, now).world)), now); };
  apply({ type: 'join', eventId: catalog[0].id });
  for (const node of catalog[0].encounters!) {
    apply({ type: 'begin', eventId: catalog[0].id, nodeId: node.id });
    const orderId = localOrderId(catalog[0].id, node.id);
    // Populate the ordinary board with the authored requirements, then use the real serve reducer.
    const slots = world.board.flatMap((c, i) => !c.locked && !c.mist && !c.blocker ? [i] : []);
    let index = 0;
    for (const r of node.requirements) for (let n = 0; n < r.quantity; n++) {
      const cell = slots[index++];
      world.board[cell] = { ...world.board[cell], occupant: { kind: 'item', instanceId: `supply-${index}`, definitionId: r.definitionId } };
    }
    const command = { type: 'serveOrder' as const, orderId, now };
    const served = reduceMergeWorld(world, command);
    assert.equal(served.servedOrderId, orderId, served.message);
    world = projectLocalEvents(served.state, mergeCommandEvents(world, command, served, 1), now);
    world = normalizeMergeWorldState(JSON.parse(JSON.stringify(world)), now);
    assert.equal(world.localLiveOps!.runs[catalog[0].id].nodes[node.id].phase, 'board');
    const cells = missionWindow(3).cellIndices;
    for (let i = 0; i < 3; i++) apply({ type: 'move', eventId: catalog[0].id, nodeId: node.id, from: cells[i * 2], to: cells[i * 2 + 1] });
    assert.equal(world.localLiveOps!.runs[catalog[0].id].nodes[node.id].phase, 'resolution');
    apply({ type: 'resolve', eventId: catalog[0].id, nodeId: node.id });
    apply({ type: 'resolve', eventId: catalog[0].id, nodeId: node.id });
  }
  assert.equal(world.haven.tileStages.mossprout, 1);
  assert.ok(world.localLiveOps!.keepsakes['moonlit-lantern']);
  assert.equal(world.localLiveOps!.runs[catalog[0].id].progress.points, 360);
  const coins = world.coins;
  apply({ type: 'claim', eventId: catalog[0].id, tierId: 'first-light' });
  apply({ type: 'claim', eventId: catalog[0].id, tierId: 'first-light' });
  assert.equal(world.coins, coins + 25);
  apply({ type: 'equip', keepsakeId: 'moonlit-lantern' });
  const expired = reduceLocalEvent(world, { type: 'refresh' }, harmony, [], now + 20 * 86400000).world;
  assert.equal(expired.localLiveOps!.equipped, 'moonlit-lantern');
});

test('expired orders cannot consume inventory; clock rollback cannot reactivate them', () => {
  let world = reduceLocalEvent(initial(), { type: 'join', eventId: catalog[0].id }, harmony, catalog, now).world;
  world = reduceLocalEvent(world, { type: 'begin', eventId: catalog[0].id, nodeId: catalog[0].encounters![0].id }, harmony, catalog, now).world;
  const late = now + 20 * 86400000;
  const before = JSON.stringify(world.board);
  const attempt = reduceMergeWorld(world, { type: 'serveOrder', orderId: world.activeOrders.at(-1)!.id, now: late });
  assert.equal(attempt.changed, false);
  assert.equal(JSON.stringify(attempt.state.board), before);
  world = reduceLocalEvent(world, { type: 'refresh' }, harmony, [], late).world;
  assert.ok(!world.activeOrders.some(o => o.id.startsWith('local-event:')));
  assert.throws(() => reduceLocalEvent(world, { type: 'begin', eventId: catalog[0].id, nodeId: catalog[0].encounters![1].id }, harmony, catalog, now), /finished/);
});

test('Harmony preserves issued awards across definition changes', () => {
  const event = { ...action('restore'), kind: 'hex_restored' as const, context: { targetId: 'garden', level: 1 } };
  const awarded = applyHarmonyEvent({ version: 1, points: 0, milestones: {} }, event);
  assert.equal(awarded.points, 25);
  assert.equal(applyHarmonyEvent(awarded, event, { ...DEFAULT_HARMONY, awards: { hex_restored: 500 } }).points, 25);
});
