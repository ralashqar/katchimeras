/**
 * The tray is dealt in the wrong order, so your drags have to cross.
 *
 * Normally the tray lines up with the field: slot 0 holds the piece for the left footprint, slot 1 for the
 * right, so each drag is a straight pull upward. This reverses the tray, so the leftmost piece belongs to the
 * rightmost footprint and the two paths cross in the middle.
 *
 * ## Why this is a mechanic and not a nuisance
 *
 * It only bites because **colour is a rule** now — see `matchesColour`. A piece dropped on the wrong-coloured
 * footprint fails completely, so the player cannot ignore the swap and pull straight up; they have to read the
 * colours and commit to the longer path. Before the colour rule this would have been a purely cosmetic
 * shuffle, because a wrong-order drop that happened to overlap still scored.
 *
 * That is worth noticing as a general point about this system: a variety that moves information around is only
 * as strong as the rule that makes the information matter.
 *
 * ## The smallest possible variety
 *
 * All of it is one `shape` call reversing an array. It touches no groups, so `group.pieceId` still names the
 * same piece and the beat still has exactly one perfect answer — the invariant `shape` most easily breaks is
 * safe here by construction, because nothing about the *footprints* changed.
 *
 * Capabilities: **A** (shape) and nothing else. No data worth keeping, no view — the colours already say what
 * goes where, and drawing an arrow between a tray slot and a footprint would be answering the question the
 * mechanic exists to ask.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { defineVariety } from '../contract';

/**
 * Nothing to remember.
 *
 * The swap happens once, at deal time, and the dealt tray *is* the record of it. A data shape of `null` is the
 * honest answer, and it is worth having one variety in the registry that demonstrates the floor: not every
 * mechanic needs per-beat state.
 */
export type CrossedData = null;

export const CROSSED_VARIETY = defineVariety<CrossedData>({
  id: 'crossed',

  deal: (ctx) => ({ data: null, rngState: ctx.rngState }),

  /**
   * Reverse the tray.
   *
   * Reversed rather than shuffled, and for a two-piece beat those are the same thing — but they stop being the
   * same at three, and reversal is the one that is *always* a full derangement. A shuffle can roll the identity
   * permutation, which would deal a beat that claims to be crossed and is not: the player would learn nothing,
   * and worse, would learn that the marker sometimes lies.
   *
   * A single-piece beat is left exactly as it was. Reversing one element is a no-op, so this needs no guard —
   * but a progression asking for `crossed` on a single is asking for nothing, and `levels.test.ts` says so.
   */
  shape: (ctx) => ({
    groups: [...ctx.groups],
    tray: [...ctx.tray].reverse(),
    rngState: ctx.rngState,
  }),
});
