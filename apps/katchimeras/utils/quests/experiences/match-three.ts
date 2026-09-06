export type MatchThreeSpecial = 'row' | 'column' | 'burst' | 'prism';
export type MatchThreeStatus = 'playing' | 'won' | 'failed';

export type MatchThreeTile = {
  id: string;
  kind: string;
  special: MatchThreeSpecial | null;
};

export type MatchThreeObjective = {
  id: string;
  kindIds: string[];
  target: number;
  collected: number;
};

export type MatchThreeObjectiveRule = Omit<MatchThreeObjective, 'collected'>;

export type MatchThreeConfig = {
  tier: 1 | 2 | 3 | 4 | 5;
  rows: number;
  columns: number;
  tileTypeCount: number;
  targetCounts: number[];
  moveBudget: number;
  singleFrost: number;
  doubleFrost: number;
};

export type MatchThreeState = {
  board: Array<MatchThreeTile | null>;
  blockers: number[];
  objectives: MatchThreeObjective[];
  rows: number;
  columns: number;
  movesRemaining: number;
  movesUsed: number;
  frostCleared: number;
  frostTarget: number;
  maxCascade: number;
  specialsTriggered: number;
  status: MatchThreeStatus;
  rngState: number;
  nextTileId: number;
  tileKinds: string[];
};

export type MatchThreeResolutionStep = {
  kind: 'swap' | 'invalid' | 'clear' | 'fall' | 'refill' | 'reshuffle';
  board: Array<MatchThreeTile | null>;
  blockers: number[];
  objectives: MatchThreeObjective[];
  cleared: number[];
  cascade: number;
};

export type MatchThreeMove = {
  valid: boolean;
  state: MatchThreeState;
  steps: MatchThreeResolutionStep[];
};

type MatchRun = { direction: 'row' | 'column'; indices: number[]; kind: string };
type SpecialCreation = { index: number; special: MatchThreeSpecial; kind: string };

export const MATCH_THREE_DIFFICULTY: MatchThreeConfig[] = [
  { tier: 1, rows: 6, columns: 6, tileTypeCount: 5, targetCounts: [18], moveBudget: 18, singleFrost: 0, doubleFrost: 0 },
  { tier: 2, rows: 7, columns: 7, tileTypeCount: 5, targetCounts: [24], moveBudget: 20, singleFrost: 0, doubleFrost: 0 },
  { tier: 3, rows: 7, columns: 7, tileTypeCount: 6, targetCounts: [28], moveBudget: 22, singleFrost: 6, doubleFrost: 0 },
  { tier: 4, rows: 8, columns: 8, tileTypeCount: 6, targetCounts: [34], moveBudget: 24, singleFrost: 6, doubleFrost: 4 },
  { tier: 5, rows: 8, columns: 8, tileTypeCount: 6, targetCounts: [40], moveBudget: 26, singleFrost: 6, doubleFrost: 8 },
];

export function resolveMatchThreeConfig(completedCount: number): MatchThreeConfig {
  return MATCH_THREE_DIFFICULTY[Math.min(4, Math.floor(Math.max(0, completedCount) / 2))];
}

export function createMatchThreeState(input: {
  seed: string;
  config: MatchThreeConfig;
  availableKinds: string[];
  requiredKinds?: string[];
  objectiveRules?: MatchThreeObjectiveRule[];
}): MatchThreeState {
  if (input.availableKinds.length < input.config.tileTypeCount) throw new Error('Match 3 pack does not contain enough tile types');
  let rngState = stableHash(input.seed) || 1;
  const shuffled = seededShuffle(input.availableKinds, rngState);
  rngState = shuffled.rngState;
  const requiredKinds = [...new Set(input.requiredKinds ?? [])];
  if (requiredKinds.some((kind) => !input.availableKinds.includes(kind))) throw new Error('Match 3 required tile kind is unavailable');
  if (requiredKinds.length > input.config.tileTypeCount) throw new Error('Match 3 has more required kinds than board tile types');
  const tileKinds = [...requiredKinds, ...shuffled.values.filter((kind) => !requiredKinds.includes(kind))].slice(0, input.config.tileTypeCount);
  const objectives = input.objectiveRules?.length
    ? input.objectiveRules.map((rule) => ({ ...rule, kindIds: [...rule.kindIds], collected: 0 }))
    : input.config.targetCounts.map((target, index) => ({ id: tileKinds[index], kindIds: [tileKinds[index]], target, collected: 0 }));
  let generated: { board: MatchThreeTile[]; rngState: number; nextTileId: number } | null = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    generated = generateStableBoard(input.config.rows, input.config.columns, tileKinds, rngState + attempt, 0);
    if (hasLegalMove(generated.board, input.config.rows, input.config.columns)) break;
  }
  if (!generated || !hasLegalMove(generated.board, input.config.rows, input.config.columns)) {
    throw new Error('Unable to generate a playable Match 3 board');
  }
  const frostTotal = input.config.singleFrost + input.config.doubleFrost;
  const blockerOrder = seededShuffle(Array.from({ length: generated.board.length }, (_, index) => index), generated.rngState);
  const blockers = Array.from({ length: generated.board.length }, () => 0);
  blockerOrder.values.slice(0, frostTotal).forEach((index, order) => {
    blockers[index] = order < input.config.doubleFrost ? 2 : 1;
  });
  return {
    board: generated.board,
    blockers,
    objectives,
    rows: input.config.rows,
    columns: input.config.columns,
    movesRemaining: input.config.moveBudget,
    movesUsed: 0,
    frostCleared: 0,
    frostTarget: frostTotal,
    maxCascade: 0,
    specialsTriggered: 0,
    status: 'playing',
    rngState: blockerOrder.rngState,
    nextTileId: generated.nextTileId,
    tileKinds,
  };
}

