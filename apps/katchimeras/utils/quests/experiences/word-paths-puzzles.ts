export type WordPathDirection = 'across' | 'down';

export type WordPathPlacement = {
  word: string;
  row: number;
  column: number;
  direction: WordPathDirection;
};

export type WordPathPuzzle = {
  id: string;
  letters: string[];
  words: string[];
  bonusWords: string[];
  placements: WordPathPlacement[];
  rows: number;
  columns: number;
  tier: 1 | 2 | 3 | 4 | 5;
};

type RawPuzzle = [letters: string, words: string, bonus?: string];

const RAW_PUZZLES: RawPuzzle[] = [
  ['EAST', 'EAST SEAT EATS TEAS', 'EAT TEA SEA SET SAT'],
  ['STOP', 'STOP POST POTS SPOT', 'TOP POT OPT'],
  ['TEAM', 'TEAM MATE MEAT TAME', 'TEA EAT'],
  ['CARE', 'CARE RACE ACRE', 'CAR ARC'],
  ['NOTE', 'NOTE TONE', 'ONE TON TOE'],
  ['SALE', 'SALE SEAL', 'SEA LEA'],
  ['RATE', 'RATE TEAR', 'ART EAR'],
  ['READ', 'READ DEAR DARE', 'RED'],
  ['PALE', 'PALE LEAP PLEA', 'PEA'],
  ['ROSE', 'ROSE SORE', 'ORE'],
  ['LATE', 'LATE TALE TEAL', 'EAT TEA'],
  ['SAND', 'SAND AND', 'SAD'],
  ['STONE', 'STONE NOTES TONES ONSET', 'NOTE TONE ONES'],
  ['ANGEL', 'ANGEL ANGLE GLEAN LEAN LANE', 'GALE'],
  ['HEART', 'HEART EARTH HATER HEAR RATE', 'HEAT'],
  ['LEAST', 'LEAST STALE STEAL TALES SALE', 'TALE SEAL'],
  ['TRACE', 'TRACE CRATE REACT CARE RACE', 'CART'],
  ['BREAD', 'BREAD BEARD BARED READ DEAR', 'BARE'],
  ['BELOW', 'BELOW ELBOW BLOW BOWL', 'LOW BOW'],
  ['THING', 'THING NIGHT THIN HINT', 'HIT'],
  ['SPEAR', 'SPEAR SPARE PEARS REAPS PEAR', 'EARS'],
  ['RATES', 'RATES STARE TEARS TARES RATE', 'EARS'],
  ['ACRES', 'ACRES SCARE CARES RACES CARE', 'RACE'],
  ['ARISE', 'ARISE RAISE RISE SIRE', 'SEA'],
  ['ALERT', 'ALERT ALTER LATER TALE RATE', 'TEAR'],
  ['TREAD', 'TREAD TRADE RATED DATE READ', 'DARE'],
  ['STEAM', 'STEAM MEATS TEAMS TAMES MATE', 'MEAT'],
  ['DREAM', 'DREAM ARMED DAME DEAR', 'READ'],
  ['PAINT', 'PAINT PINT PAIN ANTI', 'PIN'],
  ['TRAIN', 'TRAIN RAIN ANTI', 'TAN'],
  ['PLANE', 'PLANE PANEL PENAL LEAP PALE', 'PLEA'],
  ['LEMON', 'LEMON MELON LONE MOLE', 'ONE'],
  ['SHORE', 'SHORE HORSE HERO ROSE', 'SORE'],
  ['STORE', 'STORE TORE SORE ROSE', 'REST'],
  ['SCORE', 'SCORE CORES ROSE', 'CORE'],
  ['CLOUD', 'CLOUD COULD LOUD COLD', 'CLOD'],
  ['CHAIR', 'CHAIR HAIR RICH', 'AIR'],
  ['CIDER', 'CIDER CRIED RICE RIDE', 'DICE'],
  ['SPICE', 'SPICE EPICS PICS', 'PIE'],
  ['CLOSE', 'CLOSE LOSE', 'SOLE'],
  ['MOUSE', 'MOUSE MUSE SOME', 'SUM'],
  ['HOUSE', 'HOUSE SHOE HOSE', 'USE'],
  ['CAUSE', 'CAUSE CASE', 'CUE USE'],
  ['QUIET', 'QUIET QUITE QUIT', 'TIE'],
  ['QUEST', 'QUEST SUET', 'USE SET'],
  ['LIGHT', 'LIGHT LIT HIT', 'GIT'],
  ['WORLD', 'WORLD WORD LORD', 'ROW'],
  ['WORDS', 'WORDS SWORD WORD', 'SOW'],
  ['SHELF', 'SHELF SELF', 'SHE'],
  ['BOOKS', 'BOOKS BOOK', 'BOO'],
  ['STORY', 'STORY SORT', 'TOY'],
  ['WRITE', 'WRITE WIRE TIRE', 'TIE'],
  ['READS', 'READS DEARS DARES READ', 'DARE'],
  ['NOVEL', 'NOVEL LOVE LONE', 'ONE'],
  ['POEMS', 'POEMS POSE SOME', 'MOP'],
  ['VERSE', 'VERSE EVER SEER', 'EVE'],
  ['PROSE', 'PROSE ROPE POSE', 'SORE'],
  ['TALES', 'TALES STALE STEAL LEAST SALE', 'TALE'],
  ['PAGES', 'PAGES PAGE SAGE', 'PEA'],
  ['INKED', 'INKED KIND DINE', 'INK'],
  ['GLOW', 'GLOW LOW OWL', 'LOG'],
  ['MINT', 'MINT TIN NIT', 'MIN'],
  ['FIRE', 'FIRE RIFE IRE', 'FIR'],
  ['LION', 'LION LOIN OIL', 'ION'],
  ['BARK', 'BARK BAR ARK', 'BRA'],
  ['COAT', 'COAT TACO OAT', 'CAT ACT'],
  ['TURN', 'TURN RUNT URN', 'NUT RUN TUN'],
  ['PEAR', 'PEAR REAP PARE', 'RAPE PEA EAR'],
  ['SINK', 'SINK SKIN INK', 'KIN SIN'],
  ['PLANET', 'PLANET PLATE PLANE PANEL PENAL', 'LEAP PALE PEAL PLEA LANE LATE'],
  ['STREAM', 'STREAM MASTER TEAMS MEATS STEAM', 'STARE RATES TEARS TAMES'],
  ['LISTEN', 'LISTEN SILENT ENLIST INLETS LINES', 'LIENS TILES TINES'],
  ['GARDEN', 'GARDEN DANGER RANGED GRADE NEAR', 'DEAR GEAR DARE READ'],
  ['CREDIT', 'CREDIT DIRECT CITED CRIED TIRED', 'TRIED RIDE DIRE'],
  ['ORANGE', 'ORANGE RANGE ANGER ORGAN GONE', 'GORE GEAR NEAR'],
  ['HEARTS', 'HEARTS EARTH HATER SHARE HEAR', 'HEAT RATE STAR'],
  ['CASTLE', 'CASTLE CLEATS STALE LEAST SLATE', 'TALES SALE SEAL'],
  ['CANDLE', 'CANDLE LACED DANCE CLEAN DEAL', 'LACE LANE CLAD LEND'],
  ['FRIEND', 'FRIEND FINDER FINED FIRED DIRE', 'RIDE FIND FERN REIN'],
  ['BRIGHT', 'BRIGHT BIRTH RIGHT GIRTH GRIT', 'BRIG BIG RIB'],
  ['POWERS', 'POWERS PROSE ROPES PORES SORE', 'ROSE POSE ROWS'],
  ['MARKET', 'MARKET TAKER RATE TEAR TEAM', 'MATE TAME TERM'],
  ['FAMILY', 'FAMILY FILM FAIL MAIL LAY', 'MAY YAM FLY'],
  ['SPRING', 'SPRING GRINS RINGS GRIN SIGN', 'SING PINS SPIN'],
  ['FLOWER', 'FLOWER LOWER FOWLER FLOW WOLF', 'ROLE LORE WORE'],
  ['SILVER', 'SILVER LIVES VEILS LIVER RIVES', 'RISE SIRE VILE'],
  ['TRAVEL', 'TRAVEL ALERT ALTER LATER TALE', 'RATE REAL LATE'],
  ['WINTER', 'WINTER TWINE WRITE TIRE WIRE', 'TWIN WENT RENT'],
  ['RESCUE', 'RESCUE CURSE REUSE CURES USER', 'SURE RUSE SEER'],
  ['PLAYER', 'PLAYER REPLAY LAYER EARLY RELAY', 'PALE LEAP PLEA'],
  ['THREAD', 'THREAD HATRED TREAD HEART EARTH', 'HEARD DEAR READ'],
  ['COURSE', 'COURSE SOURCE CORES SCORE CURE', 'SORE ROSE SURE'],
  ['DETAIL', 'DETAIL TAILED TIDAL DEALT IDEAL', 'TALE LATE TILE'],
  ['BEACON', 'BEACON OCEAN CANOE BONE CONE', 'ONCE BANE BEAN'],
];

