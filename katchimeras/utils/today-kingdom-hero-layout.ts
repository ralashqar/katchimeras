import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import { CREATURE_HATCHLING_ALPHA_BOUNDS } from '@/constants/creature-hatchling-alpha-bounds.gen';
import todayScene from '@/data/today-scene.json';
import type { HomeVisualKey } from '@/types/home';
import {
  kingdomTileArtFrame,
  type KingdomHexVerticalAlignmentMode,
  type KingdomTileAlphaBounds,
  type KingdomTileFaceBounds,
} from '@/utils/kingdom-tile-alignment';
import { HEX_TILE_H, HEX_TILE_LIP, HEX_TILE_W } from '@/utils/world-hex';

export const TODAY_KINGDOM_STAGE_HEIGHT = 258;
// Today's measured value replaces this after its first layout pass. Debug
// previews use the same first-frame anchor so their full-screen composition
// matches Today without needing to render the timeline.
export const TODAY_EXPLORATION_HERO_STAGE_TOP_AFTER_SAFE_AREA = 8 + 85 + 26;
// The complete close-up sits a little lower on Today than the map camera, but
// the tile and resident now share the exact same Kingdom-space origin.
const TODAY_KINGDOM_BASE_TILE_CENTER_Y = 138;
export const TODAY_KINGDOM_TILE_CENTER_Y = TODAY_KINGDOM_BASE_TILE_CENTER_Y
  + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEnvironment.verticalLowerStageHeightRatio;

export type TodayKingdomTileAlignment = {
  alignmentMode: KingdomHexVerticalAlignmentMode;
  assetBounds: KingdomTileAlphaBounds;
  faceBounds?: KingdomTileFaceBounds;
  referenceBounds: KingdomTileAlphaBounds;
};

const CREATURE_BASE_SIZE = 58;
const CREATURE_WORLD_SIZE = CREATURE_BASE_SIZE * kingdomWorldViewConfig.katchimera.globalScale;
const EGG_STAGE_WIDTH = 200;
const EGG_SHELL_WIDTH = 196;
const EGG_SHELL_HEIGHT = 224;
const TILE_ASSET_SIZE = 1024;
const FULL_IMAGE_BOUNDS = { left: 0, top: 0, right: 1024, bottom: 1024 };

// Three historical 20% close-up passes plus the current data-driven framing
// pass, kept explicit so Today tuning never changes the Kingdom camera.
const TODAY_CLOSE_UP_SCALE = 1.2 * 1.2 * 1.2 * todayScene.homeEnvironment.zoomScale;
const TILE_MIN_IMAGE_SIZE = 400;
const TILE_MAX_IMAGE_SIZE = 460;

export function todayKingdomHeroLayout(
  windowWidth: number,
  environmentAlignment: TodayKingdomTileAlignment = {
    alignmentMode: 'ground-bottom',
    assetBounds: FULL_IMAGE_BOUNDS,
    faceBounds: FULL_IMAGE_BOUNDS,
    referenceBounds: FULL_IMAGE_BOUNDS,
  },
  anchorAlignment: TodayKingdomTileAlignment = environmentAlignment,
) {
  // The egg/home environment owns the screen-space anchor. Every environment
  // keeps the same full-asset scale, but its measured visible bottom is moved
  // onto the home environment's bottom. Entity placement is derived only
  // after that environment frame has been resolved.
  const closeUpTileSize = Math.min(
    TILE_MAX_IMAGE_SIZE * TODAY_CLOSE_UP_SCALE,
    Math.max(
      TILE_MIN_IMAGE_SIZE * TODAY_CLOSE_UP_SCALE,
      windowWidth * 1.15 * TODAY_CLOSE_UP_SCALE,
    ),
  );
  const tileSize = todayScene.homeEnvironment.fitToViewport
    ? Math.max(
        1,
        (windowWidth - todayScene.homeEnvironment.fitHorizontalPadding * 2)
          * todayScene.homeEnvironment.fitScale,
      )
    : closeUpTileSize;
  const anchorBounds = anchorAlignment.faceBounds ?? anchorAlignment.assetBounds;
  const anchorLogicalWidth = tileSize
    * ((anchorBounds.right - anchorBounds.left) / TILE_ASSET_SIZE);
  const anchorScale = anchorLogicalWidth / HEX_TILE_W;
  const anchorHalfWidth = anchorLogicalWidth / 2;
  const anchorHalfFaceHeight = (HEX_TILE_H * anchorScale) / 2;
  const anchorFrame = kingdomTileArtFrame({
    ...anchorAlignment,
    target: {
      bottom: TODAY_KINGDOM_TILE_CENTER_Y + anchorHalfFaceHeight + HEX_TILE_LIP * anchorScale,
      left: -anchorHalfWidth,
      right: anchorHalfWidth,
      top: TODAY_KINGDOM_TILE_CENTER_Y - anchorHalfFaceHeight,
    },
  });
  const environmentBottomY = anchorFrame.top
    + (anchorAlignment.assetBounds.bottom / TILE_ASSET_SIZE) * anchorFrame.height;
  const tileFrame = {
    height: tileSize,
    left: anchorFrame.left,
    top: environmentBottomY
      - (environmentAlignment.assetBounds.bottom / TILE_ASSET_SIZE) * tileSize,
    width: tileSize,
  };

  const alignmentBounds = environmentAlignment.faceBounds
    ?? anchorAlignment.faceBounds
    ?? environmentAlignment.assetBounds;
  const logicalTileWidth = tileSize
    * ((alignmentBounds.right - alignmentBounds.left) / TILE_ASSET_SIZE);
  const kingdomScale = logicalTileWidth / HEX_TILE_W;
  const renderedFaceTop = tileFrame.top
    + (alignmentBounds.top / TILE_ASSET_SIZE) * tileSize;
  const tileCenterY = renderedFaceTop + (HEX_TILE_H * kingdomScale) / 2;
  const tileFaceBottomY = tileCenterY + (HEX_TILE_H * kingdomScale) / 2;

  const creatureSize = CREATURE_WORLD_SIZE * kingdomScale;
  const creatureTop = tileCenterY + (
    HEX_TILE_H * kingdomWorldViewConfig.katchimera.verticalOffsetHexTileHeight
    - CREATURE_BASE_SIZE * 0.63
    - (CREATURE_WORLD_SIZE - CREATURE_BASE_SIZE)
  ) * kingdomScale
    - creatureSize * todayScene.homeKatchimera.verticalLiftCreatureHeightRatio;
  const eggWorldWidth = EGG_STAGE_WIDTH * kingdomWorldViewConfig.egg.globalScale * kingdomScale;
  const eggCenterY = tileCenterY
    + HEX_TILE_H * kingdomWorldViewConfig.egg.verticalOffsetHexTileHeight * kingdomScale;

  return {
    creatureSize,
    creatureTop,
    eggCenterY,
    environmentBottomY,
    // LanternEgg's visible shell is 196px wide. Scaling that exact art width to
    // Kingdom's 70-world-unit egg reproduces the Kingdom egg-to-tile ratio.
    eggStageScale: (eggWorldWidth / EGG_SHELL_WIDTH) * todayScene.homeEgg.scale,
    logicalTileWidth,
    tileCenterY,
    // The boundary where the walkable top face becomes the stair/cliff edge.
    // Foreground atmosphere should begin here rather than at an arbitrary
    // percentage of the Today hero stage.
    tileFaceBottomY,
    tileFrame,
    tileSize,
  };
}

