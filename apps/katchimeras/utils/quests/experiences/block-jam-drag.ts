import { absoluteBlockCells, blockJamDoorAtAnchor, type BlockJamAnchor, type BlockJamBlockDefinition, type BlockJamDoor, type BlockJamLevel, type BlockJamState } from './block-jam';

export type BlockJamDragRect = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type BlockJamDragContext = {
  anchor: BlockJamAnchor;
  pitch: number;
  maxCatchUp: number;
  maxSubstep: number;
  epsilon: number;
  bounds: Omit<BlockJamDragRect, 'id'>;
  movingCells: Omit<BlockJamDragRect, 'id'>[];
  obstacles: BlockJamDragRect[];
};

export type BlockJamDragPose = { x: number; y: number };

export type BlockJamDragResolution = BlockJamDragPose & {
  contactKey: string | null;
  contactAxis: 'x' | 'y' | null;
};

type Layout = { cell: number; gap: number; outer: number };

export function createBlockJamDragContext(
  level: BlockJamLevel,
  state: BlockJamState,
  block: BlockJamBlockDefinition,
  anchor: BlockJamAnchor,
  layout: Layout,
): BlockJamDragContext {
  const pitch = layout.cell + layout.gap;
  const rectForCell = (row: number, column: number) => ({
    left: layout.outer + column * pitch,
    top: layout.outer + row * pitch,
    right: layout.outer + column * pitch + layout.cell,
    bottom: layout.outer + row * pitch + layout.cell,
  });
  const movingCells = absoluteBlockCells(block, anchor).map((cell) => rectForCell(cell.row, cell.column));
  const obstacles: BlockJamDragRect[] = [];

  for (const candidate of level.blocks) {
    if (candidate.id === block.id || state.clearedBlockIds.includes(candidate.id)) continue;
    for (const occupied of absoluteBlockCells(candidate, state.anchors[candidate.id])) {
      obstacles.push({ id: `block:${candidate.id}`, ...rectForCell(occupied.row, occupied.column) });
    }
  }
  for (const index of level.fixedCells) {
    const row = Math.floor(index / level.columns);
    const column = index % level.columns;
    obstacles.push({ id: `fixed:${index}`, ...rectForCell(row, column) });
  }

  return {
    anchor: { ...anchor },
    pitch,
    maxCatchUp: pitch * .85,
    maxSubstep: Math.max(2, pitch * .2),
    epsilon: .35,
    bounds: {
      left: layout.outer,
      top: layout.outer,
      right: layout.outer + level.columns * pitch - layout.gap,
      bottom: layout.outer + level.rows * pitch - layout.gap,
    },
    movingCells,
    obstacles,
  };
}

export function blockJamDragCollisionAt(context: BlockJamDragContext, x: number, y: number): string | null {
  const epsilon = context.epsilon;
  for (let movingIndex = 0; movingIndex < context.movingCells.length; movingIndex += 1) {
    const moving = context.movingCells[movingIndex];
    const left = moving.left + x;
    const right = moving.right + x;
    const top = moving.top + y;
    const bottom = moving.bottom + y;
    if (left < context.bounds.left - epsilon) return 'bounds:left';
    if (right > context.bounds.right + epsilon) return 'bounds:right';
    if (top < context.bounds.top - epsilon) return 'bounds:top';
    if (bottom > context.bounds.bottom + epsilon) return 'bounds:bottom';
    for (let obstacleIndex = 0; obstacleIndex < context.obstacles.length; obstacleIndex += 1) {
      const obstacle = context.obstacles[obstacleIndex];
      if (
        right > obstacle.left + epsilon &&
        left < obstacle.right - epsilon &&
        bottom > obstacle.top + epsilon &&
        top < obstacle.bottom - epsilon
      ) return obstacle.id;
    }
  }
  return null;
}

export function resolveBlockJamDrag(
  context: BlockJamDragContext,
  current: BlockJamDragPose,
  fingerTarget: BlockJamDragPose,
): BlockJamDragResolution {
  const requestedX = clamp(fingerTarget.x - current.x, -context.maxCatchUp, context.maxCatchUp);
  const requestedY = clamp(fingerTarget.y - current.y, -context.maxCatchUp, context.maxCatchUp);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(requestedX), Math.abs(requestedY)) / context.maxSubstep));
  const stepX = requestedX / steps;
  const stepY = requestedY / steps;
  let x = current.x;
  let y = current.y;
  let contactKey: string | null = null;
  let contactAxis: 'x' | 'y' | null = null;
  const xFirst = Math.abs(requestedX) >= Math.abs(requestedY);

  for (let index = 0; index < steps; index += 1) {
    if (xFirst) {
      const resolvedX = resolveAxis(context, x, y, stepX, 'x');
      x = resolvedX.position;
      if (resolvedX.contactKey) { contactKey = resolvedX.contactKey; contactAxis = 'x'; }
      const resolvedY = resolveAxis(context, x, y, stepY, 'y');
      y = resolvedY.position;
      if (resolvedY.contactKey) { contactKey = resolvedY.contactKey; contactAxis = 'y'; }
    } else {
      const resolvedY = resolveAxis(context, x, y, stepY, 'y');
      y = resolvedY.position;
      if (resolvedY.contactKey) { contactKey = resolvedY.contactKey; contactAxis = 'y'; }
      const resolvedX = resolveAxis(context, x, y, stepX, 'x');
      x = resolvedX.position;
      if (resolvedX.contactKey) { contactKey = resolvedX.contactKey; contactAxis = 'x'; }
    }
  }

  return { x, y, contactKey, contactAxis };
}

export function blockJamDragAnchorAtPose(context: BlockJamDragContext, pose: BlockJamDragPose): BlockJamAnchor | null {
  const candidate = {
    row: context.anchor.row + Math.round(pose.y / context.pitch),
    column: context.anchor.column + Math.round(pose.x / context.pitch),
  };
  const snappedX = (candidate.column - context.anchor.column) * context.pitch;
  const snappedY = (candidate.row - context.anchor.row) * context.pitch;
  return blockJamDragCollisionAt(context, snappedX, snappedY) ? null : candidate;
}

export function blockJamDragExitAtPose(
  level: BlockJamLevel,
  state: BlockJamState,
  blockId: string,
  context: BlockJamDragContext,
  pose: BlockJamDragPose,
): { anchor: BlockJamAnchor; door: BlockJamDoor } | null {
  const anchor = blockJamDragAnchorAtPose(context, pose);
  if (!anchor) return null;
  const door = blockJamDoorAtAnchor(level, state, blockId, anchor);
  return door ? { anchor, door } : null;
}

function resolveAxis(
  context: BlockJamDragContext,
  x: number,
  y: number,
  delta: number,
  axis: 'x' | 'y',
): { position: number; contactKey: string | null } {
  const current = axis === 'x' ? x : y;
  if (Math.abs(delta) < .001) return { position: current, contactKey: null };
  const targetX = axis === 'x' ? x + delta : x;
  const targetY = axis === 'y' ? y + delta : y;
  const collision = blockJamDragCollisionAt(context, targetX, targetY);
  if (!collision) return { position: current + delta, contactKey: null };

  let safe = 0;
  let blocked = 1;
  for (let iteration = 0; iteration < 7; iteration += 1) {
    const fraction = (safe + blocked) / 2;
    const testX = axis === 'x' ? x + delta * fraction : x;
    const testY = axis === 'y' ? y + delta * fraction : y;
    if (blockJamDragCollisionAt(context, testX, testY)) blocked = fraction;
    else safe = fraction;
  }
  return { position: current + delta * safe, contactKey: collision };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
