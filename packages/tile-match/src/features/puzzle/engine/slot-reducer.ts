/**
 * The slot game's rule set, as one pure function.
 *
 * Knows nothing about racing, rendering, sound, or time. `eventSequence` increments once per
 * **resolved beat** — not per placement — so the match bridge detects a payout by diffing, exactly
 * as it did for the board.
 *
 * ## Why the beat, not the placement, is the unit of payout
 *
 * On the board every placement could clear, so every placement was an event. Here a beat may need
 * two or three pieces before anything completes, and paying out per piece would mean the speed
 * impulse arrived in dribbles with no combo to multiply it. Resolving once, when the last piece of
 * the beat lands, is what makes a beat feel like a move: one burst, one cascade, one boost, one
 * verdict on the streak.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { hashSeed } from '../../../core/rng';
import { dealBeat } from './slot-deal';
import { DEFAULT_LADDER, planBeat, type Progression } from './progression';
import {
  absorbDrop,
  beatPaceAllowanceMs,
  eligibleGroups,
  expireVarieties,
  nextDeadlineMs,
  observePlacement,
} from '../variety/registry';
import type { VarietyEffect, VarietySpec } from '../variety/contract';
import { gradeBeat, gradePace, gradePlacement } from './slot-grade';
import { scorePlacement } from './slot-drop';
import { SLOT_GRID } from './slot-types';
import type {
  Beat,
  Placement,
  PlacementGrade,
  PlacementRefusal,
  SlotAction,
  SlotGroup,
  SlotRunState,
} from './slot-types';
import type { BlockColorId, BoardSpec, Piece, Resolution } from './types';

/**
 * Scoring weights. Score is cosmetic — speed is the real currency — but it is what the results
 * screen shows, so it should reward the thing the game is about.
 */
const SCORE_PER_FILLED_CELL = 10;
/** Flat bonus per exactly-placed piece. Deliberately larger than a cell, so accuracy dominates. */
const SCORE_PER_PERFECT_PLACEMENT = 120;
const SCORE_PER_COMBO = 60;
/**
 * Flat bonus for a beat that was exact **and** on time. The only thing pace is worth.
 *
 * This is where the cost of being late lives, and it is deliberately a flat forfeit rather than a
 * multiplier: it is paid once and does not compound, so a slow beat is a slow beat and not the start
 * of a spiral. The streak — and therefore the speed payout, which the combo dominates — is untouched.
 */
const SCORE_PERFECT_BEAT = 300;

/** What a run needs beyond its seed. Both default to the game as it has always played. */
export type SlotRunOptions = {
  grid?: BoardSpec;
  /** Set false when the host owns its tutorial and needs a normal opening beat. */
  launch?: boolean;
  /** The level's play mode. See `progression.ts`. */
  progression?: Progression;
};

export function createSlotRun(seed: string, options: SlotRunOptions = {}): SlotRunState {
  const { grid = SLOT_GRID, progression = DEFAULT_LADDER, launch = true } = options;
  /**
   * A run always opens on the launch beat: one footprint, always the same shape, always dead centre.
   *
   * The screen holds the grid until the player drags this one piece home, which is what starts the
   * countdown. That makes it the game's tutorial, so it is dealt deterministically rather than rolled —
   * see `LAUNCH_FAMILY_ID` — and it neither scores nor builds a streak, so the first *real* beat is
   * still the single that combo 0 asks for.
   */
  const opening = hashSeed(seed);
  const dealt = dealBeat(grid, opening, 0, 0, planBeat(progression, 0, 0, opening), launch);

  return {
    grid,
    progression,
    seed,
    rngState: dealt.rngState,
    beat: dealt.beat,
    beatsPlayed: 0,
    tray: dealt.tray,
    trayGeneration: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    groupsCompleted: 0,
    piecesPlaced: 0,
    eventSequence: 0,
    lastResolution: null,
    lastBeatGrade: null,
    lastBeatPace: null,
    lastBeatElapsedMs: 0,
    lastGroupCount: 0,
    lastGroupSizes: [],
  };
}

