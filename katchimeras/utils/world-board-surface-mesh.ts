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
export const WORLD_BOARD_TOP_SUBDIVISIONS = 2;

type Rgb = { r: number; g: number; b: number };
type Vector3 = { x: number; y: number; z: number };

export type WorldBoardMeshBatch = {
  colors: string[];
  indices: number[];
  textureCoordinates: WorldPoint[];
  vertices: WorldPoint[];
};

export type BeveledTileProfile = {
  cell: IsoCell;
  inner: readonly WorldSurfacePoint[];
  outer: readonly WorldSurfacePoint[];
  regionId: string;
  role: WorldRegionRole;
};

export type WorldBoardSurfaceMesh = {
  bevelLighting: {
    light: WorldBoardMeshBatch;
    middle: WorldBoardMeshBatch;
    shade: WorldBoardMeshBatch;
  };
  grass: WorldBoardMeshBatch;
  locked: WorldBoardMeshBatch;
  stats: {
    surfaceTriangleCount: number;
    tileCount: number;
    wallFaceCount: number;
  };
  tileProfiles: readonly BeveledTileProfile[];
  walls: WorldBoardMeshBatch;
};

const TOP_LIGHT: Vector3 = normalize({ x: -0.34, y: -0.42, z: 0.84 });
const COLUMN_WORLD_LENGTH = Math.hypot(LAB_COLUMN_BASIS.x, LAB_COLUMN_BASIS.y);
const ROW_WORLD_LENGTH = Math.hypot(LAB_ROW_BASIS.x, LAB_ROW_BASIS.y);
const SIDE_NEIGHBORS: readonly IsoCell[] = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

const GRASS_BASE: Rgb = { r: 137, g: 187, b: 70 };
const CONNECTOR_BASE: Rgb = { r: 128, g: 174, b: 67 };
const LOCKED_BASE: Rgb = { r: 185, g: 212, b: 213 };
const EARTH_BASE: Rgb = { r: 148, g: 116, b: 68 };
const LOCKED_WALL_BASE: Rgb = { r: 126, g: 158, b: 164 };

function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function subtract(left: WorldSurfacePoint, right: WorldSurfacePoint): Vector3 {
  return {
    x: (left.x - right.x) * COLUMN_WORLD_LENGTH,
    y: (left.y - right.y) * ROW_WORLD_LENGTH,
    z: left.z - right.z,
  };
}

function cross(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function faceNormal(points: readonly WorldSurfacePoint[]): Vector3 {
  const normal = normalize(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
  return normal.z < 0 ? { x: -normal.x, y: -normal.y, z: -normal.z } : normal;
}

function lightLevel(points: readonly WorldSurfacePoint[], ambient: number, diffuse: number): number {
  const normal = faceNormal(points);
  return Math.min(1, ambient + diffuse * Math.max(0, normal.x * TOP_LIGHT.x + normal.y * TOP_LIGHT.y + normal.z * TOP_LIGHT.z));
}

function colorAtLight(color: Rgb, light: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value * light)));
  return `rgb(${channel(color.r)},${channel(color.g)},${channel(color.b)})`;
}

function emptyBatch(): WorldBoardMeshBatch {
  return { colors: [], indices: [], textureCoordinates: [], vertices: [] };
}

