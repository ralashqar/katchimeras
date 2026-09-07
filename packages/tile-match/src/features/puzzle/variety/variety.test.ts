/**
 * The variety contract and its folds.
 *
 * Three of the six capabilities exist for modes that have not been written yet — reshaping a beat, reacting
 * to time, gating what counts — so this suite is what makes them real rather than aspirational. Each is
 * exercised through a fake variety injected into the folds, which is why `VarietyLookup` is a parameter: the
 * alternative would be registering a test mode in the production table.
 *
 * The properties that matter most here are not about any mode. They are about **identity** — `expireVarieties`
 * and `eligibleGroups` must return their input untouched when nothing happened, because the reducer turns
 * that into a no-op and the whole 60Hz tick rests on it — and about the **rng**, because a variety that
 * advances the generator differently depending on whether it fired would make every later deal diverge.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defineVariety, hasVariety, varietyData } from './contract';
import type { DealContext, VarietyDef, VarietyRequest } from './contract';
import {
  VARIETY_IDS,
  dealVarieties,
  eligibleGroups,
  expireVarieties,
  isVarietyId,
  nextDeadlineMs,
  shapeBeat,
  varietyDef,
  type VarietyLookup,
} from './registry';
import { BOMB_VARIETY } from './bomb/bomb';
import { DRIFT_VARIETY, type DriftData } from './drift/drift';
import { SLOT_GRID } from '../engine/slot-types';
import type { Beat, SlotGroup } from '../engine/slot-types';
import type { Piece } from '../engine/types';

// ------------------------------------------------------------------- fixtures

const group = (id: string, colorId: Piece['colorId'], cells: number[]): SlotGroup => ({
  id,
  zone: 'left',
  pieceId: `piece-${id}`,
  colorId,
  cells,
  origin: { row: 2, column: 2 },
  filled: [],
});

const piece = (id: string, colorId: Piece['colorId']): Piece => ({
  id,
  shapeId: 'domino',
  cells: [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ],
  colorId,
  used: false,
});

const beatWith = (varieties: Beat['varieties'], groups: SlotGroup[] = []): Beat => ({
  index: 1,
  groups,
  placements: [],
  status: 'placing',
  launch: false,
  varieties,
  voided: false,
});

const context = (overrides: Partial<DealContext> = {}): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 1,
  combo: 3,
  groups: [],
  tray: [],
  rngState: 1000,
  ...overrides,
});

/** A lookup over a hand-built table, so a fake variety can be folded without being registered. */
const lookup = (table: Record<string, VarietyDef<any>>): VarietyLookup => (id) => table[id];

const ask = (id: string, strength = 1): VarietyRequest[] => [{ id, strength }];

// --------------------------------------------------------------- the registries

test('every registered variety has both halves', async () => {
  /**
   * The one structural rule, as a test.
   *
   * A variety is two registrations — its logic in `registry.ts`, its layers in `view-registry.ts` — because
   * the engine must not reach React. Nothing enforces that pairing at the type level across two files, so a
   * variety could ship with rules and no way to see it, or with a layer and no rules behind it.
   *
   * The view registry is imported dynamically because it pulls in Reanimated, which `node --test` cannot
   * load. That is the split working: if this import ever *succeeded* synchronously at the top of this file,
   * the engine's own tests would be one refactor away from importing React.
   */
  let viewIds: readonly string[] | null = null;
  try {
    const views = await import('./view-registry');
    viewIds = views.VARIETY_VIEW_IDS;
  } catch {
    // Reanimated is not loadable here; the id parity is then checked by `tsc` instead, since
    // `VARIETY_VIEWS` is declared `satisfies Record<VarietyId, VarietyView>` and a missing key fails to
    // compile. Recorded rather than skipped silently.
    viewIds = null;
  }

  if (viewIds) {
    assert.deepEqual([...viewIds].sort(), [...VARIETY_IDS].sort());
  } else {
    assert.ok(VARIETY_IDS.length > 0, 'the registry should not be empty');
  }
});

