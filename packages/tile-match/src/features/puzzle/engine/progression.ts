/**
 * How a level decides what the next turn is: the play mode, as data.
 *
 * `dealBeat` used to work this out itself — it took a `combo` and called `slotsForCombo`, `zonesForBeat`
 * and `driftForCombo` internally, so "the game gets harder as your streak grows" was welded into the
 * dealer. One level, one curve, no way to express any other.
 *
 * Now the dealer takes a **`BeatPlan`** — how many footprints, in which zones, with which varieties — and
 * a `Progression` is the data that produces one. Two kinds today:
 *
 *   `ladder`  the streak decides. This is the default level, and it reproduces the old behaviour exactly.
 *   `stream`  a written sequence of turns, optionally looping. For a level that is a gauntlet rather
 *             than a climb.
 *
 * ## Why this lives in the engine and not with the levels
 *
 * A level bundles a progression with race settings, and lives in `features/match` — the only module
 * allowed to know about both halves. But `slot-reducer.ts` has to resolve a plan on every `next_beat`, and
 * the engine may not import from `match`. So the *progression* is a puzzle concept that lives here, and a
 * *level* is a match concept that references one. The dependency points the only way it can.
 *
 * ## The two properties the ladder has and the stream deliberately does not
 *
 * The ladder is **earned, not clocked** — a function of the streak, so breaking one drops straight back to
 * the bottom rung and a struggling player is never handed more to do — and it is **monotonic**, so no rung
 * is easier than the one before it. Both were global invariants when there was one curve; a gauntlet level
 * breaks both on purpose. `slot-engine.test.ts` therefore asserts them of the *ladder*, not of the game.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../core/rng';
import { MAX_SLOTS, SLOT_ZONES, flankForBeat } from './slot-deal';
import { DRIFT_FLOOR } from '../variety/drift/drift-metrics';
import type { SlotZoneId } from './slot-types';
import type { VarietyRequest } from '../variety/contract';

/**
 * How a variety's strength scales with the streak.
 *
 * The ladder's rungs say *which* varieties are in play; this says *how hard*. Splitting them is what lets
 * the drift keep ramping smoothly across two rungs — it arrives on the rung at combo 4 and is still
 * growing past the rung at combo 6 — without either rung having to know about the other.
 *
 * Held once per variety on the progression rather than on each rung, so a level author writes the ramp
 * once and cannot get two rungs' copies out of step.
 */
export type VarietyRamp = {
  /** Strength at `fromCombo` and below. */
  from: number;
  /** Strength at `toCombo` and above. */
  to: number;
  fromCombo: number;
  toCombo: number;
};

/** One rung of a ladder: what it asks for, and which varieties decorate it. */
export type BeatTier = {
  minShapeHeight?: number;
  /** The lowest combo that reaches this rung. */
  atCombo: number;
  slots: number;
  /** Variety ids, always dealt. Their strength comes from the progression's ramps. */
  varieties: readonly string[];
  /**
   * One id **rolled** from this list, dealt on top of `varieties`.
   *
   * What turns the top of the ladder from a fixed curve into a rotation: a player who has earned the hard rungs
   * gets a different mechanic each beat rather than the same one repeated. Empty or absent means nothing is
   * rolled, which is every rung below the pool.
   *
   * The pool is per rung rather than per progression, and that is load-bearing rather than flexible for its own
   * sake: `crossed` and `hues` need two pieces to mean anything, so the ladder's **single** rung has to pool a
   * narrower set than its double. `levels.test.ts` asserts no rung can roll a mechanic its slot count cannot
   * support.
   */
  pool?: readonly string[];
};

/** One turn of a written sequence. Strengths are explicit, because there is no streak to read. */
export type TurnSpec = {
  /** Optional authored shape constraint, e.g. two rows for a guaranteed jigsaw split. */
  minShapeHeight?: number;
  slots: number;
  /**
   * Which zones, in dealing order. Omitted means "let the flank rule decide", which is what a single
   * normally wants — a hand-written turn should not have to restate the alternation.
   */
  zones?: readonly SlotZoneId[];
  varieties: readonly VarietyRequest[];
};