function appendQuad(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  points: readonly [WorldSurfacePoint, WorldSurfacePoint, WorldSurfacePoint, WorldSurfacePoint],
  baseColor: Rgb,
  lighting: { ambient: number; diffuse: number },
) {
  const offset = batch.vertices.length;
  const light = lightLevel(points, lighting.ambient, lighting.diffuse);
  const color = colorAtLight(baseColor, light);
  points.forEach((point) => {
    batch.vertices.push(projectLabSurfacePoint(sceneOrigin, point));
    batch.textureCoordinates.push(projectLabSurfacePoint(sceneOrigin, { ...point, z: 0 }));
    batch.colors.push(color);
  });
  batch.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

function tileProfile(cell: IsoCell, regionId: string, role: WorldRegionRole): BeveledTileProfile {
  const inset = WORLD_BOARD_BEVEL_INSET;
  const outerZ = -WORLD_BOARD_BEVEL_DROP;
  return {
    cell,
    regionId,
    role,
    outer: [
      { x: cell.col, y: cell.row, z: outerZ },
      { x: cell.col + 1, y: cell.row, z: outerZ },
      { x: cell.col + 1, y: cell.row + 1, z: outerZ },
      { x: cell.col, y: cell.row + 1, z: outerZ },
    ],
    inner: [
      { x: cell.col + inset, y: cell.row + inset, z: 0 },
      { x: cell.col + 1 - inset, y: cell.row + inset, z: 0 },
      { x: cell.col + 1 - inset, y: cell.row + 1 - inset, z: 0 },
      { x: cell.col + inset, y: cell.row + 1 - inset, z: 0 },
    ],
  };
}

function cellKey(cell: IsoCell): string {
  return `${cell.col}:${cell.row}`;
}

function appendTileSurface(
  mesh: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  profile: BeveledTileProfile,
  bevelLighting?: WorldBoardSurfaceMesh['bevelLighting'],
) {
  const baseColor = profile.role === 'connector' ? CONNECTOR_BASE : profile.role === 'locked' ? LOCKED_BASE : GRASS_BASE;
  const [topLeft, topRight, , bottomLeft] = profile.inner;
  const stepX = (topRight.x - topLeft.x) / WORLD_BOARD_TOP_SUBDIVISIONS;
  const stepY = (bottomLeft.y - topLeft.y) / WORLD_BOARD_TOP_SUBDIVISIONS;

  for (let row = 0; row < WORLD_BOARD_TOP_SUBDIVISIONS; row += 1) {
    for (let col = 0; col < WORLD_BOARD_TOP_SUBDIVISIONS; col += 1) {
      const left = topLeft.x + stepX * col;
      const right = left + stepX;
      const top = topLeft.y + stepY * row;
      const bottom = top + stepY;
      appendQuad(mesh, sceneOrigin, [
        { x: left, y: top, z: 0 },
        { x: right, y: top, z: 0 },
        { x: right, y: bottom, z: 0 },
        { x: left, y: bottom, z: 0 },
      ], baseColor, { ambient: 0.8, diffuse: 0.2 });
    }
  }

  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    const points: [WorldSurfacePoint, WorldSurfacePoint, WorldSurfacePoint, WorldSurfacePoint] = [
      profile.outer[side],
      profile.outer[next],
      profile.inner[next],
      profile.inner[side],
    ];
    const lighting = { ambient: 0.74, diffuse: 0.26 };
    appendQuad(mesh, sceneOrigin, points, baseColor, lighting);
    if (bevelLighting) {
      const level = lightLevel(points, lighting.ambient, lighting.diffuse);
      const lightingBatch = level >= 0.94 ? bevelLighting.light : level >= 0.86 ? bevelLighting.middle : bevelLighting.shade;
      appendQuad(lightingBatch, sceneOrigin, points, baseColor, lighting);
    }
  }
}

function isCameraFacingEdge(sceneOrigin: WorldPoint, start: WorldSurfacePoint, end: WorldSurfacePoint): boolean {
  const projectedStart = projectLabSurfacePoint(sceneOrigin, start);
  const projectedEnd = projectLabSurfacePoint(sceneOrigin, end);
  return projectedEnd.x - projectedStart.x < -0.001;
}

function appendVisibleWalls(
  mesh: WorldBoardMeshBatch,
  manifest: WorldBoardManifest,
  profile: BeveledTileProfile,
  occupied: ReadonlySet<string>,
): number {
  let count = 0;
  for (let side = 0; side < 4; side += 1) {
    const neighbor = SIDE_NEIGHBORS[side];
    if (occupied.has(`${profile.cell.col + neighbor.col}:${profile.cell.row + neighbor.row}`)) continue;
    const next = (side + 1) % 4;
    const start = profile.outer[side];
    const end = profile.outer[next];
    if (!isCameraFacingEdge(manifest.sceneOrigin, start, end)) continue;
    const bottomEnd = { ...end, z: -manifest.slabThickness };
    const bottomStart = { ...start, z: -manifest.slabThickness };
    const base = profile.role === 'locked' ? LOCKED_WALL_BASE : EARTH_BASE;
    appendQuad(mesh, manifest.sceneOrigin, [start, end, bottomEnd, bottomStart], base, { ambient: 0.7, diffuse: 0.3 });
    count += 1;
  }
  return count;
}

export function buildWorldBoardSurfaceMesh(manifest: WorldBoardManifest): WorldBoardSurfaceMesh {
  const bevelLighting = { light: emptyBatch(), middle: emptyBatch(), shade: emptyBatch() };
  const grass = emptyBatch();
  const locked = emptyBatch();
  const walls = emptyBatch();
  const occupied = new Set(manifest.regions.flatMap((region) => region.cells.map(cellKey)));
  const tileProfiles = manifest.regions.flatMap((region) => region.cells.map((cell) => tileProfile(cell, region.id, region.role)));
  let wallFaceCount = 0;

  tileProfiles.forEach((profile) => {
    const isLocked = profile.role === 'locked';
    appendTileSurface(isLocked ? locked : grass, manifest.sceneOrigin, profile, isLocked ? undefined : bevelLighting);
    wallFaceCount += appendVisibleWalls(walls, manifest, profile, occupied);
  });

  return {
    bevelLighting,
    grass,
    locked,
    walls,
    tileProfiles,
    stats: {
      surfaceTriangleCount: (grass.indices.length + locked.indices.length) / 3,
      tileCount: tileProfiles.length,
      wallFaceCount,
    },
  };
}
