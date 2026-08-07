import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord, StoredHomeState } from '../types/home';
import type { OnboardingProfile } from '../utils/onboarding-state';
import { resolveHatchNotificationPlan } from '../utils/hatch-notification-plan';

function day(
  isoDate: string,
  state: StoredHomeDayRecord['state'] = 'forming',
): StoredHomeDayRecord {
  return {
    id: `day-${isoDate}`,
    isoDate,
    state,
    stepsCount: 0,
    visitedPlaceCount: 0,
    newPlaceCount: 0,
    locationSampleCount: 0,
    shareReadyAt: null,
    moments: [],
    locations: [],
    healthRouteImport: null,
    exactRouteSegments: [],
    selectedPathId: null,
    creature: null,
    card: null,
    promptAnswers: [],
    heroPhoto: null,
    growth: { schemaVersion: 1, events: [], careActions: [] },
  };
}

function state(
  today: StoredHomeDayRecord,
  tomorrow?: StoredHomeDayRecord,
): StoredHomeState {
  return { today, tomorrow, archivedDays: [] } as unknown as StoredHomeState;
}

const profile: OnboardingProfile = {
  completed: true,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: 20,
};

test('hatch notification plan keeps one future alert for the current day', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07')),
    profile,
    new Date(2026, 7, 7, 19, 0, 0),
  );

  assert.equal(plan.dayId, '2026-08-07');
  assert.equal(plan.isReady, false);
  assert.equal(plan.targetAt.getTime(), new Date(2026, 7, 7, 20, 0, 0).getTime());
});

test('a ready but unhatched day is not replaced with another scheduled alert', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07', 'ready_to_hatch')),
    profile,
    new Date(2026, 7, 7, 20, 1, 0),
  );

  assert.equal(plan.dayId, '2026-08-07');
  assert.equal(plan.isReady, true);
});

test('only a completed hatch advances notification planning to tomorrow', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07', 'hatched'), day('2026-08-08')),
    profile,
    new Date(2026, 7, 7, 20, 1, 0),
  );

  assert.equal(plan.dayId, '2026-08-08');
  assert.equal(plan.isReady, false);
  assert.equal(plan.targetAt.getTime(), new Date(2026, 7, 8, 20, 0, 0).getTime());
});
