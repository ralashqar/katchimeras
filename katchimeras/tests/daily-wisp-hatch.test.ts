import assert from 'node:assert/strict';
import test from 'node:test';

import { SCENES_BY_ID } from '@/constants/scenes';
import { resolveRolledPastDay } from '@/game/days/lifecycle';
import { claimDailyHatchForDay } from '@/game/days/claiming';
import { createEmptyStoredDay } from '@/game/days/records';
import type { StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { finalizeDailyWispHatch } from '@/utils/daily-wisp-hatch';
import { todayGrowthSummary } from '@/utils/today-growth';

const profile = { hatchHour: 21 } as OnboardingProfile;

function contextualDay(isoDate = '2026-08-16') {
  const day = createEmptyStoredDay(new Date(`${isoDate}T12:00:00`), profile);
  return {
    ...day,
    id: `day-${isoDate}`,
    isoDate,
    capturedEnergy: { exploration: 0.8, calm: 0.35 },
    stepsCount: 8_200,
    visitedPlaceCount: 2,
    newPlaceCount: 1,
    growth: {
      schemaVersion: 1 as const,
      careActions: [],
      events: [{
        id: 'growth:journal:walk',
        source: 'journal' as const,
        sourceId: 'walk',
        amount: 20,
        awardedAt: `${isoDate}T18:00:00.000Z`,
      }],
    },
  };
}

test('one contextual day deterministically produces one Wisp, one Scene and one unique Day Card', () => {
  const day = contextualDay();
  const first = finalizeDailyWispHatch({
    day,
    now: new Date('2026-08-16T21:00:00.000Z'),
    pastDays: [],
    provenance: 'live',
  });
  const second = finalizeDailyWispHatch({
    day,
    now: new Date('2026-08-16T21:00:00.000Z'),
    pastDays: [],
    provenance: 'live',
  });

  assert.deepEqual(second, first);
  assert.equal(first.card.primaryWispId, first.hatch.primaryWispId);
  assert.equal(first.card.sceneVariantId, first.hatch.sceneVariantId);
  assert.ok(SCENES_BY_ID.has(first.hatch.sceneVariantId));
  assert.equal(first.card.featuredWisps?.length, 1);
  assert.match(first.card.id, /2026-08-16/);
});

test('rollover seals a legitimate missed day for retrospective reveal', () => {
  const sealed = resolveRolledPastDay(
    contextualDay('2026-08-15'),
    profile,
    new Date('2026-08-16T09:00:00'),
  );

  assert.equal(sealed.state, 'sealed');
  assert.equal(sealed.dailyHatch?.revealedAt, null);
  assert.equal(sealed.dailyHatch?.claimedAt, null);
  assert.ok(sealed.card?.primaryWispId);
  assert.equal(sealed.creature, null);
});

test('rollover does not invent a collectible for an empty day', () => {
  const empty = createEmptyStoredDay(new Date('2026-08-15T12:00:00'), profile);
  const rolled = resolveRolledPastDay(empty, profile, new Date('2026-08-16T09:00:00'));

  assert.equal(rolled.state, 'forming');
  assert.equal(rolled.dailyHatch, null);
  assert.equal(rolled.card, null);
});

test('a revealed hatch remains sealed until an idempotent claim', () => {
  const sealed = resolveRolledPastDay(contextualDay('2026-08-15'), profile, new Date('2026-08-16T09:00:00'));
  const revealed = {
    ...sealed,
    dailyHatch: sealed.dailyHatch ? { ...sealed.dailyHatch, revealedAt: '2026-08-16T09:05:00.000Z' } : null,
  };
  const state = {
    version: 22,
    archivedDays: [revealed],
    today: createEmptyStoredDay(new Date('2026-08-16T12:00:00'), profile),
  } as StoredHomeState;
  state.today.growth = {
    schemaVersion: 1,
    events: [{
      id: 'growth:journal:pre-claim',
      source: 'journal',
      sourceId: 'pre-claim',
      amount: 100,
      awardedAt: '2026-08-16T08:00:00.000Z',
    }],
    careActions: [{
      instanceId: 'care:pre-claim',
      definitionId: 'journal',
      status: 'completed',
      completedAt: '2026-08-16T08:00:00.000Z',
      updatedAt: '2026-08-16T08:00:00.000Z',
    }],
  };
  const claimed = claimDailyHatchForDay(state, revealed.id, new Date('2026-08-16T09:06:00.000Z'));
  const claimedDay = claimed.archivedDays[0];
  assert.equal(claimedDay.state, 'hatched');
  assert.equal(claimedDay.dailyHatch?.claimedAt, '2026-08-16T09:06:00.000Z');
  assert.equal(claimed.today.growth?.cycleStartedAt, '2026-08-16T09:06:00.000Z');
  assert.equal(claimed.today.growth?.events.length, 1, 'historical receipts remain preserved');
  assert.equal(claimed.today.growth?.careActions.length, 0, 'the new Egg gets fresh care actions');
  const freshEgg = todayGrowthSummary(claimed.today, 0, new Date('2026-08-16T09:06:00.000Z'));
  assert.equal(freshEgg.activeEnergy, 0);
  assert.equal(freshEgg.energyRatio, 0);
  assert.equal(freshEgg.stage, 0);
  assert.equal(freshEgg.contextState, 'fresh');
  const claimedAgain = claimDailyHatchForDay(claimed, revealed.id, new Date('2026-08-16T09:07:00.000Z'));
  assert.equal(claimedAgain.archivedDays[0].dailyHatch?.claimedAt, '2026-08-16T09:06:00.000Z');
});

test('claiming a recovery replay also starts a completely fresh Today Egg', () => {
  const sealed = resolveRolledPastDay(
    contextualDay('2026-08-14'),
    profile,
    new Date('2026-08-16T09:00:00'),
  );
  const revealed = {
    ...sealed,
    dailyHatch: sealed.dailyHatch
      ? { ...sealed.dailyHatch, revealedAt: '2026-08-16T09:05:00.000Z' }
      : null,
  };
  const today = createEmptyStoredDay(new Date('2026-08-16T12:00:00'), profile);
  today.growth = {
    schemaVersion: 1,
    events: [{
      amount: 65,
      awardedAt: '2026-08-16T08:00:00.000Z',
      id: 'growth:journal:before-recovery-claim',
      source: 'journal',
      sourceId: 'before-recovery-claim',
    }],
    careActions: [],
  };
  const state = { version: 22, archivedDays: [revealed], today } as StoredHomeState;

  const claimed = claimDailyHatchForDay(state, revealed.id, new Date('2026-08-16T09:06:00.000Z'));
  const summary = todayGrowthSummary(claimed.today, 0, new Date('2026-08-16T09:06:00.000Z'));

  assert.equal(claimed.today.growth?.cycleStartedAt, '2026-08-16T09:06:00.000Z');
  assert.equal(summary.activeEnergy, 0);
  assert.equal(summary.energyRatio, 0);
  assert.equal(summary.stage, 0);
  assert.equal(summary.contextState, 'fresh');
});
