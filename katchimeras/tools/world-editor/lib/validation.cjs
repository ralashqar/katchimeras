const fs = require('fs');
const { CATALOG_PATH, LAYOUT_PATH, resolveRepoPath, assertInside, WORLD_ASSET_DIR } = require('./paths.cjs');
const { readWorldVisualRegistry } = require('./asset-registry.cjs');

const TILE_W = 128;
const TILE_H = 64;
const STAGE_SIZE = 760;
const STAGE_SCALE = 1.22;
const STAGE_CENTRE = { x: STAGE_SIZE / 2, y: STAGE_SIZE / 2 + 24 };
const SLAB_CENTRE_CELL = { col: 1, row: 1 };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function cellCenter(col, row) {
  return { x: (col - row) * (TILE_W / 2), y: (col + row + 1) * (TILE_H / 2) };
}

function toStagePoint(col, row) {
  const origin = cellCenter(SLAB_CENTRE_CELL.col, SLAB_CENTRE_CELL.row);
  const point = cellCenter(col, row);
  return {
    x: STAGE_CENTRE.x + (point.x - origin.x) * STAGE_SCALE,
    y: STAGE_CENTRE.y + (point.y - origin.y) * STAGE_SCALE,
  };
}

function validateDesignData(catalog = readJson(CATALOG_PATH), layout = readJson(LAYOUT_PATH)) {
  const errors = [];
  const warnings = [];
  const registry = readWorldVisualRegistry();
  const assetKeys = new Set(registry.map((entry) => entry.assetKey));
  const bounds = layout.bounds ?? {};
  const useBackplateBounds = bounds.mode === 'backplate' || isFiniteNumber(bounds.minX) || isFiniteNumber(bounds.maxX);
  const minX = isFiniteNumber(bounds.minX) ? bounds.minX : 0;
  const maxX = isFiniteNumber(bounds.maxX) ? bounds.maxX : STAGE_SIZE;
  const minY = isFiniteNumber(bounds.minY) ? bounds.minY : 0;
  const maxY = isFiniteNumber(bounds.maxY) ? bounds.maxY : STAGE_SIZE;
  const minCol = isFiniteNumber(bounds.minCol) ? bounds.minCol : -0.75;
  const maxCol = isFiniteNumber(bounds.maxCol) ? bounds.maxCol : 3.75;
  const minRow = isFiniteNumber(bounds.minRow) ? bounds.minRow : -0.75;
  const maxRow = isFiniteNumber(bounds.maxRow) ? bounds.maxRow : 3.75;
  const minScale = isFiniteNumber(bounds.minScale) ? bounds.minScale : 0.35;
  const maxScale = isFiniteNumber(bounds.maxScale) ? bounds.maxScale : 3.5;

  if (!Array.isArray(catalog.families)) errors.push('Catalog must contain a families array.');

  for (const family of catalog.families ?? []) {
    if (!family.id) errors.push('Every family needs an id.');
    if (!family.category) errors.push(`${family.id ?? 'unknown'} needs a category.`);
    if (family.enabled) {
      const pos = layout.positions?.[family.category];
      if (!pos) {
        errors.push(`${family.label ?? family.id} is enabled but has no layout position for category "${family.category}".`);
      } else {
        if (isFiniteNumber(pos.nx) || isFiniteNumber(pos.ny)) {
          if (!isFiniteNumber(pos.nx) || pos.nx < 0 || pos.nx > 1) {
            errors.push(`${family.category}.nx must be finite and between 0 and 1.`);
          }
          if (!isFiniteNumber(pos.ny) || pos.ny < 0 || pos.ny > 1) {
            errors.push(`${family.category}.ny must be finite and between 0 and 1.`);
          }
        } else if (!isFiniteNumber(pos.col) || !isFiniteNumber(pos.row)) {
          errors.push(`${family.category} position must have finite col and row values.`);
        } else if (useBackplateBounds) {
          const point = toStagePoint(pos.col, pos.row);
          if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
            errors.push(`${family.category} position must project inside the backplate square (${minX},${minY})-(${maxX},${maxY}).`);
          }
        } else {
          if (pos.col < minCol || pos.col > maxCol) {
            errors.push(`${family.category}.col must be finite and between ${minCol} and ${maxCol}.`);
          }
          if (pos.row < minRow || pos.row > maxRow) {
            errors.push(`${family.category}.row must be finite and between ${minRow} and ${maxRow}.`);
          }
        }
      }
    }
    for (const asset of family.assets ?? []) {
      if (!asset.assetKey) errors.push(`${family.id} has an asset without assetKey.`);
      if (asset.assetKey && !assetKeys.has(asset.assetKey)) warnings.push(`${asset.assetKey} is not currently wired in utils/world-visuals.ts.`);
      if (!asset.path) {
        errors.push(`${asset.assetKey ?? family.id} has no file path.`);
      } else {
        const abs = resolveRepoPath(asset.path);
        try {
          assertInside(abs, WORLD_ASSET_DIR);
        } catch (error) {
          errors.push(error.message);
        }
        if (!fs.existsSync(abs)) errors.push(`Missing asset file: ${asset.path}`);
      }
    }
  }

  for (const [category, scale] of Object.entries(layout.scaleByCategory ?? {})) {
    if (!isFiniteNumber(scale) || scale <= 0 || scale < minScale || scale > maxScale) {
      errors.push(`scaleByCategory.${category} must be finite and between ${minScale} and ${maxScale}.`);
    }
  }
  for (const [assetKey, scale] of Object.entries(layout.scaleByAssetKey ?? {})) {
    if (!isFiniteNumber(scale) || scale <= 0 || scale < minScale || scale > maxScale) {
      errors.push(`scaleByAssetKey.${assetKey} must be finite and between ${minScale} and ${maxScale}.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { readJson, validateDesignData };
