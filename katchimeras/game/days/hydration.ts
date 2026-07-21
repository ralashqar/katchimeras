import { timelineDemoEntries } from '@/constants/timeline-demo';
import type { HomeDayRecord, HomeScoreKey, HomeTimelineDay, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';

import { createTomorrowRecord, shiftLocalDate, toLocalDateId } from './date';
import { deriveHomeDayRecord } from './derived-records';
import { createSeedLocations } from './locations';
import type { UpgradeableStoredHomeState } from './migrations';
import {
  createSeedMoment,
  inferMomentTypeFromEntry,
  inferPrimaryTraitFromMoment,
  inferVisualKey,
} from './moment-factories';
import { createEmptyStoredDay } from './records';
import { computeWeekProfile } from './scoring';
import { normalizeStoredHomeState } from './state-normalization';

export function createInitialHomeState(profile: OnboardingProfile, now: Date): StoredHomeState {
  const archivedDays: StoredHomeDayRecord[] = timelineDemoEntries.slice(0, 4).map((entry, index) => {
    const dayDate = shiftLocalDate(now, index - 4);
    const momentType = inferMomentTypeFromEntry(entry.id);
    const moment = createSeedMoment(momentType, dayDate, index);
    const dominant = inferPrimaryTraitFromMoment(momentType);
    const secondary: HomeScoreKey = dominant === 'energy' ? 'focus' : 'calm';

    return {
      id: `seed-${entry.id}`,
      isoDate: toLocalDateId(dayDate),
      state: 'hatched' as const,
      stepsCount: 1800 + index * 1100,
      visitedPlaceCount: 0,
      newPlaceCount: 0,
      locationSampleCount: 0,
      shareReadyAt: new Date(new Date(`${toLocalDateId(dayDate)}T21:00:00`).getTime()).toISOString(),
      moments: [moment],
      locations: createSeedLocations(momentType, dayDate, index, moment.id),
      healthRouteImport: null,
      exactRouteSegments: [],
      selectedPathId: null,
      promptAnswers: [],
      heroPhoto: null,
      creature: {
        id: `seed-creature-${entry.creature.id}`,
        name: entry.creature.name,
        primaryTrait: dominant,
        secondaryTrait: secondary,
        rarity: index > 1 ? 'rare' : 'common',
        visualKey: inferVisualKey(entry.creature.id),
        accentColor: entry.creature.accent,
        highlightMomentId: moment.id,
        highlight: entry.summary,
        reflection: entry.memory.body,
        motifTags: [moment.label],
        encounterProfileId: null,
        repeatDepth: 0,
      },
      card: null,
    };
  });

  return {
    version: 14,
    personalEntities: [],
    cloudIntelligenceEnabled: false,
    locationPermission: 'unknown',
    activityPermission: 'unknown',
    healthPermission: 'unknown',
    encounterHistory: {},
    archivedDays,
    today: createEmptyStoredDay(now, profile),
  };
}

export function hydrateHomeState(
  storedState: UpgradeableStoredHomeState | null,
  profile: OnboardingProfile,
  now: Date
): {
  state: StoredHomeState;
  timelineDays: HomeTimelineDay[];
  todayId: string;
} {
  const baseState = storedState ?? createInitialHomeState(profile, now);
  const normalized = normalizeStoredHomeState(baseState, profile, now);
  const weekProfile = computeWeekProfile([
    ...normalized.archivedDays.slice(-4),
    normalized.today,
  ]);
  const archivedDays = normalized.archivedDays.slice(-5).map((day) =>
    deriveHomeDayRecord(day, profile, false, weekProfile, now)
  );
  const today = deriveHomeDayRecord(normalized.today, profile, true, weekProfile, now);

  return {
    state: normalized,
    timelineDays: [...archivedDays, today, createTomorrowRecord(now)],
    todayId: normalized.today.id,
  };
}

export function hydrateAllDays(
  storedState: UpgradeableStoredHomeState | null,
  profile: OnboardingProfile,
  now: Date
): HomeDayRecord[] {
  const baseState = storedState ?? createInitialHomeState(profile, now);
  const normalized = normalizeStoredHomeState(baseState, profile, now);
  const weekProfile = computeWeekProfile([...normalized.archivedDays.slice(-4), normalized.today]);
  return [...normalized.archivedDays, normalized.today]
    .map((day) =>
      deriveHomeDayRecord(day, profile, day.id === normalized.today.id, weekProfile, now)
    )
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate));
}