test('an id is only a variety id if it is actually registered', () => {
  for (const id of VARIETY_IDS) assert.ok(isVarietyId(id), `${id} is in the table but not an id`);
  assert.ok(!isVarietyId('not-a-variety'));
  assert.ok(!isVarietyId(''));
  // And `varietyDef` agrees rather than having its own opinion.
  assert.equal(varietyDef('drift'), DRIFT_VARIETY);
  assert.equal(varietyDef('bomb'), BOMB_VARIETY);
  assert.equal(varietyDef('not-a-variety'), undefined);
});

test('an unknown variety degrades instead of throwing', () => {
  /**
   * A beat can outlive the registry: a level config naming a variety since removed, or a run restored from
   * storage. Skipping it costs that beat one decoration; throwing would end the race.
   *
   * It must also consume **no roll**, or the generator's state would depend on which varieties happen to be
   * compiled into the build — which is the same class of bug as skipping a roll conditionally.
   */
  const ctx = context();
  const dealt = dealVarieties(ask('nope'), ctx);
  assert.deepEqual(dealt.varieties, []);
  assert.equal(dealt.rngState, ctx.rngState, 'an unregistered variety must not advance the generator');
  assert.equal(shapeBeat(ask('nope'), ctx), null);
});

// ------------------------------------------------------------------ dealing

test('deal freezes the requested strength onto the beat', () => {
  const dealt = dealVarieties(ask('drift', 0.7), context());
  assert.deepEqual(dealt.varieties, [{ id: 'drift', data: { strength: 0.7 } }]);
});

test('the generator is threaded through every variety in order', () => {
  /**
   * The rng rule, and the reason `deal` returns a state rather than taking one by reference. Two varieties
   * that each consume a roll must see *different* states, and the beat must end on the last one.
   */
  const table = lookup({
    a: defineVariety<number>({
      id: 'a',
      deal: (ctx) => ({ data: ctx.rngState, rngState: ctx.rngState + 1 }),
    }),
    b: defineVariety<number>({
      id: 'b',
      deal: (ctx) => ({ data: ctx.rngState, rngState: ctx.rngState + 10 }),
    }),
  });

  const dealt = dealVarieties(
    [
      { id: 'a', strength: 1 },
      { id: 'b', strength: 1 },
    ],
    context({ rngState: 500 }),
    table,
  );

  assert.deepEqual(dealt.varieties.map((spec) => spec.data), [500, 501]);
  assert.equal(dealt.rngState, 511, 'the beat should end on the last variety’s state');
});

test('a variety that rolls nothing leaves the generator exactly where it was', () => {
  // Drift's whole pure half. Not a special case dodged: it makes no random choice, so it advances nothing.
  const ctx = context({ rngState: 4242 });
  assert.equal(dealVarieties(ask('drift'), ctx).rngState, 4242);
});

// ------------------------------------------------------------------- shaping

test('shaping runs before dealing and composes in order', () => {
  /**
   * Capability A, and the only one that can make a beat unsolvable — which is why a variety using it owes a
   * `beatHasPerfectSolution` test of its own.
   *
   * The ordering claim is the one worth pinning: the second reshaper must see what the first produced, not
   * the skeleton the dealer laid out, or two reshaping varieties on one beat would silently fight.
   */
  const seen: number[] = [];
  const table = lookup({
    first: defineVariety<null>({
      id: 'first',
      deal: (ctx) => ({ data: null, rngState: ctx.rngState }),
      shape: (ctx) => ({
        groups: [...ctx.groups, group('added-1', 'turbo', [10])],
        tray: [...ctx.tray, piece('p1', 'turbo')],
        rngState: ctx.rngState + 1,
      }),
    }),
    second: defineVariety<null>({
      id: 'second',
      deal: (ctx) => ({ data: null, rngState: ctx.rngState }),
      shape: (ctx) => {
        seen.push(ctx.groups.length);
        return {
          groups: [...ctx.groups, group('added-2', 'nitro', [11])],
          tray: [...ctx.tray, piece('p2', 'nitro')],
          rngState: ctx.rngState + 1,
        };
      },
    }),
  });

  const shaped = shapeBeat(
    [
      { id: 'first', strength: 1 },
      { id: 'second', strength: 1 },
    ],
    context({ rngState: 7 }),
    table,
  );

  assert.deepEqual(seen, [1], 'the second reshaper should see the first one’s groups');
  assert.equal(shaped?.groups.length, 2);
  assert.equal(shaped?.tray.length, 2);
  assert.equal(shaped?.rngState, 9, 'both reshapers should have advanced the generator');
});

