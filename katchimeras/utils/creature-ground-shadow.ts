import { CREATURE_HATCHLING_ALPHA_BOUNDS } from '@/constants/creature-hatchling-alpha-bounds.gen';
import type { HomeVisualKey } from '@/types/home';

const DEFAULT_ALPHA_BOUNDS = { left: 0.2, top: 0.05, right: 0.8, bottom: 0.94 };

export type CreatureGroundShadowLayout = {
  contactY: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

/**
 * Positions a tight contact shadow from the actual visible hatchling pixels.
 * `contactY` is the bottom-most pixel whose alpha meets the generated
 * visibility threshold, not the bottom of the square source image.
 */
export function resolveCreatureGroundShadowLayout(
  visualKey: HomeVisualKey,
  frameSize: number,
  sizeMultiplier = 1,
): CreatureGroundShadowLayout {
  const bounds = CREATURE_HATCHLING_ALPHA_BOUNDS[visualKey] ?? DEFAULT_ALPHA_BOUNDS;
  const visibleWidth = Math.max(1, (bounds.right - bounds.left) * frameSize);
  const baseWidth = Math.min(
    frameSize * 0.42,
    Math.max(frameSize * 0.26, visibleWidth * 0.52),
  );
  // Keep the contact mark soft and low, but give the radial falloff enough
  // vertical body to remain legible against detailed Today and Kingdom tiles.
  const baseHeight = Math.max(frameSize * 0.075, baseWidth * 0.23);
  const width = baseWidth * sizeMultiplier;
  const height = baseHeight * sizeMultiplier;
  const contactY = bounds.bottom * frameSize;
  const visibleCenterX = ((bounds.left + bounds.right) / 2) * frameSize;

  return {
    contactY,
    height,
    left: visibleCenterX - width / 2,
    // Let the feathered ellipse sit partly behind the final visible pixels so
    // the feet and shadow meet without a transparent floating gap.
    top: contactY - height * 0.44,
    width,
  };
}
