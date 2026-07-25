import assert from 'node:assert/strict';
import test from 'node:test';

import { completedQuestCount, resolveBlockJamConfig, resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig, resolveWordPathsDifficulty } from '@/utils/quests/experiences/difficulty';
import { BLOCK_JAM_RULESET, availableBlockJamDoor, blockJamOccupancy, blockJamPath, blockJamPieceTargetAtPoint, blockJamReducer, createBlockJamState, nearestBlockJamPieceAtPoint, reachableBlockJamAnchors, TASKLET_DESK_JAM_LEVELS, validateBlockJamLevel, type BlockJamLevel } from '@/utils/quests/experiences/block-jam';
import { blockJamDragAnchorAtPose, blockJamDragCollisionAt, blockJamDragExitAtPose, createBlockJamDragContext, resolveBlockJamDrag } from '@/utils/quests/experiences/block-jam-drag';
import { blockJamSilhouettePath, blockJamSilhouetteSegments } from '@/utils/quests/experiences/block-jam-silhouette';
import { BLOCK_BLAST_BOARD_SIZE, BLOCK_BLAST_PRIMARY_TRAY_FAMILY_IDS, BLOCK_BLAST_RULESET, BLOCK_BLAST_SHAPES, blockBlastClearCascadePhase, blockBlastOriginFromFootprintCenter, blockBlastReducer, blockBlastShapeIsConnected, blockBlastShapeIsNormalised, blockBlastStreakWord, blockBlastTrayHasReservedPlacements, blockBlastTrayIsCompletable, blockBlastValidOriginMask, canPlaceBlockBlastPiece, createBlockBlastState, generateBlockBlastTray, nearestBlockBlastOrigin, nearestBlockBlastWorldOrigin, nearestSnappedBlockBlastOrigin, projectedBlockBlastLines, type BlockBlastPiece, type BlockBlastState } from '@/utils/quests/experiences/block-blast';
import { hydrateBlockBlastProfile, type BlockBlastProfile } from '@/utils/quests/experiences/block-blast-profile';
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
import { createSortingRound, ERRANDIMP_SORTING_ITEMS, FEASTLE_SORTING_ITEMS, TASKLET_SORTING_ITEMS, validateSortingItems } from '@/utils/quests/experiences/sorting';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import { createMatchingDeck, createMemoryMatchState, FEASTLE_MATCHING_MOTIFS, memoryMatchPresentation, memoryMatchReducer, MOSSPROUT_MATCHING_MOTIFS, RELICOON_MATCHING_MOTIFS, shuffleMatchingDeck, validateMatchingMotifs } from '@/utils/quests/experiences/matching';
import { attemptMatchThreeSwap, createMatchThreeState, findMatchRuns, hasLegalMove, MATCH_THREE_DIFFICULTY, resolveMatchThreeConfig, type MatchThreeState, type MatchThreeTile } from '@/utils/quests/experiences/match-three';
import { matchThreePack, validateMatchThreePack } from '@/utils/quests/experiences/match-three-packs';
import { questDefinition } from '@/utils/quests/definitions';
import { themedQuestOffers } from '@/utils/quests/themed';

test('Steppling, Flickerbun, and Pagelet receive their interactive quest families', () => {
  assert.ok(themedQuestOffers('high_steps_day', 'journey', 'steppling').some((offer) => offer.id === 'quest-steppling-stride'));
  assert.ok(themedQuestOffers('cinema', 'culture', 'flickerbun').some((offer) => offer.id === 'quest-film-trivia'));
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-book-trivia'));
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-pagelet-lost-word'));
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-pagelet-word-paths'));
});

