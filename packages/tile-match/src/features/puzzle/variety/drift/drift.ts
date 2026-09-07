/**
 * The field sways vertically while you aim.
 *
 * The first variety, and the one the contract was designed against — if it could not express the mechanic
 * that already existed, it was the wrong contract. Worth reading as the reference: it is the *smallest*
 * possible variety, because almost everything about drift is presentation.
 *
 * ## Why the pure half is three lines
 *
 * Drift changes no rules. It does not reshape the beat, it does not gate what counts, it never expires.
 * A drop is still graded on where it landed relative to the footprint — the footprint has simply moved,
 * and the drag resolves against where it actually is, so accuracy is measured honestly without the
 * grader knowing anything happened.
 *
 * All it needs to carry is *how hard* to sway. Everything else — the compound wave, the amplitude, the
 * rate, the screen offset the tray quantises against — is in `drift-metrics.ts` and `DriftLayer`, on the
 * far side of the engine/view split.
 *
 * That is the shape to aim for. A variety whose pure half is large is usually one that should have been
 * a rule change in the reducer instead.
 *
 * ## What the strength means here
 *
 * Amplitude *and* rate both scale off it, so one number makes a long streak genuinely harder rather than
 * merely bigger. The ladder ramps it from `DRIFT_FLOOR` to 1; see `progression.ts`. It used to be a bare
 * `Beat.drift` number, and the migration to a variety is behaviour-preserving by construction: the value
 * is the same, only its home changed.
 */

// Pure module — `.ts` extension imports so it runs under `node --test`.
import { defineVariety } from '../contract';

/**
 * How hard the field sways on this beat: 0 for still, up to 1.
 *
 * A named field rather than a bare number, because a variety's data is opaque to the engine and a bare
 * scalar would be indistinguishable from any other variety's — and because the day drift grows a second
 * parameter, the shape does not have to change.
 */
export type DriftData = { strength: number };

export const DRIFT_VARIETY = defineVariety<DriftData>({
  id: 'drift',
  /**
   * Freeze the requested strength, consume nothing.
   *
   * `rngState` is returned untouched, which is not a special case dodged: drift makes no random choice, so
   * it advances the generator by nothing. A variety that *sometimes* rolls is the one that has to burn the
   * roll regardless — see the contract's header.
   */
  deal: (ctx, strength) => ({ data: { strength }, rngState: ctx.rngState }),
});
