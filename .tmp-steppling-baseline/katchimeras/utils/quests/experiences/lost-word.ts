import { lostWordPuzzleById, selectLostWordPuzzle, type LostWordPuzzle } from './lost-word-puzzles';

export type LostWordLetterStatus = 'exact' | 'misplaced' | 'absent';
export type LostWordEvaluatedGuess = { word: string; statuses: LostWordLetterStatus[] };

export type LostWordRoundState = {
  puzzle: LostWordPuzzle;
  guesses: LostWordEvaluatedGuess[];
  currentGuess: string;
  maxGuesses: 6;
  startedAt: number;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  hintUnlockAfter: number | null;
  hintUsed: boolean;
  error: 'not_enough_letters' | 'already_guessed' | null;
};

export type LostWordAction =
  | { type: 'start_round'; startedAt: number }
  | { type: 'letter'; letter: string }
  | { type: 'backspace' }
  | { type: 'submit' }
  | { type: 'use_hint' }
  | { type: 'clear_error' };

export function createLostWordRound(input: {
  seed: string;
  recentPuzzleIds?: string[];
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  hintUnlockAfter: number | null;
  startedAt?: number;
  puzzleId?: string;
}): LostWordRoundState {
  const selected = selectLostWordPuzzle(input.seed, input.recentPuzzleIds);
  const puzzle = input.puzzleId
    ? lostWordPuzzleById(input.puzzleId) ?? selected
    : selected;
  return {
    puzzle,
    guesses: [],
    currentGuess: '',
    maxGuesses: 6,
    startedAt: input.startedAt ?? Date.now(),
    difficultyTier: input.difficultyTier,
    hintUnlockAfter: input.hintUnlockAfter,
    hintUsed: false,
    error: null,
  };
}

export function lostWordReducer(state: LostWordRoundState, action: LostWordAction): LostWordRoundState {
  if (action.type === 'start_round') {
    return { ...state, guesses: [], currentGuess: '', startedAt: action.startedAt, hintUsed: false, error: null };
  }
  if (lostWordRoundComplete(state)) return state;
  if (action.type === 'letter') {
    const letter = action.letter.toLowerCase();
    if (!/^[a-z]$/.test(letter) || state.currentGuess.length >= 5) return state;
    return { ...state, currentGuess: `${state.currentGuess}${letter}`, error: null };
  }
  if (action.type === 'backspace') return { ...state, currentGuess: state.currentGuess.slice(0, -1), error: null };
  if (action.type === 'clear_error') return { ...state, error: null };
  if (action.type === 'use_hint') {
    if (!lostWordHintAvailable(state)) return state;
    return { ...state, hintUsed: true, error: null };
  }
  if (state.currentGuess.length !== 5) return { ...state, error: 'not_enough_letters' };
  if (state.guesses.some((guess) => guess.word === state.currentGuess)) return { ...state, error: 'already_guessed' };
  return {
    ...state,
    guesses: [...state.guesses, evaluateLostWordGuess(state.currentGuess, state.puzzle.answer)],
    currentGuess: '',
    error: null,
  };
}

export function evaluateLostWordGuess(guess: string, answer: string): LostWordEvaluatedGuess {
  const normalizedGuess = guess.toLowerCase();
  const normalizedAnswer = answer.toLowerCase();
  const statuses: LostWordLetterStatus[] = Array.from({ length: normalizedAnswer.length }, () => 'absent');
  const remaining = new Map<string, number>();
  for (let index = 0; index < normalizedAnswer.length; index += 1) {
    if (normalizedGuess[index] === normalizedAnswer[index]) statuses[index] = 'exact';
    else remaining.set(normalizedAnswer[index], (remaining.get(normalizedAnswer[index]) ?? 0) + 1);
  }
  for (let index = 0; index < normalizedGuess.length; index += 1) {
    if (statuses[index] === 'exact') continue;
    const letter = normalizedGuess[index];
    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      statuses[index] = 'misplaced';
      remaining.set(letter, count - 1);
    }
  }
  return { word: normalizedGuess, statuses };
}

export function lostWordSolved(state: LostWordRoundState): boolean {
  return state.guesses.some((guess) => guess.word === state.puzzle.answer);
}

export function lostWordRoundComplete(state: LostWordRoundState): boolean {
  return lostWordSolved(state) || state.guesses.length >= state.maxGuesses;
}

export function lostWordHintAvailable(state: LostWordRoundState): boolean {
  return state.difficultyTier === 5 && !state.hintUsed && state.hintUnlockAfter !== null && state.guesses.length >= state.hintUnlockAfter;
}

export function lostWordClue(state: LostWordRoundState): { label: string; text: string } {
  if (state.difficultyTier === 1) return { label: `FIRST LETTER · ${state.puzzle.answer[0].toUpperCase()}`, text: state.puzzle.clue };
  if (state.difficultyTier === 2) return { label: 'CLUE', text: state.puzzle.clue };
  if (state.difficultyTier === 3) return { label: 'CLUE', text: state.puzzle.broadClue };
  if (state.hintUsed || (state.difficultyTier === 4 && state.guesses.length >= 2)) return { label: 'CLUE', text: state.puzzle.clue };
  return { label: 'CATEGORY', text: categoryLabel(state.puzzle.category) };
}

export function lostWordKeyboardStatuses(state: LostWordRoundState): Record<string, LostWordLetterStatus> {
  const rank: Record<LostWordLetterStatus, number> = { absent: 1, misplaced: 2, exact: 3 };
  const result: Record<string, LostWordLetterStatus> = {};
  for (const guess of state.guesses) {
    guess.word.split('').forEach((letter, index) => {
      const status = guess.statuses[index];
      if (!result[letter] || rank[status] > rank[result[letter]]) result[letter] = status;
    });
  }
  return result;
}

function categoryLabel(category: LostWordPuzzle['category']): string {
  if (category === 'books') return 'Books and reading';
  if (category === 'writing') return 'Writing and language';
  if (category === 'stories') return 'Stories and adventures';
  if (category === 'genres') return 'Kinds of stories';
  return 'Imagination';
}
