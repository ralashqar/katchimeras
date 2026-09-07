/**
 * The bomb: which piece is rigged, what disarms it, and what detonating costs.
 *
 * The stakes make this the variety most worth testing. Every other way a beat falls short still pays for what
 * landed; this one pays nothing, so a bug in either direction is a bad one — a bomb that fails to arm makes the
 * mechanic invisible, and one that fails to disarm makes a turn unwinnable through no fault of the player.
 *
 * These test the variety in isolation. `slot-engine.test.ts` covers the other half — that a `voidBeat` effect
 * actually zeroes the payout through the reducer.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BOMB_CLASH_COLOR,
  BOMB_VARIETY,
  BOMB_WINDOW_MS,
  bombWindowMs,
  type BombData,
} from './bomb';
import type { DealContext, PlaceInput } from '../contract';
import { SLOT_GRID } from '../../engine/slot-types';
import { BLOCK_COLOR_IDS } from '../../engine/types';
import type { BlockColorId, Piece } from '../../engine/types';

const piece = (id: string, colorId: BlockColorId = 'turbo'): Piece => ({
  id,
  shapeId: 'domino',
  cells: [
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  ],
  colorId,
  used: false,
});

const context = (trayIds: string[], rngState = 1234): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 3,
  combo: 7,
  groups: [],
  tray: trayIds.map((id) => piece(id)),
  rngState,
});

/** A footprint paired with a tray piece, which is the pairing `shape` has to keep intact. */
const group = (id: string, pieceId: string, colorId: BlockColorId) => ({
  id,
  zone: 'left' as const,
  pieceId,
  colorId,
  cells: [10, 11],
  origin: { row: 2, column: 2 },
  filled: [],
});

/** A beat whose pieces carry the given colours, footprints paired by id. */
const coloured = (colors: BlockColorId[], rngState = 1234): DealContext => ({
  grid: SLOT_GRID,
  beatIndex: 3,
  combo: 7,
  groups: colors.map((colorId, index) => group(`g${index}`, `p${index}`, colorId)),
  tray: colors.map((colorId, index) => piece(`p${index}`, colorId)),
  rngState,
});

const placing = (id: string): PlaceInput => ({
  piece: piece(id),
  groupId: 'g',
  coverage: 1,
  grade: 'perfect',
});

/** Deal a bomb and hand back just its data. */
const dealt = (strength: number, trayIds = ['a', 'b'], rngState = 1234): BombData =>
  BOMB_VARIETY.deal(context(trayIds, rngState), strength).data;

// -------------------------------------------------------------------- dealing

test('the variant comes from the strength, so a level can choose deliberately', () => {
  /**
   * Not rolled. A stream level's two bomb turns differ by one number, and that is what makes them two
   * *different* turns — one asking "which order" and one asking "when" — rather than the same turn twice with a
   * coin toss deciding which question the player gets.
   */
  assert.equal(dealt(0).variant, 'defuse');
  assert.equal(dealt(0.49).variant, 'defuse');
  assert.equal(dealt(0.5).variant, 'cycle');
  assert.equal(dealt(1).variant, 'cycle');
});

test('a one-piece beat is forced to cycle, whatever strength asked for', () => {
  /**
   * The substitution, and it is a correctness rule rather than a preference: `defuse` is answered by playing the
   * *other* piece, and on a single there is no other piece — so an armed `defuse` bomb there is a turn nobody
   * can win. `cycle` is answerable with one piece, because the clock is the whole answer.
   *
   * Substituting rather than dealing inert is the change that makes a solo bomb a real mechanic. Inert was the
   * safe answer while `defuse` was the only option; it also meant a level asking for a bomb on a single got a
   * plain turn and no warning.
   */
  for (const strength of [0, 0.2, 0.49, 0.5, 1]) {
    const solo = dealt(strength, ['only']);
    assert.equal(solo.variant, 'cycle', `strength ${strength} should still be a cycle on a single`);
    assert.equal(solo.pieceId, 'only', 'and the one piece is the rigged one');
    assert.equal(solo.armed, true);
  }
  // The clock is what makes it playable, so it must be asking for one.
  assert.equal(BOMB_VARIETY.deadlineMs?.(dealt(0, ['only'])), bombWindowMs(0));
});

