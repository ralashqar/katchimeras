export type KingdomHexVerticalAlignmentMode = 'silhouette-center' | 'ground-bottom';

export type KingdomTileAlphaBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type KingdomTileFrameTarget = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type KingdomArtSourceSize = { width: number; height: number };

export type KingdomTileArtFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type KingdomTileFaceBounds = KingdomTileAlphaBounds;

const TILE_ASSET_SIZE = 1024;

function silhouetteCenteredTop(
  targetCenterY: number,
  assetBounds: KingdomTileAlphaBounds,
  renderedSize: number
): number {
  const assetCenterY = (assetBounds.top + assetBounds.bottom) / 2;
  return targetCenterY - (assetCenterY / TILE_ASSET_SIZE) * renderedSize;
}

/**
 * Fits a square tile render to the visible hex width. The legacy mode centers
 * the complete non-transparent silhouette. Ground-bottom keeps that same
 * width/x fit, but aligns the artwork's bottom pixel to the selected base
 * tile's silhouette-centred bottom position.
 */
export function kingdomTileArtFrame({
  alignmentMode,
  assetBounds,
  faceBounds,
  referenceBounds,
  target,
}: {
  alignmentMode: KingdomHexVerticalAlignmentMode;
  assetBounds: KingdomTileAlphaBounds;
  faceBounds?: KingdomTileFaceBounds;
  referenceBounds: KingdomTileAlphaBounds;
  target: KingdomTileFrameTarget;
}): KingdomTileArtFrame {
  const targetWidth = target.right - target.left;
  const targetCenterX = (target.left + target.right) / 2;
  const targetCenterY = (target.top + target.bottom) / 2;
  if (faceBounds) {
    const faceWidth = faceBounds.right - faceBounds.left;
    const renderedSize = targetWidth * (TILE_ASSET_SIZE / faceWidth);
    return {
      height: renderedSize,
      left: target.left - (faceBounds.left / TILE_ASSET_SIZE) * renderedSize,
      top: target.top - (faceBounds.top / TILE_ASSET_SIZE) * renderedSize,
      width: renderedSize,
    };
  }
  const assetWidth = assetBounds.right - assetBounds.left;
  const renderedSize = targetWidth * (TILE_ASSET_SIZE / assetWidth);
  const assetCenterX = (assetBounds.left + assetBounds.right) / 2;
  const legacyTop = silhouetteCenteredTop(targetCenterY, assetBounds, renderedSize);

  let top = legacyTop;
  if (alignmentMode === 'ground-bottom') {
    const referenceWidth = referenceBounds.right - referenceBounds.left;
    const referenceSize = targetWidth * (TILE_ASSET_SIZE / referenceWidth);
    const referenceTop = silhouetteCenteredTop(targetCenterY, referenceBounds, referenceSize);
    const referenceBottomWorld =
      referenceTop + (referenceBounds.bottom / TILE_ASSET_SIZE) * referenceSize;
    top = referenceBottomWorld - (assetBounds.bottom / TILE_ASSET_SIZE) * renderedSize;
  }

  return {
    height: renderedSize,
    left: targetCenterX - (assetCenterX / TILE_ASSET_SIZE) * renderedSize,
    top,
    width: renderedSize,
  };
}

/**
 * Fits a non-square structure by its visible width while preserving the
 * authored aspect ratio. The top visible alpha pixel is anchored to the top
 * of the complete logical footprint, leaving the deep cliff free to extend
 * below it just like an ordinary Haven tile.
 */
export function kingdomStructureArtFrame({
  assetBounds,
  sourceSize,
  target,
}: {
  assetBounds: KingdomTileAlphaBounds;
  sourceSize: KingdomArtSourceSize;
  target: KingdomTileFrameTarget;
}): KingdomTileArtFrame {
  const targetWidth = target.right - target.left;
  const assetWidth = assetBounds.right - assetBounds.left;
  const width = targetWidth * (sourceSize.width / assetWidth);
  const height = width * (sourceSize.height / sourceSize.width);
  return {
    left: target.left - (assetBounds.left / sourceSize.width) * width,
    top: target.top - (assetBounds.top / sourceSize.height) * height,
    width,
    height,
  };
}
