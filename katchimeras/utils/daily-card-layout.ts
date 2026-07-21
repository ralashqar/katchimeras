export const CARD_DESIGN_WIDTH = 941;
export const FULL_CARD_DESIGN_HEIGHT = 1672;
export const COMPACT_CARD_DESIGN_HEIGHT = 1320;
export const FULL_CARD_ASPECT_RATIO = CARD_DESIGN_WIDTH / FULL_CARD_DESIGN_HEIGHT;
export const COMPACT_CARD_ASPECT_RATIO = CARD_DESIGN_WIDTH / COMPACT_CARD_DESIGN_HEIGHT;

// Kept as the full-card aliases for callers that render the detail card.
export const CARD_DESIGN_HEIGHT = FULL_CARD_DESIGN_HEIGHT;
export const CARD_ASPECT_RATIO = FULL_CARD_ASPECT_RATIO;

export const CARD_SCENE_TOP = 286;
export const COMPACT_CARD_SCENE_TOP = 286;
export const FULL_CARD_SCENE_HEIGHT = 770;
export const COMPACT_CARD_SCENE_HEIGHT = 820;
export const COMPACT_CARD_STORY_TOP = 1052;
export const COMPACT_CARD_STORY_HEIGHT = 174;

// Runtime content slots matched to daily-card-frame-compact.png. Keeping these
// together prevents the creature and promise cards from drifting apart when the
// bespoke frame art changes.
export const COMPACT_CARD_FRAME_RECTS = {
  badge: { x: 77, y: 103, width: 156, height: 148 },
  rarity: { x: 76, y: 263, width: 165, height: 74 },
  name: { x: 269, y: 121, width: 423, height: 86 },
  epithet: { x: 304, y: 224, width: 360, height: 62 },
  date: { x: 732, y: 110, width: 128, height: 184 },
  tag: { x: 708, y: 356, width: 148, height: 205 },
  footer: { x: 92, y: 1024, width: 757, height: 218 },
} as const;

export const COMPACT_DAILY_CARD_MAX_WIDTH = 318;
export const COMPACT_DAILY_CARD_HORIZONTAL_GUTTER = 54;
export const COMPACT_DAILY_CARD_MAX_HEIGHT = COMPACT_DAILY_CARD_MAX_WIDTH / COMPACT_CARD_ASPECT_RATIO;

export type DailyCardSize = {
  height: number;
  scale: number;
  width: number;
};

export function resolveCompactDailyCardSizeForWidth(width: number): DailyCardSize {
  const resolvedWidth = Math.max(1, width);
  return {
    height: resolvedWidth / COMPACT_CARD_ASPECT_RATIO,
    scale: resolvedWidth / CARD_DESIGN_WIDTH,
    width: resolvedWidth,
  };
}

export function resolveCompactDailyCardSize(
  viewportWidth: number,
  maxHeight = COMPACT_DAILY_CARD_MAX_HEIGHT
): DailyCardSize {
  const widthLimit = Math.max(176, viewportWidth - COMPACT_DAILY_CARD_HORIZONTAL_GUTTER);
  const heightLimit = Math.max(240, maxHeight);
  const width = Math.min(COMPACT_DAILY_CARD_MAX_WIDTH, widthLimit, heightLimit * COMPACT_CARD_ASPECT_RATIO);
  return resolveCompactDailyCardSizeForWidth(width);
}

export function resolveDetailDailyCardSize(viewportWidth: number): DailyCardSize {
  const width = Math.min(390, viewportWidth - 32);
  return { height: width / FULL_CARD_ASPECT_RATIO, scale: width / CARD_DESIGN_WIDTH, width };
}