export function attemptMatchThreeSwap(state: MatchThreeState, first: number, second: number): MatchThreeMove {
  if (state.status !== 'playing' || !areAdjacent(first, second, state.columns) || !state.board[first] || !state.board[second]) {
    return { valid: false, state, steps: [step('invalid', state, [], 0)] };
  }
  const swapped = swapCells(state.board, first, second);
  const firstTile = state.board[first]!;
  const secondTile = state.board[second]!;
  const specialCombo = Boolean(firstTile.special && secondTile.special) || firstTile.special === 'prism' || secondTile.special === 'prism';
  if (!specialCombo && findMatchRuns(swapped, state.rows, state.columns).length === 0) {
    return {
      valid: false,
      state,
      steps: [
        { ...step('swap', state, [], 0), board: swapped },
        step('invalid', state, [], 0),
      ],
    };
  }

  let working: MatchThreeState = {
    ...state,
    board: swapped,
    movesRemaining: state.movesRemaining - 1,
    movesUsed: state.movesUsed + 1,
  };
  const steps: MatchThreeResolutionStep[] = [{ ...step('swap', working, [], 0), board: cloneBoard(swapped) }];
  let forcedClear = specialCombo ? specialComboClear(swapped, first, second, state.rows, state.columns) : null;
  let cascade = 0;

  while (cascade < 32) {
    const runs = forcedClear ? [] : findMatchRuns(working.board, working.rows, working.columns);
    if (!forcedClear && runs.length === 0) break;
    cascade += 1;
    const matchIndices = forcedClear ?? new Set(runs.flatMap((run) => run.indices));
    const creation = forcedClear ? null : chooseSpecialCreation(runs, first, second, working.board);
    const protectedSpecials = forcedClear ? new Set([first, second]) : new Set<number>();
    const expanded = expandSpecialClears(working.board, matchIndices, working.rows, working.columns, protectedSpecials);
    const clearIndices = expanded.indices;
    const beforeClear = working.board;
    const boardAfterClear = cloneBoard(beforeClear);
    const blockers = [...working.blockers];
    const objectives = working.objectives.map((objective) => ({ ...objective }));
    let frostCleared = working.frostCleared;

    for (const index of clearIndices) {
      if (blockers[index] > 0) {
        blockers[index] -= 1;
        if (blockers[index] === 0) frostCleared += 1;
      }
      const tile = boardAfterClear[index];
      if (!tile) continue;
      const objective = objectives.find((item) => item.kindIds.includes(tile.kind));
      if (objective) objective.collected = Math.min(objective.target, objective.collected + 1);
      boardAfterClear[index] = null;
    }
    working = {
      ...working,
      board: boardAfterClear,
      blockers,
      objectives,
      frostCleared,
      maxCascade: Math.max(working.maxCascade, cascade),
      specialsTriggered: working.specialsTriggered + expanded.specialsTriggered + (forcedClear ? [firstTile, secondTile].filter((tile) => tile.special).length : 0),
    };
    steps.push(step('clear', working, [...clearIndices], cascade));

    const collapsed = collapseBoard(working.board, working.rows, working.columns);
    working = { ...working, board: collapsed };
    steps.push(step('fall', working, [], cascade));

    const refilled = refillBoard(working.board, working.tileKinds, working.rngState, working.nextTileId);
    if (creation) {
      const creationColumn = creation.index % working.columns;
      const specialIndex = working.board.findIndex((tile, index) => !tile && index % working.columns === creationColumn);
      const specialTile = specialIndex >= 0 ? refilled.board[specialIndex] : null;
      if (specialTile) refilled.board[specialIndex] = { ...specialTile, kind: creation.kind, special: creation.special };
    }
    working = { ...working, board: refilled.board, rngState: refilled.rngState, nextTileId: refilled.nextTileId };
    steps.push(step('refill', working, [], cascade));
    forcedClear = null;
  }

  if (cascade >= 32 && findMatchRuns(working.board, working.rows, working.columns).length > 0) {
    const rebuilt = generateStableBoard(working.rows, working.columns, working.tileKinds, working.rngState, working.nextTileId);
    working = { ...working, board: rebuilt.board, rngState: rebuilt.rngState, nextTileId: rebuilt.nextTileId };
    steps.push(step('reshuffle', working, [], cascade));
  }

  const won = objectivesComplete(working);
  if (!won && !hasLegalMove(working.board, working.rows, working.columns)) {
    const reshuffled = reshuffleStableBoard(working);
    working = reshuffled.state;
    steps.push(step('reshuffle', working, [], cascade));
  }
  working = {
    ...working,
    status: won ? 'won' : working.movesRemaining <= 0 ? 'failed' : 'playing',
  };
  return { valid: true, state: working, steps };
}

