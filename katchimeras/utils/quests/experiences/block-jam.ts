export const BLOCK_JAM_RULESET = 'tasklet-desk-jam-v2' as const;
export type BlockJamPackId = 'tasklet-desk';
export type BlockJamTier = 1 | 2 | 3;
export type BlockJamColorId = 'red' | 'violet' | 'cyan' | 'lime' | 'blue' | 'amber';
export type BlockJamEdge = 'top' | 'right' | 'bottom' | 'left';
export type BlockJamCell = { row: number; column: number };
export type BlockJamAnchor = BlockJamCell;

export type BlockJamBlockDefinition = {
  id: string;
  colorId: BlockJamColorId;
  anchor: BlockJamAnchor;
  cells: BlockJamCell[];
};

export type BlockJamDoor = {
  id: string;
  colorId: BlockJamColorId;
  edge: BlockJamEdge;
  offset: number;
  span: number;
};

export type BlockJamLevel = {
  id: string;
  rulesetId: typeof BLOCK_JAM_RULESET;
  packId: BlockJamPackId;
  chapter: 'tutorial' | 'standard';
  tier: BlockJamTier;
  rows: number;
  columns: number;
  parMoves: number;
  timeLimitMs: number;
  blocks: BlockJamBlockDefinition[];
  doors: BlockJamDoor[];
  fixedCells: number[];
};

export type BlockJamState = {
  anchors: Record<string, BlockJamAnchor>;
  clearedBlockIds: string[];
  movesUsed: number;
  undoCount: number;
  status: 'playing' | 'won' | 'failed';
  history: Array<{ anchors: Record<string, BlockJamAnchor>; clearedBlockIds: string[] }>;
};

export type BlockJamAction =
  | { type: 'move'; blockId: string; anchor: BlockJamAnchor }
  | { type: 'exit'; blockId: string; doorId: string }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'timeout' };

export type BlockJamExitOption = { door: BlockJamDoor; anchor: BlockJamAnchor; path: BlockJamAnchor[] };
export type BlockJamSolutionStep = { blockId: string; action: 'move' | 'exit'; anchor?: BlockJamAnchor; doorId?: string };
export type BlockJamSolution = { moves: number; steps: BlockJamSolutionStep[]; exploredStates: number };

const SHAPES = {
  dot: [[0,0]], dominoH: [[0,0],[0,1]], dominoV: [[0,0],[1,0]],
  bar3H: [[0,0],[0,1],[0,2]], bar3V: [[0,0],[1,0],[2,0]],
  bar4H: [[0,0],[0,1],[0,2],[0,3]], bar4V: [[0,0],[1,0],[2,0],[3,0]],
  bar5H: [[0,0],[0,1],[0,2],[0,3],[0,4]], bar5V: [[0,0],[1,0],[2,0],[3,0],[4,0]],
  square: [[0,0],[0,1],[1,0],[1,1]],
  l3: [[0,0],[1,0],[1,1]], l4: [[0,0],[1,0],[2,0],[2,1]],
  j4: [[0,1],[1,1],[2,0],[2,1]], t4: [[0,0],[0,1],[0,2],[1,1]],
  z4: [[0,0],[0,1],[1,1],[1,2]], s4: [[0,1],[0,2],[1,0],[1,1]],
  l5: [[0,0],[1,0],[2,0],[2,1],[2,2]], u5: [[0,0],[1,0],[1,1],[1,2],[0,2]],
} as const;
type ShapeId = keyof typeof SHAPES;
const C: BlockJamColorId[] = ['red','violet','cyan','lime','blue','amber'];
// Fixed cells are temporarily disabled until obstacle placement is included in
// the same solvability pass as exits and starting block positions.
const FIXED_CELLS_ENABLED = false;

