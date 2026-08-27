import {
  LAB_COLUMN_BASIS,
  LAB_ROW_BASIS,
  projectLabSurfacePoint,
  type IsoCell,
  type WorldBoardManifest,
  type WorldPoint,
  type WorldRegionRole,
  type WorldSurfacePoint,
} from './world-board-lab';

export const WORLD_BOARD_BEVEL_INSET = 0.075;
export const WORLD_BOARD_BEVEL_DROP = 6;
export const WORLD_BOARD_CORNER_RADIUS = 0.1;
export const WORLD_BOARD_CORNER_SEGMENTS = 3;

export const WORLD_BOARD_SURFACE_MATERIAL = Object.freeze({
  bevelDrop: WORLD_BOARD_BEVEL_DROP,
  bevelWidth: WORLD_BOARD_BEVEL_INSET,
  cornerRadius: WORLD_BOARD_CORNER_RADIUS,
  cornerSegments: WORLD_BOARD_CORNER_SEGMENTS,
  soilNoiseOctaves: 2,
});

type Rgb = { r: number; g: number; b: number };

export type WorldBoardMeshBatch = {
  colors: string[];
  indices: number[];
  textureCoordinates: WorldPoint[];
  vertices: WorldPoint[];
};

export type WorldBoardSurfaceBatch = WorldBoardMeshBatch & {
  cornerMask: number;
};

export type WorldBoardWallBatch = WorldBoardMeshBatch & {
  material: 'earth' | 'locked';
  normal: WorldPoint;
};

export type BeveledTileProfile = {
  cell: IsoCell;
  cornerMask: number;
  inner: readonly WorldSurfacePoint[];
  outer: readonly WorldSurfacePoint[];
  regionId: string;
  role: WorldRegionRole;
};

export type WorldBoardSurfaceMesh = {
  stats: {
    bevelTriangleCount: number;
    roundedCornerCount: number;
    surfaceTriangleCount: number;
    tileCount: number;
    topTriangleCount: number;
    wallFaceCount: number;
    wallTriangleCount: number;
  };
  surfaces: {
    grass: readonly WorldBoardSurfaceBatch[];
    locked: readonly WorldBoardSurfaceBatch[];
  };
  tileProfiles: readonly BeveledTileProfile[];
  walls: readonly WorldBoardWallBatch[];
};

const SIDE_NEIGHBORS: readonly IsoCell[] = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];
const CORNER_SIDES: readonly (readonly [number, number])[] = [
  [3, 0],
  [0, 1],
  [1, 2],
  [2, 3],
];

const GRASS_BASE: Rgb = { r: 137, g: 187, b: 70 };
const CONNECTOR_BASE: Rgb = { r: 128, g: 174, b: 67 };
const LOCKED_BASE: Rgb = { r: 185, g: 212, b: 213 };
const EARTH_BASE: Rgb = { r: 148, g: 116, b: 68 };
const LOCKED_WALL_BASE: Rgb = { r: 126, g: 158, b: 164 };

function colorString(color: Rgb): string {
  return `rgb(${color.r},${color.g},${color.b})`;
}

function emptyBatch(): WorldBoardMeshBatch {
  return { colors: [], indices: [], textureCoordinates: [], vertices: [] };
}

function cellKey(cell: IsoCell): string {
  return `${cell.col}:${cell.row}`;
}

function sideOccupied(cell: IsoCell, side: number, occupied: ReadonlySet<string>): boolean {
  const neighbor = SIDE_NEIGHBORS[side];
  return occupied.has(`${cell.col + neighbor.col}:${cell.row + neighbor.row}`);
}

function tileCornerMask(cell: IsoCell, occupied: ReadonlySet<string>): number {
  return CORNER_SIDES.reduce((mask, [firstSide, secondSide], corner) => (
    !sideOccupied(cell, firstSide, occupied) && !sideOccupied(cell, secondSide, occupied)
      ? mask | (1 << corner)
      : mask
  ), 0);
}

function arcPoints(
  center: WorldPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  z: number,
): WorldSurfacePoint[] {
  return Array.from({ length: WORLD_BOARD_CORNER_SEGMENTS + 1 }, (_, index) => {
    const progress = index / WORLD_BOARD_CORNER_SEGMENTS;
    const angle = startAngle + (endAngle - startAngle) * progress;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      z,
    };
  });
}

