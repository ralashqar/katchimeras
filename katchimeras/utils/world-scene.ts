import { ARCHETYPE_THEME } from '@/constants/world';
import type { MemoryNode, PatchCellType, WorldArchetype, WorldObject, WorldPatch } from '@/types/world';
import TILE_LAYOUT from '@/data/world-tile-layout.json';
import {
  cellCenter,
  drawDepth,
  gridCorner,
  patchWorldOrigin,
  PATCH_SIZE,
  SLAB_THICKNESS,
  TILE_W,
  type IsoPoint,
} from '@/utils/world-iso';
import { IMAGE_BASE_FACTOR } from '@/utils/world-base-projection';

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
  col: number; // the tile this sprite OCCUPIES (for tile-based tap hit-testing)
  row: number;
  size: number;
  depth: number; // global painter order
  memory?: MemoryNode;
  category?: WorldObject['category']; // which time-capsule cell this sprite is
  badge?: number; // small count/metric tag for the cell object
  badgeIcon?: string; // override the badge icon
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

// An empty typed slot on a forming patch — drawn as a faint placeholder "spot"
// the day can fill (Today Patch V2). Positioned at the slot's tile centre.
export type SceneGhost = {
  id: string;
  patchId: string;
  slotType: PatchCellType;
  x: number;
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

// A perimeter fence: a straight front-facing strip skewed onto one front edge.
// `angle` is the skewY in degrees that shears the strip to the 2:1 edge slope
// (pickets stay vertical). `x,y,w,h` is the un-skewed box; skew is about centre.
export type SceneFence = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  depth: number;
  // Which horizontal slice of the fence strip this segment shows (so the 4
  // segments of a side together form one continuous fence, not 4 squashed copies).
  sliceIndex: number;
  sliceCount: number;
};

// Split a front edge (a→b, with corner grid-sums sumA/sumB) into 4 tile-edge
// fence segments. Each segment's baseline midpoint sits on the edge (skewY shears
// it to the slope) and its depth interpolates the grid-sum, so it sorts with the
// objects. H = picket height above the edge.
function buildFenceSide(
  idBase: string,
  a: IsoPoint,
  b: IsoPoint,
  angle: number,
  patchDepth: number,
  sumA: number,
  sumB: number
): SceneFence[] {
  // Picket height above the edge. Kept low (a short cottage fence) so the
  // perimeter frames the plot without blocking the view of objects behind it.
  const H = 38;
  const segs: SceneFence[] = [];
  for (let k = 0; k < 4; k += 1) {
    const t0 = k / 4;
    const t1 = (k + 1) / 4;
    const tc = (k + 0.5) / 4;
    const x0 = a.x + t0 * (b.x - a.x);
    const x1 = a.x + t1 * (b.x - a.x);
    const cy = a.y + tc * (b.y - a.y);
    const gridSum = sumA + tc * (sumB - sumA);
    segs.push({
      id: `${idBase}-${k}`,
      x: Math.min(x0, x1),
      y: cy - H,
      w: Math.abs(x1 - x0),
      h: H,
      angle,
      depth: patchDepth + gridSum * 2,
      // The strip runs a→b; slice index follows screen-x (left→right).
      sliceIndex: x0 < x1 ? k : 3 - k,
      sliceCount: 4,
    });
  }
  return segs;
}

export type WorldScene = {
  width: number;
  height: number;
  slabs: SceneSlab[];
  decals: SceneDecal[];
  fences: SceneFence[];
  sprites: SceneSprite[];
  ghosts: SceneGhost[];
};

const PATCH_DEPTH_STRIDE = 1000;