test('companion quest pools include their reusable mini-games', () => {
  assert.ok(themedQuestOffers('coffee_shop', 'food', 'baristabbit').some((offer) => offer.id === 'quest-coffee-ritual-brew-sequence'));
  assert.ok(themedQuestOffers('errand_loop', 'craft', 'errandimp').some((offer) => offer.id === 'quest-errandimp-sort'));
  assert.ok(themedQuestOffers('dawn', 'memory', 'dawnle').some((offer) => offer.id === 'quest-dawnle-first-light'));
  assert.ok(themedQuestOffers('tender_day', 'memory', 'mendle').some((offer) => offer.id === 'quest-mendle-breathe'));
  assert.ok(themedQuestOffers('reflection', 'memory', 'quietome').some((offer) => offer.id === 'quest-quietome-still-signals'));
  assert.ok(themedQuestOffers('good_sleep', 'night', 'bedrotte').some((offer) => offer.id === 'quest-bedrotte-breathe'));
  assert.ok(themedQuestOffers('park', 'places', 'mossprout').some((offer) => offer.id === 'quest-mossprout-memory'));
  assert.ok(themedQuestOffers('city', 'places', 'skylo').some((offer) => offer.id === 'quest-skylo-city-trivia'));
  assert.ok(themedQuestOffers('social_gathering', 'memory', 'gatherglow').some((offer) => offer.id === 'quest-gatherglow-pattern'));
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-merge'));
  assert.ok(themedQuestOffers('focus_work', 'craft', 'tasklet').some((offer) => offer.id === 'quest-tasklet-desk-jam'));
  assert.ok(themedQuestOffers('celebration', 'celebrate', 'cheerlet').some((offer) => offer.id === 'quest-cheerlet-block-party'));
  assert.equal(questDefinition('quest-cheerlet-block-party')?.execution?.kind, 'block_blast');
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-memory'));
  assert.ok(themedQuestOffers('museum', 'culture', 'relicoon').some((offer) => offer.id === 'quest-relicoon-match'));
  assert.ok(themedQuestOffers('live_music', 'culture', 'encora').some((offer) => offer.id === 'quest-encora-rhythm'));
  const moonSignals = questDefinition('quest-vesperitt-moon-signals')?.execution;
  assert.equal(moonSignals?.kind === 'pattern_memory' ? moonSignals.gameId : null, 'vesperitt-moon-signals');
});