test('a beat nobody reshapes is left entirely alone', () => {
  // `null` rather than a copy of the input, so the dealer can skip the assignment altogether.
  assert.equal(shapeBeat(ask('drift'), context()), null);
});

// ---------------------------------------------------------------- deadlines

const FUSE = defineVariety<{ at: number; blown: boolean; pieceId: string }>({
  id: 'fuse',
  deal: (ctx) => ({ data: { at: 3000, blown: false, pieceId: 'doomed' }, rngState: ctx.rngState }),
  deadlineMs: (data) => (data.blown ? null : data.at),
  expire: (data) => ({
    data: { ...data, blown: true },
    effects: [{ kind: 'losePiece', pieceId: data.pieceId }],
  }),
});

const fuseTable = lookup({ fuse: FUSE });

test('a beat with no timed variety asks for no tick at all', () => {
  /**
   * What lets the screen skip dispatching entirely, which is every beat at today's tuning. Ticking anyway
   * would work — the fold would return null — but it would burn a reducer call per frame to be told nothing.
   */
  assert.equal(nextDeadlineMs(beatWith([])), null);
  assert.equal(nextDeadlineMs(beatWith([{ id: 'drift', data: { strength: 1 } }])), null);
});

test('the soonest deadline wins, and a spent one stops asking', () => {
  const live = beatWith([{ id: 'fuse', data: { at: 3000, blown: false, pieceId: 'a' } }]);
  assert.equal(nextDeadlineMs(live, fuseTable), 3000);

  const spent = beatWith([{ id: 'fuse', data: { at: 3000, blown: true, pieceId: 'a' } }]);
  assert.equal(nextDeadlineMs(spent, fuseTable), null, 'a blown fuse must stop asking to be told');
});

test('a tick that crosses nothing returns null, so the reducer can no-op', () => {
  /**
   * **The load-bearing one.** The screen dispatches a tick from the fixed-step loop, sixty times a second;
   * the reducer converts this `null` into an identity return, and `use-match` treats identity as a no-op. If
   * this ever returned a fresh object on an uneventful tick, the run state would change every frame and the
   * promise that React state holds only discrete things would be gone — silently, as a frame-rate problem
   * rather than as a failing test.
   */
  const beat = beatWith([{ id: 'fuse', data: { at: 3000, blown: false, pieceId: 'a' } }]);
  assert.equal(expireVarieties(beat, 0, fuseTable), null);
  assert.equal(expireVarieties(beat, 2999, fuseTable), null);
  // And a beat with no varieties at all, which is the cheapest path.
  assert.equal(expireVarieties(beatWith([]), 99999, fuseTable), null);
});

test('crossing a deadline advances the variety and asks for its effect', () => {
  const beat = beatWith([{ id: 'fuse', data: { at: 3000, blown: false, pieceId: 'doomed' } }]);
  const advanced = expireVarieties(beat, 3000, fuseTable);

  assert.ok(advanced, 'the deadline was reached, so something should have happened');
  assert.deepEqual(advanced?.effects, [{ kind: 'losePiece', pieceId: 'doomed' }]);
  assert.deepEqual(advanced?.varieties, [
    { id: 'fuse', data: { at: 3000, blown: true, pieceId: 'doomed' } },
  ]);
  // The input is untouched: the fold copies rather than mutating, so the caller keeps a usable old state.
  assert.equal(beat.varieties[0].data, beat.varieties[0].data);
  assert.deepEqual(beat.varieties, [
    { id: 'fuse', data: { at: 3000, blown: false, pieceId: 'doomed' } },
  ]);
});

