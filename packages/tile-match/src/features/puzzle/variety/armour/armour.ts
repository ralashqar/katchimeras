/**
 * One footprint is frozen. Break it open first, then fill it.
 *
 * Every cell of the chosen footprint carries hit points. Dropping its piece on it does **damage** rather than
 * landing: each cell of the piece that covers an armoured cell takes a point off it. The piece comes straight
 * back to the tray, so it can be dropped again. Once every cell is down to zero the footprint thaws and the next
 * drop scores exactly as it always would.
 *
 * ## It is a repetition mechanic, and that is what makes it new
 *
 * Every other variety changes *one* drop: where the footprint is, whether the piece is safe, whether the colours
 * agree. This one changes how many drops the turn takes. A one-hit-point beat is three drags where an ordinary
 * one is a single drag — chip, then place — and the cost is paid in the race clock rather than in the streak.
 *
 * That is the honest place to charge for it. Making armour break the streak would have made it the harshest
 * mechanic in the game by a distance: the player does the right thing repeatedly and is punished for it. Making
 * it cost *time* is exactly right, because time is what a beat that takes three drags actually spends, and the
 * race clock already turns spent time into lost places.
 *
 * ## Capabilities
 *
 * **B** (data), **D** (`accepts`), **H** (`absorb`). It is the reason `absorb` exists — see the capability's own
 * doc for why neither `accepts` nor `onPlace` could express it. The short version: `accepts` makes a drop a
 * *miss*, which breaks the streak, spends the piece and can end the beat, and chipping must do none of those.
 *
 * `accepts` is still needed as the belt. `absorb` only fires on a drop that covers an armoured cell, so a drop
 * landing solely on cells that are *already* clear would otherwise score on a footprint that is still frozen
 * elsewhere. The rule is all-or-nothing: while any cell holds a point, the footprint takes nothing.
 *
 * ## Only one footprint, ever
 *
 * A double with both footprints armoured is four chips plus two placements, which is not a harder version of
 * this mechanic — it is a different and much worse one. The interesting shape is *asymmetry*: one target you can
 * fill and one you have to work at, so the turn has an order to find. On a single there is nothing to contrast
 * with, which is fine; it is then a pure repetition test, the same way a solo bomb is a pure timing test.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { nextInt } from '../../../../core/rng';
import { defineVariety } from '../contract';

/**
 * Hit points per cell, at the bottom and top of the strength range.
 *
 * Deliberately tiny. Two points means three drags for that footprint, which on a two-slot beat is four drags
 * against an ordinary beat's two — already most of the pace budget. Anything higher and the beat stops being a
 * beat and becomes a small siege, which is a different game.
 */
export const ARMOUR_MIN_HP = 1;
export const ARMOUR_MAX_HP = 2;

/** Above this strength the armour is at `ARMOUR_MAX_HP`. */
export const ARMOUR_HARD_AT = 0.5;

export type ArmourData = {
  /** The frozen footprint, or `null` when the beat had none to freeze. */
  groupId: string | null;
  /**
   * The only piece that can chip it — the footprint's own.
   *
   * Recorded rather than looked up, because `absorb` runs against the *drop* and has no view of the beat's
   * groups. It is also what stops a drop meant for the other footprint being eaten when the two overlap: a
   * mechanic that swallowed its neighbour's drops would be stealing a placement the player earned.
   */
  pieceId: string | null;
  /**
   * Points left, per field cell index. A cell missing from here, or at zero, is clear.
   *
   * Keyed by absolute field index rather than by position within the footprint, so it lines up directly with
   * `covered` from a drop and with `group.cells` for the view — no offset arithmetic in either, and therefore no
   * second place for the two to disagree about which cell is which.
   */
  hp: Readonly<Record<number, number>>;
  /** What every cell started on. The view needs it to draw how far along the player is. */
  max: number;
};

/** Points per cell at a given strength. */
export function armourHpFor(strength: number): number {
  return strength >= ARMOUR_HARD_AT ? ARMOUR_MAX_HP : ARMOUR_MIN_HP;
}