function roundedBoundary(
  cell: IsoCell,
  inset: number,
  cornerMask: number,
  z: number,
): WorldSurfacePoint[] {
  const left = cell.col + inset;
  const top = cell.row + inset;
  const right = cell.col + 1 - inset;
  const bottom = cell.row + 1 - inset;
  const radius = Math.max(0, WORLD_BOARD_CORNER_RADIUS - inset);
  const corners = [
    { center: { x: left + radius, y: top + radius }, point: { x: left, y: top, z }, start: Math.PI, end: Math.PI * 1.5 },
    { center: { x: right - radius, y: top + radius }, point: { x: right, y: top, z }, start: -Math.PI / 2, end: 0 },
    { center: { x: right - radius, y: bottom - radius }, point: { x: right, y: bottom, z }, start: 0, end: Math.PI / 2 },
    { center: { x: left + radius, y: bottom - radius }, point: { x: left, y: bottom, z }, start: Math.PI / 2, end: Math.PI },
  ] as const;

  return corners.flatMap((corner, index) => (
    radius > 0 && (cornerMask & (1 << index)) !== 0
      ? arcPoints(corner.center, radius, corner.start, corner.end, z)
      : [corner.point]
  ));
}

function tileProfile(
  cell: IsoCell,
  regionId: string,
  role: WorldRegionRole,
  occupied: ReadonlySet<string>,
): BeveledTileProfile {
  const cornerMask = tileCornerMask(cell, occupied);
  return {
    cell,
    cornerMask,
    regionId,
    role,
    outer: roundedBoundary(cell, 0, cornerMask, -WORLD_BOARD_BEVEL_DROP),
    inner: roundedBoundary(cell, WORLD_BOARD_BEVEL_INSET, cornerMask, 0),
  };
}

function appendVertex(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  point: WorldSurfacePoint,
  color: string,
): number {
  const index = batch.vertices.length;
  batch.vertices.push(projectLabSurfacePoint(sceneOrigin, point));
  batch.textureCoordinates.push({ x: point.x, y: point.y });
  batch.colors.push(color);
  return index;
}

function appendTop(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  profile: BeveledTileProfile,
  color: string,
): number {
  const points = profile.inner;
  if (points.length === 4) {
    const offset = batch.vertices.length;
    points.forEach((point) => appendVertex(batch, sceneOrigin, point, color));
    batch.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    return 2;
  }

  const center: WorldSurfacePoint = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: 0,
  };
  const centerIndex = appendVertex(batch, sceneOrigin, center, color);
  const boundaryIndices = points.map((point) => appendVertex(batch, sceneOrigin, point, color));
  boundaryIndices.forEach((index, pointIndex) => {
    batch.indices.push(centerIndex, index, boundaryIndices[(pointIndex + 1) % boundaryIndices.length]);
  });
  return points.length;
}

function appendBevel(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  profile: BeveledTileProfile,
  color: string,
): number {
  const segmentCount = profile.outer.length;
  for (let index = 0; index < segmentCount; index += 1) {
    const next = (index + 1) % segmentCount;
    const offset = batch.vertices.length;
    [profile.outer[index], profile.outer[next], profile.inner[next], profile.inner[index]]
      .forEach((point) => appendVertex(batch, sceneOrigin, point, color));
    batch.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }
  return segmentCount * 2;
}

function surfaceBatchFor(
  batches: Map<number, WorldBoardSurfaceBatch>,
  cornerMask: number,
): WorldBoardSurfaceBatch {
  const existing = batches.get(cornerMask);
  if (existing) return existing;
  const batch = { ...emptyBatch(), cornerMask };
  batches.set(cornerMask, batch);
  return batch;
}

function isCameraFacingEdge(sceneOrigin: WorldPoint, start: WorldSurfacePoint, end: WorldSurfacePoint): boolean {
  const projectedStart = projectLabSurfacePoint(sceneOrigin, start);
  const projectedEnd = projectLabSurfacePoint(sceneOrigin, end);
  return projectedEnd.x - projectedStart.x < -0.001;
}

function sideForSegment(cell: IsoCell, start: WorldSurfacePoint, end: WorldSurfacePoint): number {
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const distances = [
    Math.abs(middle.y - cell.row),
    Math.abs(middle.x - (cell.col + 1)),
    Math.abs(middle.y - (cell.row + 1)),
    Math.abs(middle.x - cell.col),
  ];
  return distances.indexOf(Math.min(...distances));
}

function outwardNormal(start: WorldSurfacePoint, end: WorldSurfacePoint): WorldPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dy / length, y: -dx / length };
}

function wallBatchKey(material: WorldBoardWallBatch['material'], normal: WorldPoint): string {
  return `${material}:${normal.x.toFixed(4)}:${normal.y.toFixed(4)}`;
}