export function slotReducer(state: SlotRunState, action: SlotAction): SlotRunState {
  switch (action.type) {
    case 'new_run':
      // Grid *and* progression carry over: a fresh seed restarts the level, it does not change it.
      return createSlotRun(action.seed, { grid: state.grid, progression: state.progression });
    case 'next_beat':
      return nextBeat(state);
    case 'place':
      return place(state, action.pieceId, action.row, action.column, action.elapsedMs);
    case 'discard':
      return discard(state, action.pieceId, action.elapsedMs);
    case 'tick':
      return tick(state, action.beatElapsedMs);
    default:
      return state;
  }
}

/**
 * Deal the next beat.
 *
 * A no-op unless the current beat has resolved, so a stray dispatch — a settle timer that fires
 * after the screen has already moved on, say — cannot skip a beat the player is mid-way through.
 *
 * `lastResolution` is cleared here rather than left to be overwritten. The view keys its burst on
 * the resolution's identity, and leaving a stale one in place while a fresh beat is interactive is
 * how the board's launch-wipe bug worked: a resolution that outlives its animation is a burst
 * waiting to be restarted.
 */
function nextBeat(state: SlotRunState): SlotRunState {
  if (state.beat.status !== 'resolved') return state;

  const trayGeneration = state.trayGeneration + 1;
  const index = state.beat.index + 1;
  // `resolveBeat` has already updated the combo, so the next beat is sized by the beat just played:
  // a perfect one opens up more footprints, a broken streak drops back to a single. Which of those the
  // progression makes of it is no longer this file's business — see `planBeat`.
  const dealt = dealBeat(
    state.grid,
    state.rngState,
    index,
    trayGeneration,
    /**
     * The generator's state is handed to the plan as well as to the deal, and the plan **reads it without
     * consuming it** — see `rollFromPool`. That is what lets a rung roll its mechanic while leaving the rng
     * stream exactly where it was, so the golden fixture still measures the deal rather than the plan.
     */
    planBeat(state.progression, index, state.combo, state.rngState),
  );

  return {
    ...state,
    beat: dealt.beat,
    tray: dealt.tray,
    trayGeneration,
    rngState: dealt.rngState,
    lastResolution: null,
    lastBeatGrade: null,
    lastBeatPace: null,
    lastBeatElapsedMs: 0,
    lastGroupCount: 0,
    lastGroupSizes: [],
  };
}

/**
 * The groups whose colour this piece matches — **a rule of the game, not a variety.**
 *
 * Colour used to be decoration. Nothing in `slot-drop.ts` or `slot-grade.ts` mentioned it: attribution was
 * purely geometric, so a piece dropped on the *wrong* footprint scored there anyway, and the colour pairing
 * was a hint the game did not enforce. Now a drop only counts on the footprint it belongs to, and a
 * wrong-colour drop **fails completely** — no partial credit, streak broken — rather than quietly scoring.
 *
 * It is a rule and not a variety because it has to hold everywhere for the varieties that play with it to mean
 * anything: crossing the tray is only confusing if the wrong piece fails, and a footprint that changes colour
 * is only a timing problem if its colour is what admits the piece. Making it a global rule also means those two
 * varieties need no gating logic of their own — they move the colours and this decides what that costs.
 *
 * Returns the input array by identity when every group matches, which is the whole of a one-footprint beat.
 */
/**
 * Repaint footprints, leaving anything not named alone.
 *
 * Returns the beat by identity when no id matched, so a `recolour` effect that changes nothing cannot break the
 * reducer's no-op contract — the tick that carried it would otherwise force a re-render for a repaint that did
 * not happen.
 */
function recolour(beat: Beat, colors: Readonly<Record<string, BlockColorId>>): Beat {
  let touched = false;
  const groups = beat.groups.map((group) => {
    const next = colors[group.id];
    if (next === undefined || next === group.colorId) return group;
    touched = true;
    return { ...group, colorId: next };
  });
  return touched ? { ...beat, groups } : beat;
}

function matchesColour(groups: readonly SlotGroup[], piece: Piece): readonly SlotGroup[] {
  const allowed = groups.filter((group) => group.colorId === piece.colorId);
  return allowed.length === groups.length ? groups : allowed;
}

