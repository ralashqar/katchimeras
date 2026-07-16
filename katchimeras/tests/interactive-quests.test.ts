import assert from 'node:assert/strict';
import test from 'node:test';

import { completedQuestCount, resolveBlockJamConfig, resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig, resolveWordPathsDifficulty } from '@/utils/quests/experiences/difficulty';
import { BLOCK_JAM_RULESET, availableBlockJamDoor, blockJamOccupancy, blockJamPath, blockJamReducer, createBlockJamState, reachableBlockJamAnchors, TASKLET_DESK_JAM_LEVELS, validateBlockJamLevel, type BlockJamLevel } from '@/utils/quests/experiences/block-jam';
import { BLOCK_BLAST_BOARD_SIZE, BLOCK_BLAST_RULESET, BLOCK_BLAST_SHAPES, blockBlastClearCascadePhase, blockBlastReducer, blockBlastShapeIsConnected, blockBlastShapeIsNormalised, canPlaceBlockBlastPiece, createBlockBlastState, generateBlockBlastTray, nearestBlockBlastOrigin, nearestSnappedBlockBlastOrigin, projectedBlockBlastLines, type BlockBlastPiece, type BlockBlastState } from '@/utils/quests/experiences/block-blast';
import { canMergeItems, createMergeRound, FEASTLE_MERGE_ITEMS, MERGE_BOARD_COLUMNS, MERGE_BOARD_ROWS, MERGE_BOARD_SIZE, mergeBoardCellFromPoint, mergeRoundMinimumActions, mergeRoundReducer, readyOrderForItem, selectPantrySpawnCell, validateMergePack, type MergeRoundState } from '@/utils/quests/experiences/merge';
import { evaluateLostWordGuess, createLostWordRound, lostWordReducer, lostWordRoundComplete } from '@/utils/quests/experiences/lost-word';
import { LOST_WORD_PUZZLES, selectLostWordPuzzle, validateLostWordPuzzles } from '@/utils/quests/experiences/lost-word-puzzles';
import { createWordPathRound, wordPathCellRevealed, wordPathLetterAtPoint, wordPathReducer, wordPathRoundComplete } from '@/utils/quests/experiences/word-paths';
import { selectWordPathPuzzle, validateWordPathPuzzles, WORD_PATH_PUZZLES } from '@/utils/quests/experiences/word-paths-puzzles';
import { answerTriviaQuestion, createTriviaRound, triviaRoundComplete, triviaRoundScore } from '@/utils/quests/experiences/trivia';
import { BOOK_TRIVIA_QUESTIONS, CITY_TRIVIA_QUESTIONS, FILM_TRIVIA_QUESTIONS, validateTriviaPack } from '@/utils/quests/experiences/trivia-packs';
import { advanceBreathing, createBreathingState } from '@/utils/quests/experiences/paced-breathing';
import { scoreTimingTap } from '@/utils/quests/experiences/timing-zone';
import { createPattern, patternComplete, patternMatches } from '@/utils/quests/experiences/pattern-memory';
import { createSortingRound, FEASTLE_SORTING_ITEMS, TASKLET_SORTING_ITEMS, validateSortingItems } from '@/utils/quests/experiences/sorting';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import { createMatchingDeck, createMemoryMatchState, FEASTLE_MATCHING_MOTIFS, memoryMatchReducer, MOSSPROUT_MATCHING_MOTIFS, RELICOON_MATCHING_MOTIFS, shuffleMatchingDeck, validateMatchingMotifs } from '@/utils/quests/experiences/matching';
import { attemptMatchThreeSwap, createMatchThreeState, findMatchRuns, hasLegalMove, MATCH_THREE_DIFFICULTY, resolveMatchThreeConfig, type MatchThreeState, type MatchThreeTile } from '@/utils/quests/experiences/match-three';
import { matchThreePack, validateMatchThreePack } from '@/utils/quests/experiences/match-three-packs';
import { questDefinition } from '@/utils/quests/definitions';
import { themedQuestOffers } from '@/utils/quests/themed';

test('Steppling, Flickerbun, and Pagelet receive their interactive quest families first', () => {
  assert.equal(themedQuestOffers('high_steps_day', 'journey', 'steppling')[0]?.id, 'quest-steppling-stride');
  assert.equal(themedQuestOffers('cinema', 'culture', 'flickerbun')[0]?.id, 'quest-film-trivia');
  assert.equal(themedQuestOffers('bookstore', 'culture', 'pagelet')[0]?.id, 'quest-book-trivia');
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-pagelet-lost-word'));
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-pagelet-word-paths'));
});

test('the new companion quest pools lead with their reusable mini-game', () => {
  assert.equal(themedQuestOffers('good_sleep', 'night', 'bedrotte')[0]?.id, 'quest-bedrotte-breathe');
  assert.equal(themedQuestOffers('park', 'places', 'mossprout')[0]?.id, 'quest-mossprout-memory');
  assert.equal(themedQuestOffers('city', 'places', 'skylo')[0]?.id, 'quest-skylo-city-trivia');
  assert.equal(themedQuestOffers('social_gathering', 'memory', 'gatherglow')[0]?.id, 'quest-gatherglow-pattern');
  assert.equal(themedQuestOffers('feast', 'food', 'feastle')[0]?.id, 'quest-feastle-merge');
  assert.equal(themedQuestOffers('focus_work', 'craft', 'tasklet')[0]?.id, 'quest-tasklet-desk-jam');
  assert.equal(themedQuestOffers('celebration', 'celebrate', 'cheerlet')[0]?.id, 'quest-cheerlet-block-party');
  assert.equal(questDefinition('quest-cheerlet-block-party')?.execution?.kind, 'block_blast');
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-memory'));
  assert.equal(themedQuestOffers('museum', 'culture', 'relicoon')[0]?.id, 'quest-relicoon-match');
  assert.equal(themedQuestOffers('live_music', 'culture', 'encora')[0]?.id, 'quest-encora-rhythm');
});

