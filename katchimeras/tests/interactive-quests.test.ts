import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBreathingConfig, resolveLostWordDifficulty, resolveMatchingConfig, resolveMergeConfig, resolvePatternConfig, resolveRhythmConfig, resolveSortingConfig, resolveStepChallengeConfig, resolveTimingConfig } from '@/utils/quests/experiences/difficulty';
import { canMergeItems, createMergeRound, FEASTLE_MERGE_ITEMS, MERGE_BOARD_COLUMNS, MERGE_BOARD_ROWS, MERGE_BOARD_SIZE, mergeBoardCellFromPoint, mergeRoundMinimumActions, mergeRoundReducer, readyOrderForItem, selectPantrySpawnCell, validateMergePack, type MergeRoundState } from '@/utils/quests/experiences/merge';
import { evaluateLostWordGuess, createLostWordRound, lostWordReducer, lostWordRoundComplete } from '@/utils/quests/experiences/lost-word';
import { LOST_WORD_PUZZLES, selectLostWordPuzzle, validateLostWordPuzzles } from '@/utils/quests/experiences/lost-word-puzzles';
import { answerTriviaQuestion, createTriviaRound, triviaRoundComplete, triviaRoundScore } from '@/utils/quests/experiences/trivia';
import { BOOK_TRIVIA_QUESTIONS, CITY_TRIVIA_QUESTIONS, FILM_TRIVIA_QUESTIONS, validateTriviaPack } from '@/utils/quests/experiences/trivia-packs';
import { advanceBreathing, createBreathingState } from '@/utils/quests/experiences/paced-breathing';
import { scoreTimingTap } from '@/utils/quests/experiences/timing-zone';
import { createPattern, patternComplete, patternMatches } from '@/utils/quests/experiences/pattern-memory';
import { createSortingRound, FEASTLE_SORTING_ITEMS, TASKLET_SORTING_ITEMS, validateSortingItems } from '@/utils/quests/experiences/sorting';
import { formatQuestDuration } from '@/utils/quests/experiences/duration';
import { createMatchingDeck, createMemoryMatchState, FEASTLE_MATCHING_MOTIFS, memoryMatchReducer, MOSSPROUT_MATCHING_MOTIFS, RELICOON_MATCHING_MOTIFS, shuffleMatchingDeck, validateMatchingMotifs } from '@/utils/quests/experiences/matching';
import { questDefinition } from '@/utils/quests/definitions';
import { themedQuestOffers } from '@/utils/quests/themed';

test('Steppling, Flickerbun, and Pagelet receive their interactive quest families first', () => {
  assert.equal(themedQuestOffers('high_steps_day', 'journey', 'steppling')[0]?.id, 'quest-steppling-stride');
  assert.equal(themedQuestOffers('cinema', 'culture', 'flickerbun')[0]?.id, 'quest-film-trivia');
  assert.equal(themedQuestOffers('bookstore', 'culture', 'pagelet')[0]?.id, 'quest-book-trivia');
  assert.ok(themedQuestOffers('bookstore', 'culture', 'pagelet').some((offer) => offer.id === 'quest-pagelet-lost-word'));
});

test('the new companion quest pools lead with their reusable mini-game', () => {
  assert.equal(themedQuestOffers('good_sleep', 'night', 'bedrotte')[0]?.id, 'quest-bedrotte-breathe');
  assert.equal(themedQuestOffers('park', 'places', 'mossprout')[0]?.id, 'quest-mossprout-memory');
  assert.equal(themedQuestOffers('city', 'places', 'skylo')[0]?.id, 'quest-skylo-city-trivia');
  assert.equal(themedQuestOffers('social_gathering', 'memory', 'gatherglow')[0]?.id, 'quest-gatherglow-pattern');
  assert.equal(themedQuestOffers('feast', 'food', 'feastle')[0]?.id, 'quest-feastle-merge');
  assert.equal(themedQuestOffers('focus_work', 'craft', 'tasklet')[0]?.id, 'quest-tasklet-sort');
  assert.ok(themedQuestOffers('feast', 'food', 'feastle').some((offer) => offer.id === 'quest-feastle-memory'));
  assert.equal(themedQuestOffers('museum', 'culture', 'relicoon')[0]?.id, 'quest-relicoon-match');
  assert.equal(themedQuestOffers('live_music', 'culture', 'encora')[0]?.id, 'quest-encora-rhythm');
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
