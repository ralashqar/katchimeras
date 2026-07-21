export const CARD_DESIGN_WIDTH = 941;
export const FULL_CARD_DESIGN_HEIGHT = 1672;
export const COMPACT_CARD_DESIGN_HEIGHT = 1320;
export const FULL_CARD_ASPECT_RATIO = CARD_DESIGN_WIDTH / FULL_CARD_DESIGN_HEIGHT;
export const COMPACT_CARD_ASPECT_RATIO = CARD_DESIGN_WIDTH / COMPACT_CARD_DESIGN_HEIGHT;

// Kept as the full-card aliases for callers that render the detail card.
export const CARD_DESIGN_HEIGHT = FULL_CARD_DESIGN_HEIGHT;
export const CARD_ASPECT_RATIO = FULL_CARD_ASPECT_RATIO;

export const CARD_SCENE_TOP = 286;
export const FULL_CARD_SCENE_HEIGHT = 770;
export const COMPACT_CARD_SCENE_HEIGHT = 730;
export const COMPACT_CARD_STORY_TOP = 1070;
export const COMPACT_CARD_STORY_HEIGHT = 116;

export const COMPACT_DAILY_CARD_MAX_WIDTH = 318;
export const COMPACT_DAILY_CARD_HORIZONTAL_GUTTER = 54;
export const COMPACT_DAILY_CARD_MAX_HEIGHT = COMPACT_DAILY_CARD_MAX_WIDTH / COMPACT_CARD_ASPECT_RATIO;

export type DailyCardSize = {
  height: number;
  scale: number;
  width: number;
};

export function resolveCompactDailyCardSize(
  viewportWidth: number,
  maxHeight = COMPACT_DAILY_CARD_MAX_HEIGHT
): DailyCardSize {
  const widthLimit = Math.max(176, viewportWidth - COMPACT_DAILY_CARD_HORIZONTAL_GUTTER);
  const heightLimit = Math.max(240, maxHeight);
  const width = Math.min(COMPACT_DAILY_CARD_MAX_WIDTH, widthLimit, heightLimit * COMPACT_CARD_ASPECT_RATIO);
  return { height: width / COMPACT_CARD_ASPECT_RATIO, scale: width / CARD_DESIGN_WIDTH, width };
}

export function resolveDetailDailyCardSize(viewportWidth: number): DailyCardSize {
  const width = Math.min(390, viewportWidth - 32);
  return { height: width / FULL_CARD_ASPECT_RATIO, scale: width / CARD_DESIGN_WIDTH, width };
}
