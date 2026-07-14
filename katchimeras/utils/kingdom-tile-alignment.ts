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

export type KingdomTileArtFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
  referenceBounds,
  target,
}: {
  alignmentMode: KingdomHexVerticalAlignmentMode;
  assetBounds: KingdomTileAlphaBounds;
  referenceBounds: KingdomTileAlphaBounds;
  target: KingdomTileFrameTarget;
}): KingdomTileArtFrame {
  const targetWidth = target.right - target.left;
  const targetCenterX = (target.left + target.right) / 2;
  const targetCenterY = (target.top + target.bottom) / 2;
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