/**
 * Was this drop refused, rather than merely missed?
 *
 * Only asked when the drop landed **nothing**, and answered by scoring it a second time against the groups that
 * were filtered *out*. If it would have hit one of those, the player aimed correctly at a footprint that would
 * not take the piece, and they are owed that word instead of MISSED.
 *
 * The second scoring pass is the price of keeping the filters where they are. The alternative — having
 * `scorePlacement` know about colour — would put a rule in the grader, which is the entanglement the filter
 * design exists to avoid. It runs at most once per drop, over at most two footprints, and only on a drop that
 * already scored zero.
 *
 * Attribution is by *which* filter dropped the group: still present after the colour pass means a variety's
 * `accepts` refused it, absent means colour did.
 */
function refusalFor(
  state: SlotRunState,
  piece: Piece,
  candidates: readonly SlotGroup[],
  byColour: readonly SlotGroup[],
  coverage: number,
  row: number,
  column: number,
): PlacementRefusal | null {
  if (coverage > 0) return null;
  if (candidates.length === state.beat.groups.length) return null;

  const refused = state.beat.groups.filter((group) => !candidates.includes(group));
  const shadow = scorePlacement(state.grid, refused, piece.cells, { row, column });
  if (!shadow.groupId) return null;

  const hit = refused.find((group) => group.id === shadow.groupId);
  return hit && byColour.includes(hit) ? 'variety' : 'colour';
}

function place(
  state: SlotRunState,
  pieceId: string,
  row: number,
  column: number,
  elapsedMs: number,
): SlotRunState {
  if (state.beat.status !== 'placing') return state;

  const piece = state.tray.find((candidate) => candidate.id === pieceId && !candidate.used);
  if (!piece) return state;

  /**
   * Before anything is scored: does a mechanic eat this drop?
   *
   * First, because an absorbed drop is not a placement at all — it neither lands nor misses, so putting it after
   * scoring would mean grading a drop that never happened and then discarding the verdict. See the `absorb`
   * capability for why armour needed an outcome the other gates could not express.
   *
   * `covered` comes from `scorePlacement` with **no groups**, which returns exactly the offset-and-clip
   * arithmetic and nothing else. Deriving the cell list any other way would be a second implementation of the
   * one thing every part of a drop agrees on: where the piece was.
   */
  const covered = scorePlacement(state.grid, [], piece.cells, { row, column }).dropped;
  const eaten = absorbDrop(state.beat, { piece, covered });
  if (eaten) return absorb(state, piece, eaten.varieties, elapsedMs);

  /**
   * Only the groups that will take this piece.
   *
   * Two filters, in order. **Colour first**, which is a rule of the game rather than a variety — see
   * `matchesColour`. Then the beat's varieties, folded by `eligibleGroups`: a group that refuses the piece
   * simply is not a candidate, so the drop attributes to nothing, covers nothing and grades `miss` through
   * exactly the path a badly aimed drop already takes. `scorePlacement` never learns about either filter.
   */
  const byColour = matchesColour(state.beat.groups, piece);
  const candidates = eligibleGroups({ ...state.beat, groups: byColour as SlotGroup[] }, piece);
  const score = scorePlacement(state.grid, candidates, piece.cells, { row, column });
  // Accuracy only. `elapsedMs` is recorded on the placement and judged once, for the beat as a whole.
  const grade = gradePlacement({ coverage: score.coverage, offset: score.offset });

  // Everything the piece covered that scored nothing. Derived from `dropped` rather than recomputed,
  // so it cannot disagree with what `scorePlacement` decided the piece covered.
  const counted = new Set(score.filled);
  const wasted = score.dropped.filter((index) => !counted.has(index));

  const placement: Placement = {
    groupId: score.groupId,
    filled: score.filled,
    wasted,
    colorId: piece.colorId,
    coverage: score.coverage,
    offset: score.offset,
    elapsedMs,
    grade,
    refused: refusalFor(state, piece, candidates, byColour, score.coverage, row, column),
    // Nothing ate this one — `absorb` runs before scoring and returns early when it fires.
    absorbed: false,
  };

  // Fill only the cells that actually landed. A group whose piece was dropped a cell out ends up
  // partially filled, which is what makes accuracy visible: the footprint stays half empty and the
  // beat pays out proportionally less.
  const groups: SlotGroup[] = score.groupId
    ? state.beat.groups.map((group) =>
        group.id === score.groupId
          ? { ...group, filled: [...group.filled, ...score.filled] }
          : group,
      )
    : state.beat.groups;

  /**
   * Let the beat's varieties see the drop.
   *
   * After scoring and before the beat decides whether it is over, so a variety can both react to the
   * placement and end the beat on it — which is exactly what a detonated bomb does. Returns null on an
   * ordinary beat, so the common path allocates nothing.
   */
  const reacted = observePlacement(
    { ...state.beat, groups },
    { piece, groupId: score.groupId, coverage: score.coverage, grade },
  );

  return commit(state, piece, placement, groups, reacted?.varieties, reacted?.effects);
}