test('Block Party V2 ships connected, role-classified shapes and deterministic fair trays', () => {
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
  assert.ok(BLOCK_BLAST_SHAPES.filter((shape) => shape.role === 'standard').every((shape) => shape.cells.length >= 4));
  assert.deepEqual(new Set(BLOCK_BLAST_SHAPES.filter((shape) => shape.role === 'rescue').map((shape) => shape.familyId)), new Set(['domino', 'line-3', 'corner-3']));
  assert.deepEqual(new Set(BLOCK_BLAST_SHAPES.filter((shape) => shape.role === 'last_resort').map((shape) => shape.familyId)), new Set(['single']));
  const first = createBlockBlastState('cheerlet:test', 100);
  const second = createBlockBlastState('cheerlet:test', 100);
  assert.deepEqual(first.tray, second.tray);
  assert.equal(first.rulesetId, BLOCK_BLAST_RULESET);
  assert.equal(BLOCK_BLAST_RULESET, 'cheerlet-block-party-v2');
  assert.equal(first.board.length, BLOCK_BLAST_BOARD_SIZE * BLOCK_BLAST_BOARD_SIZE);
  assert.equal(first.tray.length, 3);
  assert.equal(new Set(first.tray.map((piece) => BLOCK_BLAST_SHAPES.find((shape) => shape.id === piece.shapeId)?.familyId)).size, 3, 'open-board trays use distinct shape families');
  assert.equal(new Set(first.tray.map((piece) => piece.colorId)).size, 3, 'tray colors are distinct when the palette allows it');
  assert.ok(first.tray.every((piece) => BLOCK_BLAST_SHAPES.find((shape) => shape.id === piece.shapeId)?.role === 'standard'), 'open boards do not consume rescue pieces');
  assert.ok(first.tray.filter((piece) => piece.cells.length >= 6).length <= 1, 'standard trays contain at most one large piece');
  assert.equal(blockBlastTrayHasReservedPlacements(first.board, first.tray), true);
  assert.equal(blockBlastTrayIsCompletable(first.board, first.tray), true);

  const primaryFamilies = new Set<string>(BLOCK_BLAST_PRIMARY_TRAY_FAMILY_IDS);
  const observedPrimaryFamilies = new Set<string>();
  for (let sample = 0; sample < 100; sample += 1) {
    for (const piece of createBlockBlastState(`primary-pool:${sample}`, 100).tray) {
      const familyId = BLOCK_BLAST_SHAPES.find((shape) => shape.id === piece.shapeId)?.familyId;
      assert.ok(familyId && primaryFamilies.has(familyId), `open tray uses shared PRESET_LIBRARY family ${familyId}`);
      observedPrimaryFamilies.add(familyId!);
    }
  }
  assert.deepEqual(observedPrimaryFamilies, primaryFamilies, 'every enabled shared-code tray family appears across deterministic open-board samples');

  const crowded = Array.from({ length: 64 }, (_, index) => index === 63 ? null : 'rose' as const);
  const generated = generateBlockBlastTray(crowded, 123, 4);
  assert.equal(generated.tray.length, 3);
  assert.equal(blockBlastTrayIsCompletable(crowded, generated.tray), true, 'a constrained refill is proven playable through its complete sequence');
  assert.ok(generated.tray.some((piece) => piece.cells.length === 1), 'a one-cell opening reaches the deterministic last-resort ladder');

  const threeSingles = Array.from({ length: 3 }, (_, index): BlockBlastPiece => ({ id: `single-${index}`, shapeId: 'single', cells: [{ row: 0, column: 0 }], colorId: 'teal', used: false }));
  assert.equal(blockBlastTrayHasReservedPlacements(crowded, threeSingles), false, 'one empty cell cannot reserve three simultaneous footprints');
  assert.equal(blockBlastTrayIsCompletable(crowded, threeSingles), true, 'filling the final cell clears lines and opens the verified continuation');
  assert.deepEqual(generateBlockBlastTray(Array.from({ length: 64 }, () => 'rose'), 777, 9), { tray: [], rngState: 777 }, 'a board with no legal origin exits generation without consuming RNG');

  for (let sample = 0; sample < 32; sample += 1) {
    const sampledBoard = Array.from({ length: 64 }, (_, index) => ((index * 17 + sample * 13) % 10 < 5 + sample % 3 ? 'blue' as const : null));
    const sampleTray = generateBlockBlastTray(sampledBoard, 1_000 + sample, sample);
    assert.equal(sampleTray.tray.length, 3, `sample ${sample} generates a complete tray`);
    assert.equal(blockBlastTrayIsCompletable(sampledBoard, sampleTray.tray), true, `sample ${sample} generates a proven tray`);
    assert.equal(blockBlastTrayHasReservedPlacements(sampledBoard, sampleTray.tray), true, `sample ${sample} gives all three pieces immediate non-overlapping placements`);
    assert.equal(new Set(sampleTray.tray.map((piece) => piece.colorId)).size, 3, `sample ${sample} keeps colors distinct`);
  }
});

test('Block Party V2 starts a separate profile while carrying forward only the V1 sound preference', () => {
  const activeRun = createBlockBlastState('cheerlet:v2-profile', 100);
  const legacyPayload = {
    schemaVersion: 1,
    rulesetId: 'cheerlet-block-party-v1',
    highScore: 99_999,
    totalRuns: 12,
    soundEnabled: false,
    activeRun: { ...activeRun, rulesetId: 'cheerlet-block-party-v1' },
  } as unknown as Partial<BlockBlastProfile>;
  const migrated = hydrateBlockBlastProfile(legacyPayload, { soundEnabled: false });
  assert.equal(migrated.rulesetId, 'cheerlet-block-party-v2');
  assert.equal(migrated.highScore, 0, 'V1 scores are not compared with the V2 ruleset');
  assert.equal(migrated.totalRuns, 0);
  assert.equal(migrated.activeRun, null, 'V1 active runs are not resumed under V2');
  assert.equal(migrated.soundEnabled, false, 'the non-scoring sound preference carries forward');

  const current = hydrateBlockBlastProfile({ ...migrated, highScore: 420, totalRuns: 3, activeRun }, { soundEnabled: true });
  assert.equal(current.highScore, 420);
  assert.equal(current.totalRuns, 3);
  assert.equal(current.activeRun?.seed, activeRun.seed);
  assert.equal(current.soundEnabled, false, 'an existing V2 preference takes precedence over the legacy profile');

  const { trayAlgorithmVersion: _staleVersion, ...staleRun } = activeRun;
  const stale = hydrateBlockBlastProfile({ ...current, activeRun: staleRun as BlockBlastState }, null);
  assert.equal(stale.activeRun, null, 'saved trays from the earlier V2 generator are invalidated instead of being shown again');
});

