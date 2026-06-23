import { ARCHETYPE_THEME } from '@/constants/world';
import type { MemoryNode, WorldArchetype, WorldObject, WorldPatch } from '@/types/world';
import {
  cellCenter,
  drawDepth,
  gridCorner,
  patchTopCorners,
  patchWorldOrigin,
  PATCH_SIZE,
  SLAB_THICKNESS,
  TILE_W,
  type IsoPoint,
} from '@/utils/world-iso';

// Flattens the persisted world into absolute, render-ready geometry. Pure: the
// Skia/RN component just paints what this returns, and this stays unit-testable.

export type SceneSprite = {
  id: string;
  patchId: string;
  kind: WorldObject['kind'] | 'memory';
  assetKey: string;
  label: string;
  archetype: WorldArchetype;
  x: number; // bottom-centre anchor point, absolute scene coords
  y: number;
  size: number;
  depth: number; // global painter order
  memory?: MemoryNode;
};

export type SceneDecal = {
  id: string;
  patchId: string;
  decal: string;
  archetype: WorldArchetype;
  x: number; // tile centre, absolute scene coords
  y: number;
  size: number;
  depth: number;
};

export type SceneSlab = {
  patchId: string;
  archetype: WorldArchetype;
  topCorners: IsoPoint[]; // [top, right, bottom, left]
  leftFace: IsoPoint[];
  rightFace: IsoPoint[];
  seams: [IsoPoint, IsoPoint][];
  centre: IsoPoint;
  depth: number;
};

export type WorldScene = {
  width: number;
  height: number;
  slabs: SceneSlab[];
  decals: SceneDecal[];
  sprites: SceneSprite[];
};

const PATCH_DEPTH_STRIDE = 1000;

// Sprites are centred on their cell, so size encodes how much of the footprint
// the object should cover. Multi-cell anchors scale up to occupy both tiles.
function spriteSize(object: WorldObject): number {
  switch (object.kind) {
    case 'anchor':
      return object.footprint >= 2 ? TILE_W * 1.6 : TILE_W * 1.05;
    case 'creature':
      return TILE_W * 0.7;
    case 'memory':
      return TILE_W * 0.66;
    default:
      return TILE_W * 0.66;
  }
}

// Every cell is floored with a diamond tile from the atlas — the archetype's
// base ground tile by default, an accent tile on some free cells. Rendered at
// exactly one tile width so the diamonds tile seamlessly (shared edges). Derived
// at render time, so density/look changes apply to existing patches too.
const TILE_RENDER_W = TILE_W * 1.02; // slight overlap seals the seams
const ACCENT_DENSITY = 0.4; // share of free cells that get an accent tile