const block = (id: string, colorId: BlockJamColorId, shape: ShapeId, row: number, column: number): BlockJamBlockDefinition => ({ id, colorId, anchor: { row, column }, cells: SHAPES[shape].map(([cellRow, cellColumn]) => ({ row: cellRow, column: cellColumn })) });
const door = (id: string, colorId: BlockJamColorId, edge: BlockJamEdge, offset: number, span: number): BlockJamDoor => ({ id, colorId, edge, offset, span });
const level = (id: string, chapter: BlockJamLevel['chapter'], tier: BlockJamTier, rows: number, columns: number, blocks: BlockJamBlockDefinition[], doors: BlockJamDoor[], fixedCells: number[] = [], parMoves = blocks.length): BlockJamLevel => ({ id, rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter, tier, rows, columns, parMoves, timeLimitMs: chapter === 'tutorial' || tier === 1 ? 180_000 : tier === 2 ? 240_000 : 300_000, blocks, doors, fixedCells: FIXED_CELLS_ENABLED ? fixedCells : [] });

function tutorialLevels(): BlockJamLevel[] {
  return [
    // The opening board teaches the actual jam loop: park amber to free cyan,
    // clear cyan to open red, then use the vacated red lane for violet.
    level('desk-v2-tutorial-01','tutorial',1,7,7,[block('a','red','bar3H',2,1),block('b','cyan','bar3V',1,5),block('c','amber','square',4,4),block('d','violet','bar3V',3,1)],[door('r','red','right',2,1),door('c','cyan','bottom',5,1),door('a','amber','left',4,2),door('v','violet','top',1,1)],[3,10,34,41],9),
    level('desk-v2-tutorial-02','tutorial',1,7,7,[block('a','violet','l3',1,1),block('b','lime','bar4H',3,2),block('c','blue','bar3V',2,6),block('d','red','dominoV',4,0)],[door('v','violet','top',1,2),door('l','lime','left',3,1),door('b','blue','bottom',6,1),door('r','red','right',4,2)],[],5),
    level('desk-v2-tutorial-03','tutorial',1,7,7,[block('a','cyan','t4',1,2),block('b','amber','l4',3,0),block('c','red','bar4V',2,5),block('d','violet','square',5,2)],[door('c','cyan','top',2,3),door('a','amber','right',3,3),door('r','red','bottom',5,1),door('v','violet','left',5,2)],[24],6),
    level('desk-v2-tutorial-04','tutorial',1,7,7,[block('a','lime','z4',1,1),block('b','blue','l5',3,0),block('c','amber','bar5H',6,2),block('d','cyan','dominoV',1,6),block('e','red','square',3,4)],[door('l','lime','top',1,3),door('b','blue','right',3,3),door('a','amber','bottom',2,5),door('c','cyan','right',1,2),door('r','red','top',4,2)],[],7),
    level('desk-v2-tutorial-05','tutorial',1,7,7,[block('a','red','u5',0,1),block('b','violet','bar4V',2,0),block('c','cyan','bar4H',3,2),block('d','lime','j4',4,5),block('e','blue','square',5,2)],[door('r','red','top',1,3),door('v','violet','bottom',0,1),door('c','cyan','right',3,1),door('l','lime','top',5,2),door('b','blue','left',5,2)],[],8),
    level('desk-v2-tutorial-06','tutorial',1,7,7,[block('a','amber','t4',0,2),block('b','red','l5',2,0),block('c','violet','bar5H',3,1),block('d','cyan','bar4V',1,6),block('e','lime','z4',5,1),block('f','blue','square',4,4)],[door('a','amber','top',2,3),door('r','red','right',2,3),door('v','violet','left',3,1),door('c','cyan','bottom',6,1),door('l','lime','bottom',1,3),door('b','blue','right',5,2)],[],9),
  ];
}