/**
 * A drop a mechanic ate: record it, change nothing else.
 *
 * Deliberately **not** routed through `commit`, which is the opposite of the choice made for `discard`. Everything
 * `commit` does is wrong here — it spends the piece, counts it, and resolves the beat when the tray empties — and
 * an absorbed drop must do none of those three. Sharing the path would have meant three flags threaded through it
 * and a reader unable to tell which combination was legal.
 *
 * What it *does* share is the placement record, so the screen learns about the drop through the channel it already
 * reads. `absorbed: true` is what keeps it out of every verdict; see `resolveBeat`.
 *
 * `elapsedMs` is kept for the same reason the other fields are — a `Placement` is one shape — but nothing sums it.
 * Chipping is free on the pace budget, and that is the design: a beat that takes four drags instead of two is
 * already charged for, in the only currency that matters here, by the race clock running while it happens.
 */
function absorb(
  state: SlotRunState,
  piece: Piece,
  varieties: VarietySpec[],
  elapsedMs: number,
): SlotRunState {
  const placement: Placement = {
    groupId: null,
    filled: [],
    // Not `wasted` either, and the distinction matters to the view: these cells did not miss, they hit armour.
    // Marking them wasted would tumble them away, which is the gesture for a mistake.
    wasted: [],
    colorId: piece.colorId,
    coverage: 0,
    offset: Number.POSITIVE_INFINITY,
    elapsedMs,
    grade: 'miss',
    refused: null,
    absorbed: true,
  };

  return {
    ...state,
    beat: {
      ...state.beat,
      varieties,
      placements: [...state.beat.placements, placement],
    },
  };
}

/**
 * Lose a piece that was released somewhere the field is not.
 *
 * Scores nothing, fills nothing, and breaks the streak — the same outcome as a drop that overlapped no
 * footprint, which is what it is. It goes through `commit` rather than duplicating the tail so it cannot
 * drift out of step with `place` on the things that are genuinely shared: consuming the piece, counting
 * it, and resolving the beat when it was the last one.
 *
 * `offset` is `Infinity` for the same reason `scorePlacement` uses it — a miss with no group must never be
 * comparable to an exact placement — and `wasted` is empty because the cells never touched the field. The
 * screen collapses them where they fell instead, which is not the field's business.
 */
function discard(state: SlotRunState, pieceId: string, elapsedMs: number): SlotRunState {
  if (state.beat.status !== 'placing') return state;

  const piece = state.tray.find((candidate) => candidate.id === pieceId && !candidate.used);
  if (!piece) return state;

  const placement: Placement = {
    groupId: null,
    filled: [],
    wasted: [],
    colorId: piece.colorId,
    coverage: 0,
    offset: Number.POSITIVE_INFINITY,
    elapsedMs,
    grade: 'miss',
    // Nothing refused this — the piece was let go where the field is not. There is no footprint to have been
    // wrong about, which is exactly what distinguishes a discard from a refused drop.
    refused: null,
    /**
     * And nothing absorbed it either, which is the escape hatch armour needs.
     *
     * A drop off the field is the one way to end a beat whose frozen footprint the player has given up on: it
     * spends the piece for real, so the tray empties and the beat resolves short. Without it a player who could
     * not clear the armour would be stuck until the race clock ran out.
     */
    absorbed: false,
  };

  /**
   * A discard is a placement too, as far as a variety is concerned.
   *
   * It has to be: a bomb that only detonated on a *scoring* drop could be defused by hurling the rigged piece
   * off the field, which would make the safest play the one that looks like giving up.
   */
  const reacted = observePlacement(state.beat, {
    piece,
    groupId: null,
    coverage: 0,
    grade: 'miss',
  });

  return commit(state, piece, placement, state.beat.groups, reacted?.varieties, reacted?.effects);
}

