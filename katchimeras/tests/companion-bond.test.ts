import assert from 'node:assert/strict';
import test from 'node:test';

import {
  backfillQuestBondEvents,
  companionBondProgress,
  emptyCompanionBondState,
  questBondEventId,
  recordCompanionBondEvent,
} from '@/utils/companion-bond';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { selectRankedQuestOffers } from '@/utils/quest-offer-order';

test('companion bond resolves every level boundary and segment', () => {
  const state = (points: number) => ({
    schemaVersion: 1 as const,
    events: points ? [{ id: `points-${points}`, creatureId: 'feastle', kind: 'quest_completed' as const, points, occurredAt: 1 }] : [],
  });
  assert.deepEqual([0, 99, 100, 249, 250, 499, 500].map((points) => {
    const progress = companionBondProgress(state(points), 'feastle');
    return [progress.level, progress.segmentPoints, progress.segmentTarget, progress.pointsRemaining, progress.isMax];
  }), [
    [1, 0, 100, 100, false],
    [1, 99, 100, 1, false],
    [2, 0, 150, 150, false],
    [2, 149, 150, 1, false],
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
  assert.equal(companionBondProgress(migrated, 'feastle').totalPoints, 10);
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
