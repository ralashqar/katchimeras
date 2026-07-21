export const CARD_DESIGN_WIDTH = 941;
export const CARD_DESIGN_HEIGHT = 1672;
export const CARD_ASPECT_RATIO = CARD_DESIGN_WIDTH / CARD_DESIGN_HEIGHT;

export const COMPACT_DAILY_CARD_MAX_WIDTH = 276;
export const COMPACT_DAILY_CARD_HORIZONTAL_GUTTER = 88;
export const COMPACT_DAILY_CARD_MAX_HEIGHT = COMPACT_DAILY_CARD_MAX_WIDTH / CARD_ASPECT_RATIO;

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
  const width = Math.min(COMPACT_DAILY_CARD_MAX_WIDTH, widthLimit, heightLimit * CARD_ASPECT_RATIO);
  return { height: width / CARD_ASPECT_RATIO, scale: width / CARD_DESIGN_WIDTH, width };
}

export function resolveDetailDailyCardSize(viewportWidth: number): DailyCardSize {
  const width = Math.min(390, viewportWidth - 32);
  return { height: width / CARD_ASPECT_RATIO, scale: width / CARD_DESIGN_WIDTH, width };
}