/**
 * Consume the piece, record the placement, and resolve the beat if that was the last one.
 *
 * Shared by `place` and `discard`. The beat ends when the **tray** is empty rather than when the
 * footprints are full, which is what makes a lost piece a real cost: it cannot be retried, and the beat
 * resolves a footprint short.
 */
/**
 * Time passed. Tell any variety whose deadline has gone by, and apply what it asks for.
 *
 * **Returns the state object unchanged when nothing happened**, which is the whole reason this is
 * affordable. The screen dispatches it from the fixed-step loop, so it runs sixty times a second; the
 * reducer's callers treat referential identity as a no-op, so an uneventful tick costs not one re-render.
 * Without that, the run state would change every frame and `use-match`'s promise that React state holds only
 * discrete things would be gone.
 *
 * The caller owns the clock, exactly as it does for `elapsedMs` on a placement. This module still has none.
 */
function tick(state: SlotRunState, beatElapsedMs: number): SlotRunState {
  if (state.beat.status !== 'placing') return state;
  if (state.beat.varieties.length === 0) return state;

  const advanced = expireVarieties(state.beat, beatElapsedMs);
  if (!advanced) return state;

  let next: SlotRunState = {
    ...state,
    beat: { ...state.beat, varieties: advanced.varieties },
  };

  /**
   * Effects, in order, each through the path a player action would take.
   *
   * A piece lost to a deadline goes through `discard` — so it costs the streak, counts as a placement, and
   * can be the drop that resolves the beat, all exactly as a piece thrown off the field does. A timer is a
   * different *cause*, not a different rule, and routing it through the same code is what keeps it that way.
   *
   * `elapsedMs` is 0 because the time is already accounted for: every other placement in the beat measures
   * from the previous drop, and the beat's pace is their sum — charging this one again would double-count
   * the same seconds.
   */
  for (const effect of advanced.effects) {
    if (effect.kind === 'losePiece') next = discard(next, effect.pieceId, 0);
    // A repaint changes which piece each footprint will take — see `matchesColour` — so it is a rule change
    // dressed as a visual one, and it lands on the groups where every consumer already looks for it.
    if (effect.kind === 'recolour') next = { ...next, beat: recolour(next.beat, effect.colors) };
  }

  return next;
}

/**
 * The soonest this beat wants a `tick`, in milliseconds since it went live, or `null` for never.
 *
 * Exported so the screen can skip dispatching entirely on a beat with no timed varieties — which is every
 * beat at today's tuning. The alternative, ticking unconditionally, would work but would burn a reducer
 * call per frame to be told nothing happened.
 */
export function beatDeadlineMs(state: SlotRunState): number | null {
  return state.beat.status === 'placing' ? nextDeadlineMs(state.beat) : null;
}

