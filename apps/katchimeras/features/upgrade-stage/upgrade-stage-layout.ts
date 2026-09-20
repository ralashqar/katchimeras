/**
 * The shared upgrade stage: a docked panel over the bottom of the screen and
 * the world subject framed in the band left above it. The panel's height is
 * decided here, before anything mounts, so the camera can be sent to its final
 * target while the panel is still sliding in.
 */
export type UpgradeStageLayout = {
  panelHeight: number;
  panelWidth: number;
  /** Top of the band the subject is framed in, below the HUD. */
  stageTop: number;
  stageHeight: number;
  /** Screen Y the subject's centre is framed at. */
  stageCenterY: number;
};

/** The HUD bar (Back, progress, Glow) under the top safe-area inset. */
export const UPGRADE_STAGE_TOP_CHROME = 60;
export const UPGRADE_PANEL_MAX_WIDTH = 600;
const PANEL_MIN_HEIGHT = 360;
const PANEL_MAX_HEIGHT = 600;
const STAGE_MIN_HEIGHT = 100;
const SHORT_SCREEN_HEIGHT = 700;

export function upgradeStageLayout(
  viewport: { width: number; height: number },
  insets: { top: number; bottom: number },
): UpgradeStageLayout {
  const stageTop = insets.top + UPGRADE_STAGE_TOP_CHROME;
  // Short phones give the panel a little more so its content rarely scrolls.
  const fraction = viewport.height < SHORT_SCREEN_HEIGHT ? 0.6 : 0.54;
  const wanted = Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, Math.round(viewport.height * fraction)));
  const panelHeight = Math.max(200, Math.min(wanted, viewport.height - stageTop - STAGE_MIN_HEIGHT));
  const stageHeight = Math.max(1, viewport.height - panelHeight - stageTop);
  return {
    panelHeight,
    panelWidth: Math.min(viewport.width, UPGRADE_PANEL_MAX_WIDTH),
    stageTop,
    stageHeight,
    stageCenterY: stageTop + stageHeight / 2,
  };
}