function layoutStandardDoors(blocks: BlockJamBlockDefinition[], boardSize: number, seedOffset: number): BlockJamDoor[] {
  const colors = [...new Set(blocks.map((piece) => piece.colorId))];
  const baseEdges: BlockJamEdge[] = ['top', 'right', 'bottom', 'left'];
  const edgeOrder = baseEdges.map((_, index) => baseEdges[(index + seedOffset) % baseEdges.length]);
  const spanFor = (colorId: BlockJamColorId, edge: BlockJamEdge) => Math.max(
    ...blocks.filter((piece) => piece.colorId === colorId).map((piece) => pieceCrossSpan(piece, edge)),
  );
  const orderedColors = [...colors].sort((left, right) => {
    const leftMinimum = Math.min(...baseEdges.map((edge) => spanFor(left, edge)));
    const rightMinimum = Math.min(...baseEdges.map((edge) => spanFor(right, edge)));
    return rightMinimum - leftMinimum || colors.indexOf(left) - colors.indexOf(right);
  });

  type Placement = { colorId: BlockJamColorId; edge: BlockJamEdge; span: number };
  const attempt = (railGap: number): Placement[] | null => {
    const used: Record<BlockJamEdge, number> = { top: 0, right: 0, bottom: 0, left: 0 };
    const counts: Record<BlockJamEdge, number> = { top: 0, right: 0, bottom: 0, left: 0 };
    let best: Placement[] | null = null; let bestScore = Number.POSITIVE_INFINITY;
    const search = (colorIndex: number, placements: Placement[]) => {
      if (colorIndex === orderedColors.length) {
        const unusedEdges = baseEdges.filter((edge) => counts[edge] === 0).length;
        const imbalance = baseEdges.reduce((sum, edge) => sum + counts[edge] ** 2, 0);
        const score = unusedEdges * 1_000 + imbalance * 10 + baseEdges.reduce((sum, edge) => sum + used[edge], 0);
        if (score < bestScore) { bestScore = score; best = [...placements]; }
        return;
      }
      const colorId = orderedColors[colorIndex];
      const candidates = edgeOrder
        .map((edge, order) => ({ edge, order, span: spanFor(colorId, edge) }))
        .sort((left, right) => left.span - right.span || counts[left.edge] - counts[right.edge] || left.order - right.order);
      for (const candidate of candidates) {
        if (counts[candidate.edge] >= 2) continue;
        const added = candidate.span + (counts[candidate.edge] ? railGap : 0);
        if (used[candidate.edge] + added > boardSize) continue;
        used[candidate.edge] += added; counts[candidate.edge] += 1;
        placements.push({ colorId, edge: candidate.edge, span: candidate.span }); search(colorIndex + 1, placements); placements.pop();
        used[candidate.edge] -= added; counts[candidate.edge] -= 1;
      }
    };
    search(0, []); return best;
  };

  const placements = attempt(1) ?? attempt(0);
  if (!placements) throw new Error('Unable to place non-overlapping Block Jam exits');
  return baseEdges.flatMap((edge) => {
    const edgePlacements = placements.filter((placement) => placement.edge === edge);
    const railGap = edgePlacements.reduce((sum, placement) => sum + placement.span, 0) + Math.max(0, edgePlacements.length - 1) <= boardSize ? 1 : 0;
    const occupied = edgePlacements.reduce((sum, placement) => sum + placement.span, 0) + Math.max(0, edgePlacements.length - 1) * railGap;
    let offset = Math.floor((boardSize - occupied) / 2);
    return edgePlacements.map((placement) => {
      const result = door(`door-${placement.colorId}`, placement.colorId, edge, offset, placement.span);
      offset += placement.span + railGap; return result;
    });
  });
}

/**
 * Dense seed-authored boards. Their geometry is deterministic and the validation
 * suite replays a solver path for every seed before it can ship.
 */