export type Progression =
  | {
      kind: 'ladder';
      tiers: readonly BeatTier[];
      ramps: Readonly<Record<string, VarietyRamp>>;
    }
  | {
      kind: 'stream';
      turns: readonly TurnSpec[];
      /** Wrap at the end, or hold the last turn forever. */
      loop: boolean;
    };

/** What the dealer needs: the beat's skeleton and its decorations, fully resolved. */
export type BeatPlan = {
  minShapeHeight?: number;
  slots: number;
  zones: SlotZoneId[];
  varieties: readonly VarietyRequest[];
  /**
   * The streak this plan was resolved at.
   *
   * Carried on the plan rather than passed to the dealer alongside it, because the only thing that still
   * wants it is a variety's `deal` — and a variety asking "how hot is this run" should read it from the
   * same object that told it how hard to be, not from a second parameter that could disagree.
   */
  combo: number;
};

/**
 * The rung a given streak is on.
 *
 * The **last** rung the combo reaches, so a table reads top-down as a ladder and adding a rung is a
 * one-line change. Clamped at both ends: a negative combo cannot happen through the reducer but must not
 * produce an undefined tier if it ever does, and a streak past the last rung stays on it.
 */
export function tierFor(tiers: readonly BeatTier[], combo: number): BeatTier {
  let tier = tiers[0];
  for (const candidate of tiers) {
    if (combo >= candidate.atCombo) tier = candidate;
  }
  return tier;
}

/** A ramp's value at a given streak. Flat outside its window, linear inside it. */
export function rampAt(ramp: VarietyRamp, combo: number): number {
  const span = ramp.toCombo - ramp.fromCombo;
  if (span <= 0) return ramp.to;
  const climbed = Math.min(1, Math.max(0, (combo - ramp.fromCombo) / span));
  return ramp.from + (ramp.to - ramp.from) * climbed;
}

/**
 * The ramp key that governs any variety without one of its own.
 *
 * Needed the moment a rung could *roll* its mechanic: writing a ramp per id would mean a level author naming
 * every variety in the registry to answer one question — how hard is this beat — whose honest answer is a
 * function of the streak and nothing else.
 *
 * A per-id ramp still wins where it exists, and `drift` keeps one for a specific reason: its strength is read as
 * a *gate* below `DRIFT_FLOOR` and as a strength at or above it, so a shared ramp starting lower would deal the
 * beat that introduces the sway at a fraction of the floor amplitude — which is the exact failure the floor
 * exists to prevent.
 */
export const ANY_VARIETY = '*';

/**
 * Which id a rung rolls, from its pool.
 *
 * **Derives a choice from the generator's state without consuming it.** Threading the rng *through* `planBeat`
 * would have been the obvious move and is worse: the signature would have to return a new state, and every call
 * site and test — including several that just want to ask what a rung looks like — would have to invent one and
 * thread it back.
 *
 * Consuming nothing is what keeps `planBeat` a pure function of its arguments, which it has to be: tests call it
 * repeatedly with the same inputs, and the screen may plan the same beat more than once.
 *
 * Note what this does *not* buy. The run's rng stream still moves when the roll changes, because each variety's own
 * `deal` consumes a different amount — the drift takes nothing, a bomb and armour each burn a roll. That is
 * expected and correct; the contract's rng rule promises a variety advances consistently *for itself*, not that
 * every variety costs the same. So a change to a pool does still move the golden fixture.
 *
 * `beatIndex` is mixed in as belt rather than braces. `rngState` already differs per beat, so the mix is not
 * load-bearing — it is there so that two runs whose states happened to collide on one beat still diverge.
 */
export function rollFromPool(pool: readonly string[], rngState: number, beatIndex: number): string {
  if (pool.length === 0) return '';
  // Knuth's multiplicative constant, the same mixing `hashSeed` relies on, then one LCG step for the pick.
  const mixed = (rngState ^ Math.imul(beatIndex + 1, 2_654_435_761)) >>> 0;
  return pool[nextInt(mixed, pool.length).value];
}

/**
 * Which zones a beat of `slots` footprints uses, in dealing order.
 *
 * A single sits on a **flank**, alternating side by beat so it is not always the same reach. Anything
 * larger takes both flanks. The centre zone is launch-only — see `slot-deal.ts` — so it never appears
 * here, and a `stream` turn that wants it has to name it explicitly.
 *
 * Order matters for presentation, not for rules: the field staggers its entrance by group index, so
 * dealing left then right makes a two-slot beat sweep across the car rather than appearing at once.
 */