const FOUR_LETTER_TIER_TWO = new Set(['EAST', 'STOP', 'TEAM', 'CARE', 'NOTE', 'RATE', 'LATE', 'COAT', 'TURN', 'PEAR', 'SINK']);

const EXTRA_WORDS: Record<string, string> = {
  BELOW: 'OWE WEB WOE',
  THING: 'TIN GIN',
  ARISE: 'AIR SIR',
  DREAM: 'DARE MADE MARE',
  PAINT: 'ANT TAN NAP',
  TRAIN: 'RANT TARN TIN ANT',
  LEMON: 'OMEN NOEL MEN',
  SHORE: 'HERS HER ORE',
  STORE: 'SORT SET',
  SCORE: 'CORE ORES ROES SORE',
  CLOUD: 'CUD DUO OLD',
  CHAIR: 'ARCH CHAR CAR',
  CIDER: 'DIRE ICED',
  SPICE: 'PIES EPIC SPEC',
  MOUSE: 'EMUS USE',
  HOUSE: 'HUES HOES',
  CAUSE: 'CUES SAUCE',
  LIGHT: 'GILT HILT',
  WORLD: 'LOW OLD',
  WORDS: 'ROW ROD',
  STORY: 'TRY ROT SOT',
  WRITE: 'WIT WET IRE',
  READS: 'DEAR SEAR EARS',
  NOVEL: 'OVEN NOEL',
  POEMS: 'POEM OPS',
  VERSE: 'VEER REVS',
  PROSE: 'ROSE ORES',
  PAGES: 'GAP GAS AGES',
  INKED: 'DEN DIN KIN',
};

