/**
 * What a variety is: the contract every turn modifier is written against.
 *
 * A **variety** decorates one turn. The field swaying as you aim is one; a piece on a fuse, a colour that
 * swaps mid-drag, a footprint split across two pieces are the ones this exists to make cheap. A
 * **progression** is a different thing and lives in `features/match/levels` — it decides a turn's
 * skeleton (how many footprints, which zones) and *which varieties are attached to it*.
 *
 * ## Why a contract rather than more branches
 *
 * The one variety that already existed was spread across six files: a field on `Beat`, a branch in the
 * dealer, three constants and a pure function in `slot-metrics`, a hook, a prop on the tray, and a
 * transform in the screen. Adding a second that way doubles the branches in all six; adding a fifth is
 * how a codebase stops being changeable. Here a variety is one folder, and the shared files learn nothing
 * about it.
 *
 * ## The capabilities
 *
 * Derived from what the modes actually need, not invented to be general. All optional but `deal`.
 *
 *   A `shape`      reshape the beat itself — split a footprint, fuse two pieces, ban a colour
 *   B `deal`       carry per-beat data, resolved once and frozen onto the `Beat`
 *   C `deadlineMs` + `expire`   be told that time has passed
 *   D `accepts`    decide whether a group will take a piece at all
 *   G `onPlace`    react to a placement, and possibly void the beat
 *   H `absorb`     eat a drop before it is scored, and hand the piece back
 *   I `waitMs`     declare how long it forces the player to stand still, for the pace budget
 *   E offset       move the field on screen (view-side; see `view-registry`)
 *   F draw         (view-side; see `view-registry`)
 *
 * The lettering is historical — they are numbered in the order they were needed rather than the order they run
 * in, and that is worth keeping, because each of `G` and `H` records a case the ones before it could not express.
 * See their own docs.
 *
 * E and F are deliberately **not** in this file. They need React and Skia, and this module is imported by
 * the engine — which must stay loadable under `node --test`. That split is the one structural rule of the
 * whole system: see `registry.ts`.
 *
 * ## Two invariants a variety must not break
 *
 * **A perfect beat is always available.** `slot-deal.ts` guarantees there is an exact answer to every
 * beat, so a player can only fall short by being inaccurate or slow — never by being handed something
 * impossible. A `shape` hook is the only capability that can violate this, and `beatHasPerfectSolution`
 * is the assertion form to test it against.
 *
 * **The rng advances identically whether or not a variety fired.** `deal` is handed the generator state
 * and must return it, advanced by however much it consumed — and a variety that *conditionally* rolls has
 * to burn the roll and discard the result rather than skipping it. Otherwise two beats that differ only in
 * their varieties leave the generator in different states and every deal after them diverges. The dealer
 * already does exactly this for the launch beat's forced shape.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import type { Beat, PlacementGrade, SlotGroup } from '../engine/slot-types';
import type { BlockColorId, BoardSpec, Piece } from '../engine/types';

/**
 * One variety attached to a beat, with whatever it resolved at deal time.
 *
 * `data` is **opaque to the engine** on purpose. Only the variety's own functions and its own view ever
 * look inside, which is what stops the reducer growing a branch per mode — the alternative is a
 * discriminated union that every shared file has to know every member of, which is the entanglement this
 * whole design exists to avoid.
 *
 * The cost of that choice is honest: a cast at the read site. `varietyData` is the one place it happens.
 */
export type VarietySpec = {
  id: string;
  data: unknown;
};

/**
 * What a progression asks for when it attaches a variety to a beat.
 *
 * `strength` is the one dial every variety understands, 0 to 1 — how hard this instance should be. The
 * ladder progression ramps it with the streak; a stream progression sets it per turn. A variety is free
 * to ignore it, but having it in the *request* rather than in each variety's own data is what lets a
 * level dial difficulty without knowing what any particular variety does with it.
 */
export type VarietyRequest = {
  id: string;
  strength: number;
};

/** Everything a variety can see when it resolves onto a freshly dealt beat. */
export type DealContext = {
  grid: BoardSpec;
  beatIndex: number;
  /** The streak going into this beat. */
  combo: number;
  /** The footprints as dealt — already zoned and positioned. */
  groups: readonly SlotGroup[];
  /** The pieces dealt for them, one per group, in the same order. */
  tray: readonly Piece[];
  /** The generator. Advance it and return the new state; never skip a roll. */
  rngState: number;
};

/** A beat's skeleton, as a variety may rewrite it. Returned by `shape`. */
export type BeatShape = {
  groups: SlotGroup[];
  tray: Piece[];
  rngState: number;
};

/**
 * Something a variety wants done to the run, having noticed time pass.
 *
 * A closed vocabulary rather than a callback, because the reducer is pure and must stay so — a variety
 * that could reach into the state directly would be able to break the beat's own invariants from outside
 * the file that maintains them.
 *
 * One member today. `losePiece` is routed through the same `commit` path `discard` uses, so a piece lost
 * to a fuse can be the drop that resolves the beat, and it costs the streak exactly as a thrown-away
 * piece does. Add members here as modes need them, and expect each one to need a test in the reducer.
 */