function commit(
  state: SlotRunState,
  piece: Piece,
  placement: Placement,
  groups: SlotGroup[],
  /** The beat's varieties, if one of them reacted to this drop. */
  varieties?: VarietySpec[],
  /** What they asked for. `voidBeat` ends the beat here and now, paying nothing. */
  effects?: readonly VarietyEffect[],
): SlotRunState {
  const voided = effects?.some((effect) => effect.kind === 'voidBeat') ?? false;

  /**
   * A voided beat consumes **every** remaining piece.
   *
   * Otherwise the beat would resolve with pieces still in the tray, and the screen would keep them draggable
   * over a beat that is already over — `placing` is derived from the status, but the tray's own pieces are
   * not. Marking them spent is also the honest model: the turn is lost, so nothing else in it is playable.
   */
  const tray: Piece[] = state.tray.map((candidate) =>
    voided || candidate.id === piece.id ? { ...candidate, used: true } : candidate,
  );

  const placements = [...state.beat.placements, placement];
  const beatOver = tray.every((candidate) => candidate.used);

  const partial: SlotRunState = {
    ...state,
    tray,
    piecesPlaced: state.piecesPlaced + 1,
    beat: {
      ...state.beat,
      groups,
      placements,
      varieties: varieties ?? state.beat.varieties,
      voided: state.beat.voided || voided,
    },
  };

  if (!beatOver) return partial;

  return resolveBeat(partial);
}

/**
 * Grade the beat, clear every footprint, and emit the payout.
 *
 * Partially filled groups clear too. That is the design decision the miss rule rests on: the beat
 * always completes and always pays, so a sloppy player is not stuck staring at a half-finished
 * footprint — they simply got less speed and lost the streak.
 */