test('Block Party V1 ships connected, normalised shapes and deterministic fair trays', () => {
  assert.ok(BLOCK_BLAST_SHAPES.length >= 30);
  assert.ok(BLOCK_BLAST_SHAPES.every(blockBlastShapeIsConnected));
  assert.ok(BLOCK_BLAST_SHAPES.every(blockBlastShapeIsNormalised));
  const familyIds = new Set(BLOCK_BLAST_SHAPES.map((shape) => shape.familyId));
  for (const familyId of ['corner-3', 'square-2', 'line-5', 'l-5', 'j-5', 't-5', 'plus-5', 'u-5', 'p-5', 'q-5', 'rectangle-2x3', 'square-3']) {
    assert.ok(familyIds.has(familyId), `missing key Block Party shape family ${familyId}`);
  }
  const rectangleRotations = BLOCK_BLAST_SHAPES.filter((shape) => shape.familyId === 'rectangle-2x3');
  assert.equal(rectangleRotations.length, 2, 'the 2x3 block can arrive horizontally or vertically');
  assert.deepEqual(new Set(rectangleRotations.map((shape) => `${Math.max(...shape.cells.map((cell) => cell.row)) + 1}x${Math.max(...shape.cells.map((cell) => cell.column)) + 1}`)), new Set(['2x3', '3x2']));
  assert.equal(BLOCK_BLAST_SHAPES.filter((shape) => shape.familyId === 'square-3')[0]?.cells.length, 9);
  assert.equal(BLOCK_BLAST_SHAPES.filter((shape) => shape.familyId === 'l-5').length, 4, 'asymmetric pieces expose every quarter-turn');
  const first = createBlockBlastState('cheerlet:test', 100);
  const second = createBlockBlastState('cheerlet:test', 100);
  assert.deepEqual(first.tray, second.tray);
  assert.equal(first.rulesetId, BLOCK_BLAST_RULESET);
  assert.equal(first.board.length, BLOCK_BLAST_BOARD_SIZE * BLOCK_BLAST_BOARD_SIZE);
  assert.ok(first.tray.some((piece) => canPlaceBlockBlastPiece(first.board, piece.cells, 0, 0)));

  const crowded = Array.from({ length: 64 }, (_, index) => index === 63 ? null : 'rose' as const);
  const generated = generateBlockBlastTray(crowded, 123, 4);
  assert.ok(generated.tray.some((piece) => piece.cells.length === 1), 'a constrained refill includes the only playable shape');
});

test('Block Party drag targeting captures the nearest geometric cells generously at board boundaries', () => {
  const board = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  const square = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }];
  assert.deepEqual(nearestBlockBlastOrigin(square, -1.5, -1.4), { row: 0, column: 0 });
  assert.deepEqual(nearestBlockBlastOrigin(square, 7.4, 7.5), { row: 6, column: 6 });
  const lineFive = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 }, { row: 0, column: 4 }];
  assert.deepEqual(nearestBlockBlastOrigin(lineFive, 2, -4.5), { row: 2, column: 0 }, 'a long piece is captured while only its far edge overlaps the board');
  assert.equal(nearestBlockBlastOrigin(square, -3, 0), null, 'pieces far away from the board are not captured');

  board[3 * 8 + 3] = 'rose';
  const occupiedOrigin = nearestBlockBlastOrigin([{ row: 0, column: 0 }], 3.1, 3.1);
  assert.deepEqual(occupiedOrigin, { row: 3, column: 3 }, 'targeting chooses the closest geometric cell even when occupied');
  assert.equal(canPlaceBlockBlastPiece(board, [{ row: 0, column: 0 }], occupiedOrigin!.row, occupiedOrigin!.column), false);
  assert.deepEqual(nearestSnappedBlockBlastOrigin(board, [{ row: 0, column: 0 }], 3.1, 3.1), { row: 3, column: 3 }, 'an occupied cell does not make a piece jump to a distant opening');
  assert.deepEqual(nearestSnappedBlockBlastOrigin(board, [{ row: 0, column: 0 }], 3.48, 3.48), { row: 3, column: 4 }, 'an almost-equidistant valid neighbour catches the piece seamlessly');
});

test('Block Party clears simultaneous lines and applies placement, clear, and perfect-board scoring', () => {
  const initial = createBlockBlastState('cheerlet:intersection', 100);
  const board = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  for (let index = 1; index < 8; index += 1) {
    board[index] = 'rose';
    board[index * 8] = 'amber';
  }
  assert.deepEqual(projectedBlockBlastLines(board, [{ row: 0, column: 0 }], 0, 0), { rows: [0], columns: [0] });
  assert.deepEqual(projectedBlockBlastLines(board, [{ row: 0, column: 0 }], 0, 1), { rows: [], columns: [] }, 'invalid placements never preview a clear');
  assert.equal(blockBlastClearCascadePhase(0, [0], [0]), 0);
  assert.equal(blockBlastClearCascadePhase(7, [0], [0]), 7);
  assert.equal(blockBlastClearCascadePhase(56, [0], [0]), 7);
  const single: BlockBlastPiece = { id: 'single', shapeId: 'single', cells: [{ row: 0, column: 0 }], colorId: 'teal', used: false };
  const state: BlockBlastState = { ...initial, board, tray: [single], rngState: 42, score: 0, combo: 0 };
  const next = blockBlastReducer(state, { type: 'place', pieceId: single.id, row: 0, column: 0, now: 200 });
  assert.deepEqual(next.lastResolution?.clearedRows, [0]);
  assert.deepEqual(next.lastResolution?.clearedColumns, [0]);
  assert.equal(next.lastResolution?.clearedIndices.length, 15);
  assert.equal(next.lastResolution?.perfectClear, true);
  assert.equal(next.score, 910, '10 placement + 400 double line + 500 perfect clear');
  assert.equal(next.linesCleared, 2);
});

test('Block Party combo scoring resets and no-move detection considers every unused tray piece', () => {
  const initial = createBlockBlastState('cheerlet:loss', 100);
  const board = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8); const column = index % 8;
    return (row + column) % 2 === 0 ? 'blue' as const : null;
  });
  board[0] = null;
  const single: BlockBlastPiece = { id: 'single', shapeId: 'single', cells: [{ row: 0, column: 0 }], colorId: 'rose', used: false };
  const square: BlockBlastPiece = { id: 'square', shapeId: 'square-2', cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }], colorId: 'amber', used: false };
  const state: BlockBlastState = { ...initial, board, tray: [single, square], combo: 3, maxCombo: 3 };
  const next = blockBlastReducer(state, { type: 'place', pieceId: single.id, row: 0, column: 0, now: 200 });
  assert.equal(next.combo, 0);
  assert.equal(next.score, 10);
  assert.equal(next.status, 'lost');
});

