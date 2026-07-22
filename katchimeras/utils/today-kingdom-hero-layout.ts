import kingdomWorldViewConfig from '@/constants/kingdom-world-view.json';
import todayScene from '@/data/today-scene.json';
import {
  kingdomTileArtFrame,
  type KingdomHexVerticalAlignmentMode,
  type KingdomTileAlphaBounds,
  type KingdomTileFaceBounds,
} from '@/utils/kingdom-tile-alignment';
import { HEX_TILE_H, HEX_TILE_LIP, HEX_TILE_W } from '@/utils/world-hex';

export const TODAY_KINGDOM_STAGE_HEIGHT = 258;
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