function resolveBeat(state: SlotRunState): SlotRunState {
  const { beat } = state;
  /**
   * Only the drops that actually counted.
   *
   * Absorbed drops are on the beat so the view can react to them, and they are excluded from **every** verdict
   * below: the grade, the pace, the perfect count and the block count. Filtering once here rather than at each of
   * those four is the whole reason the flag is on the placement — the alternative was four `if`s that had to stay
   * in step, in a function whose job is to decide what a beat was worth.
   *
   * The consequence worth stating: chipping a frozen footprint costs nothing on accuracy *or* on the clock. See
   * `absorb` in this file for why the race clock is the right place to charge for it instead.
   */
  const scored = beat.placements.filter((placement) => !placement.absorbed);
  const grades: PlacementGrade[] = scored.map((placement) => placement.grade);
  /**
   * A voided beat is a `miss` whatever its placements say.
   *
   * The player may well have landed the first piece exactly before detonating the second; the grade has to
   * describe the *beat*, and the beat was lost. This is also what makes the bridge report it correctly — it
   * branches on `grade !== 'perfect'` to raise the miss and flash the brake lights.
   */
  const beatGrade = beat.voided ? 'miss' : gradeBeat(grades);
  const exact = beatGrade === 'perfect';

  /**
   * The beat's wall duration, and whether it beat the clock.
   *
   * Summing works because each placement's `elapsedMs` is measured from the previous drop, so the
   * sum spans the beat from the moment it went interactive to the last drop. The budget is sized by
   * the number of footprints dealt rather than by placements made — they are equal, but the budget is
   * a property of what the beat *asked for*.
   *
   * And it is widened by whatever this beat's mechanics make the player **wait** for. A cycling bomb and a
   * mismatched footprint both have to be waited out; before this, a player who waited correctly was called late for
   * it, which is a verdict they had no way to avoid. See `beatPaceAllowanceMs`.
   */
  const elapsedMs = scored.reduce((total, placement) => total + placement.elapsedMs, 0);
  const pace = gradePace(elapsedMs, beat.groups.length, beatPaceAllowanceMs(beat));
  const onTime = pace === 'onTime';

  /**
   * Only accuracy moves the streak — and the launch does not move it at all.
   *
   * Every placement must be exact for a streak to survive; being slow does not enter into it. Pace used
   * to reset the combo too, which double-charged for slowness — the race clock already makes a slow beat
   * cost a race, because it is a beat that did not happen. See `slot-grade.ts`.
   *
   * The launch is left out entirely, not credited *or* punished. Crediting it meant a clean launch drag
   * put the player on combo 1, so their first beat of the actual race was a double — the game opened on
   * its second difficulty tier. Punishing a fumbled one would be worse: it is the first thing anybody
   * ever does here.
   */
  const combo = beat.launch ? state.combo : exact ? state.combo + 1 : 0;

  /**
   * Exact *and* on time. The flat bonus is the whole cost of being late.
   *
   * False for the launch whatever happened, which is what keeps it quiet: `perfectClear` is what earns
   * the bonus, the Success haptic and the streak wordmark, and none of those belong on the starting grid.
   */
  const perfect = !beat.launch && exact && onTime;

  // Pushed group by group, and the sizes recorded alongside. The order is load-bearing: the view
  // staggers the outro one footprint at a time from these boundaries, so a flat list would lose the
  // grouping the player just created.
  const clearedCells: { index: number; colorId: BlockColorId }[] = [];
  const groupSizes: number[] = [];
  let completed = 0;
  // A voided beat clears nothing, so it pays no `PER_BLOCK`, earns no nitro and fires no burst — the
  // footprints simply go out. Skipping the walk is what makes "no boost or benefit" true rather than
  // approximately true.
  for (const group of beat.voided ? [] : beat.groups) {
    for (const index of group.filled) clearedCells.push({ index, colorId: group.colorId });
    groupSizes.push(group.filled.length);
    if (group.filled.length >= group.cells.length) completed += 1;
  }

  const perfectPlacements = grades.filter((grade) => grade === 'perfect').length;
  const blocksPlaced = scored.reduce(
    (total, placement) => total + (placement.coverage > 0 ? 1 : 0),
    0,
  );

  /**
   * Nothing for the launch, which is a tutorial rather than a turn.
   *
   * It would otherwise open every run with a free 800-odd points for a drag that cannot be failed in any
   * way that matters — which is exactly the sort of flat offset that makes two players' scores
   * incomparable for a reason neither of them did anything about.
   */
  const scoreDelta = beat.launch || beat.voided
    ? 0
    : clearedCells.length * SCORE_PER_FILLED_CELL +
      perfectPlacements * SCORE_PER_PERFECT_PLACEMENT +
      SCORE_PER_COMBO * Math.max(0, combo - 1) +
      (perfect ? SCORE_PERFECT_BEAT : 0);

  const eventSequence = state.eventSequence + 1;

  /**
   * The payout, in the shape the race side already understands.
   *
   * `clearedRows` and `clearedColumns` are empty because there are no lines here. That is why
   * `lastGroupCount` exists: the bridge's `lineCount` — which drives the multi-line bonus and the
   * haptic accent — is the number of footprints in the beat, and it cannot be recovered from these
   * two fields any more.
   */
  const resolution: Resolution = {
    id: eventSequence,
    placedIndices: clearedCells.map((cell) => cell.index),
    clearedIndices: clearedCells.map((cell) => cell.index),
    clearedCells,
    clearedRows: [],
    clearedColumns: [],
    blocksCleared: clearedCells.length,
    blocksPlaced,
    comboAfter: combo,
    scoreDelta,
    // A beat where every piece landed exactly *and* inside the clock is this game's equivalent of
    // clearing the board: the biggest single thing a player can do, and it earns the Success haptic
    // and the bonus. An exact but late beat keeps its combo and forfeits this.
    perfectClear: perfect,
  };

  return {
    ...state,
    beat: { ...beat, status: 'resolved' },
    // The launch is not a turn, so it is not counted as one — in the beat tally, the streak, the score
    // or the footprint count. `eventSequence` still advances, because the bridge needs to see the
    // resolution for the burst and the cascade to fire: the drag is unrewarded on the scoreboard and
    // fully rewarded on screen, which is the right way round for a tutorial.
    beatsPlayed: beat.launch ? state.beatsPlayed : state.beatsPlayed + 1,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    score: state.score + scoreDelta,
    groupsCompleted: beat.launch ? state.groupsCompleted : state.groupsCompleted + completed,
    eventSequence,
    lastResolution: resolution,
    lastBeatGrade: beatGrade,
    lastBeatPace: pace,
    lastBeatElapsedMs: elapsedMs,
    lastGroupCount: beat.groups.length,
    lastGroupSizes: groupSizes,
  };
}

/** Total target cells in a beat — what a perfect beat fills. Used by the view and by tuning. */
export function beatTargetCells(beat: Beat): number {
  return beat.groups.reduce((total, group) => total + group.cells.length, 0);
}