test('interactive progression survives repeat-loop removal without double-counting normal completions', () => {
  const quest = { questId: 'quest-tasklet-desk-jam', creatureId: 'tasklet', title: 'Jam', hint: 'Clear it', acceptedAt: 1, completedAt: 2 };
  const attempt = { id: 'attempt-1', questId: quest.questId, creatureId: quest.creatureId, dayId: '2026-07-15', seed: 'seed', executionKind: 'block_jam' as const, configSnapshot: {}, status: 'succeeded' as const };
  assert.equal(completedQuestCount([], quest.questId, quest.creatureId, [attempt]), 1, 'repeat-loop attempts must advance progression');
  assert.equal(completedQuestCount([quest], quest.questId, quest.creatureId, [attempt]), 1, 'normal quest and attempt records represent one completion');
  assert.equal(resolveBlockJamConfig(completedQuestCount([], quest.questId, quest.creatureId, [attempt]), 'next').levelId, 'desk-v2-tutorial-02');
});

test('Tasklet Block Jam V2 ships 30 deterministic, connected, dense boards', () => {
  assert.equal(TASKLET_DESK_JAM_LEVELS.length, 30);
  assert.equal(TASKLET_DESK_JAM_LEVELS.filter((level) => level.chapter === 'tutorial').length, 6);
  assert.equal(TASKLET_DESK_JAM_LEVELS.filter((level) => level.chapter === 'standard').length, 24);
  assert.deepEqual([...new Set(TASKLET_DESK_JAM_LEVELS.map((level) => level.tier))], [1, 2, 3]);
  for (const level of TASKLET_DESK_JAM_LEVELS) {
    assert.deepEqual(validateBlockJamLevel(level), [], level.id);
    assert.deepEqual(level.fixedCells, [], `${level.id} should not ship blocked cells`);
    assert.equal(level.rulesetId, BLOCK_JAM_RULESET);
    assert.equal(level.timeLimitMs, level.chapter === 'tutorial' || level.tier === 1 ? 180_000 : level.tier === 2 ? 240_000 : 300_000);
    if (level.chapter === 'standard') {
      assert.ok(level.blocks.every((block) => block.cells.length >= 3), `${level.id} should use substantial connected pieces`);
      assert.ok(blockJamOccupancy(level) >= 0.4, `${level.id} should feel densely packed`);
    }
  }
  const selected = resolveBlockJamConfig(0, 'tasklet:day-1');
  assert.deepEqual(resolveBlockJamConfig(0, 'tasklet:day-1'), selected);
  assert.equal(selected.rulesetId, BLOCK_JAM_RULESET);
  assert.equal(resolveBlockJamConfig(6, 'tasklet:day-1').tier, 1);
  assert.equal(resolveBlockJamConfig(99, 'tasklet:late').tier, 3);
  assert.equal(questDefinition('quest-tasklet-desk-jam')?.execution?.kind, 'block_jam');
});

test('Desk Jam opening board requires a parking move and replays its nine-move jam chain', () => {
  const level = TASKLET_DESK_JAM_LEVELS[0];
  let state = createBlockJamState(level);
  assert.equal(blockJamReducer(level, state, { type: 'move', blockId: 'a', anchor: { row: 99, column: 99 } }), state);
  const destinations = reachableBlockJamAnchors(level, state, 'a');
  assert.ok(destinations.length > 0);
  assert.ok(blockJamPath(level, state, 'a', destinations[0])?.length);
  assert.ok(level.blocks.every((block) => availableBlockJamDoor(level, state, block.id) == null), 'nothing starts aligned to an exit');
  const solution = [
    { type: 'move', blockId: 'c', anchor: { row: 5, column: 3 } },
    { type: 'move', blockId: 'b', anchor: { row: 4, column: 5 } },
    { type: 'exit', blockId: 'b', doorId: 'c' },
    { type: 'move', blockId: 'a', anchor: { row: 2, column: 4 } },
    { type: 'exit', blockId: 'a', doorId: 'r' },
    { type: 'move', blockId: 'd', anchor: { row: 0, column: 1 } },
    { type: 'exit', blockId: 'd', doorId: 'v' },
    { type: 'move', blockId: 'c', anchor: { row: 4, column: 0 } },
    { type: 'exit', blockId: 'c', doorId: 'a' },
  ] as const;
  for (const action of solution) state = blockJamReducer(level, state, action);
  assert.equal(state.status, 'won');
  assert.equal(state.movesUsed, 9);
  assert.equal(state.clearedBlockIds.length, 4);
  state = blockJamReducer(level, state, { type: 'undo' });
  assert.equal(state.movesUsed, 8);
  assert.equal(state.clearedBlockIds.length, 3);
  assert.equal(state.undoCount, 1);
});

test('Block Jam rejects an exit when any trailing polyomino cell has a blocked sweep lane', () => {
  const level: BlockJamLevel = {
    id: 'sweep-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 5, columns: 5, parMoves: 2, timeLimitMs: 180_000, fixedCells: [],
    blocks: [
      { id: 'target', colorId: 'cyan', anchor: { row: 0, column: 1 }, cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }] },
      { id: 'blocker', colorId: 'red', anchor: { row: 0, column: 2 }, cells: [{ row: 0, column: 0 }] },
    ],
    doors: [{ id: 'cyan-exit', colorId: 'cyan', edge: 'top', offset: 1, span: 2 }],
  };
  const blocked = createBlockJamState(level);
  assert.equal(availableBlockJamDoor(level, blocked, 'target'), null, 'the lower-right cell would sweep through the blocker');
  const unblocked = { ...blocked, clearedBlockIds: ['blocker'] };
  assert.equal(availableBlockJamDoor(level, unblocked, 'target')?.id, 'cyan-exit');
});

test('Block Jam moves are unlimited and only timeout can fail a live board', () => {
  const level = TASKLET_DESK_JAM_LEVELS[0];
  const state = { ...createBlockJamState(level), movesUsed: 999 };
  const moved = blockJamReducer(level, state, { type: 'move', blockId: 'c', anchor: { row: 5, column: 3 } });
  assert.equal(moved.status, 'playing');
  assert.equal(moved.movesUsed, 1000);
  const timedOut = blockJamReducer(level, moved, { type: 'timeout' });
  assert.equal(timedOut.status, 'failed');
  assert.equal(blockJamReducer(level, timedOut, { type: 'restart' }).status, 'playing');
});

test('Lost Word includes 150 valid, unique, deterministic Pagelet puzzles', () => {
  assert.equal(LOST_WORD_PUZZLES.length, 150);
  assert.deepEqual(validateLostWordPuzzles(), []);
  const selected = selectLostWordPuzzle('pagelet:day-1');
  assert.equal(selectLostWordPuzzle('pagelet:day-1').id, selected.id);
  assert.notEqual(selectLostWordPuzzle('pagelet:day-1', [selected.id]).id, selected.id);
});