export function zonesFor(slots: number, beatIndex: number): SlotZoneId[] {
  if (slots <= 1) return [flankForBeat(beatIndex)];
  const both: SlotZoneId[] = ['left', 'right'];
  if (slots <= both.length) return both;

  // More footprints than flanks: fall back to the full zone list, which is the only place the centre can
  // come from without being asked for by name. Unreachable at today's tuning — `MAX_SLOTS` is 2 — and here
  // so that a level asking for three does something sensible rather than dealing two and saying nothing.
  return SLOT_ZONES.slice(0, Math.min(slots, SLOT_ZONES.length)).map((zone) => zone.id);
}

/**
 * Resolve the next beat.
 *
 * `beatIndex` drives the flank alternation and the stream's cursor; `combo` drives the ladder. A stream
 * ignores the combo entirely, which is the point of it.
 *
 * `rngState` selects a rung's rolled mechanic and is **read, not consumed** — see `rollFromPool`. It defaults to
 * zero so a caller that has no generator (a test asking what a rung looks like, a screen describing a level) gets
 * a stable answer rather than having to invent one.
 */
export function planBeat(
  progression: Progression,
  beatIndex: number,
  combo: number,
  rngState = 0,
): BeatPlan {
  if (progression.kind === 'stream') {
    const { turns, loop } = progression;
    if (turns.length === 0) return { slots: 1, zones: zonesFor(1, beatIndex), varieties: [], combo };
    // Held rather than wrapped when `loop` is false: a gauntlet that ran out of script should end on its
    // hardest turn, not silently restart at its easiest.
    const cursor = loop ? beatIndex % turns.length : Math.min(beatIndex, turns.length - 1);
    const turn = turns[cursor];
    return {
      slots: turn.slots,
      ...(turn.minShapeHeight ? { minShapeHeight: turn.minShapeHeight } : {}),
      zones: turn.zones ? [...turn.zones] : zonesFor(turn.slots, beatIndex),
      varieties: turn.varieties,
      combo,
    };
  }

  const tier = tierFor(progression.tiers, combo);

  /**
   * Everything this rung asks for: its fixed list, then the one it rolls.
   *
   * Rolled **after** the fixed ids and deduped against them, so a pool that happens to contain something the rung
   * already deals cannot deal it twice — two specs with the same id would have the folds run that variety's hooks
   * twice on one beat, each against its own copy of the data.
   */
  const ids = [...tier.varieties];
  if (tier.pool && tier.pool.length > 0) {
    const rolled = rollFromPool(tier.pool, rngState, beatIndex);
    if (rolled && !ids.includes(rolled)) ids.push(rolled);
  }

  const varieties: VarietyRequest[] = [];
  for (const id of ids) {
    // A ramp of its own, else the shared one, else full strength. A rung that lists an id is asking for it;
    // refusing to deal it because nobody wrote a ramp would be a silent no-op.
    const ramp = progression.ramps[id] ?? progression.ramps[ANY_VARIETY];
    varieties.push({ id, strength: ramp ? rampAt(ramp, combo) : 1 });
  }

  return {
    slots: Math.max(1, tier.slots),
    ...(tier.minShapeHeight ? { minShapeHeight: tier.minShapeHeight } : {}),
    zones: zonesFor(tier.slots, beatIndex),
    varieties,
    combo,
  };
}

/**
 * Combo at which the drift is at its worst.
 *
 * Past its arrival the sway keeps *growing* rather than switching on and staying put — it gets both wider
 * and quicker — so a long streak is genuinely harder to hold than a short one. Without that the ladder had
 * a ceiling four clean beats in, and everything after it was the same beat repeated.
 *
 * Deliberately past the camera's `COMBO_FULL` of 10, so the hardest the game gets is a little beyond the
 * point where it is already shouting about it.
 */
export const DRIFT_FULL_COMBO = 14;

/**
 * Re-exported from the drift, which owns it.
 *
 * The floor is the strength the ladder ramps *from* and the point the drift's own harshness curve measures
 * *from*, and those two being the same constant is what makes the two curves line up. So it lives with the
 * wave, and the ladder imports it rather than the reverse.
 */