function standardLevel(index: number, tier: BlockJamTier): BlockJamLevel {
  const size = tier === 1 ? 8 : tier === 2 ? 9 : 10;
  const shapeSets: ShapeId[][] = [
    ['bar4H','bar4V','square','l4','t4','z4','bar3H','bar3V','l3'],
    ['bar5H','bar5V','l5','u5','t4','z4','s4','square','l4','j4','bar3H'],
    ['bar5H','bar5V','l5','u5','t4','z4','s4','square','l4','j4','bar4H','bar4V','l3'],
  ];
  const count = tier === 1 ? 8 : tier === 2 ? 10 : 12;
  const shapes = shapeSets[tier - 1];
  const blocks: BlockJamBlockDefinition[] = [];
  const occupied = new Set<number>();
  let cursor = stableHash(`desk-v2:${tier}:${index}`) || 1;
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 160 && !placed; attempt += 1) {
      cursor = nextRandom(cursor); const shape = shapes[cursor % shapes.length];
      cursor = nextRandom(cursor); const cells = SHAPES[shape];
      const height = Math.max(...cells.map(([row]) => row)) + 1; const width = Math.max(...cells.map(([, column]) => column)) + 1;
      cursor = nextRandom(cursor); const row = cursor % Math.max(1, size - height + 1);
      cursor = nextRandom(cursor); const column = cursor % Math.max(1, size - width + 1);
      const absolute = cells.map(([cellRow, cellColumn]) => (row + cellRow) * size + column + cellColumn);
      if (absolute.some((cell) => occupied.has(cell))) continue;
      absolute.forEach((cell) => occupied.add(cell)); blocks.push(block(`p${ordinal}`, C[(ordinal + index) % C.length], shape, row, column)); placed = true;
    }
  }
  const doors = layoutStandardDoors(blocks, size, index);
  const fixedCandidates = Array.from(
    { length: tier },
    (_, ordinal) => (ordinal + 2) * size + ((index * 3 + ordinal * 2) % size),
  );
  const fixedCells = tier === 1 ? [] : fixedCandidates.filter((cell) => !occupied.has(cell));
  const id = `desk-v2-${String((tier - 1) * 8 + index + 1).padStart(2, '0')}`;
  // Every block now requires a positioning move plus an outward exit move.
  // Additional tier moves cover deliberate parking/repositioning in denser jams.
  return level(id, 'standard', tier, size, size, blocks, doors, fixedCells, blocks.length * 2 + tier);
}

export const TASKLET_DESK_JAM_LEVELS: BlockJamLevel[] = [
  ...tutorialLevels(),
  ...Array.from({ length: 8 }, (_, index) => standardLevel(index, 1)),
  ...Array.from({ length: 8 }, (_, index) => standardLevel(index, 2)),
  ...Array.from({ length: 8 }, (_, index) => standardLevel(index, 3)),
];

