import type { BlockJamCell } from './block-jam';

type Point = { x: number; y: number };
type Edge = { from: Point; to: Point };
export type BlockJamSilhouetteSegment = { x1: number; y1: number; x2: number; y2: number };

export function blockJamSilhouetteSegments(
  cells: readonly BlockJamCell[],
  options: { pitch: number; width: number; height: number; padding?: number },
): BlockJamSilhouetteSegment[] {
  const edges = boundaryEdges(cells);
  const padding = options.padding ?? 0;
  const toPixels = (point: Point): Point => ({
    x: padding + Math.min(point.x * options.pitch, options.width),
    y: padding + Math.min(point.y * options.pitch, options.height),
  });
  return edges.map((edge) => {
    const from = toPixels(edge.from); const to = toPixels(edge.to);
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  });
}

export function blockJamSilhouettePath(
  cells: readonly BlockJamCell[],
  options: { pitch: number; width: number; height: number; radius: number; padding?: number },
): string {
  if (!cells.length) return '';
  const remaining = boundaryEdges(cells);
  const loops: Point[][] = [];
  while (remaining.length) {
    const first = remaining.shift()!;
    const loop = [first.from];
    let cursor = first.to;
    while (pointKey(cursor) !== pointKey(first.from)) {
      loop.push(cursor);
      const nextIndex = remaining.findIndex((candidate) => pointKey(candidate.from) === pointKey(cursor));
      if (nextIndex < 0) break;
      cursor = remaining.splice(nextIndex, 1)[0].to;
    }
    if (loop.length >= 3) loops.push(loop);
  }

  const padding = options.padding ?? 0;
  const toPixels = (point: Point): Point => ({
    x: padding + Math.min(point.x * options.pitch, options.width),
    y: padding + Math.min(point.y * options.pitch, options.height),
  });
  return loops.map((loop) => roundedLoopPath(loop.map(toPixels), options.radius)).join(' ');
}

function boundaryEdges(cells: readonly BlockJamCell[]): Edge[] {
  const edges = new Map<string, Edge>();
  const addEdge = (from: Point, to: Point) => {
    const forward = pointKey(from); const backward = pointKey(to);
    const key = forward < backward ? `${forward}|${backward}` : `${backward}|${forward}`;
    if (edges.has(key)) edges.delete(key);
    else edges.set(key, { from, to });
  };

  for (const cell of cells) {
    const left = cell.column; const top = cell.row; const right = left + 1; const bottom = top + 1;
    addEdge({ x: left, y: top }, { x: right, y: top });
    addEdge({ x: right, y: top }, { x: right, y: bottom });
    addEdge({ x: right, y: bottom }, { x: left, y: bottom });
    addEdge({ x: left, y: bottom }, { x: left, y: top });
  }
  return [...edges.values()];
}

function roundedLoopPath(points: Point[], requestedRadius: number): string {
  const corners = points.map((current, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const radius = Math.min(requestedRadius, distance(current, previous) / 2, distance(current, next) / 2);
    return { current, before: moveTowards(current, previous, radius), after: moveTowards(current, next, radius) };
  });
  const commands = [`M ${number(corners[0].after.x)} ${number(corners[0].after.y)}`];
  for (let offset = 1; offset <= corners.length; offset += 1) {
    const corner = corners[offset % corners.length];
    commands.push(`L ${number(corner.before.x)} ${number(corner.before.y)}`);
    commands.push(`Q ${number(corner.current.x)} ${number(corner.current.y)} ${number(corner.after.x)} ${number(corner.after.y)}`);
  }
  commands.push('Z');
  return commands.join(' ');
}

function moveTowards(from: Point, to: Point, amount: number): Point {
  const length = distance(from, to);
  if (length === 0) return { ...from };
  return { x: from.x + (to.x - from.x) / length * amount, y: from.y + (to.y - from.y) / length * amount };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function number(value: number): string {
  return String(Math.round(value * 100) / 100);
}
