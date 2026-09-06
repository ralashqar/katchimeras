import type { HomeDayRecord, StoredHomeState, StoredHomeDayRecord, WeekProfile } from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { deriveDayMapSummary } from '@/utils/day-map-engine';
import { formatDateLabel, getDayLabel, tomorrowDateId } from './date';
import { resolveDayState } from './lifecycle';
import { createEmptyStoredDay } from './records';
import { buildInsightLine, buildPathOptions, computeDayScores, computeWeekProfile } from './scoring';
import { buildUnhatchedHighlight, deriveEggVisualState } from './visuals';

export function deriveHomeDayRecord(
  storedDay: StoredHomeDayRecord,
  profile: OnboardingProfile,
  isToday: boolean,
  weekProfile: WeekProfile,
  now: Date
): HomeDayRecord {
  const state = resolveDayState(storedDay, now);
  const scores = computeDayScores(storedDay);
  const insightLine = buildInsightLine(weekProfile, profile);
  const pathOptions = buildPathOptions(weekProfile);
  const egg = deriveEggVisualState(scores, storedDay.selectedPathId, profile, state);
  const highlight = storedDay.creature?.highlight ?? buildUnhatchedHighlight(storedDay, state);
  const dayMap = deriveDayMapSummary(storedDay.locations, storedDay.moments);

  return {
    ...storedDay,
    kind: 'day',
    state,
    dayLabel: getDayLabel(storedDay.isoDate, isToday),
    dateLabel: formatDateLabel(storedDay.isoDate),
    isToday,
    scores,
    egg,
    insightLine,
    pathOptions,
    canAddMoments: isToday,
    canHatch: state === 'ready_to_hatch' || state === 'sealed',
    highlight,
    dayMap,
  };
}

export function deriveTomorrowDayRecord(
  state: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
): HomeDayRecord {
  const weekProfile = computeWeekProfile([...state.archivedDays.slice(-4), state.today]);
  const iso = tomorrowDateId(now);
  const stored =
    state.tomorrow && state.tomorrow.isoDate === iso
      ? state.tomorrow
      : { ...createEmptyStoredDay(now, profile), id: `day-${iso}`, isoDate: iso };
  const record = deriveHomeDayRecord(stored, profile, false, weekProfile, now);
  return { ...record, dayLabel: 'Tomorrow', canAddMoments: true, canHatch: false };
}