/** Top edge for UI that must sit fully below the scaled Today egg shell. */
export function todayEggCountdownTop(eggCenterY: number, eggStageScale: number): number {
  const shellBottom = eggCenterY
    + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio
    + (EGG_SHELL_HEIGHT * eggStageScale) / 2;
  return shellBottom
    + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeHatchCountdown.verticalLowerStageHeightRatio;
}

/** Final native-layout frame for Today's egg. Avoids a small transformed
 * subtree that iOS can cache before the user pinches into it. */
export function todayEggStageFrame(eggCenterY: number, eggStageScale: number) {
  const height = TODAY_KINGDOM_STAGE_HEIGHT * eggStageScale;
  const centerY = eggCenterY
    + TODAY_KINGDOM_STAGE_HEIGHT * todayScene.homeEgg.verticalLowerStageHeightRatio;
  return {
    height,
    top: centerY - height / 2,
  };
}

/**
 * Places the separately rendered egg onto the fixed platform authored into the
 * square exploration background. `stageScreenTop` is the hero stage's y
 * position in the full Today viewport; the returned frame is local to that
 * stage and may extend below it because the Today composition intentionally
 * allows visible overflow.
 */
export function todayExplorationEggStageFrame(
  windowWidth: number,
  windowHeight: number,
  stageScreenTop: number,
) {
  const config = todayScene.homeExplorationBackground;
  const eggWidth = Math.min(
    windowWidth * config.eggWidthViewportWidthRatio,
    windowHeight * config.eggWidthViewportHeightRatio,
  );
  const scale = eggWidth / EGG_STAGE_WIDTH;
  const height = TODAY_KINGDOM_STAGE_HEIGHT * scale;
  const contactY = windowHeight * config.eggContactYRatio;
  const top = contactY - stageScreenTop - height;
  return {
    centerY: top + height / 2,
    contactY,
    height,
    scale,
    top,
    width: eggWidth,
  };
}

/**
 * Places a hatchling cutout on the same authored platform as the forming egg.
 * The frame accounts for each transparent cutout's measured bottom-most pixel,
 * so its visible feet—not the square bitmap edge—meet the platform.
 */
export function todayExplorationCreatureStageFrame(
  windowWidth: number,
  windowHeight: number,
  stageScreenTop: number,
  visualKey: HomeVisualKey,
) {
  const config = todayScene.homeExplorationBackground;
  const size = Math.min(
    windowWidth * config.creatureWidthViewportWidthRatio,
    windowHeight * config.creatureWidthViewportHeightRatio,
  );
  const alphaBottom = CREATURE_HATCHLING_ALPHA_BOUNDS[visualKey]?.bottom ?? 0.94;
  const contactY = windowHeight * config.creatureContactYRatio;
  const stageContactY = contactY - stageScreenTop;
  const top = stageContactY - size * alphaBottom;
  return {
    centerY: top + size / 2,
    contactY,
    height: size,
    size,
    stageContactY,
    top,
    width: size,
  };
}