export function findMatchRuns(board: Array<MatchThreeTile | null>, rows: number, columns: number): MatchRun[] {
  const runs: MatchRun[] = [];
  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    while (start < columns) {
      const tile = board[row * columns + start];
      let end = start + 1;
      while (tile && end < columns && board[row * columns + end]?.kind === tile.kind) end += 1;
      if (tile && end - start >= 3) runs.push({ direction: 'row', kind: tile.kind, indices: Array.from({ length: end - start }, (_, offset) => row * columns + start + offset) });
      start = end;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let start = 0;
    while (start < rows) {
      const tile = board[start * columns + column];
      let end = start + 1;
      while (tile && end < rows && board[end * columns + column]?.kind === tile.kind) end += 1;
      if (tile && end - start >= 3) runs.push({ direction: 'column', kind: tile.kind, indices: Array.from({ length: end - start }, (_, offset) => (start + offset) * columns + column) });
      start = end;
    }
  }
  return runs;
}

export function hasLegalMove(board: Array<MatchThreeTile | null>, rows: number, columns: number): boolean {
  for (let index = 0; index < board.length; index += 1) {
    const right = index % columns < columns - 1 ? index + 1 : -1;
    const down = index + columns < board.length ? index + columns : -1;
    for (const adjacent of [right, down]) {
      if (adjacent < 0 || !board[index] || !board[adjacent]) continue;
      if (board[index]?.special === 'prism' || board[adjacent]?.special === 'prism' || (board[index]?.special && board[adjacent]?.special)) return true;
      if (findMatchRuns(swapCells(board, index, adjacent), rows, columns).length > 0) return true;
    }
  }
  return false;
}

export function matchThreeObjectivesComplete(state: MatchThreeState): boolean {
  return objectivesComplete(state);
}

function objectivesComplete(state: MatchThreeState): boolean {
  return state.objectives.every((objective) => objective.collected >= objective.target) && state.frostCleared >= state.frostTarget;
}

function generateStableBoard(rows: number, columns: number, kinds: string[], seed: number, nextTileId: number) {
  let rngState = seed || 1;
  const board: MatchThreeTile[] = [];
  for (let index = 0; index < rows * columns; index += 1) {
    const excluded = new Set<string>();
    if (index % columns >= 2 && board[index - 1]?.kind === board[index - 2]?.kind) excluded.add(board[index - 1].kind);
    if (index >= columns * 2 && board[index - columns]?.kind === board[index - columns * 2]?.kind) excluded.add(board[index - columns].kind);
    const choices = kinds.filter((kind) => !excluded.has(kind));
    const random = nextRandom(rngState);
    rngState = random.state;
    board.push({ id: `m3-${nextTileId}`, kind: choices[Math.floor(random.value * choices.length)], special: null });
    nextTileId += 1;
  }
  return { board, rngState, nextTileId };
}