/**
 * The number to **print on a cell**: how many more drops it takes, counting the one that fills it.
 *
 * Hit points and drops-remaining differ by exactly one, and hit points are the wrong one to show. A cell on 1 point
 * needs a chip *and then* a real placement, so a plate reading `1` promises one more drop and takes two — which is
 * the number being wrong in the direction that costs the player a streak, since they will have planned the beat
 * around it. Reading `2` is a countdown that ends where the player expects: the last thing the number says before
 * the plate goes is `1`, and one drop later the footprint is theirs.
 *
 * It also makes the two strengths read as what they are — a two-drop cell and a three-drop cell — rather than as
 * "one armour" and "two armour", which meant nothing without knowing the rule.
 *
 * Lives here rather than in the layer because it is a statement about the mechanic, not about the font: the layer
 * may not be the only thing that ever counts drops, and a `+ 1` inline in a JSX expression is exactly the kind of
 * thing that gets copied to a second place and then fixed in only one of them.
 */
export function armourDropsLeft(points: number): number {
  return Math.max(0, points) + 1;
}

/** Whether any cell of this armour still holds a point. */
export function armourHolds(data: ArmourData): boolean {
  if (!data.groupId) return false;
  for (const key in data.hp) if (data.hp[key] > 0) return true;
  return false;
}

/** How many points are left in total, and how many there were. For the view, and for tests. */
export function armourProgress(data: ArmourData): { left: number; total: number } {
  let left = 0;
  let cells = 0;
  for (const key in data.hp) {
    left += data.hp[key];
    cells += 1;
  }
  return { left, total: cells * data.max };
}

export const ARMOUR_VARIETY = defineVariety<ArmourData>({
  id: 'armour',

  /**
   * Freeze one footprint.
   *
   * Rolled so it cannot be memorised as "the left one is always the hard one" — the same reasoning as the bomb's
   * rigged piece, and the same rng discipline: the roll is burned even when there is nothing to freeze, or a beat
   * that skipped it would leave the generator a step behind and every later deal would diverge.
   *
   * The strength picks the hit points and nothing else. There is no third axis here worth exposing — how many
   * footprints are frozen is fixed at one for the reason in the header, and armour has no clock.
   */
  deal: (ctx, strength) => {
    const roll = nextInt(ctx.rngState, Math.max(1, ctx.groups.length));
    const group = ctx.groups.length > 0 ? ctx.groups[roll.value] : undefined;
    const max = armourHpFor(strength);

    const hp: Record<number, number> = {};
    if (group) for (const index of group.cells) hp[index] = max;

    return {
      data: {
        groupId: group?.id ?? null,
        pieceId: group?.pieceId ?? null,
        hp,
        max,
      },
      rngState: roll.state,
    };
  },

  /**
   * A frozen footprint takes nothing at all.
   *
   * All-or-nothing while any cell holds a point, which is what "all cells must be clear for regular play" means.
   * The alternative — letting cleared cells score while their neighbours are still frozen — would mean a drop
   * that both chips and scores, and a placement that is half progress and half payout is not something the
   * grader can describe.
   *
   * Note this only ever fires on a drop `absorb` declined, which is the case worth having it for: a drop landing
   * solely on cells that are already clear covers no armoured cell, so nothing absorbs it.
   */
  accepts: (data, input) => {
    if (input.group.id !== data.groupId) return true;
    return !armourHolds(data);
  },

  /**
   * Chip it.
   *
   * Returns `null` — the cheap path, and the one taken on every drop in every beat that is not this one — unless
   * all three hold: this beat froze something, the piece is that footprint's own, and the drop actually covered a
   * cell that still has points in it.
   *
   * That last condition is what bounds the mechanic. `absorb` suspends the beat, so a variety that ate drops
   * unconditionally would deal a turn that could never end; here every absorbed drop removes at least one point,
   * and there are only ever one or two per cell.
   */
  absorb: (data, input) => {
    if (!data.groupId || input.piece.id !== data.pieceId) return null;

    let hit = false;
    const hp: Record<number, number> = { ...data.hp };
    for (const index of input.covered) {
      const left = hp[index];
      if (left === undefined || left <= 0) continue;
      hp[index] = left - 1;
      hit = true;
    }

    // Covered nothing that was still frozen — either the footprint is already open, or the player missed it
    // entirely. Both are ordinary drops and must be scored as such.
    if (!hit) return null;

    return { data: { ...data, hp } };
  },
});