test('Lost Word duplicate-letter scoring never awards more matches than the answer contains', () => {
  assert.deepEqual(evaluateLostWordGuess('eerie', 'sheep').statuses, ['misplaced', 'misplaced', 'absent', 'absent', 'absent']);
  assert.deepEqual(evaluateLostWordGuess('apple', 'apple').statuses, ['exact', 'exact', 'exact', 'exact', 'exact']);
});

test('Lost Word accepts any five letters, rejects incomplete guesses, and completes after six guesses', () => {
  let round = createLostWordRound({ seed: 'pagelet:test', difficultyTier: 2, hintUnlockAfter: null });
  for (const letter of 'zzzz') round = lostWordReducer(round, { type: 'letter', letter });
  round = lostWordReducer(round, { type: 'submit' });
  assert.equal(round.guesses.length, 0);
  assert.equal(round.error, 'not_enough_letters');
  round = lostWordReducer(round, { type: 'letter', letter: 'z' });
  round = lostWordReducer(round, { type: 'submit' });
  assert.equal(round.guesses[0]?.word, 'zzzzz');

  const guesses = ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxy'];
  for (const word of guesses) {
    for (const letter of word) round = lostWordReducer(round, { type: 'letter', letter });
    round = lostWordReducer(round, { type: 'submit' });
  }
  assert.equal(round.guesses.length, 6);
  assert.equal(lostWordRoundComplete(round), true);
});

test('Lost Word difficulty reduces and delays hints across five bounded tiers', () => {
  assert.deepEqual(resolveLostWordDifficulty(0), { difficultyTier: 1, initialHint: 'clue_and_first_letter', hintUnlockAfter: null });
  assert.equal(resolveLostWordDifficulty(3).difficultyTier, 2);
  assert.equal(resolveLostWordDifficulty(6).difficultyTier, 3);
  assert.deepEqual(resolveLostWordDifficulty(9), { difficultyTier: 4, initialHint: 'delayed_clue', hintUnlockAfter: 2 });
  assert.deepEqual(resolveLostWordDifficulty(99), { difficultyTier: 5, initialHint: 'category', hintUnlockAfter: 3 });
});

test('Word Paths includes a broad, valid 4-to-6-letter difficulty curve and avoids recent rounds', () => {
  assert.ok(WORD_PATH_PUZZLES.length >= 90);
  assert.deepEqual(validateWordPathPuzzles(), []);
  const selected = selectWordPathPuzzle('pagelet:paths:day-1');
  assert.equal(selected.letters.length, 6);
  assert.equal(selected.words.length, 8);
  assert.equal(selectWordPathPuzzle('pagelet:paths:day-1').id, selected.id);
  assert.notEqual(selectWordPathPuzzle('pagelet:paths:day-1', [selected.id]).id, selected.id);
  const letterCounts = [4, 4, 5, 5, 6];
  const wordCounts = [4, 5, 6, 7, 8];
  for (let tier = 1; tier <= 5; tier += 1) {
    const tierPuzzle = selectWordPathPuzzle(`pagelet:paths:tier-${tier}`, [], tier);
    assert.equal(tierPuzzle.tier, tier);
    assert.equal(tierPuzzle.letters.length, letterCounts[tier - 1]);
    assert.equal(tierPuzzle.words.length, wordCounts[tier - 1]);
  }
  assert.deepEqual(resolveWordPathsDifficulty(0), { difficultyTier: 1, hintAllowance: 1 });
  assert.equal(resolveWordPathsDifficulty(99).difficultyTier, 5);
});

test('Word Paths rejects side-touching placements that create undeclared words', () => {
  const invalid = {
    id: 'invalid-side-touch',
    letters: ['e', 'a', 's', 't'],
    words: ['eat', 'sea'],
    bonusWords: [],
    placements: [
      { word: 'eat', row: 0, column: 0, direction: 'across' as const },
      { word: 'sea', row: 1, column: 0, direction: 'across' as const },
    ],
    rows: 2,
    columns: 3,
    tier: 1 as const,
  };
  assert.ok(validateWordPathPuzzles([...WORD_PATH_PUZZLES, invalid]).some((error) => error.includes('unintended down word')));
});

test('Word Paths traces, backtracks, scores bonus words, hints, shuffles, and completes', () => {
  let round = createWordPathRound({ seed: 'paths:test', puzzleId: 'pagelet-word-paths-001', difficultyTier: 1 });
  const identityFor = (letter: string, used: number[] = []) => round.puzzle.letters.findIndex((candidate, index) => candidate === letter && !used.includes(index));
  const traceWord = (word: string) => {
    const used: number[] = [];
    for (const letter of word) {
      const index = identityFor(letter, used);
      used.push(index);
      round = wordPathReducer(round, { type: 'trace_letter', index });
    }
    round = wordPathReducer(round, { type: 'submit' });
  };

  const first = identityFor('e');
  const second = identityFor('a');
  round = wordPathReducer(round, { type: 'trace_letter', index: first });
  round = wordPathReducer(round, { type: 'trace_letter', index: second });
  round = wordPathReducer(round, { type: 'trace_letter', index: first });
  assert.deepEqual(round.trace, [first]);
  round = wordPathReducer(round, { type: 'clear_trace' });

  traceWord('tea');
  assert.deepEqual(round.bonusWordsFound, ['tea']);
  const beforeShuffle = round.shuffleOrder;
  round = wordPathReducer(round, { type: 'shuffle' });
  assert.notDeepEqual(round.shuffleOrder, beforeShuffle);
  assert.deepEqual([...round.shuffleOrder].sort(), beforeShuffle);
  round = wordPathReducer(round, { type: 'hint' });
  assert.equal(round.hintsUsed, 1);
  assert.equal(round.hintedCells.length, 1);
  assert.equal(wordPathCellRevealed(round, round.hintedCells[0]), true);
  assert.deepEqual(wordPathReducer(round, { type: 'hint' }), round);

  for (const word of round.puzzle.words) traceWord(word);
  assert.equal(wordPathRoundComplete(round), true);
  assert.equal(round.foundWords.length, round.puzzle.words.length);
});

