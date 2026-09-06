import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord, TodayGrowthEvent } from '@/types/home';
import { dailyJourneyForDay, nextDailyJourneyMilestone } from '@/utils/daily-journey';
import { resolveMetaEvent, unappliedRewardGrants } from '@/utils/meta-progression';

const event = (source: TodayGrowthEvent['source'], sourceId: string): TodayGrowthEvent => ({
  id: `growth:${source}:${sourceId}`,
  source,
  sourceId,
  actionId: null,
  amount: 10,
  awardedAt: '2026-08-13T12:00:00.000Z',
});

const day = (events: TodayGrowthEvent[]) => ({
  isoDate: '2026-08-13',
  growth: { schemaVersion: 1, events, careActions: [] },
}) as Pick<StoredHomeDayRecord, 'isoDate' | 'growth'>;

test('Daily Journey supports varied participation without requiring every action', () => {
  const journey = dailyJourneyForDay(day([
    event('journal', 'journal-1'),
    event('photo', 'photo-1'),
    event('voice_note', 'voice-1'),
    event('reflection', 'reflection-1'),
    event('quick_goal', 'goal-1'),
    event('place', 'place-1'),
  ]));
  assert.equal(journey.points, 98);
  assert.deepEqual(journey.reachedMilestones, ['first_gift', 'memory_gift']);
  assert.equal(nextDailyJourneyMilestone(journey)?.id, 'hatch');
});

test('repetitive mini-games are capped and cannot dominate the Journey', () => {
  const journey = dailyJourneyForDay(day(Array.from({ length: 20 }, (_, index) => event('mini_game', String(index)))));
  assert.equal(journey.points, 16);
});

test('meta reward receipts are deterministic and filter retries', () => {
  const source = { id: 'order:one', kind: 'order_served', localDayId: '2026-08-13', occurredAt: 1, sourceHash: 'safe' } as const;
  const grant = resolveMetaEvent(source);
  assert.equal(grant.receiptId, 'meta:1:order:one');
  assert.equal(unappliedRewardGrants([source], new Set([grant.receiptId])).length, 0);
});