function chooseSpecialCreation(runs: MatchRun[], first: number, second: number, board: Array<MatchThreeTile | null>): SpecialCreation | null {
  const byKind = new Map<string, MatchRun[]>();
  for (const run of runs) byKind.set(run.kind, [...(byKind.get(run.kind) ?? []), run]);
  let best: { indices: Set<number>; special: MatchThreeSpecial; kind: string; rank: number } | null = null;
  for (const [kind, kindRuns] of byKind) {
    const connected = connectedRunGroups(kindRuns);
    for (const group of connected) {
      const indices = new Set(group.flatMap((run) => run.indices));
      const hasCross = group.some((run) => run.direction === 'row') && group.some((run) => run.direction === 'column');
      const maxLength = Math.max(...group.map((run) => run.indices.length));
      const special: MatchThreeSpecial | null = maxLength >= 5 ? 'prism' : hasCross ? 'burst' : maxLength >= 4 ? group[0].direction : null;
      const rank = special === 'prism' ? 3 : special === 'burst' ? 2 : special ? 1 : 0;
      if (special && (!best || rank > best.rank)) best = { indices, special, kind, rank };
    }
  }
  if (!best) return null;
  const available = [...best.indices].filter((index) => !board[index]?.special).sort((a, b) => a - b);
  const preferred = available.includes(second) ? second : available.includes(first) ? first : available[Math.floor(available.length / 2)] ?? [...best.indices][0];
  return { index: preferred, special: best.special, kind: best.kind };
}

