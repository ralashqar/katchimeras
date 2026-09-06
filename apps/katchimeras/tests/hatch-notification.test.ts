import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredHomeDayRecord, StoredHomeState } from '../types/home';
import type { OnboardingProfile } from '../utils/onboarding-state';
import { resolveHatchNotificationPlan } from '../utils/hatch-notification-plan';
import { nextMossproutJourneyReminderDate } from '../utils/mossprout-journey-notification-plan';

test('Mossprout Journey reminder targets the next local morning', () => {
  const target = nextMossproutJourneyReminderDate('2026-08-23');
  assert.ok(target);
  assert.equal(target.getFullYear(), 2026);
  assert.equal(target.getMonth(), 7);
  assert.equal(target.getDate(), 24);
  assert.equal(target.getHours(), 9);
  assert.equal(target.getMinutes(), 0);
});

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
  schemaVersion: 3,
  completed: true,
  aspirationId: null,
  painPointIds: [],
  preferenceIds: [],
  completedAt: null,
  hatchHour: 20,
  playerNickname: null,
  mossproutAnswers: { desiredFeelingId: null, mainDifficultyId: null, supportStyleId: null, lifePriorityId: null, companionPlaceId: null },
  matchedResidentId: null,
};

test('daily Wisp flow does not schedule a same-day clock hatch', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07')),
    profile,
    new Date(2026, 7, 7, 19, 0, 0),
  );

  assert.equal(plan, null);
});

test('legacy ready state does not restore a timed notification', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07', 'ready_to_hatch')),
    profile,
    new Date(2026, 7, 7, 20, 1, 0),
  );

  assert.equal(plan, null);
});

test('a completed hatch does not schedule tomorrow at the old hatch hour', () => {
  const plan = resolveHatchNotificationPlan(
    state(day('2026-08-07', 'hatched'), day('2026-08-08')),
    profile,
    new Date(2026, 7, 7, 20, 1, 0),
  );

  assert.equal(plan, null);
});
