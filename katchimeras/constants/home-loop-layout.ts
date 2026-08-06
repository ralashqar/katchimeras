/** Optical offsets shared by the forming, hatch, and settled Home compositions. */
export const HOME_SCENE_Y_OFFSET = 22;
export const HOME_ACTIONS_Y_OFFSET = 36;

/** Keep the forming action stack visually attached to the floating tab bar. */
export const HOME_ACTIONS_TAB_BAR_GAP = 20;
export const HOME_TAB_BAR_MIN_HEIGHT = 96;
export const HOME_TAB_BAR_CONTENT_HEIGHT = 62;
export const HOME_TAB_BAR_MIN_BOTTOM_PADDING = 10;

export function homeTabBarHeight(bottomInset: number): number {
  return Math.max(
    HOME_TAB_BAR_MIN_HEIGHT,
    HOME_TAB_BAR_CONTENT_HEIGHT + Math.max(bottomInset, HOME_TAB_BAR_MIN_BOTTOM_PADDING),
  );
}
