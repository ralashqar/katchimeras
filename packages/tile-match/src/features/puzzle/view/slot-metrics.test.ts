/**
 * Tests for the outro's ordering.
 *
 * These earn their place because the cascade is the one part of the payout that is pure arithmetic and
 * entirely invisible in a diff — the delays *are* the animation. Both previous attempts at it were
 * wrong in ways that looked fine in code: one clamped every cell to the same maximum stagger, the
 * other fired cells from different footprints interleaved. Neither would fail a typecheck.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boardIndex } from '../engine/board';
import { SLOT_GRID } from '../engine/slot-types';
import { boardMetricsForCell } from './metrics';
import {
  SLOT_ARRIVAL_MS,
  SLOT_BLAST_POP_MS,
  SLOT_BLAST_SHAKE_MS,
  SLOT_BLAST_STEP_MS,
  SLOT_BURST_STEP_MS,
  SLOT_CELL_LIFE_MS,
  SLOT_CELL_OUTRO_MS,
  SLOT_CELL_SETTLE_FRACTION,
  SLOT_CELL_SETTLE_MS,
  SLOT_GROUP_GAP_MS,
  SLOT_MAX_CELL,
  SLOT_MIN_CELL,
  SLOT_SETTLE_GAP_MS,
  SLOT_TARGET_CELL,
  beatSettleMs,
  blastSettleMs,
  buildSlotBurst,
  slotArrivalSpanMs,
  slotBlastSpanMs,
  slotBurstSpanMs,
} from './slot-metrics';
import type { BlockColorId } from '../engine/types';

const GRID = SLOT_GRID;
const METRICS = boardMetricsForCell(GRID, 38);

const cell = (row: number, column: number, colorId: BlockColorId = 'turbo') => ({
  index: boardIndex(GRID, row, column),
  colorId,
});

test('cells go out one at a time, in the order they were filled', () => {
  // The whole point: a run of pops the player can count, matching the run of haptic taps. A spatial
  // ordering would fire them in an order nothing on screen corresponds to.
  const cells = [cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)];
  const burst = buildSlotBurst(GRID, METRICS, cells, [4]);

  assert.deepEqual(
    burst.map((entry) => entry.delayMs),
    [0, SLOT_BURST_STEP_MS, SLOT_BURST_STEP_MS * 2, SLOT_BURST_STEP_MS * 3],
  );
});

test('each footprint gets a breath before the next one starts', () => {
  // Two groups of two. Without the gap the sequence is uniform and the grouping is invisible.
  const cells = [cell(0, 0), cell(0, 1), cell(3, 2), cell(3, 3)];
  const burst = buildSlotBurst(GRID, METRICS, cells, [2, 2]);

  assert.equal(burst[0].delayMs, 0);
  assert.equal(burst[1].delayMs, SLOT_BURST_STEP_MS);
  // Third cell starts the second group, so it takes the gap on top of its sequence position.
  assert.equal(burst[2].delayMs, SLOT_BURST_STEP_MS * 2 + SLOT_GROUP_GAP_MS);
  assert.equal(burst[3].delayMs, SLOT_BURST_STEP_MS * 3 + SLOT_GROUP_GAP_MS);
});

test('delays are strictly increasing, so no two cells pop together', () => {
  const cells = Array.from({ length: 12 }, (_, i) => cell(i % GRID.rows, i % GRID.cols));
  const burst = buildSlotBurst(GRID, METRICS, cells, [4, 4, 4]);

  for (let i = 1; i < burst.length; i += 1) {
    assert.ok(
      burst[i].delayMs > burst[i - 1].delayMs,
      `cell ${i} starts at ${burst[i].delayMs}, not after ${burst[i - 1].delayMs}`,
    );
  }
});

test('a footprint that was missed entirely does not shift the ones after it', () => {
  // The edge case an earlier version got wrong. A group whose piece missed contributes zero cells, so
  // two group boundaries land on the same offset — dedupe them and the group index under-counts, which
  // quietly shrinks the gap for every later footprint.
  const cells = [cell(0, 0), cell(3, 2), cell(3, 3)];
  const burst = buildSlotBurst(GRID, METRICS, cells, [1, 0, 2]);

  assert.equal(burst[0].delayMs, 0);
  // The third group is group index 2, so it takes two gaps even though group 1 drew nothing.
  assert.equal(burst[1].delayMs, SLOT_BURST_STEP_MS + SLOT_GROUP_GAP_MS * 2);
  assert.equal(burst[2].delayMs, SLOT_BURST_STEP_MS * 2 + SLOT_GROUP_GAP_MS * 2);
});

test('no group sizes at all still produces a plain sequence', () => {
  // The default. Callers that have no grouping to declare should still get a one-at-a-time cascade
  // rather than everything at zero.
  const burst = buildSlotBurst(GRID, METRICS, [cell(0, 0), cell(0, 1)]);
  assert.deepEqual(
    burst.map((entry) => entry.delayMs),
    [0, SLOT_BURST_STEP_MS],
  );
});

test('positions come from the cell grid and carry the colour through', () => {
  const burst = buildSlotBurst(GRID, METRICS, [cell(2, 3, 'nitro')], [1]);
  assert.equal(burst[0].colorId, 'nitro');
  assert.equal(burst[0].x, METRICS.outer + 3 * METRICS.pitch);
  assert.equal(burst[0].y, METRICS.outer + 2 * METRICS.pitch);
});

test('the reported span covers the last cell', () => {
  const cells = [cell(0, 0), cell(0, 1), cell(3, 2), cell(3, 3)];
  const burst = buildSlotBurst(GRID, METRICS, cells, [2, 2]);
  const last = Math.max(...burst.map((entry) => entry.delayMs));

  assert.ok(
    slotBurstSpanMs(cells.length, 2) >= last,
    `span ${slotBurstSpanMs(cells.length, 2)} is shorter than the last delay ${last}`,
  );
});

test('the span never under-estimates, even when a footprint drew nothing', () => {
  // The hold timer is computed from this, so an under-estimate cuts the tail off the animation.
  const cells = [cell(0, 0), cell(3, 2), cell(3, 3)];
  const burst = buildSlotBurst(GRID, METRICS, cells, [1, 0, 2]);
  const last = Math.max(...burst.map((entry) => entry.delayMs));
  assert.ok(slotBurstSpanMs(cells.length, 3) >= last);
});

test('an empty beat has no span and no cells', () => {
  assert.deepEqual(buildSlotBurst(GRID, METRICS, [], []), []);
  assert.equal(slotBurstSpanMs(0, 0), 0);
});

test('no cell is left without a delay it can be drawn at', () => {
  // The field hides every cell the instant a beat resolves, so from that frame on the burst is the only
  // thing drawing them — including the ones whose turn has not come. Those are drawn at rest, which only
  // works if their delay is a real number the burst can compare against its ramp. A cell that came back
  // `undefined` or `NaN` here would fail that comparison and vanish until its window opened, which is
  // exactly the bug this pins: gone, pause, then pop.
  const cells = Array.from({ length: 12 }, (_, i) => cell(i % GRID.rows, i % GRID.cols));
  const burst = buildSlotBurst(GRID, METRICS, cells, [4, 4, 4]);

  assert.equal(burst.length, cells.length, 'every cleared cell must appear in the burst');
  for (const [ordinal, entry] of burst.entries()) {
    assert.ok(Number.isFinite(entry.delayMs), `cell ${ordinal} has a non-finite delay`);
    assert.ok(entry.delayMs >= 0, `cell ${ordinal} has a negative delay`);
  }
});

test('the whole cascade fits inside the burst\'s delay ceiling', () => {
  // Past the ceiling the burst clamps, which bunches the tail of the cascade into one simultaneous pop.
  // The largest beat the game can deal is three footprints of four cells.
  const worst = slotBurstSpanMs(3 * 4, 3);
  assert.ok(worst <= 780, `the longest cascade is ${worst}ms, past the 780ms ceiling`);
});

// ------------------------------------------------- cells out, then ghosts in

test('the settle always outlasts the burst, so ghosts never enter over an outro', () => {
  // The ordering the whole outro depends on. Checked across every beat shape the game can deal — one
  // to three footprints of two to four cells each — because a flat pause is exactly what failed here:
  // a three-slot cascade runs nearly three times as long as a one-slot one.
  for (let groups = 1; groups <= 3; groups += 1) {
    for (let perGroup = 2; perGroup <= 4; perGroup += 1) {
      const cellCount = groups * perGroup;
      const burstEnds = slotBurstSpanMs(cellCount, groups) + SLOT_CELL_OUTRO_MS;
      const settle = beatSettleMs(cellCount, groups);
      assert.ok(
        settle >= burstEnds,
        `${groups} groups of ${perGroup}: settle ${settle}ms lands before the burst ends at ${burstEnds}ms`,
      );
    }
  }
});

test('cells settle and leave as one pipeline, not two phases', () => {
  /**
   * The property that makes the payout quick. Each cell's window is `settle` then `leave`, and the stagger
   * between cells is far shorter than that window — so cell two is still rising while cell one is already
   * falling.
   *
   * The design this replaced sequenced the two halves *globally*: every cell popped, and only once the
   * last had finished did any cell begin to leave. That is what read as a wait, and it is why this is
   * asserted rather than left to the constants happening to be in the right ratio.
   */
  assert.ok(
    SLOT_BURST_STEP_MS < SLOT_CELL_SETTLE_MS,
    `a cell starts leaving after ${SLOT_CELL_SETTLE_MS}ms but the next only starts ${SLOT_BURST_STEP_MS}ms later — ` +
      'if the stagger were the longer of the two the cells would run one at a time',
  );
  assert.ok(SLOT_CELL_LIFE_MS === SLOT_CELL_SETTLE_MS + SLOT_CELL_OUTRO_MS);
  assert.ok(
    SLOT_CELL_SETTLE_FRACTION > 0 && SLOT_CELL_SETTLE_FRACTION < 1,
    'the split has to fall inside the window for the burst to remap around it',
  );
});