test('Word Paths wheel hit testing selects the nearest letter within hit slop', () => {
  const positions = [{ x: 20, y: 20 }, { x: 80, y: 20 }, { x: 50, y: 80 }];
  assert.equal(wordPathLetterAtPoint(20, 20, positions, 24), 0);
  assert.equal(wordPathLetterAtPoint(75, 22, positions, 24), 1);
  assert.equal(wordPathLetterAtPoint(50, 55, positions, 24), -1);
  assert.equal(wordPathLetterAtPoint(200, 200, positions, 24), -1);
});

test('Word Paths marks an already revealed word as a fresh duplicate submission', () => {
  let round = createWordPathRound({ seed: 'paths:duplicate', puzzleId: 'pagelet-word-paths-001', difficultyTier: 1 });
  const submit = (word: string) => {
    const used: number[] = [];
    for (const letter of word) {
      const index = round.puzzle.letters.findIndex((candidate, identity) => candidate === letter && !used.includes(identity));
      used.push(index);
      round = wordPathReducer(round, { type: 'trace_letter', index });
    }
    round = wordPathReducer(round, { type: 'submit' });
  };
  submit('east');
  assert.equal(round.feedback, 'target');
  submit('east');
  assert.equal(round.feedback, 'already_found');
  assert.equal(round.submissions, 2);
  assert.deepEqual(round.foundWords, ['east']);
});

test('step sprint difficulty is bounded and time trials use their own targets', () => {
  assert.equal(resolveStepChallengeConfig({ challengeId: 'step_sprint', completedCount: 0 }).target, 100);
  assert.equal(resolveStepChallengeConfig({ challengeId: 'step_sprint', completedCount: 4 }).target, 200);
  assert.equal(resolveStepChallengeConfig({ challengeId: 'step_sprint', completedCount: 99 }).target, 200);
  assert.equal(resolveStepChallengeConfig({ challengeId: 'step_time_trial', completedCount: 0 }).target, 250);
  assert.equal(resolveStepChallengeConfig({ challengeId: 'step_time_trial', completedCount: 99 }).target, 600);
});

test('film and book packs each contain 100 valid predefined questions', () => {
  assert.equal(FILM_TRIVIA_QUESTIONS.length, 100);
  assert.equal(BOOK_TRIVIA_QUESTIONS.length, 100);
  assert.deepEqual(validateTriviaPack(FILM_TRIVIA_QUESTIONS), []);
  assert.deepEqual(validateTriviaPack(BOOK_TRIVIA_QUESTIONS), []);
});

test('Skylo city pack contains 100 valid deterministic questions', () => {
  assert.equal(CITY_TRIVIA_QUESTIONS.length, 100);
  assert.deepEqual(validateTriviaPack(CITY_TRIVIA_QUESTIONS), []);
  const round = createTriviaRound({ packIds: ['city'], questionCount: 5, seed: 'skylo:day-1' });
  assert.equal(round.questions.length, 5);
  assert.equal(new Set(round.questions.map((question) => question.id)).size, 5);
});

test('breathing, timing, and pattern engines are bounded and deterministic', () => {
  let breath = createBreathingState();
  for (let index = 0; index < 8; index += 1) breath = advanceBreathing(breath, 4);
  assert.equal(breath.completed, true);
  assert.equal(resolveBreathingConfig(99).cycles, 6);
  assert.equal(scoreTimingTap(0.5, 0.5, 0.2).rating, 'perfect');
  assert.equal(scoreTimingTap(0.1, 0.5, 0.2).rating, 'early');
  assert.equal(resolveTimingConfig('steppling-stride', 99).zoneWidth, 0.18);
  const pattern = createPattern('gatherglow:test', 6);
  assert.deepEqual(createPattern('gatherglow:test', 6), pattern);
  assert.equal(patternMatches(pattern, pattern.slice(0, 3)), true);
  assert.equal(patternComplete(pattern, pattern), true);
  assert.equal(resolvePatternConfig(99).maxLength, 7);
});

test('Feastle sorting and Relicoon matching packs validate and avoid recent content', () => {
  assert.equal(FEASTLE_SORTING_ITEMS.length, 60);
  assert.deepEqual(validateSortingItems(), []);
  const sorting = createSortingRound('feastle:test', 12);
  assert.equal(sorting.length, 12);
  assert.equal(createSortingRound('feastle:test-2', 12, sorting.map((item) => item.id)).some((item) => sorting.some((old) => old.id === item.id)), false);
  assert.equal(RELICOON_MATCHING_MOTIFS.length, 48);
  assert.deepEqual(validateMatchingMotifs(), []);
  const deck = createMatchingDeck('relicoon:test', 6);
  assert.equal(deck.length, 12);
  assert.equal(new Set(deck.map((card) => card.motif.id)).size, 6);
  assert.deepEqual(resolveSortingConfig(99), { itemCount: 15, targetCorrect: 12, tier: 3 });
  assert.deepEqual(resolveMatchingConfig(99), { pairCount: 8, moveBudget: 28, tier: 3 });
  assert.equal(resolveRhythmConfig(99).bpm, 100);
});

test('Tasklet triage is deterministic, valid, tiered, and records readable elapsed time', () => {
  assert.equal(TASKLET_SORTING_ITEMS.length, 60);
  assert.deepEqual(validateSortingItems(TASKLET_SORTING_ITEMS), []);
  const firstTier = createSortingRound('tasklet:day-1', 9, [], 'tasklet-triage', 1);
  assert.equal(firstTier.length, 9);
  assert.ok(firstTier.every((item) => item.category === 'quick' || item.category === 'focus'));
  assert.deepEqual(
    createSortingRound('tasklet:day-1', 9, [], 'tasklet-triage', 1).map((item) => item.id),
    firstTier.map((item) => item.id),
  );
  const finalTier = createSortingRound('tasklet:day-3', 15, [], 'tasklet-triage', 3);
  assert.ok(new Set(finalTier.map((item) => item.category)).size >= 3);
  assert.equal(formatQuestDuration(12_349), '12.3s');
  assert.equal(formatQuestDuration(62_349), '1:02.3');
  const execution = questDefinition('quest-tasklet-sort')?.execution;
  assert.equal(execution?.kind, 'sorting');
  assert.equal(execution?.kind === 'sorting' ? execution.packId : null, 'tasklet-triage');
});

