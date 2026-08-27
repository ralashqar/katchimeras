import {
  LAB_COLUMN_BASIS,
  projectLabSurfacePoint,
  type IsoCell,
  type WorldBoardManifest,
  type WorldPoint,
  type WorldSurfacePoint,
} from './world-board-lab';

export const WORLD_BOARD_CONVEX_RADIUS = 0.15;
export const WORLD_BOARD_CONCAVE_RADIUS = 0.21;
export const WORLD_BOARD_CONTOUR_SEGMENTS = 3;
export const WORLD_BOARD_EDGE_NORMAL_STEPS = 16;

export type WorldBoardMeshBatch = {
  colors: string[];
  indices: number[];
  textureCoordinates: WorldPoint[];
  vertices: WorldPoint[];
};

export type WorldBoardEdgeBatch = WorldBoardMeshBatch & {
  normal: WorldPoint;
};

export type WorldBoardLandmassContour = {
  boundary: readonly WorldSurfacePoint[];
};

export type WorldBoardSurfaceMesh = {
  boardOverlay: WorldBoardMeshBatch;
  contours: readonly WorldBoardLandmassContour[];
  holeMasks: WorldBoardMeshBatch;
  lockedOverlay: WorldBoardMeshBatch;
  stats: {
    boardOverlayTriangleCount: number;
    concaveCornerCount: number;
    contourCount: number;
    contourPointCount: number;
    convexCornerCount: number;
    holeContourCount: number;
    surfaceTriangleCount: number;
    tileCount: number;
    wallFaceCount: number;
    wallTriangleCount: number;
  };
  terrain: WorldBoardMeshBatch;
  walls: readonly WorldBoardEdgeBatch[];
};

type BoundaryEdge = {
  end: WorldPoint;
  start: WorldPoint;
};

type FilletedLoop = {
  concaveCornerCount: number;
  convexCornerCount: number;
  points: WorldPoint[];
};

const TERRAIN_COLOR = 'rgb(148,201,70)';
const WALL_COLOR = 'rgb(171,137,78)';
const LOCKED_COLOR = 'rgb(185,212,213)';
const TRANSPARENT = 'rgba(0,0,0,0)';
const EPSILON = 1e-7;

function pointKey(point: WorldPoint): string {
  return `${point.x}:${point.y}`;
}

function cellKey(cell: IsoCell): string {
  return `${cell.col}:${cell.row}`;
}

function emptyBatch(): WorldBoardMeshBatch {
  return { colors: [], indices: [], textureCoordinates: [], vertices: [] };
}

function cross(first: WorldPoint, second: WorldPoint, third: WorldPoint): number {
  return (second.x - first.x) * (third.y - second.y) - (second.y - first.y) * (third.x - second.x);
}