function connectedRunGroups(runs: MatchRun[]): MatchRun[][] {
  const remaining = [...runs];
  const groups: MatchRun[][] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (remaining[index].indices.some((cell) => group.some((run) => run.indices.includes(cell)))) {
          group.push(remaining.splice(index, 1)[0]);
          changed = true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function expandSpecialClears(
  board: Array<MatchThreeTile | null>,
  initial: Set<number>,
  rows: number,
  columns: number,
  protectedIndices: Set<number>,
): { indices: Set<number>; specialsTriggered: number } {
  const indices = new Set(initial);
  const queue = [...initial];
  const activated = new Set<number>();
  while (queue.length) {
    const index = queue.shift()!;
    if (protectedIndices.has(index) || activated.has(index)) continue;
    const tile = board[index];
    if (!tile?.special) continue;
    activated.add(index);
    for (const target of specialArea(tile.special, index, rows, columns, board, tile.kind)) {
      if (!indices.has(target)) {
        indices.add(target);
        queue.push(target);
      }
    }
  }
  return { indices, specialsTriggered: activated.size };
}

function specialComboClear(board: Array<MatchThreeTile | null>, first: number, second: number, rows: number, columns: number): Set<number> {
  const a = board[first]!;
  const b = board[second]!;
  if (a.special === 'prism' && b.special === 'prism') return new Set(board.map((_, index) => index));
  const prismIndex = a.special === 'prism' ? first : b.special === 'prism' ? second : -1;
  if (prismIndex >= 0) {
    const otherIndex = prismIndex === first ? second : first;
    const other = board[otherIndex]!;
    const result = new Set<number>([prismIndex, otherIndex]);
    board.forEach((tile, index) => {
      if (tile?.kind !== other.kind) return;
      result.add(index);
      if (other.special && other.special !== 'prism') tile.special = other.special === 'row' || other.special === 'column' ? (index % 2 ? 'row' : 'column') : other.special;
    });
    return result;
  }
  const line = (special: MatchThreeSpecial | null) => special === 'row' || special === 'column';
  if (line(a.special) && line(b.special)) {
    return new Set([...rowIndices(first, columns), ...columnIndices(second, rows, columns), first, second]);
  }
  if ((line(a.special) && b.special === 'burst') || (line(b.special) && a.special === 'burst')) {
    const center = a.special === 'burst' ? first : second;
    const row = Math.floor(center / columns);
    const column = center % columns;
    const result = new Set<number>();
    for (let offset = -1; offset <= 1; offset += 1) {
      if (row + offset >= 0 && row + offset < rows) rowIndices((row + offset) * columns, columns).forEach((index) => result.add(index));
      if (column + offset >= 0 && column + offset < columns) columnIndices(column + offset, rows, columns).forEach((index) => result.add(index));
    }
    return result;
  }
  if (a.special === 'burst' && b.special === 'burst') {
    const centerRow = Math.floor(second / columns);
    const centerColumn = second % columns;
    const result = new Set<number>();
    for (let row = centerRow - 2; row <= centerRow + 2; row += 1) for (let column = centerColumn - 2; column <= centerColumn + 2; column += 1) if (row >= 0 && row < rows && column >= 0 && column < columns) result.add(row * columns + column);
    return result;
  }
  return new Set([first, second]);
}

function specialArea(special: MatchThreeSpecial, index: number, rows: number, columns: number, board: Array<MatchThreeTile | null>, kind: string): number[] {
  if (special === 'row') return rowIndices(index, columns);
  if (special === 'column') return columnIndices(index, rows, columns);
  if (special === 'prism') return board.flatMap((tile, tileIndex) => tile?.kind === kind ? [tileIndex] : []);
  const centerRow = Math.floor(index / columns);
  const centerColumn = index % columns;
  const result: number[] = [];
  for (let row = centerRow - 1; row <= centerRow + 1; row += 1) for (let column = centerColumn - 1; column <= centerColumn + 1; column += 1) if (row >= 0 && row < rows && column >= 0 && column < columns) result.push(row * columns + column);
  return result;
}

function collapseBoard(board: Array<MatchThreeTile | null>, rows: number, columns: number): Array<MatchThreeTile | null> {
  const next = Array.from({ length: board.length }, () => null as MatchThreeTile | null);
  for (let column = 0; column < columns; column += 1) {
    let writeRow = rows - 1;
    for (let row = rows - 1; row >= 0; row -= 1) {
      const tile = board[row * columns + column];
      if (tile) next[writeRow-- * columns + column] = tile;
    }
  }
  return next;
}

function refillBoard(board: Array<MatchThreeTile | null>, kinds: string[], rngState: number, nextTileId: number) {
  const next = cloneBoard(board);
  for (let index = 0; index < next.length; index += 1) {
    if (next[index]) continue;
    const random = nextRandom(rngState);
    rngState = random.state;
    next[index] = { id: `m3-${nextTileId++}`, kind: kinds[Math.floor(random.value * kinds.length)], special: null };
  }
  return { board: next, rngState, nextTileId };
}

function reshuffleStableBoard(state: MatchThreeState): { state: MatchThreeState } {
  let rngState = state.rngState;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const shuffled = seededShuffle(state.board.filter((tile): tile is MatchThreeTile => Boolean(tile)), rngState + attempt);
    rngState = shuffled.rngState;
    if (findMatchRuns(shuffled.values, state.rows, state.columns).length === 0 && hasLegalMove(shuffled.values, state.rows, state.columns)) {
      return { state: { ...state, board: shuffled.values, rngState } };
    }
  }
  const rebuilt = generateStableBoard(state.rows, state.columns, state.tileKinds, rngState, state.nextTileId);
  return { state: { ...state, board: rebuilt.board, rngState: rebuilt.rngState, nextTileId: rebuilt.nextTileId } };
}

function step(kind: MatchThreeResolutionStep['kind'], state: MatchThreeState, cleared: number[], cascade: number): MatchThreeResolutionStep {
  return { kind, board: cloneBoard(state.board), blockers: [...state.blockers], objectives: state.objectives.map((objective) => ({ ...objective })), cleared, cascade };
}

function swapCells(board: Array<MatchThreeTile | null>, first: number, second: number): Array<MatchThreeTile | null> {
  const next = cloneBoard(board);
  [next[first], next[second]] = [next[second], next[first]];
  return next;
}

function cloneBoard(board: Array<MatchThreeTile | null>): Array<MatchThreeTile | null> {
  return board.map((tile) => tile ? { ...tile } : null);
}

function areAdjacent(first: number, second: number, columns: number): boolean {
  const rowDistance = Math.abs(Math.floor(first / columns) - Math.floor(second / columns));
  const columnDistance = Math.abs((first % columns) - (second % columns));
  return rowDistance + columnDistance === 1;
}

function rowIndices(index: number, columns: number): number[] {
  const start = Math.floor(index / columns) * columns;
  return Array.from({ length: columns }, (_, offset) => start + offset);
}

function columnIndices(index: number, rows: number, columns: number): number[] {
  const column = index % columns;
  return Array.from({ length: rows }, (_, row) => row * columns + column);
}

function seededShuffle<T>(values: T[], seed: number): { values: T[]; rngState: number } {
  const result = [...values];
  let rngState = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rngState);
    rngState = random.state;
    const swapIndex = Math.floor(random.value * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return { values: result, rngState };
}

function nextRandom(state: number): { state: number; value: number } {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return { state: next, value: next / 4294967296 };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