export { DRIFT_FLOOR };

/** Combo at which the field starts moving. Derived from the ladder, so the table stays the single source. */
export const DRIFT_AT_COMBO = 4;

/**
 * The strength the quick race pins its variant-switching mechanics to.
 *
 * Both `armour` and `bomb` change *kind* rather than degree as strength crosses a threshold — armour to two hit
 * points, the bomb to the cycling wait-it-out form — and the quick race wants the gentle half of each: one hit
 * point, and the bomb you defuse by playing the other piece. So those two take their own **flat** ramp topping out
 * here instead of the shared one, which climbs to 1.
 *
 * Flat rather than climbing because for these two the strength has nothing left to say once the variant is pinned:
 * armour's only use of it *is* the hit points, and the bomb's window squeeze is dead weight on a variant with no
 * window. A ramp that moved would imply an escalation that does not exist.
 *
 * `progression.test.ts` asserts this stays below both thresholds. A constant with a test rather than an expression
 * over `ARMOUR_HARD_AT` and `BOMB_CYCLE_AT`, because those are owned by their own modules and only *happen* to be
 * equal today — the test is what stops the coincidence quietly ending.
 */
export const QUICK_GENTLE_STRENGTH = 0.35;

/**
 * Which mechanics the ladder's **single** rung may roll.
 *
 * Three, and every absence is a reason rather than an oversight:
 *
 *  - `crossed` and `hues` are out of the quick race **entirely** — see `DUO_POOL`.
 *  - `bomb` is out of the *solo* pool because the only bomb a one-piece beat can carry is a `cycle` one: `defuse`
 *    is answered by playing the other piece, and on a single there is no other piece, so the variety substitutes
 *    the cycling form. The quick race does not want that form, so it does not deal a solo bomb at all.
 *
 * `fuse` is the interesting inclusion. It splits the one footprint into halves and deals two pieces, so a fused
 * single is about the same workload as an ordinary double — which makes it a natural fit for the rung that drops
 * back to one placement and then does something to it.
 */
export const SOLO_POOL: readonly string[] = ['drift', 'armour', 'fuse'];

/**
 * And the double rung.
 *
 * `crossed` and `hues` are deliberately absent from **both** quick-race pools. Both are colour-reading puzzles and
 * both proved too much for the default level: `hues` in particular makes the player *wait*, which eats a race clock
 * calibrated so a good run finishes at the buzzer, and the probe showed a steady-but-accurate player dropping two
 * places once they were in the rotation. They are still the point of `GAUNTLET_LEVEL`, which is where a player who
 * wants them goes.
 *
 * `fuse` is absent for a structural reason instead: it splits the *first* group, so on a two-footprint beat it
 * would deal **three** — past the two the camera impulse is tuned for, and past what the field's layout was
 * measured against. It belongs on the solo rung, where splitting one footprint gives exactly two.
 */
export const DUO_POOL: readonly string[] = ['drift', 'armour', 'bomb'];