test('which piece is rigged is rolled, and the roll advances the generator', () => {
  /**
   * Rolled so the mechanic cannot be memorised: with a fixed index a player would learn "the left one is safe"
   * in two beats and the decision would evaporate.
   *
   * The seeds below are chosen to land on different pieces, which is the point — the same beat shape must be
   * able to rig either one.
   */
  const rigged = new Set<string | null>();
  for (let seed = 0; seed < 40; seed += 1) {
    rigged.add(dealt(0, ['a', 'b'], seed * 7919).pieceId);
  }
  assert.deepEqual([...rigged].sort(), ['a', 'b'], 'both pieces should be riggable');

  const result = BOMB_VARIETY.deal(context(['a', 'b']), 0);
  assert.notEqual(result.rngState, 1234, 'the roll must advance the generator');
});

test('the roll costs the same however many pieces there are to rig', () => {
  /**
   * **The rng rule, and the one most easily broken.** The number of pieces must not change how far the generator
   * advances, or two beats differing only in their slot count would leave it in different states and every deal
   * after them would diverge.
   *
   * `nextInt` is called with a different *bound* for one piece than for two and still lands in the same place,
   * which is a property of the generator rather than an accident — worth pinning here, because the obvious
   * "optimisation" of skipping the roll when there is only one candidate would break it silently.
   */
  const single = BOMB_VARIETY.deal(context(['only']), 0);
  const double = BOMB_VARIETY.deal(context(['a', 'b']), 0);
  const empty = BOMB_VARIETY.deal(context([]), 0);
  assert.equal(
    single.rngState,
    double.rngState,
    'the generator must land in the same place whatever the tray held',
  );
  assert.equal(empty.rngState, double.rngState, 'including when there was nothing to rig at all');
});

test('an empty tray is inert rather than a crash', () => {
  // Reachable if a level asks for a bomb on a turn the dealer could not fill. Degrading beats throwing.
  const empty = BOMB_VARIETY.deal(context([]), 1);
  assert.equal(empty.data.pieceId, null);
  assert.equal(empty.data.armed, false);
});

test('both variants open live', () => {
  /**
   * `cycle` used to open **disarmed**, on the reasoning that opening live would detonate anyone who reacted
   * quickly and so teach hesitation rather than timing. That was backwards, and it is worth recording why,
   * because the argument for it still sounds right:
   *
   * A brisk player drops inside the first window. Opening disarmed meant they dropped into the safe half, and
   * the bomb — drawn dim, never fired — was simply not part of their turn. The mechanic was invisible to exactly
   * the player it was meant to challenge. Opening live inverts it: the first thing on screen is a lit fuse, and
   * the answer is available by looking rather than by reflex.
   *
   * `defuse` opened live already, because being live is the whole problem it poses.
   */
  assert.equal(dealt(1).armed, true, 'a cycle bomb opens live');
  assert.equal(dealt(0).armed, true, 'and so does a defuse bomb');
});

test('strength squeezes the cycle window without closing it', () => {
  assert.equal(bombWindowMs(0), BOMB_WINDOW_MS);
  assert.ok(bombWindowMs(1) < BOMB_WINDOW_MS);
  /**
   * The window has to survive a whole drag. A double's pace budget allows 2550ms for two placements, so about
   * 1.2s a piece — a window shorter than that would detonate a player who started their drag inside a safe gap,
   * which is a loss they could not have avoided.
   */
  assert.ok(bombWindowMs(1) > 1400, `the tightest window is only ${bombWindowMs(1)}ms`);
  // Monotonic, and clamped outside 0..1.
  assert.ok(bombWindowMs(0.5) < bombWindowMs(0) && bombWindowMs(0.5) > bombWindowMs(1));
  assert.equal(bombWindowMs(-1), bombWindowMs(0));
  assert.equal(bombWindowMs(9), bombWindowMs(1));
});

// ------------------------------------------------------------- the colour clash

test('a bomb beat never contains the red the marker is drawn in', () => {
  /**
   * The marker pulses in `semantic.sabotageAxis`, and one of the five block colours *is* that red. A red dot on a
   * red cell is invisible, and a red footprint beside a red warning reads as one object — so the colour is taken
   * out of the beat entirely.
   *
   * Out of the **whole** beat rather than just the rigged piece, and that is forced rather than chosen: `shape`
   * runs before `deal`, so at this point nobody knows which piece will be rigged. It is also the stronger
   * guarantee — the rigged footprint must contrast with the marker, and its neighbour must contrast with the
   * rigged one.
   */
  for (const colors of [
    [BOMB_CLASH_COLOR],
    [BOMB_CLASH_COLOR, 'turbo'],
    ['turbo', BOMB_CLASH_COLOR],
  ] as BlockColorId[][]) {
    const shaped = BOMB_VARIETY.shape?.(coloured(colors), 1);
    assert.ok(shaped, 'the bomb must reshape the beat');
    for (const entry of shaped.tray) {
      assert.notEqual(entry.colorId, BOMB_CLASH_COLOR, 'no tray piece may wear the clash colour');
    }
    for (const entry of shaped.groups) {
      assert.notEqual(entry.colorId, BOMB_CLASH_COLOR, 'and no footprint may either');
    }
  }
});

