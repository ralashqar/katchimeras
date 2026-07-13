import type { DayMapSummary, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { deriveDayMapSummary } from '@/utils/day-map-engine';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { pruneRejectedDerivedMoments } from '@/utils/intelligence/classification-policy';
import { CLASSIFIED_MEMORY_SCHEMA_VERSION, recalibrateClassifiedMemory, repairUrbanPhotoCentrality } from '@/utils/intelligence/classification';
import { normalizeFoodEmoji } from '@/utils/food-detect';

import { tomorrowDateId, toLocalDateId } from './date';
import { getDistanceMeters } from './geo';
import { resolveDayState, resolveHatchHour, resolveRolledPastDay } from './lifecycle';
import { upgradeStoredHomeState, type UpgradeableStoredHomeState } from './migrations';
import { createEmptyStoredDay } from './records';
import { dayHasShape, dayInputSignature } from './shape';

const MAX_ARCHIVED_DAYS = 120;
const NEW_PLACE_DISTANCE_METERS = 220;

export function normalizeStoredHomeState(
  inputState: UpgradeableStoredHomeState,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const upgradedState = upgradeStoredHomeState(inputState);
  const todayDateId = toLocalDateId(now);
  const tomorrowDate = tomorrowDateId(now);
  const hatchHour = resolveHatchHour(profile);
  let archivedDays: StoredHomeDayRecord[] = [...upgradedState.archivedDays];
  let today: StoredHomeDayRecord = { ...upgradedState.today };
  let tomorrow: StoredHomeDayRecord | undefined = upgradedState.tomorrow
    ? { ...upgradedState.tomorrow }
    : undefined;

  if (today.isoDate !== todayDateId) {
    archivedDays = [...archivedDays, resolveRolledPastDay(today, profile, now)].slice(-MAX_ARCHIVED_DAYS);
    today = tomorrow && tomorrow.isoDate === todayDateId ? tomorrow : createEmptyStoredDay(now, profile);
    tomorrow = undefined;
  }

  if (tomorrow && tomorrow.isoDate !== tomorrowDate) {
    tomorrow = undefined;
  }

  today = {
    ...today,
    state: resolveDayState(today, now, hatchHour),
  };

  archivedDays = archivedDays
    .map((day): StoredHomeDayRecord => ({
      ...day,
      state: resolveDayState(day, now, hatchHour),
    }))
    .slice(-MAX_ARCHIVED_DAYS);

  const normalizedArchived: StoredHomeDayRecord[] = [];
  archivedDays.forEach((day) => {
    normalizedArchived.push(updateStoredDayDerivedFields(day, normalizedArchived, now, hatchHour, false));
  });
  const normalizedToday = updateStoredDayDerivedFields(today, normalizedArchived, now, hatchHour, true);

  const normalizedTomorrow =
    tomorrow && dayHasShape(tomorrow)
      ? updateStoredDayDerivedFields(
          { ...tomorrow, state: 'forming' },
          [...normalizedArchived, normalizedToday],
          now,
          hatchHour,
          false
        )
      : undefined;

  return {
    version: 12,
    locationPermission: upgradedState.locationPermission,
    activityPermission: upgradedState.activityPermission,
    healthPermission: upgradedState.healthPermission,
    encounterHistory: upgradedState.encounterHistory,
    personalEntities: upgradedState.personalEntities,
    cloudIntelligenceEnabled: upgradedState.cloudIntelligenceEnabled,
    archivedDays: normalizedArchived,
    today: normalizedToday,
    tomorrow: normalizedTomorrow,
    backfilledAt: upgradedState.backfilledAt,
  };
}

function updateStoredDayDerivedFields(
  inputDay: StoredHomeDayRecord,
  priorDays: StoredHomeDayRecord[],
  now: Date,
  hatchHour: number,
  force: boolean
): StoredHomeDayRecord {
  const emojiNormalizedDay: StoredHomeDayRecord = {
    ...inputDay,
    foodMoments: inputDay.foodMoments?.map((moment) => ({ ...moment, emoji: normalizeFoodEmoji(moment.emoji) })),
    classifiedMemories: inputDay.classifiedMemories?.map((memory) => {
      const recalibrated = memory.schemaVersion < CLASSIFIED_MEMORY_SCHEMA_VERSION ? recalibrateClassifiedMemory(memory) : memory;
      return repairUrbanPhotoCentrality(recalibrated);
    }),
  };
  const day = (emojiNormalizedDay.classifiedMemories ?? []).reduce(
    (current, memory) => pruneRejectedDerivedMoments(current, memory),
    emojiNormalizedDay
  );
  const signature = dayInputSignature(day);

  if (!force && day.derivedSignature === signature) {
    return { ...day, state: resolveDayState(day, now, hatchHour) };
  }

  const dayMap = deriveDayMapSummary(day.locations, day.moments);
  const visitedPlaceCount = dayMap?.nodes.length ?? 0;
  const locationSampleCount = day.locations.length;
  const newPlaceCount = countNewPlacesForDay(dayMap, priorDays);
  const shareReadyAt =
    day.shareReadyAt ??
    (day.creature ? new Date(`${day.isoDate}T21:00:00`).toISOString() : null);

  return {
    ...day,
    state: resolveDayState(day, now, hatchHour),
    visitedPlaceCount,
    newPlaceCount,
    locationSampleCount,
    shareReadyAt,
    derivedSignature: signature,
  };
}

function countNewPlacesForDay(dayMap: DayMapSummary | null, priorDays: StoredHomeDayRecord[]) {
  if (!dayMap || dayMap.nodes.length === 0) {
    return 0;
  }

  const previousLocations = priorDays.flatMap((day) => day.locations);
  if (previousLocations.length === 0) {
    return dayMap.nodes.length;
  }

  return dayMap.nodes.filter((node) => {
    return !previousLocations.some((location) => {
      const distance = getDistanceMeters(node.latitude, node.longitude, location.lat, location.lng);
      return distance <= NEW_PLACE_DISTANCE_METERS;
    });
  }).length;
}