test('Block Party drag targeting captures the nearest geometric cells generously at board boundaries', () => {
  const board = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  const square = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1, column: 1 }];
  assert.deepEqual(blockBlastOriginFromFootprintCenter(square, 3.5, 4.5), { row: 3, column: 4 }, 'piece and board footprint centers align one-to-one');
  const tallCorner = [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 }, { row: 2, column: 1 }];
  assert.deepEqual(blockBlastOriginFromFootprintCenter(tallCorner, 4, 3.5), { row: 3, column: 3 }, 'asymmetric pieces use their complete visual footprint center');
  const boardFirstCellCenter = { x: 100, y: 200 };
  assert.deepEqual(nearestBlockBlastWorldOrigin(board, square, { x: 280, y: 340 }, boardFirstCellCenter, 40), { row: 3, column: 4 }, 'world-space centers select the cells directly beneath a square piece');
  assert.deepEqual(nearestBlockBlastWorldOrigin(board, square, { x: 280, y: 361 }, boardFirstCellCenter, 40), { row: 4, column: 4 }, 'crossing the world-space halfway point selects the next row');
  assert.deepEqual(nearestBlockBlastWorldOrigin(board, tallCorner, { x: 240, y: 360 }, boardFirstCellCenter, 40), { row: 3, column: 3 }, 'every occupied cell in an asymmetric piece aligns with its corresponding board center');
  assert.deepEqual(nearestBlockBlastOrigin(square, -1.5, -1.4), { row: 0, column: 0 });
  assert.deepEqual(nearestBlockBlastOrigin(square, 7.4, 7.5), { row: 6, column: 6 });
  const lineFive = [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 }, { row: 0, column: 4 }];
  assert.deepEqual(nearestBlockBlastOrigin(lineFive, 2, -4.5), { row: 2, column: 0 }, 'a long piece is captured while only its far edge overlaps the board');
  assert.equal(nearestBlockBlastOrigin(square, -3, 0), null, 'pieces far away from the board are not captured');

  board[3 * 8 + 3] = 'rose';
  const occupiedOrigin = nearestBlockBlastOrigin([{ row: 0, column: 0 }], 3.1, 3.1);
  assert.deepEqual(occupiedOrigin, { row: 3, column: 3 }, 'targeting chooses the closest geometric cell even when occupied');
  assert.equal(canPlaceBlockBlastPiece(board, [{ row: 0, column: 0 }], occupiedOrigin!.row, occupiedOrigin!.column), false);
  assert.deepEqual(nearestSnappedBlockBlastOrigin(board, [{ row: 0, column: 0 }], 3.1, 3.1), { row: 3, column: 4 }, 'an adjacent fully valid origin catches a blocked nearest cell');
  assert.deepEqual(nearestSnappedBlockBlastOrigin(board, [{ row: 0, column: 0 }], 3.48, 3.48), { row: 3, column: 4 }, 'an almost-equidistant valid neighbour catches the piece seamlessly');

  const verticalOnly = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  verticalOnly[3 * 8 + 2] = 'rose';
  verticalOnly[3 * 8 + 3] = 'rose';
  verticalOnly[3 * 8 + 4] = 'rose';
  assert.deepEqual(nearestSnappedBlockBlastOrigin(verticalOnly, [{ row: 0, column: 0 }], 2.9, 3), { row: 2, column: 3 }, 'a blocked origin snaps upward when the floating piece is closer above it');
  assert.deepEqual(nearestSnappedBlockBlastOrigin(verticalOnly, [{ row: 0, column: 0 }], 3.1, 3), { row: 4, column: 3 }, 'a blocked origin snaps downward when the floating piece is closer below it');

  const diagonalOnly = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  diagonalOnly[3 * 8 + 3] = 'rose';
  diagonalOnly[2 * 8 + 3] = 'rose';
  diagonalOnly[3 * 8 + 2] = 'rose';
  diagonalOnly[3 * 8 + 4] = 'rose';
  diagonalOnly[4 * 8 + 3] = 'rose';
  assert.deepEqual(nearestSnappedBlockBlastOrigin(diagonalOnly, [{ row: 0, column: 0 }], 3, 3), { row: 2, column: 2 }, 'an immediately diagonal valid origin remains within the forgiving snap envelope');

  const blockedNeighbourhood = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  for (let row = 2; row <= 4; row += 1) {
    for (let column = 2; column <= 4; column += 1) blockedNeighbourhood[row * 8 + column] = 'rose';
  }
  assert.deepEqual(nearestSnappedBlockBlastOrigin(blockedNeighbourhood, [{ row: 0, column: 0 }], 3.1, 3.1), { row: 3, column: 3 }, 'targeting does not jump to an opening outside the local snap radius');

  const blockedCorner = Array.from({ length: 64 }, () => null) as BlockBlastState['board'];
  blockedCorner[0] = 'rose';
  assert.deepEqual(nearestSnappedBlockBlastOrigin(blockedCorner, [{ row: 0, column: 0 }], -0.7, 0.05), { row: 0, column: 1 }, 'edge targeting measures nearby valid origins from the clamped board position');
});