test('Mossprout memory match uses deterministic garden assets and keeps legacy watering readable', () => {
  assert.equal(MOSSPROUT_MATCHING_MOTIFS.length, 12);
  assert.deepEqual(validateMatchingMotifs(MOSSPROUT_MATCHING_MOTIFS), []);
  assert.ok(MOSSPROUT_MATCHING_MOTIFS.every((motif) => motif.visual.kind === 'world_asset'));
  const deck = createMatchingDeck('mossprout:day-1', 8, [], 'mossprout-garden');
  const repeated = createMatchingDeck('mossprout:day-1', 8, [], 'mossprout-garden');
  assert.deepEqual(deck.map((card) => card.cardId), repeated.map((card) => card.cardId));
  assert.equal(deck.length, 16);
  assert.equal(new Set(deck.map((card) => card.motif.id)).size, 8);
  assert.ok(deck.every((card) => deck.filter((candidate) => candidate.motif.id === card.motif.id).length === 2));
  assert.equal(questDefinition('quest-mossprout-memory')?.execution?.kind, 'matching');
  assert.equal(questDefinition('quest-mossprout-tend')?.execution?.kind, 'timing_zone');
  assert.equal(themedQuestOffers('park', 'places', 'mossprout').some((offer) => offer.id === 'quest-mossprout-tend'), false);
});

test('Feastle memory match uses a varied deterministic food emoji pack', () => {
  assert.equal(FEASTLE_MATCHING_MOTIFS.length, 20);
  assert.deepEqual(validateMatchingMotifs(FEASTLE_MATCHING_MOTIFS), []);
  assert.ok(FEASTLE_MATCHING_MOTIFS.every((motif) => motif.visual.kind === 'emoji'));

  const deck = createMatchingDeck('feastle:day-1', 8, [], 'feastle-food');
  const repeated = createMatchingDeck('feastle:day-1', 8, [], 'feastle-food');
  const motifIds = [...new Set(deck.map((card) => card.motif.id))];
  assert.deepEqual(deck.map((card) => card.cardId), repeated.map((card) => card.cardId));
  assert.equal(deck.length, 16);
  assert.equal(motifIds.length, 8);
  assert.ok(deck.every((card) => deck.filter((candidate) => candidate.motif.id === card.motif.id).length === 2));

  const nextDeck = createMatchingDeck('feastle:day-2', 8, motifIds, 'feastle-food');
  assert.ok(nextDeck.every((card) => !motifIds.includes(card.motif.id)));
  const execution = questDefinition('quest-feastle-memory')?.execution;
  assert.equal(execution?.kind, 'matching');
  assert.equal(execution?.kind === 'matching' ? execution.packId : null, 'feastle-food');
});

test('memory match reducer locks comparisons and resolves matches without accepting a third card', () => {
  const deck = createMatchingDeck('mossprout:reducer', 4, [], 'mossprout-garden');
  const first = deck[0];
  const pair = deck.find((card) => card.cardId !== first.cardId && card.motif.id === first.motif.id)!;
  const third = deck.find((card) => card.motif.id !== first.motif.id)!;
  let state = createMemoryMatchState();
  state = memoryMatchReducer(state, { type: 'reveal', cardId: first.cardId, motifId: first.motif.id });
  state = memoryMatchReducer(state, { type: 'reveal', cardId: pair.cardId, motifId: pair.motif.id });
  assert.equal(state.locked, true);
  assert.equal(state.moves, 1);
  assert.equal(state.comparison?.matched, true);
  const lockedState = memoryMatchReducer(state, { type: 'reveal', cardId: third.cardId, motifId: third.motif.id });
  assert.deepEqual(lockedState, state);
  state = memoryMatchReducer(state, { type: 'resolve_comparison' });
  assert.deepEqual(state.matchedMotifIds, [first.motif.id]);
  assert.equal(state.openCards.length, 0);
  assert.equal(state.locked, false);
});

test('matching games reshuffle card cells without changing the selected pairs', () => {
  const deck = createMatchingDeck('mossprout:layout', 6, [], 'mossprout-garden');
  const shuffled = shuffleMatchingDeck(deck, 'attempt:2');
  assert.notDeepEqual(shuffled.map((card) => card.cardId), deck.map((card) => card.cardId));
  assert.deepEqual(
    [...shuffled.map((card) => card.cardId)].sort(),
    [...deck.map((card) => card.cardId)].sort(),
  );
  assert.deepEqual(
    shuffleMatchingDeck(deck, 'attempt:2').map((card) => card.cardId),
    shuffled.map((card) => card.cardId),
  );
});

test('Zodiac Match 3 has a deterministic, playable five-tier difficulty curve and a valid elemental pack', () => {
  const pack = matchThreePack();
  assert.deepEqual(validateMatchThreePack(pack), []);
  assert.deepEqual(resolveMatchThreeConfig(0), MATCH_THREE_DIFFICULTY[0]);
  assert.deepEqual(resolveMatchThreeConfig(99), MATCH_THREE_DIFFICULTY[4]);
  const fireKinds = pack.motifs.filter((motif) => motif.element === 'fire').map((motif) => motif.id);
  const elemental = createMatchThreeState({
    seed: 'zodiac:daily:aries:1',
    config: MATCH_THREE_DIFFICULTY[0],
    availableKinds: pack.motifs.map((motif) => motif.id),
    requiredKinds: fireKinds,
    objectiveRules: [{ id: 'fire', kindIds: fireKinds, target: MATCH_THREE_DIFFICULTY[0].targetCounts[0] }],
  });
  assert.ok(fireKinds.every((kind) => elemental.tileKinds.includes(kind)));
  assert.deepEqual(elemental.objectives, [{ id: 'fire', kindIds: fireKinds, target: MATCH_THREE_DIFFICULTY[0].targetCounts[0], collected: 0 }]);
  for (const config of MATCH_THREE_DIFFICULTY) {
    for (let seed = 0; seed < 30; seed += 1) {
      const first = createMatchThreeState({ seed: `match-three:${config.tier}:${seed}`, config, availableKinds: pack.motifs.map((motif) => motif.id) });
      const repeated = createMatchThreeState({ seed: `match-three:${config.tier}:${seed}`, config, availableKinds: pack.motifs.map((motif) => motif.id) });
      assert.deepEqual(first, repeated);
      assert.equal(findMatchRuns(first.board, first.rows, first.columns).length, 0);
      assert.equal(hasLegalMove(first.board, first.rows, first.columns), true);
      assert.equal(first.board.length, config.rows * config.columns);
      assert.equal(first.blockers.filter((layers) => layers > 0).length, config.singleFrost + config.doubleFrost);
    }
  }
});