export const WORD_PATH_PUZZLES: WordPathPuzzle[] = RAW_PUZZLES.map((raw, index) =>
  makePuzzle(raw, index),
);

export function selectWordPathPuzzle(seed: string, recentPuzzleIds: string[] = [], tier = 5): WordPathPuzzle {
  const playable = WORD_PATH_PUZZLES.filter(isPlayablePuzzle);
  const tierPool = playable.filter((puzzle) => puzzle.tier === tier);
  const eligible = tierPool.length ? tierPool : playable.filter((puzzle) => puzzle.tier <= tier);
  const recent = new Set(recentPuzzleIds);
  const fresh = eligible.filter((puzzle) => !recent.has(puzzle.id));
  const pool = fresh.length ? fresh : eligible;
  return pool[stableHash(seed) % pool.length];
}

export function wordPathPuzzleById(id: string): WordPathPuzzle | null {
  return WORD_PATH_PUZZLES.find((puzzle) => puzzle.id === id) ?? null;
}

export function validateWordPathPuzzles(puzzles: WordPathPuzzle[] = WORD_PATH_PUZZLES): string[] {
  const errors: string[] = [];
  if (puzzles.length < 60) errors.push('Word Paths requires at least 60 puzzles');
  if (new Set(puzzles.map((puzzle) => puzzle.id)).size !== puzzles.length) errors.push('Puzzle IDs must be unique');
  for (let tier = 1; tier <= 5; tier += 1) {
    const playable = puzzles.filter((puzzle) => puzzle.tier === tier && isPlayablePuzzle(puzzle));
    if (playable.length < 5) errors.push(`Tier ${tier} needs at least five playable puzzles`);
  }
  for (const puzzle of puzzles) {
    if (puzzle.letters.length < 4 || puzzle.letters.length > 6) errors.push(`${puzzle.id}: letter count must be 4-6`);
    if (new Set(puzzle.words).size !== puzzle.words.length) errors.push(`${puzzle.id}: solution words must be unique`);
    if (puzzle.words.length < 2) errors.push(`${puzzle.id}: needs at least two solution words`);
    if (isPlayablePuzzle(puzzle) && !matchesTierShape(puzzle)) errors.push(`${puzzle.id}: puzzle shape does not match tier ${puzzle.tier}`);
    for (const word of [...puzzle.words, ...puzzle.bonusWords]) {
      if (word.length < 3 || word.length > puzzle.letters.length || !canBuildWord(word, puzzle.letters)) errors.push(`${puzzle.id}: cannot build ${word}`);
    }
    if (puzzle.placements.length !== puzzle.words.length) errors.push(`${puzzle.id}: every word needs a placement`);
    const cells = new Map<string, string>();
    for (const placement of puzzle.placements) {
      placement.word.split('').forEach((letter, offset) => {
        const row = placement.row + (placement.direction === 'down' ? offset : 0);
        const column = placement.column + (placement.direction === 'across' ? offset : 0);
        if (row < 0 || column < 0 || row >= puzzle.rows || column >= puzzle.columns) errors.push(`${puzzle.id}: ${placement.word} is out of bounds`);
        const key = `${row}:${column}`;
        const existing = cells.get(key);
        if (existing && existing !== letter) errors.push(`${puzzle.id}: conflicting cell ${key}`);
        cells.set(key, letter);
      });
    }
    const declaredRuns = new Set(puzzle.placements.map((placement) => `${placement.direction}:${placement.row}:${placement.column}:${placement.word}`));
    const actualRuns = crosswordRuns(cells, puzzle.rows, puzzle.columns);
    for (const run of actualRuns) {
      const key = `${run.direction}:${run.row}:${run.column}:${run.word}`;
      if (!declaredRuns.has(key)) errors.push(`${puzzle.id}: unintended ${run.direction} word ${run.word} at ${run.row}:${run.column}`);
    }
    for (const run of declaredRuns) if (!actualRuns.some((actual) => `${actual.direction}:${actual.row}:${actual.column}:${actual.word}` === run)) errors.push(`${puzzle.id}: declared placement is not a complete crossword run: ${run}`);
  }
  return errors;
}