test('the settle covers the last cell\'s whole life, rise included', () => {
  // The last cell starts at the end of the cascade and then still has to settle *and* leave. Measuring
  // only its departure would deal the next beat over a cell that was still swelling.
  for (let groups = 1; groups <= 3; groups += 1) {
    for (let perGroup = 2; perGroup <= 4; perGroup += 1) {
      const cellCount = groups * perGroup;
      const lastCellDone = slotBurstSpanMs(cellCount, groups) + SLOT_CELL_LIFE_MS;
      assert.ok(
        beatSettleMs(cellCount, groups) >= lastCellDone,
        `${groups}x${perGroup}: dealt at ${beatSettleMs(cellCount, groups)}ms, last cell done at ${lastCellDone}ms`,
      );
    }
  }
});

test('the pop is quick enough not to dominate a beat', () => {
  // It runs before the outro, so it is pure added latency between the last drop and the payout. Four
  // cells is the largest piece, and even then the pop should be a fraction of the settle.
  const longest = slotArrivalSpanMs(4);
  assert.ok(longest < 500, `${longest}ms is too long to sit in front of every payout`);
  assert.ok(longest > SLOT_ARRIVAL_MS, 'a multi-cell pop should stagger, not fire as one');
});

test('a single-cell pop is just the one window, unstaggered', () => {
  assert.equal(slotArrivalSpanMs(1), SLOT_ARRIVAL_MS);
});