test('Match 3 rejects invalid swaps without spending a move and resolves valid boards to stability', () => {
  const pack = matchThreePack();
  const state = createMatchThreeState({ seed: 'match-three:swap-rules', config: MATCH_THREE_DIFFICULTY[1], availableKinds: pack.motifs.map((motif) => motif.id) });
  let invalid = null as ReturnType<typeof attemptMatchThreeSwap> | null;
  let valid = null as ReturnType<typeof attemptMatchThreeSwap> | null;
  for (let index = 0; index < state.board.length && (!invalid || !valid); index += 1) {
    for (const adjacent of [index + 1, index + state.columns]) {
      if (adjacent >= state.board.length || (adjacent === index + 1 && index % state.columns === state.columns - 1)) continue;
      const result = attemptMatchThreeSwap(state, index, adjacent);
      if (result.valid) valid ??= result;
      else invalid ??= result;
    }
  }
  assert.ok(invalid);
  assert.equal(invalid.state.movesRemaining, state.movesRemaining);
  assert.deepEqual(invalid.state.board, state.board);
  assert.ok(valid);
  assert.equal(valid.state.movesRemaining, state.movesRemaining - 1);
  assert.equal(findMatchRuns(valid.state.board, valid.state.rows, valid.state.columns).length, 0);
  if (valid.state.status === 'playing') assert.equal(hasLegalMove(valid.state.board, valid.state.rows, valid.state.columns), true);
  assert.ok(valid.steps.some((step) => step.kind === 'clear'));
  assert.ok(valid.steps.some((step) => step.kind === 'fall'));
  assert.ok(valid.steps.some((step) => step.kind === 'refill'));
});

test('Match 3 creates line specials, damages frost, and activates special combinations', () => {
  const lineState = matchThreeFixture([
    'a', 'b', 'c', 'd',
    'a', 'a', 'b', 'a',
    'c', 'd', 'a', 'b',
  ], 3, 4);
  lineState.blockers[4] = 1;
  lineState.frostTarget = 1;
  const lineMove = attemptMatchThreeSwap(lineState, 6, 10);
  assert.equal(lineMove.valid, true);
  const lineClear = lineMove.steps.find((step) => step.kind === 'clear');
  assert.ok(lineClear);
  assert.ok(lineClear.cleared.length >= 4, 'every gem in a 4+ match should clear');
  assert.ok(lineMove.steps.some((step) => step.kind === 'refill' && step.board.some((tile) => tile?.special === 'row')));
  assert.equal(lineMove.state.frostCleared, 1);
  assert.ok(lineMove.state.objectives[0].collected > 0);

  const comboState = matchThreeFixture([
    'a', 'b', 'c',
    'c', 'b', 'a',
    'b', 'a', 'c',
  ], 3, 3);
  comboState.board[0]!.special = 'prism';
  comboState.board[1]!.special = 'row';
  const combo = attemptMatchThreeSwap(comboState, 0, 1);
  assert.equal(combo.valid, true);
  assert.ok(combo.state.specialsTriggered >= 2);
  assert.ok(combo.steps.find((step) => step.kind === 'clear')!.cleared.length >= 3);
});

test('Match 3 supports every planned special-to-special combination', () => {
  const combinations: Array<[MatchThreeTile['special'], MatchThreeTile['special']]> = [
    ['row', 'column'],
    ['row', 'burst'],
    ['burst', 'burst'],
    ['prism', null],
    ['prism', 'row'],
    ['prism', 'burst'],
    ['prism', 'prism'],
  ];
  for (const [firstSpecial, secondSpecial] of combinations) {
    const state = matchThreeFixture([
      'a', 'b', 'c', 'd', 'a',
      'c', 'd', 'a', 'b', 'c',
      'b', 'a', 'd', 'c', 'b',
      'd', 'c', 'b', 'a', 'd',
      'a', 'b', 'c', 'd', 'a',
    ], 5, 5);
    state.board[0]!.special = firstSpecial;
    state.board[1]!.special = secondSpecial;
    const result = attemptMatchThreeSwap(state, 0, 1);
    assert.equal(result.valid, true, `${firstSpecial}+${secondSpecial} should be a valid combo`);
    assert.ok(result.steps.some((step) => step.kind === 'clear' && step.cleared.length > 0));
    assert.ok(result.state.specialsTriggered >= 1);
  }
});

test('Feastle merge pack is complete, tiered, deterministic, and becomes the lead quest', () => {
  assert.equal(FEASTLE_MERGE_ITEMS.length, 15);
  assert.deepEqual(validateMergePack(), []);
  assert.equal(new Set(FEASTLE_MERGE_ITEMS.map((item) => item.id)).size, 15);
  assert.deepEqual(resolveMergeConfig(0).targetTiers, [3, 4]);
  assert.deepEqual(resolveMergeConfig(2).targetTiers, [4, 4]);
  assert.deepEqual(resolveMergeConfig(99).targetTiers, [4, 5]);
  const config = resolveMergeConfig(0);
  assert.ok(config.moveBudget > mergeRoundMinimumActions(config));
  const first = createMergeRound('feastle:merge:day-1', config);
  const repeated = createMergeRound('feastle:merge:day-1', config);
  assert.deepEqual(first, repeated);
  assert.equal(first.board.length, 36);
  assert.equal(first.board.length, MERGE_BOARD_SIZE);
  const next = createMergeRound('feastle:merge:day-2', config, first.orders.map((order) => order.targetId));
  assert.ok(next.orders.every((order) => !first.orders.some((previous) => previous.targetId === order.targetId)));
  assert.equal(questDefinition('quest-feastle-merge')?.execution?.kind, 'merge');
  assert.equal(themedQuestOffers('feast', 'food', 'feastle')[0]?.id, 'quest-feastle-merge');
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-sort'));
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-memory'));
});

