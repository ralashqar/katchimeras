import assert from 'node:assert/strict';
import test from 'node:test';

import { SCENES_BY_ID } from '@/constants/scenes';
import { resolveRolledPastDay } from '@/game/days/lifecycle';
import { createEmptyStoredDay } from '@/game/days/records';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { finalizeDailyWispHatch } from '@/utils/daily-wisp-hatch';

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
