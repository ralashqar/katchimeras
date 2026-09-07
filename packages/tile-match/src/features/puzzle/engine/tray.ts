/**
 * Dealing primitives: which shapes to hand out, and how to turn them into pieces.
 *
 * What is left of a much larger module. It used to own `generateTray` — a candidate ladder that
 * rolled up to 24 trays and scored each on how many of its pieces would fit the *current board*,
 * with a rescue path of smallest-fitting shapes to stop an unlucky roll jamming a board that still
 * had room, plus a single-piece dealer that rolled best-of-three to bias toward larger pieces.
 *
 * Every one of those existed to manage a board filling up. The slot field is empty at the start of
 * every beat and each footprint is its own piece's shape, so nothing can fail to fit, there is no
 * jam to rescue from, and difficulty comes from the clock instead of from crowding. `slot-deal.ts`
 * owns dealing now; these two functions are the parts of it worth keeping.
 */

// Relative, not `@/` — these modules run directly under `node --test`, which
// does not resolve tsconfig path aliases.
import { seededShuffle, weightedPick } from '../../../core/rng';
import { shapeCellCount } from './shapes';
import { BLOCK_COLOR_IDS } from './types';
import type { Piece, Shape } from './types';

/**
 * A single deal may contain at most this many "big" pieces.
 *
 * Kept from the board, where the reason was jam risk. The reason here is different but points the
 * same way: a big piece is slower to line up, and a beat of three big ones would make the timing
 * window unreachable no matter how well the player aims. Note that `slot-deal.ts` also caps piece
 * size outright — this stops a beat being made entirely of shapes at that cap.
 */
export const BIG_PIECE_CELLS = 5;
export const MAX_BIG_PIECES = 1;

/**
 * Weighted pick of `count` shapes with distinct families and a big-piece cap.
 *
 * `already` lets the caller account for a shape it has pre-seeded, so the diversity rule and the
 * big-piece cap still hold across the whole deal rather than just the part this function picks.
 *
 * Family diversity matters more in slot mode than it did on a board. Two footprints of the same
 * shape are two identical targets, and with colour as the only thing pairing a piece to its
 * footprint, identical shapes make that pairing arbitrary — either piece fits either slot, so the
 * player is being asked to distinguish things that are not different.
 */
export function pickDiverseShapes(
  pool: readonly Shape[],
  rngState: number,
  count: number,
  already?: { families?: ReadonlySet<string>; bigPieces?: number },
): { shapes: Shape[]; rngState: number } {
  const chosen: Shape[] = [];
  const usedFamilies = new Set<string>(already?.families ?? []);
  let state = rngState;
  let bigPieces = already?.bigPieces ?? 0;

  // Two passes: the first insists on family diversity, the second fills any
  // shortfall without that constraint so we always return `count` shapes.
  for (let pass = 0; pass < 2 && chosen.length < count; pass += 1) {
    const enforceDiversity = pass === 0;
    let guard = 0;

    while (chosen.length < count && guard < pool.length * 4) {
      guard += 1;
      const weights = pool.map((shape) => {
        if (enforceDiversity && usedFamilies.has(shape.familyId)) return 0;
        if (bigPieces >= MAX_BIG_PIECES && shapeCellCount(shape) >= BIG_PIECE_CELLS) return 0;
        return shape.weight;
      });

      const picked = weightedPick(state, weights);
      state = picked.state;
      if (picked.index < 0) break;

      const shape = pool[picked.index];
      chosen.push(shape);
      usedFamilies.add(shape.familyId);
      if (shapeCellCount(shape) >= BIG_PIECE_CELLS) bigPieces += 1;
    }
  }

  return { shapes: chosen, rngState: state };
}

/**
 * Turn shapes into dealt pieces: stable ids and a colour each.
 *
 * The colour is a shuffle rather than a per-piece roll so one deal never contains two of the same
 * colour. That was cosmetic on the board and is load-bearing here: colour is what pairs a tray piece
 * with the footprint it belongs to, so a repeat would make two footprints indistinguishable.
 *
 * `generation` is in the id so ids cannot collide between beats — React keys and the reducer's piece
 * lookup both depend on that.
 */
export function toPieces(
  shapes: readonly Shape[],
  colorState: number,
  generation: number,
): { pieces: Piece[]; rngState: number } {
  const shuffled = seededShuffle(colorState, BLOCK_COLOR_IDS);
  const pieces = shapes.map((shape, index) => ({
    id: `${generation}:${index}:${shape.id}`,
    shapeId: shape.id,
    cells: shape.cells,
    colorId: shuffled.items[index % shuffled.items.length],
    used: false,
  }));
  return { pieces, rngState: shuffled.state };
}