test('recolouring moves the piece and its footprint together, or the beat is unwinnable', () => {
  /**
   * The trap in this whole change, and the reason it is one edit rather than two. **Colour is a rule** —
   * `matchesColour` pairs a piece with its footprint by colour — so recolouring a piece and leaving its footprint
   * behind deals a turn with no legal drop in it. The pieces still fit; nothing may be placed.
   *
   * Paired by `group.pieceId`, which is the pairing the dealer established and the only one that survives a
   * reshape.
   */
  const shaped = BOMB_VARIETY.shape?.(coloured([BOMB_CLASH_COLOR, 'coolant']), 1);
  assert.ok(shaped);
  for (const entry of shaped.groups) {
    // Annotated because `assert.ok` is an assertion signature, and TypeScript will not infer a binding it is
    // asked to narrow in the same statement it was declared.
    const paired: Piece | undefined = shaped.tray.find((candidate) => candidate.id === entry.pieceId);
    assert.ok(paired, `no piece for footprint ${entry.id}`);
    assert.equal(entry.colorId, paired.colorId, 'a footprint must match the piece it names');
  }
  // And the colours are still distinct, or two footprints become indistinguishable.
  const used = shaped.groups.map((entry) => entry.colorId);
  assert.equal(new Set(used).size, used.length);
});

test('the substitute is a colour the beat was not already using, and costs no randomness', () => {
  /**
   * Deterministic rather than rolled, twice over. It consumes no rng — so the contract's parity rule is satisfied
   * by there being nothing to burn — and a fixed substitute cannot make two otherwise-identical beats diverge.
   *
   * With five colours against at most two pieces there is always one free, so the fallback in `shape` is
   * unreachable at current sizes; it exists so a wider beat degrades rather than throwing.
   */
  const ctx = coloured([BOMB_CLASH_COLOR, 'coolant'], 777);
  const shaped = BOMB_VARIETY.shape?.(ctx, 1);
  assert.equal(shaped?.rngState, 777, 'reshaping must not touch the generator');

  const swapped = shaped!.tray.find((entry) => entry.id === 'p0')!;
  assert.notEqual(swapped.colorId, 'coolant', 'it must not collide with the other piece');
  assert.ok(BLOCK_COLOR_IDS.includes(swapped.colorId));
});

test('a beat with no clashing colour is left exactly as it was', () => {
  // The common case — four beats in five — and it should cost nothing. Asserted by identity on the entries, which
  // is what a repaint would break.
  const ctx = coloured(['turbo', 'coolant']);
  const shaped = BOMB_VARIETY.shape?.(ctx, 1);
  ctx.groups.forEach((entry, index) => assert.equal(shaped?.groups[index], entry));
  ctx.tray.forEach((entry, index) => assert.equal(shaped?.tray[index], entry));
});

// -------------------------------------------------------------------- defusing

test('playing the other piece first disarms a defuse bomb', () => {
  const data = dealt(0, ['a', 'b'], 1);
  const safe = data.pieceId === 'a' ? 'b' : 'a';
  assert.equal(data.armed, true);

  const after = BOMB_VARIETY.onPlace?.(data, placing(safe));
  assert.equal(after?.data.armed, false, 'the safe piece should have defused it');
  assert.deepEqual(after?.effects, [], 'and cost nothing');

  // The rigged piece is then just a piece.
  const then = BOMB_VARIETY.onPlace?.(after!.data, placing(data.pieceId!));
  assert.deepEqual(then?.effects, [], 'a defused bomb must not detonate');
});

test('playing the rigged piece first detonates it', () => {
  const data = dealt(0, ['a', 'b'], 1);
  const boom = BOMB_VARIETY.onPlace?.(data, placing(data.pieceId!));
  assert.deepEqual(boom?.effects, [{ kind: 'voidBeat' }]);
});

test('the rigged piece is checked before the defuse rule', () => {
  /**
   * Order-of-checks, and getting it wrong would make the mechanic self-defusing: a `defuse` bomb whose "played
   * something else" branch ran first would treat the rigged piece as "something else" and disarm itself.
   */
  const data = dealt(0, ['a', 'b'], 1);
  const result = BOMB_VARIETY.onPlace?.(data, placing(data.pieceId!));
  assert.equal(result?.data.armed, true, 'it must still be armed — it went off');
  assert.deepEqual(result?.effects, [{ kind: 'voidBeat' }]);
});