test('merge board hit testing targets every 6x6 cell from the finger release position', () => {
  const boardX = 100;
  const boardY = 200;
  const inset = 7;
  const gap = 5;
  const cellSize = 52;
  const boardWidth = cellSize * MERGE_BOARD_COLUMNS + gap * (MERGE_BOARD_COLUMNS - 1) + inset * 2;
  const boardHeight = cellSize * MERGE_BOARD_ROWS + gap * (MERGE_BOARD_ROWS - 1) + inset * 2;
  const hit = (absoluteX: number, absoluteY: number) => mergeBoardCellFromPoint({
    absoluteX, absoluteY, boardX, boardY, boardWidth, boardHeight, inset, gap, cellSize,
  });

  for (let row = 0; row < MERGE_BOARD_ROWS; row += 1) {
    for (let column = 0; column < MERGE_BOARD_COLUMNS; column += 1) {
      const x = boardX + inset + column * (cellSize + gap) + cellSize / 2;
      const y = boardY + inset + row * (cellSize + gap) + cellSize / 2;
      const expected = row * MERGE_BOARD_COLUMNS + column;
      assert.equal(hit(x, y), expected);
      assert.equal(hit(
        boardX + inset + column * (cellSize + gap) + 0.1,
        boardY + inset + row * (cellSize + gap) + 0.1,
      ), expected);
      assert.equal(hit(
        boardX + inset + column * (cellSize + gap) + cellSize - 0.1,
        boardY + inset + row * (cellSize + gap) + cellSize - 0.1,
      ), expected);
    }
  }

  assert.equal(hit(boardX - 0.1, boardY + inset), null);
  assert.equal(hit(boardX + boardWidth + 0.1, boardY + inset), null);
  assert.equal(hit(boardX + inset, boardY - 0.1), null);
  assert.equal(hit(boardX + inset, boardY + boardHeight + 0.1), null);
});

test('pantry draws choose varied deterministic empty cells', () => {
  const board = Array.from({ length: MERGE_BOARD_SIZE }, (_, index) => index % 4 === 0 ? { instanceId: `occupied:${index}`, definitionId: 'pasta:1' } : null);
  const selections = Array.from({ length: 20 }, (_, index) => selectPantrySpawnCell(board, `pantry-draw:${index}`));
  assert.equal(selectPantrySpawnCell(board, 'pantry-draw:4'), selections[4]);
  assert.ok(selections.every((cell) => cell >= 0 && board[cell] == null));
  assert.ok(new Set(selections).size > 8);
  assert.equal(selectPantrySpawnCell(board.map(() => ({ instanceId: 'full', definitionId: 'pasta:1' })), 'full'), -1);
});

test('merge reducer conserves items, rejects unlike merges, serves orders, and does not charge free moves', () => {
  const config = resolveMergeConfig(0);
  let state = createMergeRound('feastle:merge:reducer', config);
  const occupied = state.board.flatMap((item, index) => item ? [index] : []);
  const empty = state.board.findIndex((item) => !item);
  const beforeMoves = state.movesUsed;
  state = mergeRoundReducer(state, { type: 'move', from: occupied[0], to: empty }, config.moveBudget);
  assert.equal(state.movesUsed, beforeMoves);
  assert.ok(state.board[empty]);

  const unlike = state.board.flatMap((item, index) => item ? [{ item, index }] : []);
  const left = unlike[0];
  const right = unlike.find((candidate) => candidate.item.definitionId !== left.item.definitionId)!;
  assert.equal(canMergeItems(left.item, right.item), false);
  assert.deepEqual(mergeRoundReducer(state, { type: 'move', from: left.index, to: right.index }, config.moveBudget), state);

  const solved = solveMergeRound(state, config.moveBudget);
  assert.equal(solved.status, 'won');
  assert.equal(solved.orders.filter((order) => order.completed).length, 2);
  assert.ok(solved.movesUsed <= config.moveBudget);
});

test('every sampled Feastle merge round is solvable within its budget', () => {
  for (let completed = 0; completed <= 6; completed += 2) {
    const config = resolveMergeConfig(completed);
    for (let index = 0; index < 250; index += 1) {
      const solved = solveMergeRound(createMergeRound(`feastle:solver:${completed}:${index}`, config), config.moveBudget);
      assert.equal(solved.status, 'won', `seed ${completed}:${index} should be solvable`);
      assert.ok(solved.movesUsed <= config.moveBudget);
    }
  }
});

test('trivia round is seeded, unique, scoreable, and completes after every answer', () => {
  let round = createTriviaRound({ packIds: ['film'], questionCount: 5, seed: 'flickerbun:day-1' });
  const repeated = createTriviaRound({ packIds: ['film'], questionCount: 5, seed: 'flickerbun:day-1' });
  assert.deepEqual(round.questions.map((question) => question.id), repeated.questions.map((question) => question.id));
  assert.equal(new Set(round.questions.map((question) => question.id)).size, 5);
  for (let index = 0; index < round.questions.length; index += 1) {
    round = answerTriviaQuestion(round, round.questions[index].correctChoiceId);
    if (index < round.questions.length - 1) round = { ...round, index: index + 1 };
  }
  assert.equal(triviaRoundScore(round), 5);
  assert.equal(triviaRoundComplete(round), true);
});

function solveMergeRound(initial: MergeRoundState, moveBudget: number): MergeRoundState {
  let state = initial;
  for (let guard = 0; guard < 500 && state.status === 'playing'; guard += 1) {
    let acted = false;
    for (let cell = 0; cell < state.board.length; cell += 1) {
      const order = readyOrderForItem(state, cell);
      if (!order) continue;
      state = mergeRoundReducer(state, { type: 'serve', cell, orderId: order.id }, moveBudget);
      acted = true;
      break;
    }
    if (acted) continue;
    for (let left = 0; left < state.board.length; left += 1) {
      for (let right = left + 1; right < state.board.length; right += 1) {
        if (!canMergeItems(state.board[left], state.board[right])) continue;
        state = mergeRoundReducer(state, { type: 'move', from: left, to: right }, moveBudget);
        acted = true;
        break;
      }
      if (acted) break;
    }
    if (acted) continue;
    const empty = state.board.findIndex((item) => !item);
    if (empty >= 0 && state.pantry.length) {
      state = mergeRoundReducer(state, { type: 'spawn', cell: empty }, moveBudget);
      acted = true;
    }
    if (!acted) break;
  }
  return state;
}

function matchThreeFixture(kinds: string[], rows: number, columns: number): MatchThreeState {
  const board: MatchThreeTile[] = kinds.map((kind, index) => ({ id: `fixture-${index}`, kind, special: null }));
  return {
    board,
    blockers: board.map(() => 0),
    objectives: [{ id: 'fixture', kindIds: ['a', 'b'], target: 99, collected: 0 }],
    rows,
    columns,
    movesRemaining: 20,
    movesUsed: 0,
    frostCleared: 0,
    frostTarget: 0,
    maxCascade: 0,
    specialsTriggered: 0,
    status: 'playing',
    rngState: 12345,
    nextTileId: 100,
    tileKinds: ['a', 'b', 'c', 'd'],
  };
}