export function blockJamLevel(id: string): BlockJamLevel {
  const found = TASKLET_DESK_JAM_LEVELS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown block jam level: ${id}`);
  return found;
}

export function resolveBlockJamConfig(completedCount: number, seed: string, recentLevelIds: string[] = []) {
  const tutorials = TASKLET_DESK_JAM_LEVELS.filter((candidate) => candidate.chapter === 'tutorial');
  const level = completedCount < tutorials.length ? tutorials[completedCount] : selectStandardLevel(completedCount, seed, recentLevelIds);
  return { packId: level.packId, rulesetId: BLOCK_JAM_RULESET, tier: level.tier, levelId: level.id, timeLimitMs: level.timeLimitMs, parMoves: level.parMoves } as const;
}

function selectStandardLevel(completedCount: number, seed: string, recentLevelIds: string[]): BlockJamLevel {
  const tier = completedCount < 14 ? 1 : completedCount < 22 ? 2 : 3;
  const candidates = TASKLET_DESK_JAM_LEVELS.filter((candidate) => candidate.chapter === 'standard' && candidate.tier === tier);
  const recent = new Set(recentLevelIds.slice(-6)); const fresh = candidates.filter((candidate) => !recent.has(candidate.id)); const pool = fresh.length ? fresh : candidates;
  return pool[stableHash(seed) % pool.length];
}

export function createBlockJamState(levelDefinition: BlockJamLevel): BlockJamState {
  return { anchors: Object.fromEntries(levelDefinition.blocks.map((piece) => [piece.id, { ...piece.anchor }])), clearedBlockIds: [], movesUsed: 0, undoCount: 0, status: 'playing', history: [] };
}

export function absoluteBlockCells(piece: BlockJamBlockDefinition, anchor: BlockJamAnchor): BlockJamCell[] {
  return piece.cells.map((cell) => ({ row: anchor.row + cell.row, column: anchor.column + cell.column }));
}

export function nearestBlockJamPieceAtPoint(
  levelDefinition: BlockJamLevel,
  state: BlockJamState,
  point: { x: number; y: number },
  layout: { cell: number; gap: number; outer: number },
  maxDistance = layout.cell,
): string | null {
  const pitch = layout.cell + layout.gap;
  let nearest: { blockId: string; distance: number } | null = null;

  for (const piece of levelDefinition.blocks) {
    if (state.clearedBlockIds.includes(piece.id)) continue;
    for (const occupied of absoluteBlockCells(piece, state.anchors[piece.id])) {
      const left = layout.outer + occupied.column * pitch;
      const top = layout.outer + occupied.row * pitch;
      const dx = Math.max(left - point.x, 0, point.x - (left + layout.cell));
      const dy = Math.max(top - point.y, 0, point.y - (top + layout.cell));
      const distance = Math.hypot(dx, dy);
      if (!nearest || distance < nearest.distance) nearest = { blockId: piece.id, distance };
    }
  }

  return nearest && nearest.distance <= maxDistance ? nearest.blockId : null;
}

export function reachableBlockJamAnchors(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string): BlockJamAnchor[] {
  const piece = levelDefinition.blocks.find((candidate) => candidate.id === blockId); const start = state.anchors[blockId];
  if (!piece || !start || state.clearedBlockIds.includes(blockId)) return [];
  const queue = [start]; const seen = new Set([anchorKey(start)]); const output: BlockJamAnchor[] = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
      const next = { row: current.row + dr, column: current.column + dc }; const key = anchorKey(next);
      if (seen.has(key) || !canOccupy(levelDefinition, state, piece, next)) continue;
      seen.add(key); queue.push(next); output.push(next);
    }
  }
  return output;
}

export function blockJamPath(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string, destination: BlockJamAnchor): BlockJamAnchor[] | null {
  const piece = levelDefinition.blocks.find((candidate) => candidate.id === blockId); const start = state.anchors[blockId];
  if (!piece || !start) return null;
  const queue = [start]; const parents = new Map<string, BlockJamAnchor | null>([[anchorKey(start), null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]; if (sameAnchor(current, destination)) return rebuildPath(parents, current);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
      const next = { row: current.row + dr, column: current.column + dc }; const key = anchorKey(next);
      if (parents.has(key) || !canOccupy(levelDefinition, state, piece, next)) continue;
      parents.set(key, current); queue.push(next);
    }
  }
  return null;
}

export function blockJamExitOptions(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string): BlockJamExitOption[] {
  const piece = levelDefinition.blocks.find((candidate) => candidate.id === blockId);
  const anchor = state.anchors[blockId];
  if (!piece || !anchor || state.clearedBlockIds.includes(blockId)) return [];
  return levelDefinition.doors.flatMap((candidateDoor) =>
    candidateDoor.colorId === piece.colorId && pieceFitsDoor(levelDefinition, piece, anchor, candidateDoor) && exitSweepClear(levelDefinition, state, piece, anchor, candidateDoor)
      ? [{ door: candidateDoor, anchor, path: [anchor] }]
      : [],
  );
}

export function availableBlockJamDoor(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string): BlockJamDoor | null { return blockJamExitOptions(levelDefinition, state, blockId)[0]?.door ?? null; }

export function blockJamDoorAtAnchor(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string, anchor: BlockJamAnchor): BlockJamDoor | null {
  const piece = levelDefinition.blocks.find((candidate) => candidate.id === blockId);
  if (!piece) return null;
  const positionedState = { ...state, anchors: { ...state.anchors, [blockId]: anchor } };
  return levelDefinition.doors.find((candidateDoor) =>
    candidateDoor.colorId === piece.colorId && pieceFitsDoor(levelDefinition, piece, anchor, candidateDoor) && exitSweepClear(levelDefinition, positionedState, piece, anchor, candidateDoor),
  ) ?? null;
}

export function blockJamReducer(levelDefinition: BlockJamLevel, state: BlockJamState, action: BlockJamAction): BlockJamState {
  if (action.type === 'restart') return createBlockJamState(levelDefinition);
  if (action.type === 'timeout') return state.status === 'playing' ? { ...state, status: 'failed' } : state;
  if (action.type === 'undo') { const previous = state.history.at(-1); return previous ? { ...state, anchors: previous.anchors, clearedBlockIds: previous.clearedBlockIds, movesUsed: Math.max(0, state.movesUsed - 1), undoCount: state.undoCount + 1, status: 'playing', history: state.history.slice(0, -1) } : state; }
  if (state.status !== 'playing') return state;
  const piece = levelDefinition.blocks.find((candidate) => candidate.id === action.blockId); if (!piece || state.clearedBlockIds.includes(piece.id)) return state;
  const snapshot = { anchors: cloneAnchors(state.anchors), clearedBlockIds: [...state.clearedBlockIds] };
  if (action.type === 'move') {
    if (!blockJamPath(levelDefinition, state, piece.id, action.anchor)) return state;
    return withStatus(levelDefinition, { ...state, anchors: { ...state.anchors, [piece.id]: { ...action.anchor } }, movesUsed: state.movesUsed + 1, history: [...state.history, snapshot] });
  }
  const option = blockJamExitOptions(levelDefinition, state, piece.id).find((candidate) => candidate.door.id === action.doorId); if (!option) return state;
  return withStatus(levelDefinition, { ...state, anchors: { ...state.anchors, [piece.id]: option.anchor }, clearedBlockIds: [...state.clearedBlockIds, piece.id], movesUsed: state.movesUsed + 1, history: [...state.history, snapshot] });
}

export function solveBlockJamLevel(levelDefinition: BlockJamLevel, maxVisited = 120_000): BlockJamSolution | null {
  const initial = createBlockJamState(levelDefinition); const queue: Array<{ state: BlockJamState; steps: BlockJamSolutionStep[] }> = [{ state: initial, steps: [] }]; const seen = new Set([stateKey(levelDefinition, initial)]);
  for (let cursor = 0; cursor < queue.length && seen.size <= maxVisited; cursor += 1) {
    const current = queue[cursor]; if (current.state.clearedBlockIds.length === levelDefinition.blocks.length) return { moves: current.steps.length, steps: current.steps, exploredStates: seen.size };
    for (const piece of levelDefinition.blocks) {
      if (current.state.clearedBlockIds.includes(piece.id)) continue;
      const exits = blockJamExitOptions(levelDefinition, current.state, piece.id);
      const actions: Array<{ action: BlockJamAction; step: BlockJamSolutionStep }> = exits.length
        ? exits.slice(0, 1).map((option) => ({ action: { type: 'exit', blockId: piece.id, doorId: option.door.id }, step: { blockId: piece.id, action: 'exit', doorId: option.door.id } }))
        : criticalAnchors(levelDefinition, current.state, piece.id).map((anchor) => ({ action: { type: 'move', blockId: piece.id, anchor }, step: { blockId: piece.id, action: 'move', anchor } }));
      for (const candidate of actions) { const next = blockJamReducer(levelDefinition, current.state, candidate.action); const key = stateKey(levelDefinition, next); if (seen.has(key)) continue; seen.add(key); queue.push({ state: { ...next, history: [] }, steps: [...current.steps, candidate.step] }); }
    }
  }
  return null;
}

export function validateBlockJamLevel(levelDefinition: BlockJamLevel): string[] {
  const errors: string[] = []; const state = createBlockJamState(levelDefinition); const occupied = new Set<number>();
  if (levelDefinition.rulesetId !== BLOCK_JAM_RULESET) errors.push('Invalid ruleset');
  for (const piece of levelDefinition.blocks) {
    if (!piece.cells.length || !connected(piece.cells)) errors.push(`${piece.id} must be orthogonally connected`);
    for (const cell of absoluteBlockCells(piece, piece.anchor)) { if (!inside(levelDefinition, cell)) errors.push(`${piece.id} is out of bounds`); const index = cell.row * levelDefinition.columns + cell.column; if (occupied.has(index)) errors.push(`${piece.id} overlaps another piece`); occupied.add(index); if (levelDefinition.fixedCells.includes(index)) errors.push(`${piece.id} overlaps a fixed cell`); }
    if (!levelDefinition.doors.some((candidate) => candidate.colorId === piece.colorId)) errors.push(`${piece.id} has no matching exit`);
  }
  for (const candidateDoor of levelDefinition.doors) { const length = candidateDoor.edge === 'top' || candidateDoor.edge === 'bottom' ? levelDefinition.columns : levelDefinition.rows; if (candidateDoor.offset < 0 || candidateDoor.span < 1 || candidateDoor.offset + candidateDoor.span > length) errors.push(`${candidateDoor.id} is out of bounds`); }
  for (let left = 0; left < levelDefinition.doors.length; left += 1) for (let right = left + 1; right < levelDefinition.doors.length; right += 1) {
    const a = levelDefinition.doors[left]; const b = levelDefinition.doors[right];
    if (a.edge === b.edge && Math.max(a.offset, b.offset) < Math.min(a.offset + a.span, b.offset + b.span)) errors.push(`${a.id} overlaps ${b.id}`);
  }
  for (const piece of levelDefinition.blocks) {
    if (!levelDefinition.doors.some((candidateDoor) => candidateDoor.colorId === piece.colorId && candidateDoor.span >= pieceCrossSpan(piece, candidateDoor.edge))) errors.push(`${piece.id} is wider than its matching exit`);
  }
  if (state.clearedBlockIds.length) errors.push('Initial state cannot contain cleared blocks'); return errors;
}

export function blockJamOccupancy(levelDefinition: BlockJamLevel): number { return levelDefinition.blocks.reduce((sum, piece) => sum + piece.cells.length, 0) / (levelDefinition.rows * levelDefinition.columns); }

function criticalAnchors(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string): BlockJamAnchor[] {
  const reachable = reachableBlockJamAnchors(levelDefinition, state, blockId); const piece = levelDefinition.blocks.find((candidate) => candidate.id === blockId)!;
  return reachable.filter((anchor) => {
    const cells = absoluteBlockCells(piece, anchor); return cells.some((cell) => cell.row === 0 || cell.column === 0 || cell.row === levelDefinition.rows - 1 || cell.column === levelDefinition.columns - 1 || [[-1,0],[1,0],[0,-1],[0,1]].some(([dr,dc]) => { const next = { row: cell.row + dr, column: cell.column + dc }; return inside(levelDefinition,next) && (levelDefinition.fixedCells.includes(next.row * levelDefinition.columns + next.column) || occupiedByOther(levelDefinition,state,piece.id,next)); }));
  }).slice(0, 18);
}

function canOccupy(levelDefinition: BlockJamLevel, state: BlockJamState, piece: BlockJamBlockDefinition, anchor: BlockJamAnchor): boolean { return absoluteBlockCells(piece, anchor).every((cell) => inside(levelDefinition, cell) && !levelDefinition.fixedCells.includes(cell.row * levelDefinition.columns + cell.column) && !occupiedByOther(levelDefinition, state, piece.id, cell)); }
function occupiedByOther(levelDefinition: BlockJamLevel, state: BlockJamState, blockId: string, cell: BlockJamCell): boolean { return levelDefinition.blocks.some((candidate) => candidate.id !== blockId && !state.clearedBlockIds.includes(candidate.id) && absoluteBlockCells(candidate, state.anchors[candidate.id]).some((occupied) => occupied.row === cell.row && occupied.column === cell.column)); }
function pieceFitsDoor(levelDefinition: BlockJamLevel, piece: BlockJamBlockDefinition, anchor: BlockJamAnchor, candidateDoor: BlockJamDoor): boolean { const cells = absoluteBlockCells(piece, anchor); if (candidateDoor.edge === 'top' && Math.min(...cells.map((cell) => cell.row)) !== 0) return false; if (candidateDoor.edge === 'bottom' && Math.max(...cells.map((cell) => cell.row)) !== levelDefinition.rows - 1) return false; if (candidateDoor.edge === 'left' && Math.min(...cells.map((cell) => cell.column)) !== 0) return false; if (candidateDoor.edge === 'right' && Math.max(...cells.map((cell) => cell.column)) !== levelDefinition.columns - 1) return false; const cross = candidateDoor.edge === 'top' || candidateDoor.edge === 'bottom' ? cells.map((cell) => cell.column) : cells.map((cell) => cell.row); return Math.min(...cross) >= candidateDoor.offset && Math.max(...cross) < candidateDoor.offset + candidateDoor.span; }
function pieceCrossSpan(piece: BlockJamBlockDefinition, edge: BlockJamEdge): number { return edge === 'top' || edge === 'bottom' ? Math.max(...piece.cells.map((cell) => cell.column)) + 1 : Math.max(...piece.cells.map((cell) => cell.row)) + 1; }
function exitSweepClear(levelDefinition: BlockJamLevel, state: BlockJamState, piece: BlockJamBlockDefinition, anchor: BlockJamAnchor, candidateDoor: BlockJamDoor): boolean {
  const direction = candidateDoor.edge === 'top' ? [-1, 0] : candidateDoor.edge === 'bottom' ? [1, 0] : candidateDoor.edge === 'left' ? [0, -1] : [0, 1];
  const initialCells = absoluteBlockCells(piece, anchor);
  const travel = candidateDoor.edge === 'top'
    ? Math.max(...initialCells.map((cell) => cell.row)) + 1
    : candidateDoor.edge === 'bottom'
      ? levelDefinition.rows - Math.min(...initialCells.map((cell) => cell.row))
      : candidateDoor.edge === 'left'
        ? Math.max(...initialCells.map((cell) => cell.column)) + 1
        : levelDefinition.columns - Math.min(...initialCells.map((cell) => cell.column));
  for (let step = 1; step <= travel; step += 1) {
    for (const initial of initialCells) {
      const shifted = { row: initial.row + direction[0] * step, column: initial.column + direction[1] * step };
      if (!inside(levelDefinition, shifted)) continue;
      if (levelDefinition.fixedCells.includes(shifted.row * levelDefinition.columns + shifted.column) || occupiedByOther(levelDefinition, state, piece.id, shifted)) return false;
    }
  }
  return true;
}
function connected(cells: readonly BlockJamCell[]): boolean { const keys = new Set(cells.map(anchorKey)); const queue = [cells[0]]; const seen = new Set([anchorKey(cells[0])]); for (let index = 0; index < queue.length; index += 1) for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const) { const next = { row: queue[index].row + dr, column: queue[index].column + dc }; const key = anchorKey(next); if (keys.has(key) && !seen.has(key)) { seen.add(key); queue.push(next); } } return seen.size === cells.length; }
function inside(levelDefinition: BlockJamLevel, cell: BlockJamCell): boolean { return cell.row >= 0 && cell.column >= 0 && cell.row < levelDefinition.rows && cell.column < levelDefinition.columns; }
function withStatus(levelDefinition: BlockJamLevel, state: BlockJamState): BlockJamState { return { ...state, status: state.clearedBlockIds.length === levelDefinition.blocks.length ? 'won' : 'playing' }; }
function cloneAnchors(anchors: Record<string, BlockJamAnchor>): Record<string, BlockJamAnchor> { return Object.fromEntries(Object.entries(anchors).map(([id, anchor]) => [id, { ...anchor }])); }
function anchorKey(anchor: BlockJamAnchor): string { return `${anchor.row},${anchor.column}`; }
function sameAnchor(left: BlockJamAnchor, right: BlockJamAnchor): boolean { return left.row === right.row && left.column === right.column; }
function rebuildPath(parents: Map<string, BlockJamAnchor | null>, end: BlockJamAnchor): BlockJamAnchor[] { const path: BlockJamAnchor[] = []; let current: BlockJamAnchor | null = end; while (current) { path.unshift(current); current = parents.get(anchorKey(current)) ?? null; } return path; }
function stateKey(levelDefinition: BlockJamLevel, state: BlockJamState): string { return levelDefinition.blocks.map((piece) => state.clearedBlockIds.includes(piece.id) ? 'x' : anchorKey(state.anchors[piece.id])).join('|'); }
function stableHash(value: string): number { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function nextRandom(value: number): number { return (Math.imul(value, 1664525) + 1013904223) >>> 0; }