test('no cells means no wait at all', () => {
  // This gates the outro, so a drop that filled nothing must not hold the payout back. It used to report
  // a full window here on the reasoning that a span is never zero — which was true of the number and
  // wrong about what the number is for: a quarter-second of stillness with nothing on screen.
  assert.equal(slotArrivalSpanMs(0), 0);
  assert.equal(slotArrivalSpanMs(-3), 0);
});

test('a beat that filled nothing skips straight to the next one', () => {
  // Every piece can miss, leaving no cells to pop and none to burst. The settle should then be the bare
  // gap rather than a pop window plus a cascade window over an empty field.
  const empty = beatSettleMs(0, 0);
  const smallest = beatSettleMs(2, 1);
  assert.ok(empty < smallest, `${empty}ms should be shorter than the ${smallest}ms a real beat takes`);
  assert.ok(empty > 0, 'but still a beat of pause, so the turn does not read as skipped');
});

test('the settle scales with the payout rather than being flat', () => {
  // A consequence rather than the goal, but worth pinning: a big beat earns a longer beat of silence
  // to land in, and a one-slot opener moves on briskly.
  const small = beatSettleMs(3, 1);
  const large = beatSettleMs(12, 3);
  assert.ok(large > small * 1.5, `${small}ms vs ${large}ms is barely a difference`);
});

