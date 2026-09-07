/**
 * How a *competent* scripted player takes a beat.
 *
 * Harness-only: nothing in the app imports this. It exists because three separate harnesses — the engine's own
 * tests, the golden fixture's replay and the balance probe — all have to answer the same question, and answering it
 * three times is how they drift apart.
 *
 * ## Why a naive player stopped being good enough
 *
 * Until the ladder's hard rungs started rolling a mechanic, "play a beat" was one line per footprint: drop each
 * group's piece on its origin, in tray order. Two of the mechanics break that outright, and both break it
 * *silently* — they produce a plausible-looking bad result rather than an error:
 *
 *  - **Armour** hands its piece back, so one pass per tray slot leaves the beat unresolved forever. A harness that
 *    then moved on would record a beat that never happened.
 *  - **A bomb** detonates, so one pass in tray order loses roughly half the bombs it meets — and a harness whose
 *    player cannot read a bomb reports the ladder as far harsher than a human finds it.
 *
 * The fix is not to make the player perfect. It is to make it *competent at the mechanics* and leave it as bad as
 * it ever was at the things each harness is actually measuring — aim, pace, and how often it slips.
 *
 * ## What it deliberately does not do
 *
 * It does not know about `hues`: a mismatched footprint refuses the drop, which costs the beat cells but resolves
 * it, so a player that ignores the colour clock is *wrong* rather than stuck. Modelling that would mean deciding
 * how long a human waits, which is a tuning question the harnesses should not be silently answering. The same goes
 * for `crossed` and `drift`, neither of which a headless player can perceive at all — a limitation the probe's own
 * header already records.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { varietyData } from '../variety/contract';
import { slotReducer } from './slot-reducer';
import type { SlotRunState } from './slot-types';
import type { Piece } from './types';

/** As much of the bomb's data as playing around it needs. Read, never written. */
type BombPeek = { pieceId: string | null; armed: boolean; nextToggleMs: number };

/**
 * How many drops one beat is allowed before the harness gives up.
 *
 * Two hit points of armour on a two-footprint beat is four drags, so this is comfortable headroom rather than a
 * tuned bound. Its job is to turn "a mechanic stopped converging" into a failing assertion instead of a hung
 * process — a test that cannot fail without hanging is worse than one that is merely wrong.
 */
export const MAX_DROPS_PER_BEAT = 24;

/**
 * The piece to play next: anything the bomb has **not** rigged, if there is a choice.
 *
 * This is the whole answer to the `defuse` variant — playing the safe piece first takes the rigged one cold — and
 * it needs no clock, which is why it is expressible in a headless player at all.
 *
 * Falls back to the rigged piece when it is the only one left, which is correct: on a single there was never a
 * choice, and by then a `cycle` bomb is the only kind the dealer will have given out.
 */
export function nextSafestPiece(state: SlotRunState): Piece | undefined {
  const live = state.tray.filter((piece) => !piece.used);
  const bomb = varietyData<BombPeek>(state.beat, 'bomb');
  if (!bomb?.pieceId) return live[0];
  return live.find((piece) => piece.id !== bomb.pieceId) ?? live[0];
}

/**
 * Wait out a live bomb on this piece by ticking the beat's clock to its next toggle.
 *
 * Reaches only a `cycle` bomb. A `defuse` one has no deadline, so the tick is a no-op and this returns immediately
 * — which is right rather than a gap: `defuse` is answered by order, above, and `cycle` by the clock, here.
 *
 * The tick is dispatched through the real reducer at the real deadline, so the harness exercises the same path the
 * screen does rather than an easier one.
 */
export function coolOff(state: SlotRunState, pieceId: string): SlotRunState {
  let next = state;
  for (let window = 0; window < 8; window += 1) {
    const bomb = varietyData<BombPeek>(next.beat, 'bomb');
    if (!bomb || bomb.pieceId !== pieceId || !bomb.armed) return next;
    const ticked = slotReducer(next, { type: 'tick', beatElapsedMs: bomb.nextToggleMs });
    if (ticked === next) return next;
    next = ticked;
  }
  return next;
}