// Stable per-cell hash so decal placement is deterministic per patch + tile.
function cellHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Centre of an object's footprint (handles the 2-wide anchor).
function footprintCentre(object: WorldObject): IsoPoint {
  if (object.footprint >= 2) {
    const a = cellCenter(object.col, object.row);
    const b = cellCenter(object.col + object.footprint - 1, object.row);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return cellCenter(object.col, object.row);
}

export function layoutWorld(patches: WorldPatch[]): WorldScene {
  const rawSlabs: SceneSlab[] = [];
  const rawSprites: SceneSprite[] = [];
  const rawDecals: SceneDecal[] = [];

  for (const patch of patches) {
    const origin = patchWorldOrigin(patch.gridCol, patch.gridRow);
    const patchDepth = (patch.gridCol + patch.gridRow) * PATCH_DEPTH_STRIDE;
    const shift = (p: IsoPoint): IsoPoint => ({ x: origin.x + p.x, y: origin.y + p.y });

    const [top, right, bottom, left] = patchTopCorners().map(shift);
    const leftFace = [left, bottom, { x: bottom.x, y: bottom.y + SLAB_THICKNESS }, { x: left.x, y: left.y + SLAB_THICKNESS }];
    const rightFace = [bottom, right, { x: right.x, y: right.y + SLAB_THICKNESS }, { x: bottom.x, y: bottom.y + SLAB_THICKNESS }];
    const seams: [IsoPoint, IsoPoint][] = [];
    for (let i = 1; i < PATCH_SIZE; i += 1) {
      seams.push([shift(gridCorner(i, 0)), shift(gridCorner(i, PATCH_SIZE))]);
      seams.push([shift(gridCorner(0, i)), shift(gridCorner(PATCH_SIZE, i))]);
    }

    rawSlabs.push({
      patchId: patch.id,
      archetype: patch.primaryArchetype,
      topCorners: [top, right, bottom, left],
      leftFace,
      rightFace,
      seams,
      centre: shift(cellCenter(1, 1)),
      depth: patchDepth - 1,
    });

    for (const object of patch.objects) {
      const c = shift(footprintCentre(object));
      rawSprites.push({
        id: object.id,
        patchId: patch.id,
        kind: object.kind,
        assetKey: object.assetKey,
        label: object.label,
        archetype: patch.primaryArchetype,
        x: c.x,
        y: c.y,
        size: spriteSize(object),
        depth: patchDepth + drawDepth(object.col, object.row) * 2 + (object.kind === 'creature' ? 1 : 0),
      });
    }
    // Decals grow on the cells NOT taken by an object/memory. Occupied = every
    // footprint cell of each object plus each memory node.
    const occupied = new Set<string>();
    for (const object of patch.objects) {
      for (let f = 0; f < Math.max(1, object.footprint); f += 1) {
        occupied.add(`${object.col + f},${object.row}`);
      }
    }
    for (const node of patch.memoryNodes) occupied.add(`${node.col},${node.row}`);

    const theme = ARCHETYPE_THEME[patch.primaryArchetype];
    for (let row = 0; row < PATCH_SIZE; row += 1) {
      for (let col = 0; col < PATCH_SIZE; col += 1) {
        const h = cellHash(`${patch.id}:${col},${row}`);
        const isFree = !occupied.has(`${col},${row}`);
        // Accent tile on some free cells; the base ground tile everywhere else
        // (including under objects, so they sit on real ground).
        const key =
          isFree && (h % 1000) / 1000 < ACCENT_DENSITY
            ? theme.decals[(h >>> 10) % theme.decals.length]
            : theme.groundTile;
        const c = shift(cellCenter(col, row));
        rawDecals.push({
          id: `${patch.id}-tile-${col}-${row}`,
          patchId: patch.id,
          // Each tile type has a _2 variant from the grid; pick one per cell.
          decal: (h >>> 16) & 1 ? `${key}_2` : key,
          archetype: patch.primaryArchetype,
          x: c.x,
          y: c.y,
          size: TILE_RENDER_W,
          depth: patchDepth + drawDepth(col, row) * 2 - 1,
        });
      }
    }
    for (const node of patch.memoryNodes) {
      const c = shift(cellCenter(node.col, node.row));
      rawSprites.push({
        id: node.id,
        patchId: patch.id,
        kind: 'memory',
        assetKey: node.assetKey,
        label: node.label,
        archetype: patch.primaryArchetype,
        x: c.x,
        y: c.y,
        size: TILE_W * 0.6,
        depth: patchDepth + drawDepth(node.col, node.row) * 2,
        memory: node,
      });
    }
  }

  // Normalise to a positive, padded coordinate space.
  const pad = 80;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const slab of rawSlabs) {
    for (const p of [...slab.topCorners, ...slab.leftFace, ...slab.rightFace]) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const sprite of rawSprites) {
    xs.push(sprite.x - sprite.size / 2, sprite.x + sprite.size / 2);
    ys.push(sprite.y - sprite.size, sprite.y);
  }
  const minX = xs.length ? Math.min(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  const dx = -minX + pad;
  const dy = -minY + pad;

  const move = (p: IsoPoint): IsoPoint => ({ x: p.x + dx, y: p.y + dy });
  const slabs = rawSlabs.map((slab) => ({
    ...slab,
    topCorners: slab.topCorners.map(move),
    leftFace: slab.leftFace.map(move),
    rightFace: slab.rightFace.map(move),
    seams: slab.seams.map(([a, b]) => [move(a), move(b)] as [IsoPoint, IsoPoint]),
    centre: move(slab.centre),
  }));
  const sprites = rawSprites
    .map((sprite) => ({ ...sprite, x: sprite.x + dx, y: sprite.y + dy }))
    .sort((a, b) => a.depth - b.depth);
  const decals = rawDecals
    .map((decal) => ({ ...decal, x: decal.x + dx, y: decal.y + dy }))
    .sort((a, b) => a.depth - b.depth);

  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    slabs: slabs.sort((a, b) => a.depth - b.depth),
    decals,
    sprites,
  };
}
