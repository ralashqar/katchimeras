/**
 * The five things that stand on Heartwood's patches (the Wisp Lantern and the four buildings) share one size and one
 * seat, so they always agree. They are sized by real layout, never by a transform: a scaled-down view is resampled
 * and lands on fractional pixels, which softens the art and its label. Every number here is already whole.
 *
 * `SCALE` is against the original 104 x 124 design (0.8, then a further 0.85).
 */
export const HEARTWOOD_PATCH_ITEM_SCALE = 0.68;
const scaled = (value: number) => Math.round(value * HEARTWOOD_PATCH_ITEM_SCALE);

export const HEARTWOOD_PATCH_ITEM = {
  /** The art's square. */
  art: scaled(104),
  width: scaled(104),
  /** Art plus the label under it. */
  height: scaled(124),
  labelFont: 8,
  labelPadding: 3,
  labelRadius: 7,
  /** How far under the patch's centre the box's bottom edge (the label) sits, so the art stands in the patch. */
  baseBelowCentre: 40,
  scaled,
} as const;

/** Where the box goes for a patch, on whole pixels. */
export function heartwoodPatchItemPosition(frame: { left: number; top: number; width: number; height: number }) {
  return {
    position: 'absolute' as const,
    left: Math.round(frame.left + frame.width / 2 - HEARTWOOD_PATCH_ITEM.width / 2),
    top: Math.round(frame.top + frame.height / 2 + HEARTWOOD_PATCH_ITEM.baseBelowCentre - HEARTWOOD_PATCH_ITEM.height),
  };
}