function makePuzzle([lettersInput, wordsInput, bonusInput = '']: RawPuzzle, index: number): WordPathPuzzle {
  const letters = lettersInput.toLowerCase().split('');
  const originalWords = wordsInput.toLowerCase().split(/\s+/).filter(Boolean);
  const originalBonusWords = bonusInput.toLowerCase().split(/\s+/).filter(Boolean);
  const extraWords = (EXTRA_WORDS[lettersInput] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = [...new Set([...originalWords, ...originalBonusWords, ...extraWords])];
  const tier = puzzleTier(lettersInput, candidates.length, index);
  const requiredWords = tierWordCount(tier);
  const playable = candidates.length >= requiredWords;
  const targetCount = playable ? requiredWords : originalWords.length;
  const words = candidates.slice(0, targetCount);
  const bonusWords = candidates.slice(targetCount);
  const layout = buildCrossword(words);
  return { id: `pagelet-word-paths-${String(index + 1).padStart(3, '0')}`, letters, words, bonusWords, ...layout, tier };
}

function puzzleTier(letters: string, candidateCount: number, index: number): 1 | 2 | 3 | 4 | 5 {
  if (letters.length === 4) return FOUR_LETTER_TIER_TWO.has(letters) && candidateCount >= 5 ? 2 : 1;
  if (letters.length === 5) return candidateCount >= 7 && index % 2 === 0 ? 4 : 3;
  return 5;
}

function tierWordCount(tier: WordPathPuzzle['tier']): number {
  return [4, 5, 6, 7, 8][tier - 1];
}

function tierLetterCount(tier: WordPathPuzzle['tier']): number {
  return tier <= 2 ? 4 : tier <= 4 ? 5 : 6;
}

function matchesTierShape(puzzle: WordPathPuzzle): boolean {
  return puzzle.letters.length === tierLetterCount(puzzle.tier) && puzzle.words.length === tierWordCount(puzzle.tier);
}

function isPlayablePuzzle(puzzle: WordPathPuzzle): boolean {
  return matchesTierShape(puzzle);
}

function buildCrossword(words: string[]): Pick<WordPathPuzzle, 'placements' | 'rows' | 'columns'> {
  const size = 15;
  const middle = Math.floor(size / 2);
  let placements: WordPathPlacement[] | null = null;
  for (const firstWord of words) {
    const first = { word: firstWord, row: middle, column: middle - Math.floor(firstWord.length / 2), direction: 'across' as const };
    placements = placeRemainingWords(words.filter((word) => word !== firstWord), [first], placementCells(first), size);
    if (placements) break;
  }
  if (!placements) throw new Error(`Unable to lay out Word Paths puzzle: ${words.join(', ')}`);
  const cells = new Map<string, string>();
  for (const placement of placements) for (const [key, letter] of placementCells(placement)) cells.set(key, letter);
  let minRow = size;
  let minColumn = size;
  let maxRow = 0;
  let maxColumn = 0;
  for (const key of cells.keys()) {
    const [row, column] = key.split(':').map(Number);
    minRow = Math.min(minRow, row);
    minColumn = Math.min(minColumn, column);
    maxRow = Math.max(maxRow, row);
    maxColumn = Math.max(maxColumn, column);
  }
  return {
    placements: placements.map((placement) => ({ ...placement, row: placement.row - minRow, column: placement.column - minColumn })),
    rows: maxRow - minRow + 1,
    columns: maxColumn - minColumn + 1,
  };
}

function placeRemainingWords(remaining: string[], placements: WordPathPlacement[], cells: Map<string, string>, size: number): WordPathPlacement[] | null {
  if (!remaining.length) return placements;
  for (let remainingIndex = 0; remainingIndex < remaining.length; remainingIndex += 1) {
    const word = remaining[remainingIndex];
    const candidates = placementCandidates(word, placements).filter((candidate) => canPlace(candidate, cells, placements, size));
    for (const candidate of candidates) {
      const nextCells = new Map(cells);
      for (const [key, letter] of placementCells(candidate)) nextCells.set(key, letter);
      const result = placeRemainingWords(
        remaining.filter((_, index) => index !== remainingIndex),
        [...placements, candidate],
        nextCells,
        size,
      );
      if (result) return result;
    }
  }
  return null;
}

function placementCandidates(word: string, placements: WordPathPlacement[]): WordPathPlacement[] {
  const candidates = new Map<string, WordPathPlacement>();
  for (const placed of placements) {
    for (let placedIndex = 0; placedIndex < placed.word.length; placedIndex += 1) {
      for (let wordIndex = 0; wordIndex < word.length; wordIndex += 1) {
        if (placed.word[placedIndex] !== word[wordIndex]) continue;
        const crossingRow = placed.row + (placed.direction === 'down' ? placedIndex : 0);
        const crossingColumn = placed.column + (placed.direction === 'across' ? placedIndex : 0);
        const direction: WordPathDirection = placed.direction === 'across' ? 'down' : 'across';
        const candidate = {
          word,
          direction,
          row: crossingRow - (direction === 'down' ? wordIndex : 0),
          column: crossingColumn - (direction === 'across' ? wordIndex : 0),
        };
        candidates.set(`${candidate.direction}:${candidate.row}:${candidate.column}`, candidate);
      }
    }
  }
  return [...candidates.values()];
}

function canPlace(placement: WordPathPlacement, cells: Map<string, string>, placements: WordPathPlacement[], size: number): boolean {
  const beforeRow = placement.row - (placement.direction === 'down' ? 1 : 0);
  const beforeColumn = placement.column - (placement.direction === 'across' ? 1 : 0);
  const afterRow = placement.row + (placement.direction === 'down' ? placement.word.length : 0);
  const afterColumn = placement.column + (placement.direction === 'across' ? placement.word.length : 0);
  if (cells.has(`${beforeRow}:${beforeColumn}`) || cells.has(`${afterRow}:${afterColumn}`)) return false;
  let overlaps = 0;
  for (const [key, letter] of placementCells(placement)) {
    const [row, column] = key.split(':').map(Number);
    if (row < 0 || column < 0 || row >= size || column >= size) return false;
    const existing = cells.get(key);
    if (existing && existing !== letter) return false;
    if (existing === letter) {
      if (placements.some((item) => item.direction === placement.direction && placementContains(item, row, column))) return false;
      overlaps += 1;
      continue;
    }
    const perpendicularNeighbours = placement.direction === 'across'
      ? [`${row - 1}:${column}`, `${row + 1}:${column}`]
      : [`${row}:${column - 1}`, `${row}:${column + 1}`];
    if (perpendicularNeighbours.some((neighbour) => cells.has(neighbour))) return false;
  }
  return overlaps > 0;
}

function placementContains(placement: WordPathPlacement, row: number, column: number): boolean {
  if (placement.direction === 'across') return row === placement.row && column >= placement.column && column < placement.column + placement.word.length;
  return column === placement.column && row >= placement.row && row < placement.row + placement.word.length;
}

function placementCells(placement: WordPathPlacement): Map<string, string> {
  const cells = new Map<string, string>();
  placement.word.split('').forEach((letter, offset) => {
    const row = placement.row + (placement.direction === 'down' ? offset : 0);
    const column = placement.column + (placement.direction === 'across' ? offset : 0);
    cells.set(`${row}:${column}`, letter);
  });
  return cells;
}

function crosswordRuns(cells: Map<string, string>, rows: number, columns: number): WordPathPlacement[] {
  const runs: WordPathPlacement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!cells.has(`${row}:${column}`)) continue;
      if (!cells.has(`${row}:${column - 1}`)) {
        let word = '';
        for (let cursor = column; cells.has(`${row}:${cursor}`); cursor += 1) word += cells.get(`${row}:${cursor}`);
        if (word.length >= 2) runs.push({ word, row, column, direction: 'across' });
      }
      if (!cells.has(`${row - 1}:${column}`)) {
        let word = '';
        for (let cursor = row; cells.has(`${cursor}:${column}`); cursor += 1) word += cells.get(`${cursor}:${column}`);
        if (word.length >= 2) runs.push({ word, row, column, direction: 'down' });
      }
    }
  }
  return runs;
}

function canBuildWord(word: string, letters: string[]): boolean {
  const remaining = [...letters];
  return word.split('').every((letter) => {
    const index = remaining.indexOf(letter);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