test('Block Party compact placement masks exactly match placement rules', () => {
  for (let sample = 0; sample < 24; sample += 1) {
    const board = Array.from({ length: BLOCK_BLAST_BOARD_SIZE ** 2 }, (_, index) =>
      ((index * 17 + sample * 11) % 7 < 2 ? 'rose' as const : null));
    for (const shape of BLOCK_BLAST_SHAPES.filter((_, index) => index % 7 === sample % 7)) {
      const mask = blockBlastValidOriginMask(board, shape.cells);
      assert.equal(mask.length, BLOCK_BLAST_BOARD_SIZE ** 2);
      for (let row = 0; row < BLOCK_BLAST_BOARD_SIZE; row += 1) {
        for (let column = 0; column < BLOCK_BLAST_BOARD_SIZE; column += 1) {
          assert.equal(mask[row * BLOCK_BLAST_BOARD_SIZE + column] === 1, canPlaceBlockBlastPiece(board, shape.cells, row, column));
        }
      }
    }
  }
});

test('Block Party clears simultaneous lines and applies placement, clear, and perfect-board scoring', () => {
  assert.deepEqual([1, 3, 5, 7, 9, 20].map(blockBlastStreakWord), ['GOOD', 'GREAT', 'EPIC', 'LEGENDARY', 'GODLIKE', 'GODLIKE']);
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
  assert.equal(next.score, 1010, '10 placement + 400 double line + 100 streak bonus + 500 perfect clear');
  assert.equal(next.linesCleared, 2);
  assert.equal(next.combo, 2, 'a simultaneous row and column clear counts as a two-line streak');
  assert.equal(next.maxCombo, 2);

  const continued = blockBlastReducer(
    { ...state, combo: 2, maxCombo: 2 },
    { type: 'place', pieceId: single.id, row: 0, column: 0, now: 201 },
  );
  assert.equal(continued.combo, 4, 'two more lines extend a two-line streak to four');
  assert.equal(blockBlastStreakWord(continued.combo), 'GREAT');
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

test('Block Jam tap targeting generously chooses the nearest piece within a firm threshold', () => {
  const level: BlockJamLevel = {
    id: 'tap-target-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 5, columns: 6, parMoves: 2, timeLimitMs: 180_000, fixedCells: [],
    blocks: [
      { id: 'left', colorId: 'cyan', anchor: { row: 2, column: 1 }, cells: [{ row: 0, column: 0 }] },
      { id: 'right', colorId: 'red', anchor: { row: 2, column: 4 }, cells: [{ row: 0, column: 0 }] },
    ],
    doors: [],
  };
  const state = createBlockJamState(level);
  const layout = { cell: 20, gap: 2, outer: 10 };

  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 66, y: 64 }, layout), 'left', 'nearby empty space selects the closest shape');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 10, y: 64 }, layout), 'left', 'the default generous radius reaches beyond one cell width');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 75, y: 42 }, layout), 'left', 'the center of an empty adjacent tile selects its nearest piece');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 75, y: 64 }, layout), 'left', 'an exact distance tie resolves deterministically by piece order');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 108, y: 64 }, layout), 'right', 'a direct hit selects its piece');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 0, y: 64 }, layout), null, 'the generous radius still has a firm maximum distance');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 4, y: 4 }, layout), null, 'distant corner taps select nothing');
  assert.equal(nearestBlockJamPieceAtPoint(level, { ...state, clearedBlockIds: ['left'] }, { x: 66, y: 64 }, layout), null, 'cleared pieces are skipped without reaching beyond the one-tile threshold');

  const nestedLevel: BlockJamLevel = {
    ...level,
    id: 'tap-target-nested-l-fixture',
    rows: 4,
    columns: 4,
    blocks: [
      { id: 'large-l', colorId: 'cyan', anchor: { row: 0, column: 0 }, cells: [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 }, { row: 2, column: 1 }, { row: 2, column: 2 }] },
      { id: 'small-l', colorId: 'red', anchor: { row: 0, column: 1 }, cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }, { row: 1, column: 1 }] },
    ],
  };
  const nestedState = createBlockJamState(nestedLevel);
  assert.equal(nearestBlockJamPieceAtPoint(nestedLevel, nestedState, { x: 43, y: 21 }, layout), 'small-l', 'an occupied cell inside a larger L bounding box belongs to the smaller nested piece');
  assert.equal(nearestBlockJamPieceAtPoint(nestedLevel, nestedState, { x: 42, y: 43 }, layout), 'large-l', 'an empty concave corner resolves actual occupied-cell distance ties deterministically');
});

