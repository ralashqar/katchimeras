import assert from 'node:assert/strict';
import test from 'node:test';

import {
  backfillQuestBondEvents,
  companionBondProgress,
  emptyCompanionBondState,
  questBondEventId,
  recordCompanionBondEvent,
  resetCompanionBondForCreatures,
} from '@/utils/companion-bond';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { selectBalancedQuestOffers, selectRankedQuestOffers, sortQuestOffersByAvailability } from '@/utils/quest-offer-order';

test('available quests sort above completed or tomorrow-only cards without losing authored order', () => {
  const offers = [
    { id: 'completed-real-life', availableToday: false },
    { id: 'first-available', availableToday: true },
    { id: 'tomorrow-only', availableToday: false },
    { id: 'replayable-mini-game', availableToday: true },
  ];
  assert.deepEqual(
    sortQuestOffersByAvailability(offers).map((offer) => offer.id),
    ['first-available', 'replayable-mini-game', 'completed-real-life', 'tomorrow-only'],
  );
});

test('companion bond resolves every level boundary and segment', () => {
  const state = (points: number) => ({
    schemaVersion: 1 as const,
    events: points ? [{ id: `points-${points}`, creatureId: 'feastle', kind: 'quest_completed' as const, points, occurredAt: 1 }] : [],
  });
  assert.deepEqual([0, 49, 50, 149, 150, 399, 400].map((points) => {
    const progress = companionBondProgress(state(points), 'feastle');
    return [progress.level, progress.segmentPoints, progress.segmentTarget, progress.pointsRemaining, progress.isMax];
  }), [
    [1, 0, 50, 50, false],
    [1, 49, 50, 1, false],
    [2, 0, 100, 100, false],
    [2, 99, 100, 1, false],
    [3, 0, 250, 250, false],
    [3, 249, 250, 1, false],
    [4, 0, 0, 0, true],
  ]);
});

test('bond events are idempotent and use their configured reward', () => {
  const event = { id: 'insight:feastle:2026-07-15', creatureId: 'feastle', kind: 'insight_engaged' as const, occurredAt: 1, dayId: '2026-07-15' };
  const first = recordCompanionBondEvent(emptyCompanionBondState(), event);
  const duplicate = recordCompanionBondEvent(first.state, event);
  assert.equal(first.awarded, true);
  assert.equal(first.points, 10);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.state.events.length, 1);
});

test('live awards queue a before/after receipt and reset removes it at true zero', () => {
  const first = recordCompanionBondEvent(emptyCompanionBondState(), {
    id: 'questionnaire:steppling:1',
    creatureId: 'steppling',
    kind: 'ideal_skin_questionnaire_completed',
    occurredAt: 100,
  }, { queueCelebration: true });
  assert.equal(first.receipt?.beforeTotal, 0);
  assert.equal(first.receipt?.afterTotal, 20);
  assert.equal(first.state.pendingCelebrations?.length, 1);

  const reset = resetCompanionBondForCreatures(first.state, ['steppling'], 200);
  assert.equal(companionBondProgress(reset, 'steppling').totalPoints, 0);
  assert.equal(reset.pendingCelebrations?.length, 0);
  assert.equal(reset.resetCutoffsByCreature?.['companion:steppling'], 200);

  const historicalQuestState: CompanionQuestState = {
    schemaVersion: 2,
    quests: [{ questId: 'quest-steppling-walk', creatureId: 'steppling', title: 'Walk', hint: 'Go', acceptedAt: 20, completedAt: 90, completedDayId: '2026-07-15' }],
    submissions: [], offerCycles: [], attempts: [],
  };
  assert.equal(companionBondProgress(backfillQuestBondEvents(reset, historicalQuestState), 'steppling').totalPoints, 0);
});

test('quest migration deduplicates completed rows and applies the quest lane reward', () => {
  const quest = { questId: 'quest-feastle-sort', creatureId: 'feastle', title: 'Set the table', hint: 'Sort it', acceptedAt: 10, completedAt: 20, completedDayId: '2026-07-15' };
  const quests: CompanionQuestState = {
    schemaVersion: 2,
    quests: [quest],
    submissions: [{ id: 'submission-1', questId: quest.questId, creatureId: quest.creatureId, dayId: '2026-07-15', sourceType: 'photo', sourceId: 'photo-1', submittedAt: 20 }],
    offerCycles: [],
    attempts: [],
  };
  const migrated = backfillQuestBondEvents(emptyCompanionBondState(), quests);
  assert.equal(migrated.events.length, 1);
  assert.equal(migrated.events[0]?.id, 'quest-submission:submission-1');
  assert.equal(companionBondProgress(migrated, 'feastle').totalPoints, 8);
});

test('daily quest choices are deterministic, weighted, and capped at three', () => {
  const offers = [
    { id: 'low-a', weight: 1 },
    { id: 'recommended', weight: 4 },
    { id: 'low-b', weight: 1 },
    { id: 'low-c', weight: 1 },
  ];
  const first = selectRankedQuestOffers(offers, 'feastle:2026-07-15');
  const second = selectRankedQuestOffers(offers, 'feastle:2026-07-15');
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(first[0]?.id, 'recommended');
});

test('Pagelet keeps both signature word games beside one real-life quest', () => {
  const offers = [
    { id: 'quest-book-trivia', lane: 'mini_game' as const },
    { id: 'quest-pagelet-learning-note', lane: 'real_life' as const },
    { id: 'quest-pagelet-lost-word', lane: 'mini_game' as const },
    { id: 'quest-pagelet-word-paths', lane: 'mini_game' as const },
    { id: 'quest-read-book', lane: 'real_life' as const },
  ];
  const selected = selectBalancedQuestOffers(
    offers,
    3,
    ['quest-pagelet-word-paths', 'quest-pagelet-lost-word'],
  );

  assert.deepEqual(selected.map((offer) => offer.id), [
    'quest-pagelet-learning-note',
    'quest-pagelet-word-paths',
    'quest-pagelet-lost-word',
  ]);
});