function polygonArea(points: readonly WorldPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function normalize(vector: WorldPoint): WorldPoint {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function boundaryEdges(cells: readonly IsoCell[], occupied: ReadonlySet<string>): BoundaryEdge[] {
  return cells.flatMap((cell) => {
    const left = cell.col;
    const top = cell.row;
    const right = cell.col + 1;
    const bottom = cell.row + 1;
    const edges: BoundaryEdge[] = [];
    if (!occupied.has(`${cell.col}:${cell.row - 1}`)) edges.push({ start: { x: left, y: top }, end: { x: right, y: top } });
    if (!occupied.has(`${cell.col + 1}:${cell.row}`)) edges.push({ start: { x: right, y: top }, end: { x: right, y: bottom } });
    if (!occupied.has(`${cell.col}:${cell.row + 1}`)) edges.push({ start: { x: right, y: bottom }, end: { x: left, y: bottom } });
    if (!occupied.has(`${cell.col - 1}:${cell.row}`)) edges.push({ start: { x: left, y: bottom }, end: { x: left, y: top } });
    return edges;
  });
}

function directionIndex(edge: BoundaryEdge): number {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

function traceBoundaryLoops(edges: readonly BoundaryEdge[]): WorldPoint[][] {
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    const key = pointKey(edge.start);
    outgoing.set(key, [...(outgoing.get(key) ?? []), index]);
  });
  const used = new Set<number>();
  const loops: WorldPoint[][] = [];
  const turnPreference = new Map([[1, 0], [0, 1], [3, 2], [2, 3]]);

  edges.forEach((initialEdge, initialIndex) => {
    if (used.has(initialIndex)) return;
    const loop: WorldPoint[] = [];
    const initialKey = pointKey(initialEdge.start);
    let edgeIndex = initialIndex;
    let guard = 0;
    while (!used.has(edgeIndex) && guard <= edges.length) {
      guard += 1;
      used.add(edgeIndex);
      const edge = edges[edgeIndex];
      loop.push(edge.start);
      const endKey = pointKey(edge.end);
      if (endKey === initialKey) break;
      const currentDirection = directionIndex(edge);
      const candidates = (outgoing.get(endKey) ?? []).filter((candidate) => !used.has(candidate));
      if (!candidates.length) break;
      candidates.sort((left, right) => {
        const leftTurn = (directionIndex(edges[left]) - currentDirection + 4) % 4;
        const rightTurn = (directionIndex(edges[right]) - currentDirection + 4) % 4;
        return (turnPreference.get(leftTurn) ?? 4) - (turnPreference.get(rightTurn) ?? 4);
      });
      edgeIndex = candidates[0];
    }
    if (loop.length >= 3) loops.push(loop);
  });
  return loops;
}

function simplifyLoop(points: readonly WorldPoint[]): WorldPoint[] {
  return points.filter((_, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    return Math.abs(cross(previous, current, next)) > EPSILON;
  });
}

function filletLoop(points: readonly WorldPoint[]): FilletedLoop {
  const simplified = simplifyLoop(points);
  let concaveCornerCount = 0;
  let convexCornerCount = 0;
  const filleted = simplified.flatMap((current, index) => {
    const previous = simplified[(index - 1 + simplified.length) % simplified.length];
    const next = simplified[(index + 1) % simplified.length];
    const incoming = normalize({ x: current.x - previous.x, y: current.y - previous.y });
    const outgoing = normalize({ x: next.x - current.x, y: next.y - current.y });
    const turn = incoming.x * outgoing.y - incoming.y * outgoing.x;
    const preferredRadius = turn > 0 ? WORLD_BOARD_CONVEX_RADIUS : WORLD_BOARD_CONCAVE_RADIUS;
    if (turn > 0) convexCornerCount += 1;
    else concaveCornerCount += 1;
    const radius = Math.min(
      preferredRadius,
      Math.hypot(current.x - previous.x, current.y - previous.y) * 0.42,
      Math.hypot(next.x - current.x, next.y - current.y) * 0.42,
    );
    const start = { x: current.x - incoming.x * radius, y: current.y - incoming.y * radius };
    const end = { x: current.x + outgoing.x * radius, y: current.y + outgoing.y * radius };
    return Array.from({ length: WORLD_BOARD_CONTOUR_SEGMENTS + 1 }, (_, segment) => {
      const t = segment / WORLD_BOARD_CONTOUR_SEGMENTS;
      const inverse = 1 - t;
      return {
        x: inverse * inverse * start.x + 2 * inverse * t * current.x + t * t * end.x,
        y: inverse * inverse * start.y + 2 * inverse * t * current.y + t * t * end.y,
      };
    });
  });
  return { concaveCornerCount, convexCornerCount, points: filleted };
}

function pointInTriangle(point: WorldPoint, first: WorldPoint, second: WorldPoint, third: WorldPoint): boolean {
  const firstCross = (second.x - first.x) * (point.y - first.y) - (second.y - first.y) * (point.x - first.x);
  const secondCross = (third.x - second.x) * (point.y - second.y) - (third.y - second.y) * (point.x - second.x);
  const thirdCross = (first.x - third.x) * (point.y - third.y) - (first.y - third.y) * (point.x - third.x);
  return firstCross >= -EPSILON && secondCross >= -EPSILON && thirdCross >= -EPSILON;
}

function triangulatePolygon(points: readonly WorldPoint[]): number[] {
  if (points.length < 3) return [];
  const order = Array.from({ length: points.length }, (_, index) => index);
  if (polygonArea(points) < 0) order.reverse();
  const triangles: number[] = [];
  let guard = 0;
  while (order.length > 3 && guard < points.length * points.length) {
    guard += 1;
    let earFound = false;
    for (let index = 0; index < order.length; index += 1) {
      const previousIndex = order[(index - 1 + order.length) % order.length];
      const currentIndex = order[index];
      const nextIndex = order[(index + 1) % order.length];
      const previous = points[previousIndex];
      const current = points[currentIndex];
      const next = points[nextIndex];
      if (cross(previous, current, next) <= EPSILON) continue;
      const containsPoint = order.some((candidate) => (
        candidate !== previousIndex && candidate !== currentIndex && candidate !== nextIndex
        && pointInTriangle(points[candidate], previous, current, next)
      ));
      if (containsPoint) continue;
      triangles.push(previousIndex, currentIndex, nextIndex);
      order.splice(index, 1);
      earFound = true;
      break;
    }
    if (!earFound) break;
  }
  if (order.length === 3) triangles.push(order[0], order[1], order[2]);
  return triangles;
}

function appendVertex(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  point: WorldSurfacePoint,
  textureCoordinate: WorldPoint,
  color: string,
): number {
  const index = batch.vertices.length;
  batch.vertices.push(projectLabSurfacePoint(sceneOrigin, point));
  batch.textureCoordinates.push(textureCoordinate);
  batch.colors.push(color);
  return index;
}

function appendTopPolygon(batch: WorldBoardMeshBatch, sceneOrigin: WorldPoint, points: readonly WorldPoint[]) {
  const offset = batch.vertices.length;
  points.forEach((point) => appendVertex(batch, sceneOrigin, { ...point, z: 0 }, point, TERRAIN_COLOR));
  triangulatePolygon(points).forEach((index) => batch.indices.push(offset + index));
}

function appendHoleMask(batch: WorldBoardMeshBatch, sceneOrigin: WorldPoint, points: readonly WorldPoint[]) {
  const offset = batch.vertices.length;
  points.forEach((point) => appendVertex(batch, sceneOrigin, { ...point, z: 0 }, point, 'black'));
  triangulatePolygon(points).forEach((index) => batch.indices.push(offset + index));
}

function appendRect(
  batch: WorldBoardMeshBatch,
  sceneOrigin: WorldPoint,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: string,
) {
  const offset = batch.vertices.length;
  const points = [
    { x: left, y: top, z: 0 },
    { x: right, y: top, z: 0 },
    { x: right, y: bottom, z: 0 },
    { x: left, y: bottom, z: 0 },
  ];
  points.forEach((point) => appendVertex(batch, sceneOrigin, point, { x: point.x, y: point.y }, color));
  batch.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

function quantizedNormal(start: WorldPoint, end: WorldPoint): WorldPoint {
  const tangent = normalize({ x: end.x - start.x, y: end.y - start.y });
  const outward = { x: tangent.y, y: -tangent.x };
  const step = Math.PI * 2 / WORLD_BOARD_EDGE_NORMAL_STEPS;
  const angle = Math.round(Math.atan2(outward.y, outward.x) / step) * step;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function edgeBatchKey(normal: WorldPoint): string {
  return `${normal.x.toFixed(4)}:${normal.y.toFixed(4)}`;
}

function edgeBatchFor(batches: Map<string, WorldBoardEdgeBatch>, normal: WorldPoint): WorldBoardEdgeBatch {
  const key = edgeBatchKey(normal);
  const existing = batches.get(key);
  if (existing) return existing;
  const batch = { ...emptyBatch(), normal };
  batches.set(key, batch);
  return batch;
}

function projectedSegmentLength(sceneOrigin: WorldPoint, start: WorldPoint, end: WorldPoint): number {
  const projectedStart = projectLabSurfacePoint(sceneOrigin, { ...start, z: 0 });
  const projectedEnd = projectLabSurfacePoint(sceneOrigin, { ...end, z: 0 });
  return Math.hypot(projectedEnd.x - projectedStart.x, projectedEnd.y - projectedStart.y);
}

function isCameraFacingEdge(sceneOrigin: WorldPoint, start: WorldPoint, end: WorldPoint): boolean {
  const projectedStart = projectLabSurfacePoint(sceneOrigin, { ...start, z: 0 });
  const projectedEnd = projectLabSurfacePoint(sceneOrigin, { ...end, z: 0 });
  return projectedEnd.x - projectedStart.x < -0.001;
}

function appendWallGeometry(
  walls: Map<string, WorldBoardEdgeBatch>,
  manifest: WorldBoardManifest,
  boundary: readonly WorldPoint[],
): number {
  let perimeter = 0;
  let wallFaces = 0;
  for (let index = 0; index < boundary.length; index += 1) {
    const next = (index + 1) % boundary.length;
    const start = boundary[index];
    const end = boundary[next];
    const segmentLength = projectedSegmentLength(manifest.sceneOrigin, start, end) / Math.max(1, Math.hypot(LAB_COLUMN_BASIS.x, LAB_COLUMN_BASIS.y));
    const nextPerimeter = perimeter + segmentLength;
    const normal = quantizedNormal(start, end);
    if (isCameraFacingEdge(manifest.sceneOrigin, start, end)) {
      const wall = edgeBatchFor(walls, normal);
      const wallOffset = wall.vertices.length;
      [
        { point: { ...start, z: 0 }, uv: { x: perimeter, y: 0 } },
        { point: { ...end, z: 0 }, uv: { x: nextPerimeter, y: 0 } },
        { point: { ...end, z: -manifest.slabThickness }, uv: { x: nextPerimeter, y: 1 } },
        { point: { ...start, z: -manifest.slabThickness }, uv: { x: perimeter, y: 1 } },
      ].forEach(({ point, uv }) => appendVertex(wall, manifest.sceneOrigin, point, uv, WALL_COLOR));
      wall.indices.push(wallOffset, wallOffset + 1, wallOffset + 2, wallOffset, wallOffset + 2, wallOffset + 3);
      wallFaces += 1;
    }
    perimeter = nextPerimeter;
  }
  return wallFaces;
}

export function buildWorldBoardSurfaceMesh(manifest: WorldBoardManifest): WorldBoardSurfaceMesh {
  const terrain = emptyBatch();
  const boardOverlay = emptyBatch();
  const holeMasks = emptyBatch();
  const lockedOverlay = emptyBatch();
  const walls = new Map<string, WorldBoardEdgeBatch>();
  const cells = manifest.regions.flatMap((region) => region.cells);
  const occupied = new Set(cells.map(cellKey));
  const rawLoops = traceBoundaryLoops(boundaryEdges(cells, occupied));
  const holeContourCount = rawLoops.filter((loop) => polygonArea(loop) < 0).length;
  let convexCornerCount = 0;
  let concaveCornerCount = 0;
  let wallFaceCount = 0;
  const contours = rawLoops.map((loop): WorldBoardLandmassContour => {
    const isHole = polygonArea(loop) < 0;
    const filleted = filletLoop(loop);
    convexCornerCount += filleted.convexCornerCount;
    concaveCornerCount += filleted.concaveCornerCount;
    if (isHole) appendHoleMask(holeMasks, manifest.sceneOrigin, filleted.points);
    else appendTopPolygon(terrain, manifest.sceneOrigin, filleted.points);
    wallFaceCount += appendWallGeometry(walls, manifest, filleted.points);
    return {
      boundary: filleted.points.map((point) => ({ ...point, z: 0 })),
    };
  });

  appendRect(
    boardOverlay,
    manifest.sceneOrigin,
    manifest.board.startCol,
    manifest.board.startRow,
    manifest.board.startCol + manifest.board.columns,
    manifest.board.startRow + manifest.board.rows,
    TRANSPARENT,
  );
  manifest.regions.filter((region) => region.role === 'locked').forEach((region) => {
    region.cells.forEach((cell) => appendRect(lockedOverlay, manifest.sceneOrigin, cell.col, cell.row, cell.col + 1, cell.row + 1, LOCKED_COLOR));
  });

  return {
    boardOverlay,
    contours,
    holeMasks,
    lockedOverlay,
    terrain,
    walls: [...walls.values()].sort((left, right) => edgeBatchKey(left.normal).localeCompare(edgeBatchKey(right.normal))),
    stats: {
      boardOverlayTriangleCount: boardOverlay.indices.length / 3,
      concaveCornerCount,
      contourCount: contours.length,
      contourPointCount: contours.reduce((total, contour) => total + contour.boundary.length, 0),
      convexCornerCount,
      holeContourCount,
      surfaceTriangleCount: terrain.indices.length / 3,
      tileCount: cells.length,
      wallFaceCount,
      wallTriangleCount: wallFaceCount * 2,
    },
  };
}