test('the settle leaves a real gap after the last cell, not a hair', () => {
  const cellCount = 9;
  const groups = 3;
  const burstEnds = slotBurstSpanMs(cellCount, groups) + SLOT_CELL_OUTRO_MS;
  assert.ok(beatSettleMs(cellCount, groups) - burstEnds >= 150);
});

test('an empty beat still holds a moment before the next one', () => {
  // Reachable: every piece can miss, leaving nothing to burst. Dealing instantly would read as the beat
  // having been skipped — but there is no cascade to wait out either, so the hold is the bare gap.
  assert.equal(beatSettleMs(0, 0), SLOT_SETTLE_GAP_MS);
  assert.ok(SLOT_SETTLE_GAP_MS > 0);
});

// -------------------------------------------------------------------- the blast

test('the blast is two movements: everything judders, then the cells go one by one', () => {
  /**
   * The shape of the animation, asserted rather than described, because the order is the whole reading. The
   * judder is a *shared* wind-up — every cell rattling at once says the turn is about to go — and the pops are
   * staggered so the field comes apart rather than blinking out. Reverse them and it reads as cells vanishing
   * followed by an aftershock.
   */
  assert.ok(SLOT_BLAST_SHAKE_MS > 0, 'there has to be a wind-up for the bang to land against');
  // The first cell pops at the end of the judder, so the two movements meet rather than overlapping.
  assert.equal(slotBlastSpanMs(1), SLOT_BLAST_SHAKE_MS + SLOT_BLAST_POP_MS);
  // And each extra cell adds exactly one step.
  assert.equal(slotBlastSpanMs(4) - slotBlastSpanMs(3), SLOT_BLAST_STEP_MS);
});

test('the detonation rips rather than cascading', () => {
  /**
   * The tempo is what separates this from the payout. A burst *streams* because streaming is the reward — each
   * cell earning its own moment — so its step is slow enough for the motor to resolve one tap per cell. A blast
   * is one event, and a stagger as slow as the burst's would turn it into a queue of small failures.
   */
  assert.ok(
    SLOT_BLAST_STEP_MS < SLOT_BURST_STEP_MS,
    `the blast steps at ${SLOT_BLAST_STEP_MS}ms against the burst's ${SLOT_BURST_STEP_MS}ms`,
  );
  // But the whole thing still has to be long enough to read as an event rather than a glitch.
  assert.ok(slotBlastSpanMs(6) > 400, `six cells detonate in only ${slotBlastSpanMs(6)}ms`);
});

test('a voided beat is held long enough to see itself blow up', () => {
  /**
   * The bug this exists to prevent, and it was a real one: a voided beat clears no cells, so `beatSettleMs`
   * gives it the bare gap — 140ms — and the next beat's footprints faded in over a detonation that had barely
   * started. Losing a whole turn is the harshest outcome in the game and it was also the quietest.
   */
  for (const cells of [1, 4, 6, 12]) {
    assert.ok(
      blastSettleMs(cells) > slotBlastSpanMs(cells),
      `${cells} cells: the hold must outlast the blast`,
    );
    assert.ok(
      blastSettleMs(cells) > beatSettleMs(0, 0),
      `${cells} cells: the hold must beat the empty-burst settle it replaces`,
    );
  }
  assert.equal(blastSettleMs(0), SLOT_SETTLE_GAP_MS, 'nothing to blow up is still the bare gap');
});

test('the cell size range is ordered and contains the target', () => {
  assert.ok(SLOT_MIN_CELL < SLOT_MAX_CELL);
  assert.ok(SLOT_TARGET_CELL >= SLOT_MIN_CELL && SLOT_TARGET_CELL <= SLOT_MAX_CELL);
  // Below ~32pt a cell is hard to hit, and this game grades how precisely you hit it.
  assert.ok(SLOT_MIN_CELL >= 32);
});

test('the burst step is slow enough for the motor to resolve separate taps', () => {
  // `haptics.cellCascade` fires one tap per cell at this step. Below ~30ms the motor blurs adjacent
  // pulses into one buzz, which is exactly the "doesn't feel like anything" failure.
  assert.ok(SLOT_BURST_STEP_MS >= 30, `${SLOT_BURST_STEP_MS}ms is below the motor's resolution`);
});