function wallBatchFor(
  batches: Map<string, WorldBoardWallBatch>,
  material: WorldBoardWallBatch['material'],
  normal: WorldPoint,
): WorldBoardWallBatch {
  const key = wallBatchKey(material, normal);
  const existing = batches.get(key);
  if (existing) return existing;
  const batch = { ...emptyBatch(), material, normal };
  batches.set(key, batch);
  return batch;
}

function appendWallQuad(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  start: WorldSurfacePoint,
  end: WorldSurfacePoint,
  slabThickness: number,
  color: string,
) {
  const bottomEnd = { ...end, z: -slabThickness };
  const bottomStart = { ...start, z: -slabThickness };
  const projectedStart = projectLabSurfacePoint(sceneOrigin, { ...start, z: 0 });
  const projectedEnd = projectLabSurfacePoint(sceneOrigin, { ...end, z: 0 });
  const startU = projectedStart.x / Math.max(1, Math.hypot(LAB_COLUMN_BASIS.x, LAB_COLUMN_BASIS.y));
  const endU = projectedEnd.x / Math.max(1, Math.hypot(LAB_COLUMN_BASIS.x, LAB_COLUMN_BASIS.y));
  const offset = batch.vertices.length;
  [start, end, bottomEnd, bottomStart].forEach((point) => {
    batch.vertices.push(projectLabSurfacePoint(sceneOrigin, point));
    batch.colors.push(color);
  });
  batch.textureCoordinates.push(
    { x: startU, y: 0 },
    { x: endU, y: 0 },
    { x: endU, y: 1 },
    { x: startU, y: 1 },
  );
  batch.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

function appendVisibleWalls(
  batches: Map<string, WorldBoardWallBatch>,
  manifest: WorldBoardManifest,
  profile: BeveledTileProfile,
  occupied: ReadonlySet<string>,
): number {
  let count = 0;
  for (let index = 0; index < profile.outer.length; index += 1) {
    const start = profile.outer[index];
    const end = profile.outer[(index + 1) % profile.outer.length];
    const side = sideForSegment(profile.cell, start, end);
    if (sideOccupied(profile.cell, side, occupied) || !isCameraFacingEdge(manifest.sceneOrigin, start, end)) continue;
    const material = profile.role === 'locked' ? 'locked' : 'earth';
    const normal = outwardNormal(start, end);
    const batch = wallBatchFor(batches, material, normal);
    const base = material === 'locked' ? LOCKED_WALL_BASE : EARTH_BASE;
    appendWallQuad(batch, manifest.sceneOrigin, start, end, manifest.slabThickness, colorString(base));
    count += 1;
  }
  return count;
}

export function buildWorldBoardSurfaceMesh(manifest: WorldBoardManifest): WorldBoardSurfaceMesh {
  const grass = new Map<number, WorldBoardSurfaceBatch>();
  const locked = new Map<number, WorldBoardSurfaceBatch>();
  const walls = new Map<string, WorldBoardWallBatch>();
  const occupied = new Set(manifest.regions.flatMap((region) => region.cells.map(cellKey)));
  const tileProfiles = manifest.regions.flatMap((region) => region.cells.map((cell) => (
    tileProfile(cell, region.id, region.role, occupied)
  )));
  let topTriangleCount = 0;
  let bevelTriangleCount = 0;
  let wallFaceCount = 0;

  tileProfiles.forEach((profile) => {
    const batches = profile.role === 'locked' ? locked : grass;
    const batch = surfaceBatchFor(batches, profile.cornerMask);
    const base = profile.role === 'connector' ? CONNECTOR_BASE : profile.role === 'locked' ? LOCKED_BASE : GRASS_BASE;
    const color = colorString(base);
    topTriangleCount += appendTop(batch, manifest.sceneOrigin, profile, color);
    bevelTriangleCount += appendBevel(batch, manifest.sceneOrigin, profile, color);
    wallFaceCount += appendVisibleWalls(walls, manifest, profile, occupied);
  });

  return {
    surfaces: {
      grass: [...grass.values()].sort((left, right) => left.cornerMask - right.cornerMask),
      locked: [...locked.values()].sort((left, right) => left.cornerMask - right.cornerMask),
    },
    tileProfiles,
    walls: [...walls.values()].sort((left, right) => wallBatchKey(left.material, left.normal).localeCompare(wallBatchKey(right.material, right.normal))),
    stats: {
      bevelTriangleCount,
      roundedCornerCount: tileProfiles.reduce((total, profile) => total + profile.cornerMask.toString(2).replaceAll('0', '').length, 0),
      surfaceTriangleCount: topTriangleCount + bevelTriangleCount,
      tileCount: tileProfiles.length,
      topTriangleCount,
      wallFaceCount,
      wallTriangleCount: wallFaceCount * 2,
    },
  };
}