// Objects are 1:2 frames = one SLOT of the 4x4 line grid (world-tile-edit.py
// object-grid): two stacked square cells, the LOWER is the base tile, the UPPER is
// headroom. The frame width == one grid column == one tile, so size = TILE_W and
// the base cell maps onto the world tile. See OBJECT_BASE in world-canvas for the
// vertical mapping. Creatures are square + centre-anchored (not tile-art).
function spriteSize(object: WorldObject): number {
  const base = object.kind === 'creature' ? TILE_W * 0.6 : TILE_W;
  return base * (object.sizeScale ?? 1);
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

// `ring` extends the ground slab by N rings of EMPTY cells around the 4×4 content
// (objects/memories still live on the inner 0..PATCH_SIZE grid). It frames the
// day's patch with a margin of bare ground so it reads as an island, and is used
// by the single-patch home view. ring = 0 reproduces the original tight slab.
// `stableBounds` makes the coordinate space depend ONLY on the fixed slab geometry
// (plus a constant object-rise margin), never on where the objects currently sit. So
// adding / moving / removing objects can't re-normalise the scene — the camera stays
// put instead of snapping (used by the image-base home view where objects are draggable).
export function layoutWorld(patches: WorldPatch[], ring = 0, stableBounds = false): WorldScene {
  const rawSlabs: SceneSlab[] = [];
  const rawSprites: SceneSprite[] = [];
  const rawDecals: SceneDecal[] = [];
  const rawFences: SceneFence[] = [];
  const rawGhosts: SceneGhost[] = [];

  // Slab + decals span the content grid grown by `ring` on every side.
  const lo = -ring;
  const hi = PATCH_SIZE + ring;

  // Territory tiles dock at EXACT tessellation offsets from the anchor patch
  // (the first non-docked one): the base images tile seamlessly because the
  // offset is the same side×ring step the Tile Lab calibrated.
  const anchorPatch = patches.find((patch) => !patch.expansionDock);
  const DOCK_SIGNS: Record<string, { sx: 1 | -1; sy: 1 | -1 }> = {
    ne: { sx: 1, sy: -1 },
    se: { sx: 1, sy: 1 },
    sw: { sx: -1, sy: 1 },
    nw: { sx: -1, sy: -1 },
  };

  for (const patch of patches) {
    let origin = patchWorldOrigin(patch.gridCol, patch.gridRow);
    if (patch.expansionDock && anchorPatch) {
      const anchorOrigin = patchWorldOrigin(anchorPatch.gridCol, anchorPatch.gridRow);
      const span = (PATCH_SIZE + ring * 2) * TILE_W * IMAGE_BASE_FACTOR;
      const side = DOCK_SIGNS[patch.expansionDock.side] ?? DOCK_SIGNS.ne;
      const mags =
        TILE_LAYOUT.sides?.[patch.expansionDock.side as keyof typeof TILE_LAYOUT.sides] ?? { w: 0.4565, h: 0.3652 };
      origin = {
        x: anchorOrigin.x + side.sx * mags.w * span * patch.expansionDock.ring,
        y: anchorOrigin.y + side.sy * mags.h * span * patch.expansionDock.ring,
      };
    }
    const patchDepth = (patch.gridCol + patch.gridRow) * PATCH_DEPTH_STRIDE;
    const shift = (p: IsoPoint): IsoPoint => ({ x: origin.x + p.x, y: origin.y + p.y });

    // The slab's four top-face corners over the (possibly ring-extended) grid.
    const top = shift(gridCorner(lo, lo));
    const right = shift(gridCorner(hi, lo));
    const bottom = shift(gridCorner(hi, hi));
    const left = shift(gridCorner(lo, hi));
    const leftFace = [left, bottom, { x: bottom.x, y: bottom.y + SLAB_THICKNESS }, { x: left.x, y: left.y + SLAB_THICKNESS }];
    const rightFace = [bottom, right, { x: right.x, y: right.y + SLAB_THICKNESS }, { x: bottom.x, y: bottom.y + SLAB_THICKNESS }];
    const seams: [IsoPoint, IsoPoint][] = [];
    for (let i = lo + 1; i < hi; i += 1) {
      seams.push([shift(gridCorner(i, lo)), shift(gridCorner(i, hi))]);
      seams.push([shift(gridCorner(lo, i)), shift(gridCorner(hi, i))]);
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

    // A fence prop becomes a perimeter border along the two FRONT edges
    // (right→bottom + bottom→left), one sprite per side spanning the full edge.
    const hasFence = patch.objects.some((o) => o.assetKey === 'prop_fence');
    if (hasFence) {
      // Each front side is split into 4 tile-edge segments with their own depth
      // (interpolated from the corner grid-sums), so fences depth-sort WITH the
      // objects — a segment behind an object renders under it, the front over it.
      rawFences.push(...buildFenceSide(`${patch.id}-fr`, right, bottom, -26.565, patchDepth, 4, 8));
      rawFences.push(...buildFenceSide(`${patch.id}-fl`, bottom, left, 26.565, patchDepth, 8, 4));
    }

    for (const object of patch.objects) {
      if (object.assetKey === 'prop_fence') continue; // rendered as perimeter
      // Always on a single cell — objects are 1-tile, never spanning two.
      const c = shift(cellCenter(object.col, object.row));
      rawSprites.push({
        id: object.id,
        patchId: patch.id,
        kind: object.kind,
        assetKey: object.assetKey,
        label: object.label,
        archetype: patch.primaryArchetype,
        x: c.x,
        y: c.y,
        col: object.col,
        row: object.row,
        size: spriteSize(object),
        depth: patchDepth + drawDepth(object.col, object.row) * 2 + (object.kind === 'creature' ? 1 : 0),
        category: object.category,
        badge: object.badge,
        badgeIcon: object.badgeIcon,
      });
    }
    // Decals grow on the cells NOT taken by an object/memory. Occupied = every
    // footprint cell of each object plus each memory node.
    const occupied = new Set<string>();
    const occupiedCellTypes = new Set<string>();
    for (const object of patch.objects) {
      if (object.assetKey === 'prop_fence') continue; // perimeter, not a cell
      if (object.category) occupiedCellTypes.add(object.category);
      for (let f = 0; f < Math.max(1, object.footprint); f += 1) {
        occupied.add(`${object.col + f},${object.row}`);
      }
    }
    for (const node of patch.memoryNodes) occupied.add(`${node.col},${node.row}`);

    const theme = ARCHETYPE_THEME[patch.primaryArchetype];
    // Today's forming plot is intentionally a bare, uniform field: one fixed
    // ground decal on every cell, no scattered accents — so it reads as "nothing
    // yet" until real moments grow on it. Hatched/legacy patches keep the
    // accent-scattered, archetype-themed ground.
    const isForming = patch.status === 'forming' || patch.status === 'readyToHatch';
    for (let row = lo; row < hi; row += 1) {
      for (let col = lo; col < hi; col += 1) {
        const inContent = col >= 0 && col < PATCH_SIZE && row >= 0 && row < PATCH_SIZE;
        const h = cellHash(`${patch.id}:${col},${row}`);
        const isFree = !occupied.has(`${col},${row}`);
        // Ring cells are always bare ground (a calm margin around the plot).
        // Inside the content grid: accent tile on some free cells, base ground
        // tile everywhere else (including under objects, so they sit on land).
        const key =
          inContent && !isForming && isFree && (h % 1000) / 1000 < ACCENT_DENSITY
            ? theme.decals[(h >>> 10) % theme.decals.length]
            : theme.groundTile;
        const c = shift(cellCenter(col, row));
        rawDecals.push({
          id: `${patch.id}-tile-${col}-${row}`,
          patchId: patch.id,
          // Each tile type has a _2 variant from the grid; pick one per content
          // cell — the forming plot and the ring stay on the single base tile.
          decal: inContent && !isForming && (h >>> 16) & 1 ? `${key}_2` : key,
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
        col: node.col,
        row: node.row,
        size: TILE_W * 0.6,
        depth: patchDepth + drawDepth(node.col, node.row) * 2,
        memory: node,
      });
    }
    // Empty cells (level 0) → faint ghost placeholders the day can fill. Only on
    // the live forming patch — a finalized day is complete, no empty spots shown.
    for (const cell of isForming ? patch.cells ?? [] : []) {
      if (cell.level > 0) continue;
      if (occupiedCellTypes.has(cell.type)) continue;
      if (occupied.has(`${cell.col},${cell.row}`)) continue;
      const c = shift(cellCenter(cell.col, cell.row));
      rawGhosts.push({
        id: `${patch.id}-ghost-${cell.type}`,
        patchId: patch.id,
        slotType: cell.type,
        x: c.x,
        y: c.y,
        size: TILE_W,
        depth: patchDepth + drawDepth(cell.col, cell.row) * 2 - 1,
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
  if (!stableBounds) {
    for (const sprite of rawSprites) {
      xs.push(sprite.x - sprite.size / 2, sprite.x + sprite.size / 2);
      // Square (1:1) objects rise ~1× their width above the cell, ~0.1× below.
      ys.push(sprite.y - sprite.size * 1.05, sprite.y + sprite.size * 0.15);
    }
  }
  let minX = xs.length ? Math.min(...xs) : 0;
  let minY = ys.length ? Math.min(...ys) : 0;
  let maxX = xs.length ? Math.max(...xs) : 0;
  let maxY = ys.length ? Math.max(...ys) : 0;
  if (stableBounds) {
    // Constant margins (NOT derived from object positions) so the space is fixed:
    // enough headroom for a tall object to rise above its cell, plus side breathing
    // room. Objects beyond this still render (the world surface overflows visibly).
    minY -= TILE_W * 2.4;
    minX -= TILE_W * 0.8;
    maxX += TILE_W * 0.8;
    maxY += TILE_W * 0.3;
  }
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
  const fences = rawFences
    .map((fence) => ({ ...fence, x: fence.x + dx, y: fence.y + dy }))
    .sort((a, b) => a.depth - b.depth);
  const ghosts = rawGhosts
    .map((ghost) => ({ ...ghost, x: ghost.x + dx, y: ghost.y + dy }))
    .sort((a, b) => a.depth - b.depth);

  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    slabs: slabs.sort((a, b) => a.depth - b.depth),
    decals,
    fences,
    sprites,
    ghosts,
  };
}