test('Block Jam targeting uses exactly one neighboring tile and ranks actual occupied cells', () => {
  const level: BlockJamLevel = {
    id: 'tile-target-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 6, columns: 6, parMoves: 2, timeLimitMs: 180_000, fixedCells: [], doors: [],
    blocks: [
      { id: 'first', colorId: 'cyan', anchor: { row: 2, column: 2 }, cells: [{ row: 0, column: 0 }] },
      { id: 'second', colorId: 'red', anchor: { row: 2, column: 4 }, cells: [{ row: 0, column: 0 }] },
    ],
  };
  const state = createBlockJamState(level);
  const layout = { cell: 20, gap: 2, outer: 10 };

  assert.deepEqual(blockJamPieceTargetAtPoint(level, state, { x: 64, y: 64 }, layout), {
    blockId: 'first', cell: { row: 2, column: 2 }, distanceSquared: 0, exact: true,
  }, 'a direct tile hit always owns the touch');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 42, y: 64 }, layout), 'first', 'an orthogonally adjacent empty tile selects');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 42, y: 42 }, layout), 'first', 'a diagonally adjacent empty tile selects');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 20, y: 64 }, layout), null, 'a tile two columns away is outside the capture range');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 86, y: 64 }, layout), 'first', 'equal distances resolve by stable level order');
  assert.equal(nearestBlockJamPieceAtPoint(level, state, { x: 90, y: 64 }, layout), 'second', 'precise touch distance chooses the closer occupied cell within the same empty tile');
  assert.equal(nearestBlockJamPieceAtPoint({ ...level, fixedCells: [13] }, state, { x: 42, y: 64 }, layout), null, 'fixed obstacle tiles do not provide empty-cell capture padding');
});

