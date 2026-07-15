import { selectWordPathPuzzle, wordPathPuzzleById, type WordPathPuzzle } from './word-paths-puzzles';

export type WordPathFeedback = 'target' | 'bonus' | 'invalid' | 'already_found' | 'too_short' | null;

export type WordPathRoundState = {
  puzzle: WordPathPuzzle;
  foundWords: string[];
  bonusWordsFound: string[];
  trace: number[];
  submissions: number;
  hintsUsed: number;
  hintedCells: string[];
  shuffleOrder: number[];
  shuffleCount: number;
  feedback: WordPathFeedback;
  lastSubmittedWord: string | null;
  startedAt: number;
};

export type WordPathAction =
  | { type: 'replace'; state: WordPathRoundState }
  | { type: 'start_round'; startedAt: number }
  | { type: 'trace_letter'; index: number }
  | { type: 'clear_trace' }
  | { type: 'submit' }
  | { type: 'shuffle' }
  | { type: 'hint' }
  | { type: 'clear_feedback' };

export function createWordPathRound(input: {
  seed: string;
  recentPuzzleIds?: string[];
  puzzleId?: string;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
}): WordPathRoundState {
  const selected = selectWordPathPuzzle(input.seed, input.recentPuzzleIds, input.difficultyTier);
  const puzzle = input.puzzleId ? wordPathPuzzleById(input.puzzleId) ?? selected : selected;
  return {
    puzzle,
    foundWords: [],
    bonusWordsFound: [],
    trace: [],
    submissions: 0,
    hintsUsed: 0,
    hintedCells: [],
    shuffleOrder: puzzle.letters.map((_, index) => index),
    shuffleCount: 0,
    feedback: null,
    lastSubmittedWord: null,
    startedAt: 0,
  };
}

export function wordPathReducer(state: WordPathRoundState, action: WordPathAction): WordPathRoundState {
  if (action.type === 'replace') return action.state;
  if (action.type === 'start_round') return { ...state, startedAt: action.startedAt };
  if (action.type === 'clear_feedback') return { ...state, feedback: null, lastSubmittedWord: null };
  if (action.type === 'clear_trace') return { ...state, trace: [] };
  if (action.type === 'trace_letter') {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.puzzle.letters.length) return state;
    const previous = state.trace[state.trace.length - 2];
    if (previous === action.index) return { ...state, trace: state.trace.slice(0, -1), feedback: null };
    if (state.trace.includes(action.index)) return state;
    return { ...state, trace: [...state.trace, action.index], feedback: null };
  }
  if (action.type === 'shuffle') {
    const nextCount = state.shuffleCount + 1;
    return { ...state, shuffleCount: nextCount, shuffleOrder: rotateAndReverse(state.shuffleOrder, nextCount), trace: [], feedback: null };
  }
  if (action.type === 'hint') {
    if (state.hintsUsed >= 1 || wordPathRoundComplete(state)) return state;
    const hidden = wordPathGridCells(state.puzzle).filter((cell) => !wordPathCellRevealed(state, cell.key));
    if (!hidden.length) return state;
    const chosen = hidden[stableHash(`${state.puzzle.id}:hint:${state.hintsUsed}`) % hidden.length];
    return { ...state, hintsUsed: state.hintsUsed + 1, hintedCells: [...state.hintedCells, chosen.key], feedback: null };
  }
  if (action.type === 'submit') {
    const word = wordPathCurrentWord(state);
    const common = { trace: [] as number[], lastSubmittedWord: word || null };
    if (word.length < 3) return { ...state, ...common, feedback: 'too_short' };
    if (state.foundWords.includes(word) || state.bonusWordsFound.includes(word)) return { ...state, ...common, submissions: state.submissions + 1, feedback: 'already_found' };
    if (state.puzzle.words.includes(word)) return { ...state, ...common, foundWords: [...state.foundWords, word], submissions: state.submissions + 1, feedback: 'target' };
    if (state.puzzle.bonusWords.includes(word)) return { ...state, ...common, bonusWordsFound: [...state.bonusWordsFound, word], submissions: state.submissions + 1, feedback: 'bonus' };
    return { ...state, ...common, submissions: state.submissions + 1, feedback: 'invalid' };
  }
  return state;
}

export function wordPathCurrentWord(state: WordPathRoundState): string {
  return state.trace.map((index) => state.puzzle.letters[index] ?? '').join('');
}

export function wordPathRoundComplete(state: WordPathRoundState): boolean {
  return state.foundWords.length === state.puzzle.words.length;
}

export function wordPathCellRevealed(state: WordPathRoundState, key: string): boolean {
  if (state.hintedCells.includes(key)) return true;
  return state.puzzle.placements.some((placement) => state.foundWords.includes(placement.word) && placementKeys(placement).includes(key));
}

export function wordPathGridCells(puzzle: WordPathPuzzle): { key: string; row: number; column: number; letter: string; words: string[] }[] {
  const result = new Map<string, { key: string; row: number; column: number; letter: string; words: string[] }>();
  for (const placement of puzzle.placements) {
    placement.word.split('').forEach((letter, offset) => {
      const row = placement.row + (placement.direction === 'down' ? offset : 0);
      const column = placement.column + (placement.direction === 'across' ? offset : 0);
      const key = `${row}:${column}`;
      const current = result.get(key);
      result.set(key, current ? { ...current, words: [...current.words, placement.word] } : { key, row, column, letter, words: [placement.word] });
    });
  }
  return [...result.values()];
}

export function wordPathLetterAtPoint(x: number, y: number, positions: { x: number; y: number }[], radius: number): number {
  let closest = -1;
  let bestDistance = radius * radius;
  positions.forEach((point, index) => {
    const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (distance <= bestDistance) {
      closest = index;
      bestDistance = distance;
    }
  });
  return closest;
}

function placementKeys(placement: WordPathPuzzle['placements'][number]): string[] {
  return placement.word.split('').map((_, offset) => `${placement.row + (placement.direction === 'down' ? offset : 0)}:${placement.column + (placement.direction === 'across' ? offset : 0)}`);
}

function rotateAndReverse(order: number[], count: number): number[] {
  const source = count % 2 ? [...order].reverse() : [...order];
  const shift = count % source.length;
  return [...source.slice(shift), ...source.slice(0, shift)];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