export type VarietyEffect =
  | { kind: 'losePiece'; pieceId: string }
  /**
   * End the beat now, and pay nothing for it.
   *
   * Stronger than every other way a beat can fall short, and deliberately the only outcome in the game that
   * is *worse* than missing every footprint. A missed beat still pays for whatever landed; a voided one pays
   * nothing at all, breaks the streak, and takes the rest of its pieces with it.
   *
   * Added for the bomb, which needed it: "the turn fully gets lost and you don't get any boost or benefit" is
   * not expressible as a bad placement, because a bad placement still credits the cells that hit. See
   * `resolveBeat`, which honours it by zeroing the payout rather than by a second code path.
   */
  | { kind: 'voidBeat' }
  /**
   * Repaint footprints, by group id.
   *
   * The one effect that changes what the beat *looks like* rather than what happens to it, and it exists
   * because colour is now a rule: `matchesColour` admits a piece only to a footprint of its own colour, so
   * moving a footprint's colour moves which piece it will take.
   *
   * Applied to `beat.groups` rather than kept inside the variety's data, and that is the whole trick — every
   * consumer already reads `group.colorId`. The rule sees it, `SlotField` draws it, the burst inherits it.
   * A variety that kept its colours privately would have to be consulted by all three.
   *
   * Ids not present are left alone, so a variety may repaint one footprint without restating the others.
   */
  | { kind: 'recolour'; colors: Readonly<Record<string, BlockColorId>> };

/** Whether a group will accept a piece at all. Input to `accepts`. */
export type AcceptInput = {
  group: SlotGroup;
  piece: Piece;
};

/**
 * A drop, before it has been scored. Input to `absorb`.
 *
 * The **only** hook that sees the raw drop rather than its outcome, and the only one that needs to: a mechanic
 * that eats a drop has to know which cells it landed on, because that is the thing it is reacting to. `covered`
 * is exactly the list `scorePlacement` derives — every field index the piece occupied, clipped to the grid —
 * taken from the same function rather than recomputed, so the two cannot disagree about where the piece was.
 */
export type AbsorbInput = {
  piece: Piece;
  covered: readonly number[];
};

/**
 * A placement that just happened, as a variety sees it.
 *
 * Deliberately the *outcome* rather than the raw drop: a variety reacting to "which piece was played, and did
 * it land" needs neither the origin nor the cell list, and handing them over would invite one to start
 * re-deriving what `scorePlacement` already decided.
 */
export type PlaceInput = {
  piece: Piece;
  /** The group it was attributed to, or null if it overlapped none. */
  groupId: string | null;
  /** 0 to 1. Zero for a drop that scored nothing, including a discard. */
  coverage: number;
  grade: PlacementGrade;
};

/**
 * A variety's pure half: its definition, its logic, and nothing about how it looks.
 *
 * `Data` is the shape this variety keeps on the beat. It is generic so that the *definition site* is
 * fully typed — `defineVariety<BombData>({...})` type-checks every hook against `BombData` — while the
 * registry can still hold varieties with unrelated data shapes side by side.
 */