test('Block Jam selected outlines form one rounded union silhouette', () => {
  const lShape = [{ row: 0, column: 0 }, { row: 1, column: 0 }, { row: 1, column: 1 }];
  const path = blockJamSilhouettePath(lShape, { pitch: 32, width: 62, height: 62, radius: 6, padding: 8 });
  assert.equal((path.match(/M /g) ?? []).length, 1, 'connected cells produce one perimeter rather than one path per cell');
  assert.equal((path.match(/ Z/g) ?? []).length, 1, 'the union perimeter closes exactly once');
  assert.ok((path.match(/Q /g) ?? []).length >= 6, 'outer corners and the inward bend use rounded quadratic corners');
  assert.equal(path.includes('NaN'), false);
  const segments = blockJamSilhouetteSegments(lShape, { pitch: 32, width: 62, height: 62, padding: 8 });
  assert.equal(segments.length, 8, 'three joined cells expose only the eight outer boundary edges');
  assert.equal(segments.some((segment) => segment.x1 === 40 && segment.x2 === 40 && Math.min(segment.y1, segment.y2) === 40 && Math.max(segment.y1, segment.y2) === 70), false, 'the shared internal cell edge is absent');

  for (const level of TASKLET_DESK_JAM_LEVELS) {
    for (const block of level.blocks) {
      const columns = Math.max(...block.cells.map((cell) => cell.column)) + 1;
      const rows = Math.max(...block.cells.map((cell) => cell.row)) + 1;
      const candidate = blockJamSilhouettePath(block.cells, { pitch: 30, width: columns * 30 - 2, height: rows * 30 - 2, radius: 5, padding: 8 });
      assert.equal((candidate.match(/M /g) ?? []).length, 1, `${level.id}/${block.id} has one connected silhouette`);
      assert.equal(candidate.includes('NaN'), false, `${level.id}/${block.id} has finite silhouette geometry`);
    }
  }
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

test('Block Jam continuous dragging stops fast swipes and slides along obstacle faces', () => {
  const level: BlockJamLevel = {
    id: 'continuous-drag-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 5, columns: 5, parMoves: 2, timeLimitMs: 180_000, fixedCells: [4 * 5 + 4],
    blocks: [
      { id: 'moving', colorId: 'cyan', anchor: { row: 1, column: 0 }, cells: [{ row: 0, column: 0 }] },
      { id: 'wall', colorId: 'red', anchor: { row: 1, column: 2 }, cells: [{ row: 0, column: 0 }] },
    ],
    doors: [],
  };
  const state = createBlockJamState(level);
  const context = createBlockJamDragContext(level, state, level.blocks[0], state.anchors.moving, { cell: 30, gap: 2, outer: 20 });
  const uncapped = { ...context, maxCatchUp: 200 };
  const blocked = resolveBlockJamDrag(uncapped, { x: 0, y: 0 }, { x: 130, y: 0 });

  assert.equal(blockJamDragCollisionAt(context, blocked.x, blocked.y), null, 'a resolved pose never overlaps its blocker');
  assert.ok(blocked.x < context.pitch * 1.1, 'a fast swipe cannot tunnel through a full cell');
  assert.equal(blocked.contactKey, 'block:wall');
  assert.equal(blocked.contactAxis, 'x');
  assert.deepEqual(blockJamDragAnchorAtPose(context, blocked), { row: 1, column: 1 }, 'the last physically reached grid cell remains available');

  let sliding = { x: 0, y: 0 };
  for (let index = 0; index < 8; index += 1) sliding = resolveBlockJamDrag(context, sliding, { x: 96, y: 64 });
  assert.equal(blockJamDragCollisionAt(context, sliding.x, sliding.y), null);
  assert.ok(sliding.y > context.pitch * .8, 'the unblocked tangent axis continues moving');
  assert.ok(sliding.x > context.pitch * 1.5, 'the block catches up only after sliding beyond the obstacle');
});

test('Block Jam dragging hands a piece to its exit as soon as it reaches a valid exit anchor', () => {
  const level: BlockJamLevel = {
    id: 'drag-auto-exit-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 4, columns: 4, parMoves: 1, timeLimitMs: 180_000, fixedCells: [],
    blocks: [{ id: 'moving', colorId: 'cyan', anchor: { row: 2, column: 1 }, cells: [{ row: 0, column: 0 }] }],
    doors: [{ id: 'bottom-cyan', colorId: 'cyan', edge: 'bottom', offset: 1, span: 1 }],
  };
  const state = createBlockJamState(level);
  const context = createBlockJamDragContext(level, state, level.blocks[0], state.anchors.moving, { cell: 30, gap: 2, outer: 20 });

  assert.equal(blockJamDragExitAtPose(level, state, 'moving', context, { x: 0, y: 0 }), null, 'the starting anchor is not yet at its exit');
  assert.deepEqual(blockJamDragExitAtPose(level, state, 'moving', context, { x: 0, y: context.pitch }), {
    anchor: { row: 3, column: 1 },
    door: level.doors[0],
  });
});

test('Block Jam continuous dragging cannot cut a blocked corner or leave the board', () => {
  const level: BlockJamLevel = {
    id: 'continuous-corner-fixture', rulesetId: BLOCK_JAM_RULESET, packId: 'tasklet-desk', chapter: 'tutorial', tier: 1,
    rows: 4, columns: 4, parMoves: 3, timeLimitMs: 180_000, fixedCells: [],
    blocks: [
      { id: 'moving', colorId: 'cyan', anchor: { row: 0, column: 0 }, cells: [{ row: 0, column: 0 }] },
      { id: 'right', colorId: 'red', anchor: { row: 0, column: 1 }, cells: [{ row: 0, column: 0 }] },
      { id: 'below', colorId: 'amber', anchor: { row: 1, column: 0 }, cells: [{ row: 0, column: 0 }] },
    ],
    doors: [],
  };
  const state = createBlockJamState(level);
  const context = { ...createBlockJamDragContext(level, state, level.blocks[0], state.anchors.moving, { cell: 30, gap: 2, outer: 20 }), maxCatchUp: 200 };
  const diagonal = resolveBlockJamDrag(context, { x: 0, y: 0 }, { x: 96, y: 96 });
  const outside = resolveBlockJamDrag(context, { x: 0, y: 0 }, { x: -96, y: -96 });

  assert.ok(diagonal.x < 4 && diagonal.y < 4, 'orthogonal blockers prevent diagonal corner cutting');
  assert.equal(blockJamDragCollisionAt(context, diagonal.x, diagonal.y), null);
  assert.ok(outside.x > -1 && outside.y > -1, 'board edges remain solid');
  assert.equal(blockJamDragCollisionAt(context, outside.x, outside.y), null);
});

test('Block Jam drag resolution stays collision-free across deterministic stress trajectories', () => {
  let seed = 0x9e3779b9;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };

  for (const level of TASKLET_DESK_JAM_LEVELS) {
    const state = createBlockJamState(level);
    for (const block of level.blocks) {
      const context = createBlockJamDragContext(level, state, block, state.anchors[block.id], { cell: 28, gap: 2, outer: 20 });
      let pose = { x: 0, y: 0 };
      for (let step = 0; step < 40; step += 1) {
        const target = { x: (next() * 2 - 1) * context.pitch * level.columns, y: (next() * 2 - 1) * context.pitch * level.rows };
        pose = resolveBlockJamDrag(context, pose, target);
        assert.equal(blockJamDragCollisionAt(context, pose.x, pose.y), null, `${level.id}/${block.id} overlaps after stress step ${step}`);
      }
    }
  }
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

test('Errandimp sorting separates admin, home, and out-of-home loops', () => {
  assert.equal(ERRANDIMP_SORTING_ITEMS.length, 45);
  assert.deepEqual(validateSortingItems(ERRANDIMP_SORTING_ITEMS), []);
  const round = createSortingRound('errandimp:day-1', 12, [], 'errandimp-loops', 2);
  assert.equal(round.length, 12);
  assert.deepEqual(new Set(round.map((item) => item.category)), new Set(['admin', 'home', 'out']));
  const execution = questDefinition('quest-errandimp-sort')?.execution;
  assert.equal(execution?.kind === 'sorting' ? execution.packId : null, 'errandimp-loops');
});

test('Mossprout memory match uses deterministic garden assets and keeps legacy watering readable', () => {
  assert.equal(memoryMatchPresentation('mossprout-garden'), 'memory_garden');
  assert.equal(memoryMatchPresentation('relicoon-gallery'), 'standard');
  assert.equal(memoryMatchPresentation('feastle-food'), 'standard');
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
  assert.equal(themedQuestOffers('park', 'places', 'mossprout').some((offer) => offer.id === 'quest-mossprout-tend'), true);
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