test('a deadline already passed still fires exactly once', () => {
  // The screen can be late — a stalled frame, a backgrounded app — so crossing must be "at or past", and the
  // variety's own data is what stops it firing again.
  const beat = beatWith([{ id: 'fuse', data: { at: 3000, blown: false, pieceId: 'a' } }]);
  const first = expireVarieties(beat, 9999, fuseTable);
  assert.equal(first?.effects.length, 1);

  const after = beatWith(first?.varieties ?? []);
  assert.equal(expireVarieties(after, 9999, fuseTable), null, 'it must not fire twice');
});

// ------------------------------------------------------------------- gating

const COLOUR_LOCK = defineVariety<{ allow: string }>({
  id: 'colour-lock',
  deal: (ctx) => ({ data: { allow: 'turbo' }, rngState: ctx.rngState }),
  accepts: (data, { group: target, piece: dropped }) =>
    target.colorId === dropped.colorId && dropped.colorId === data.allow,
});

const lockTable = lookup({ 'colour-lock': COLOUR_LOCK });

test('with nothing gating, the beat’s own groups come back by identity', () => {
  /**
   * The common case, and it must allocate nothing: this runs on every drop. Identity rather than a equal copy
   * because that is what proves no array was built.
   */
  const groups = [group('a', 'turbo', [1]), group('b', 'nitro', [2])];
  const beat = beatWith([{ id: 'drift', data: { strength: 1 } }], groups);
  assert.equal(eligibleGroups(beat, piece('p', 'turbo')), beat.groups);
});

test('a gating variety can refuse a group, which makes the drop a miss', () => {
  /**
   * Capability D, and the reason it is expressed as *candidacy* rather than as a grade override: a refused
   * group is simply not offered to `scorePlacement`, so the drop overlaps nothing scorable and comes out
   * coverage 0, grade `miss` — through the exact path a badly aimed drop already takes. `scorePlacement` and
   * `gradePlacement` never learn that varieties exist.
   */
  const groups = [group('a', 'turbo', [1]), group('b', 'nitro', [2])];
  const beat = beatWith([{ id: 'colour-lock', data: { allow: 'turbo' } }], groups);

  const matching = eligibleGroups(beat, piece('p', 'turbo'), lockTable);
  assert.deepEqual(
    matching.map((entry) => entry.id),
    ['a'],
    'only the group whose colour matches should be a candidate',
  );

  const wrong = eligibleGroups(beat, piece('p', 'coolant'), lockTable);
  assert.deepEqual(wrong, [], 'a piece no group accepts should have nowhere to land');
});

test('gates compose: every variety has to accept, not just one', () => {
  const groups = [group('a', 'turbo', [1])];
  const never = defineVariety<null>({
    id: 'never',
    deal: (ctx) => ({ data: null, rngState: ctx.rngState }),
    accepts: () => false,
  });
  const beat = beatWith(
    [
      { id: 'colour-lock', data: { allow: 'turbo' } },
      { id: 'never', data: null },
    ],
    groups,
  );

  const table = lookup({ 'colour-lock': COLOUR_LOCK, never });
  assert.deepEqual(eligibleGroups(beat, piece('p', 'turbo'), table), []);
});

// ------------------------------------------------------------------ reading

test('a beat’s variety data reads back typed, and absence is undefined', () => {
  const beat = beatWith([{ id: 'drift', data: { strength: 0.8 } }]);
  assert.equal(varietyData<DriftData>(beat, 'drift')?.strength, 0.8);
  assert.equal(varietyData<DriftData>(beat, 'fuse'), undefined);
  assert.ok(hasVariety(beat, 'drift'));
  assert.ok(!hasVariety(beat, 'fuse'));
  assert.ok(!hasVariety(beatWith([]), 'drift'));
});