/**
 * The default level's ladder.
 *
 *   combo 0        one footprint, still       — where you land after breaking a streak
 *   combo 1..3     two, still                 — one clean single opens the double up
 *   combo 4..5     one, **rolled mechanic**   — back to one thing, but now something is done to it
 *   combo 6 and up two, **rolled mechanic**
 *
 * ## The top of the ladder is a rotation, not a curve
 *
 * The two hard rungs used to deal `drift` and only `drift`, so a player who reached them met the same beat for
 * the rest of the race — the sway grew wider and quicker with the streak, and that was the whole of it. Now each
 * of those beats **rolls** one mechanic from a pool, so the reward for holding a streak is variety rather than
 * more of one thing. The drift is still in the pool; it is one of three answers instead of the only one.
 *
 * The pools are deliberately **narrower than the registry**, and that is the tuning that matters here. The first
 * pass pooled everything and the quick race became genuinely too hard — see `DUO_POOL` for which mechanics were
 * taken back out and why. What is left is the set that asks the player to *aim* better rather than to wait: a
 * moving field, a footprint to break open, a rigged piece to play around, and a shape to fit in two halves.
 *
 * Note what this does *not* change. The rungs still arrive at the same combos, still ask for the same piece
 * counts, and are still earned rather than clocked — a broken streak drops straight back to rung zero. It is the
 * *content* of the hard rungs that is now rolled, not the shape of the climb.
 *
 * The roll is seeded from the run's own generator without consuming it (see `rollFromPool`), so it varies between
 * runs and between beats and replays identically.
 *
 * ## The drop back to a single is still the point of the shape
 *
 * A moving field was a new thing to learn, and teaching it while also asking for two placements would have made
 * the fourth rung a step nobody clears. That reasoning survives the change intact and in fact gets stronger:
 * whatever the rung rolls is new, so introducing it on one footprint before doubling it is right for all five
 * mechanics rather than just for the drift.
 *
 * Note what that makes the ladder: non-monotonic in *piece count*, monotonic in difficulty. Tests assert that
 * shape rather than a simple increasing count.
 *
 * ## Three ramps: one that climbs, two that are pinned, and a wildcard
 *
 * `drift` keeps its own, spanning both hard rungs — `fromCombo` is the rung where the hard rungs *begin*, not
 * the rung it happens to be rolled on — because its strength is read as a *gate* below `DRIFT_FLOOR` and as a
 * strength at or above it. A shared ramp starting lower would deal the sway at a fraction of the floor
 * amplitude, which is the exact failure the floor exists to prevent.
 *
 * `armour` and `bomb` are **pinned flat** at `QUICK_GENTLE_STRENGTH`, which holds them below the thresholds where
 * each switches to a harder *kind* — two hit points, and the cycling bomb you can only wait out. The quick race
 * deals the gentle half of each and never escalates it. See `QUICK_GENTLE_STRENGTH` for why flat rather than
 * climbing-but-capped.
 *
 * Anything left takes `ANY_VARIETY`. Today that is only `fuse`, which ignores strength entirely, so the wildcard
 * is currently doing nothing — kept because it is the fallback that stops a newly pooled mechanic silently
 * arriving at full strength with no ramp of its own.
 */
export const DEFAULT_LADDER: Progression = {
  kind: 'ladder',
  tiers: [
    { atCombo: 0, slots: 1, varieties: [] },
    { atCombo: 1, slots: 2, varieties: [] },
    { atCombo: DRIFT_AT_COMBO, slots: 1, varieties: [], pool: SOLO_POOL },
    { atCombo: 6, slots: 2, varieties: [], pool: DUO_POOL },
  ],
  ramps: {
    drift: {
      from: DRIFT_FLOOR,
      to: 1,
      fromCombo: DRIFT_AT_COMBO,
      toCombo: DRIFT_FULL_COMBO,
    },
    // Flat: `rampAt` returns `to` for a zero-width window, so both of these are `QUICK_GENTLE_STRENGTH` at every
    // streak. Written as a ramp rather than a special case so the table stays one shape.
    armour: {
      from: QUICK_GENTLE_STRENGTH,
      to: QUICK_GENTLE_STRENGTH,
      fromCombo: DRIFT_AT_COMBO,
      toCombo: DRIFT_AT_COMBO,
    },
    bomb: {
      from: QUICK_GENTLE_STRENGTH,
      to: QUICK_GENTLE_STRENGTH,
      fromCombo: DRIFT_AT_COMBO,
      toCombo: DRIFT_AT_COMBO,
    },
    [ANY_VARIETY]: {
      from: 0.2,
      to: 1,
      fromCombo: DRIFT_AT_COMBO,
      toCombo: DRIFT_FULL_COMBO,
    },
  },
};

/**
 * How many footprints the biggest plan a progression can produce asks for.
 *
 * Used by tests and by the camera's range assertions, both of which need to know the ceiling rather than
 * assume `MAX_SLOTS`. A stream level is free to exceed the ladder's two, and the thing that would notice
 * first is the camera impulse, whose count term is tuned for one to two.
 */
export function maxSlotsOf(progression: Progression): number {
  const counts =
    progression.kind === 'stream'
      ? progression.turns.map((turn) => turn.slots)
      : progression.tiers.map((tier) => tier.slots);
  return counts.length === 0 ? MAX_SLOTS : Math.max(...counts);
}