test('nothing defuses a cycling bomb but the clock', () => {
  // The distinction between the two variants, as one assertion. Playing the safe piece is not the answer here.
  const data = { ...dealt(1, ['a', 'b'], 1), armed: true };
  const safe = data.pieceId === 'a' ? 'b' : 'a';
  const after = BOMB_VARIETY.onPlace?.(data, placing(safe));
  assert.equal(after?.data.armed, true, 'playing the other piece must not help on a cycle bomb');
});

test('an inert bomb never detonates whatever is played', () => {
  // Only an *empty* tray is inert now — a one-piece beat is a real bomb. Reachable if a level asks for one on a
  // turn the dealer could not fill.
  const data = dealt(0, []);
  assert.equal(data.pieceId, null);
  for (const id of ['only', 'other']) {
    assert.deepEqual(BOMB_VARIETY.onPlace?.(data, placing(id))?.effects, []);
  }
});

test('a solo bomb detonates on its one piece while live, and is safe in the next window', () => {
  /**
   * The whole solo variant, end to end. It has to be *both* halves: a bomb that only detonated would be an
   * unwinnable turn, and one that never did would be decoration.
   */
  const data = dealt(1, ['only']);
  const boom = BOMB_VARIETY.onPlace?.(data, placing('only'));
  assert.deepEqual(boom?.effects, [{ kind: 'voidBeat' }], 'dropping in window 0 must cost the turn');

  const cooled = BOMB_VARIETY.expire?.(data, data.windowMs);
  assert.equal(cooled?.data.armed, false, 'window 1 is the safe one');
  const safe = BOMB_VARIETY.onPlace?.(cooled!.data, placing('only'));
  assert.deepEqual(safe?.effects, [], 'and the same drop then costs nothing');
});

// --------------------------------------------------------------------- timing

test('only a cycling bomb asks for the clock', () => {
  /**
   * What lets the screen skip dispatching a tick entirely on a `defuse` beat. Paying for a per-frame reducer
   * call to be told nothing happened is the cost this avoids.
   */
  assert.equal(BOMB_VARIETY.deadlineMs?.(dealt(0)), null, 'a defuse bomb is event-driven');
  assert.equal(BOMB_VARIETY.deadlineMs?.(dealt(1)), dealt(1).windowMs);
  assert.equal(BOMB_VARIETY.deadlineMs?.(dealt(1, [])), null, 'an inert bomb wants no clock');
});

test('the bomb toggles on its schedule', () => {
  const data = dealt(1, ['a', 'b'], 1);
  const window = data.windowMs;

  // Starts **live**; the first window ends and it goes cold.
  const first = BOMB_VARIETY.expire?.(data, window);
  assert.equal(first?.data.armed, false);
  assert.equal(first?.data.nextToggleMs, window * 2);
  assert.deepEqual(first?.effects, [], 'a toggle costs nothing by itself');

  // And back on again.
  const second = BOMB_VARIETY.expire?.(first!.data, window * 2);
  assert.equal(second?.data.armed, true);
  assert.equal(second?.data.nextToggleMs, window * 3);
});

test('a late tick catches up rather than falling permanently behind', () => {
  /**
   * `beatElapsedMs` can arrive well past the deadline — a stalled frame, a backgrounded app, or simply a beat
   * whose first tick came after several windows. Stepping the schedule once would leave it behind the clock
   * forever, so the state is derived from *how many* windows have elapsed.
   */
  const data = dealt(1, ['a', 'b'], 1);
  const window = data.windowMs;

  const late = BOMB_VARIETY.expire?.(data, window * 4.5);
  assert.equal(late?.data.nextToggleMs, window * 5, 'the schedule should be ahead of the clock again');
  // Windows run live, dead, live, dead, live — so mid-way through window 4 it is live.
  assert.equal(late?.data.armed, true);

  // And the parity is right at every window, however it is reached.
  for (let windows = 1; windows <= 8; windows += 1) {
    const jumped = BOMB_VARIETY.expire?.(data, window * windows);
    assert.equal(
      jumped?.data.armed,
      windows % 2 === 0,
      `after ${windows} windows the bomb should be ${windows % 2 === 0 ? 'live' : 'dead'}`,
    );
  }
});

test('the schedule always moves forward, so a tick cannot fire twice on one window', () => {
  const data = dealt(1, ['a', 'b'], 1);
  let current = data;
  let previous = 0;
  for (let i = 0; i < 6; i += 1) {
    const next = BOMB_VARIETY.expire?.(current, current.nextToggleMs);
    assert.ok(next!.data.nextToggleMs > previous, 'the next toggle must be later than the last');
    previous = next!.data.nextToggleMs;
    current = next!.data;
  }
});