export type VarietyDef<Data> = {
  /** Matches the key it is registered under, and the id a progression requests. */
  id: string;

  /**
   * Resolve this variety onto a beat. Called once, at deal time.
   *
   * Must return the generator state, advanced by whatever it consumed — see the header. A variety that
   * needs no randomness returns `ctx.rngState` unchanged, which is not a special case: it consumed
   * nothing, so nothing advanced.
   */
  deal(ctx: DealContext, strength: number): { data: Data; rngState: number };

  /**
   * Rewrite the beat's footprints and pieces before `deal` runs.
   *
   * The heavy capability, and the only one that can make a beat unsolvable. A variety using it owes a test
   * asserting `beatHasPerfectSolution` over the beats it produces.
   */
  shape?(ctx: DealContext, strength: number): BeatShape;

  /**
   * When, in milliseconds since this beat went live, this variety next wants to be told.
   *
   * `null` for "never". **A deadline, not a countdown** — the reducer holds the instant and compares, the
   * view animates the approach from a shared value. Storing a countdown in state would mean writing to it
   * every frame, which is a re-render every frame, which is the one thing the run state may never do.
   */
  deadlineMs?(data: Data): number | null;

  /**
   * The deadline passed. Return the variety's new data and anything it wants done.
   *
   * Called with the beat's elapsed time so a repeating variety can work out how many windows have gone by
   * — a colour that swaps every two seconds does not want to be resumed once per swap it slept through.
   */
  expire?(data: Data, beatElapsedMs: number): { data: Data; effects: VarietyEffect[] };

  /**
   * Whether `group` will take `piece`.
   *
   * Folded across every active variety *before* the drop is scored, so a refusal makes the piece
   * attribute to no group at all — coverage 0, grade `miss` — through machinery that already exists.
   * `scorePlacement` never learns that varieties exist.
   */
  accepts?(data: Data, input: AcceptInput): boolean;

  /**
   * Eat this drop before it is scored: it neither lands nor misses, and the piece goes back to the tray.
   *
   * Capability **H**, added for armour, and the third genuinely new *outcome* in the game after a placement and
   * a void. Return `null` to let the drop through — which is what every variety does on every drop it has no
   * opinion about, so returning null must stay the cheap path.
   *
   * ## Why neither existing gate could do this
   *
   * Armour needs a drop that is **progress without being a placement**. Chipping a frozen footprint is the
   * player doing the right thing, several times, and none of those drops should score, waste cells, break the
   * streak or spend the piece.
   *
   * - `accepts` refusing the group makes the drop a **miss**: coverage 0, streak gone, piece spent, and on a
   *   one-piece beat the tray empties and the beat resolves having paid nothing. That is the outcome for aiming
   *   badly, and chipping is the opposite of aiming badly.
   * - `onPlace` runs *after* scoring, so by the time it sees the drop the damage to the streak is done — and it
   *   cannot put the piece back either.
   *
   * ## What the reducer does with an absorbed drop
   *
   * Three things, and a variety using this should design against all three. The piece is **not consumed**, so it
   * is still in the tray and the beat cannot end on this drop. A placement is recorded but flagged `absorbed`,
   * and everything that grades a beat skips it — so an absorbed drop costs nothing on accuracy *or* on the pace
   * budget. And the beat is not resolved, whatever else happened.
   *
   * The last of those is the one to be careful with: a variety that absorbs unconditionally would deal a beat
   * that can never end, and the only way out would be the player throwing the piece off the field. Absorb must
   * be finite — armour's is bounded by its hit points.
   */
  absorb?(data: Data, input: AbsorbInput): { data: Data } | null;

  /**
   * How long this mechanic can force the player to **wait**, in milliseconds. Added to the beat's pace budget.
   *
   * Some mechanics ask the player to aim better; two ask them to stand still. A cycling bomb has to be waited out,
   * and a footprint showing its decoy cannot be dropped on until it turns back. Neither wait is avoidable and
   * neither is a mistake, so charging it against a budget sized for *drags* marked a competent player LATE for
   * playing correctly — and a verdict the player cannot avoid is the one kind of difficulty this system keeps
   * having to take back out.
   *
   * Return the **worst case for one beat**, not the total a whole turn might spend. The budget is a threshold, not
   * an allowance to be drawn down: it only has to be wide enough that a player who waited once is not late.
   *
   * Absent means zero, which is the answer for anything that changes aim rather than timing. Note armour returns
   * nothing despite taking several drags — an absorbed drop is already excluded from the pace sum entirely, so its
   * cost is the race clock rather than the budget. See `resolveBeat`.
   */
  waitMs?(data: Data): number;

  /**
   * A piece was just played. Update, and say what should happen.
   *
   * Capability **G**, added for the bomb. `accepts` was not enough for it: gating makes a drop *miss*, and a
   * missed drop still pays for whatever else landed in the beat — where detonating a bomb has to cost the
   * whole turn. And `expire` was not enough either, because a bomb goes off when the player *acts*, not when
   * a clock runs out.
   *
   * Runs after the placement has been scored and before the beat decides whether it is over, so a variety can
   * both react to the drop and end the beat on it. `losePiece` here is legal but odd — the piece is already
   * spent — so in practice this emits `voidBeat` or nothing.
   */
  onPlace?(data: Data, input: PlaceInput): { data: Data; effects: VarietyEffect[] };
};

/**
 * Define a variety with its data shape pinned.
 *
 * An identity function, and worth its keep: written as a bare object literal the generic would be
 * inferred per-hook and a typo in one hook's `data` would type-check against the others. Passing through
 * here fixes `Data` once for the whole definition.
 */
export function defineVariety<Data>(def: VarietyDef<Data>): VarietyDef<Data> {
  return def;
}

/**
 * Read a variety's data off a beat, or `undefined` if this beat does not carry it.
 *
 * The one sanctioned cast in the system. It is safe by construction rather than by inspection: the only
 * writer of a given id's data is that id's `deal`, and the only readers are that variety's own hooks and
 * its own view. Nothing else has a reason to name the id.
 */
export function varietyData<Data>(beat: Beat, id: string): Data | undefined {
  const spec = beat.varieties.find((entry) => entry.id === id);
  return spec ? (spec.data as Data) : undefined;
}

/** Whether a beat carries a given variety at all. */
export function hasVariety(beat: Beat, id: string): boolean {
  return beat.varieties.some((entry) => entry.id === id);
}
