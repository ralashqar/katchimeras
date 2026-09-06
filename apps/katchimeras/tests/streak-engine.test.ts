import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredStreakState, StreakCaptureIntent } from '@/types/streak';
import {
  createEmptyStreakState,
  declineStreakRepair,
  defaultStreakCaptureTarget,
  registerStreakCapture,
  repairStreakDay,
  streakSnapshot,
} from '@/utils/streak-engine';

function capture(state: StoredStreakState, date: string, source = date) {
  const intent: StreakCaptureIntent = {
    clientEventId: `event:${source}`,
    localDate: date,
    occurredAt: `${date}T12:00:00.000Z`,
    sourceIdHash: source,
    timezone: 'Europe/London',
    type: 'journal',
  };
  return registerStreakCapture(state, intent, new Date(`${date}T18:00:00`));
}

test('one qualifying capture increments a day exactly once', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  const first = capture(state, '2026-08-01');
  state = first.state;
  const second = capture(state, '2026-08-01', 'another-source');
  assert.equal(first.result.firstCaptureOfDay, true);
  assert.equal(first.result.snapshot.currentStreak, 1);
  assert.equal(second.result.firstCaptureOfDay, false);
  assert.equal(second.result.snapshot.currentStreak, 1);
});

test('a current streak remains through an uncaptured today', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  state = capture(state, '2026-08-01').state;
  state = capture(state, '2026-08-02').state;
  const snapshot = streakSnapshot(state, new Date('2026-08-03T12:00:00'));
  assert.equal(snapshot.currentStreak, 2);
  assert.equal(snapshot.todayState, 'uncaptured');
});

test('a single missed day is repairable but a two-day gap is not', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  state = capture(state, '2026-08-01').state;
  state = capture(state, '2026-08-02').state;
  assert.equal(streakSnapshot(state, new Date('2026-08-04T12:00:00')).repairableDate, '2026-08-03');
  assert.equal(streakSnapshot(state, new Date('2026-08-05T12:00:00')).repairableDate, null);
});

test('repair consumes inventory and restores continuity', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  state = capture(state, '2026-08-01').state;
  state = capture(state, '2026-08-02').state;
  state = { ...state, repairsAvailable: 1 };
  const repaired = repairStreakDay(state, '2026-08-03', new Date('2026-08-04T10:00:00'));
  assert.ok(repaired);
  const withToday = capture(repaired, '2026-08-04').state;
  assert.equal(streakSnapshot(withToday, new Date('2026-08-04T18:00:00')).currentStreak, 4);
  assert.equal(withToday.repairsAvailable, 0);
});

test('declining a repair removes the offer', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  state = capture(state, '2026-08-01').state;
  state = declineStreakRepair(state, '2026-08-02');
  assert.equal(streakSnapshot(state, new Date('2026-08-03T12:00:00')).repairableDate, null);
});

test('seven post-launch captures award one repair and milestones are idempotent', () => {
  let state = createEmptyStreakState(new Date('2026-08-01T12:00:00'));
  for (let day = 1; day <= 7; day += 1) {
    state = capture(state, `2026-08-0${day}`).state;
  }
  assert.equal(state.repairsAvailable, 1);
  assert.equal(state.repairEarningProgress, 0);
  assert.deepEqual(Object.keys(state.milestones).sort(), ['3', '7']);
  state = capture(state, '2026-08-07', 'duplicate').state;
  assert.equal(Object.keys(state.milestones).length, 2);
});

test('the grace period defaults a missed yesterday only before 3 AM', () => {
  assert.equal(defaultStreakCaptureTarget(new Date('2026-08-08T02:59:00'), 'missed'), 'yesterday');
  assert.equal(defaultStreakCaptureTarget(new Date('2026-08-08T03:00:00'), 'missed'), 'today');
  assert.equal(defaultStreakCaptureTarget(new Date('2026-08-08T01:15:00'), 'captured'), 'today');
});

test('the weekly tracker always runs Monday through Sunday', () => {
  const state = createEmptyStreakState(new Date('2026-08-07T12:00:00'));
  const week = streakSnapshot(state, new Date('2026-08-07T12:00:00')).week;
  assert.deepEqual(week.map((day) => day.localDate), [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
  ]);
});
