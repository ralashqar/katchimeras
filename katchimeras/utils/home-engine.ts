import { preferenceOptions } from '@/constants/katchadeck';
import {
  HOME_HATCH_HOUR,
  homeCreatureVisuals,
  homeMomentOptions,
  homeNameRoots,
  homeNameSuffixes,
  homeScorePresentation,
  homeVisualPools,
} from '@/constants/home-mvp';
import { timelineDemoEntries } from '@/constants/timeline-demo';
import type {
  DayScores,
  EggVisualState,
  HomeDayRecord,
  HomeDayState,
  HomeMoment,
  HomeScoreKey,
  HomeTimelineDay,
  HomeTomorrowRecord,
  LocalCreatureRecord,
  LocalPathOption,
  StoredHomeDayRecord,
  StoredHomeState,
  WeekProfile,
} from '@/types/home';
import type { OnboardingProfile } from '@/utils/onboarding-state';

const scoreOrder: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const pathSupportMap: Record<HomeScoreKey, HomeScoreKey> = {
  energy: 'exploration',
  calm: 'focus',
  social: 'calm',
  exploration: 'energy',
  focus: 'calm',
};

export function createEmptyScores(): DayScores {
  return {
    energy: 0,
    calm: 0,
    social: 0,
    exploration: 0,
    focus: 0,
  };
}

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
      moments: [moment],
      selectedPathId: null,
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
      },
    };
  });

  return {
    version: 1,
    archivedDays,
    today: createEmptyStoredDay(now, profile),
  };
}

export function hydrateHomeState(
  storedState: StoredHomeState | null,
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

export function addMomentToDay(
  state: StoredHomeState,
  profile: OnboardingProfile,
  momentType: HomeMoment['type'],
  now: Date
): StoredHomeState {
  const moment = createMoment(momentType, now);
  const nextToday: StoredHomeDayRecord = {
    ...state.today,
    moments: [...state.today.moments, moment],
  };

  return normalizeStoredHomeState(
    {
      ...state,
      today: nextToday,
    },
    profile,
    now
  );
}

export function selectPathForToday(
  state: StoredHomeState,
  nextPathId: string,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  return normalizeStoredHomeState(
    {
      ...state,
      today: {
        ...state.today,
        selectedPathId: state.today.selectedPathId === nextPathId ? null : nextPathId,
      },
    },
    profile,
    now
  );
}

export function triggerHatchForDay(
  state: StoredHomeState,
  dayId: string,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  if (state.today.id === dayId) {
    const todayState = resolveDayState(state.today, now);
    if (todayState !== 'ready_to_hatch') {
      return state;
    }

    return normalizeStoredHomeState(
      {
        ...state,
        today: finalizeDayHatch(state.today, profile, now),
      },
      profile,
      now
    );
  }

  const archivedIndex = state.archivedDays.findIndex((day) => day.id === dayId);
  if (archivedIndex < 0) {
    return state;
  }

  const target = state.archivedDays[archivedIndex];
  if (resolveDayState(target, now) !== 'ready_to_hatch') {
    return state;
  }

  const nextArchived = [...state.archivedDays];
  nextArchived[archivedIndex] = finalizeDayHatch(target, profile, now);

  return normalizeStoredHomeState(
    {
      ...state,
      archivedDays: nextArchived,
    },
    profile,
    now
  );
}

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
    canAddMoments: isToday && state !== 'hatched',
    canHatch: state === 'ready_to_hatch',
    highlight,
  };
}

export function createTomorrowRecord(now: Date): HomeTomorrowRecord {
  const tomorrowDate = shiftLocalDate(now, 1);

  return {
    kind: 'tomorrow',
    id: 'tomorrow',
    isoDate: toLocalDateId(tomorrowDate),
    dayLabel: 'Tomorrow',
    dateLabel: 'Forming',
    title: 'Not yet formed',
    subtitle: 'Another day needs a little movement before it becomes visible.',
    accentColor: '#D8E2FF',
  };
}

export function getCreatureVisual(visualKey: LocalCreatureRecord['visualKey']) {
  return homeCreatureVisuals[visualKey];
}

export function buildPathOptions(profile: WeekProfile): LocalPathOption[] {
  const sorted = [...scoreOrder].sort((left, right) => profile[left] - profile[right]);
  const contrastKey = sorted[0];
  const reinforcementKey =
    [...scoreOrder].sort((left, right) => profile[right] - profile[left]).find((key) => key !== contrastKey) ??
    sorted[1] ??
    contrastKey;

  return [
    {
      id: `contrast:${contrastKey}`,
      key: contrastKey,
      title: `Path of ${homeScorePresentation[contrastKey].label}`,
      body: homeScorePresentation[contrastKey].contrastBody,
      accentColor: homeScorePresentation[contrastKey].accentColor,
      icon: homeScorePresentation[contrastKey].icon,
    },
    {
      id: `reinforce:${reinforcementKey}`,
      key: reinforcementKey,
      title: `Path of ${homeScorePresentation[reinforcementKey].label}`,
      body: homeScorePresentation[reinforcementKey].reinforcementBody,
      accentColor: homeScorePresentation[reinforcementKey].accentColor,
      icon: homeScorePresentation[reinforcementKey].icon,
    },
  ];
}

export function buildInsightLine(profile: WeekProfile, onboardingProfile: OnboardingProfile) {
  const dominant = [...scoreOrder].sort((left, right) => profile[right] - profile[left])[0] ?? 'calm';
  const quietest = [...scoreOrder].sort((left, right) => profile[left] - profile[right])[0] ?? 'energy';

  if (quietest === 'energy' && profile.energy < 0.18) {
    return 'Your days have been gentler this week, almost waiting for a spark.';
  }

  if (dominant === 'calm') {
    return 'Your days have been calm this week, with a softer center than usual.';
  }

  if (dominant === 'exploration') {
    return 'There is a roaming quality to this week. Newness is starting to leave a mark.';
  }

  if (dominant === 'social') {
    return 'Connection has been shaping your days lately, even in small moments.';
  }

  if (dominant === 'focus') {
    return 'A clearer line has been forming through the week. The days feel more deliberate.';
  }

  if (onboardingProfile.preferenceIds.includes('cozy')) {
    return 'Warm, familiar moments are still doing more shaping than they seem to.';
  }

  return 'There is more momentum in your week than the surface suggests.';
}

function normalizeStoredHomeState(
  inputState: StoredHomeState,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  const todayDateId = toLocalDateId(now);
  let archivedDays: StoredHomeDayRecord[] = [...inputState.archivedDays];
  let today: StoredHomeDayRecord = { ...inputState.today };

  if (today.isoDate !== todayDateId) {
    archivedDays = [...archivedDays, resolveRolledPastDay(today, profile, now)].slice(-5);
    today = createEmptyStoredDay(now, profile);
  }

  today = {
    ...today,
    state: resolveDayState(today, now),
  };

  archivedDays = archivedDays
    .map((day): StoredHomeDayRecord => ({
      ...day,
      state: resolveDayState(day, now),
    }))
    .slice(-5);

  return {
    version: 1,
    archivedDays,
    today,
  };
}

function resolveRolledPastDay(day: StoredHomeDayRecord, _profile: OnboardingProfile, now: Date): StoredHomeDayRecord {
  if (day.state === 'hatched') {
    return day;
  }

  if (day.moments.length === 0) {
    return {
      ...day,
      state: 'forming',
    };
  }

  if (resolveDayState(day, now) === 'ready_to_hatch') {
    return day;
  }

  return {
    ...day,
    state: 'ready_to_hatch',
  };
}

function createEmptyStoredDay(now: Date, profile: OnboardingProfile): StoredHomeDayRecord {
  return {
    id: `day-${toLocalDateId(now)}`,
    isoDate: toLocalDateId(now),
    state: 'forming',
    moments: [],
    selectedPathId: buildInitialPathId(profile),
    creature: null,
  };
}

function buildInitialPathId(profile: OnboardingProfile) {
  if (profile.aspirationId === 'adventurous') {
    return 'contrast:exploration';
  }

  if (profile.aspirationId === 'calm') {
    return 'reinforce:calm';
  }

  return null;
}

function resolveDayState(day: StoredHomeDayRecord, now: Date): HomeDayState {
  if (day.creature) {
    return 'hatched';
  }

  if (day.state === 'ready_to_hatch') {
    return 'ready_to_hatch';
  }

  if (day.moments.length === 0) {
    return 'forming';
  }

  const sameDay = day.isoDate === toLocalDateId(now);
  if (sameDay && now.getHours() >= HOME_HATCH_HOUR) {
    return 'ready_to_hatch';
  }

  if (!sameDay) {
    return 'ready_to_hatch';
  }

  return 'forming';
}

function computeDayScores(day: StoredHomeDayRecord) {
  const nextScores = createEmptyScores();

  day.moments.forEach((moment) => {
    const option = homeMomentOptions[moment.type];
    scoreOrder.forEach((key) => {
      nextScores[key] = clampScore(nextScores[key] + (option.scoreBias[key] ?? 0));
    });
  });

  const pathDelta = getPathDelta(day.selectedPathId);
  scoreOrder.forEach((key) => {
    nextScores[key] = clampScore(nextScores[key] + (pathDelta[key] ?? 0));
  });

  return nextScores;
}

function computeWeekProfile(days: StoredHomeDayRecord[]): WeekProfile {
  if (days.length === 0) {
    return createEmptyScores();
  }

  const totals = createEmptyScores();
  days.forEach((day) => {
    const scores = computeDayScores(day);
    scoreOrder.forEach((key) => {
      totals[key] += scores[key];
    });
  });

  return scoreOrder.reduce((result, key) => {
    result[key] = clampScore(totals[key] / days.length);
    return result;
  }, createEmptyScores());
}

function getPathDelta(pathId: string | null): Partial<DayScores> {
  const selectedPath = parsePathId(pathId);
  if (!selectedPath) {
    return {};
  }

  const supportKey = pathSupportMap[selectedPath.key];

  if (selectedPath.mode === 'contrast') {
    return {
      [selectedPath.key]: 0.32,
      [supportKey]: 0.12,
    };
  }

  return {
    [selectedPath.key]: 0.24,
    [supportKey]: 0.08,
  };
}

function deriveEggVisualState(
  scores: DayScores,
  selectedPathId: string | null,
  profile: OnboardingProfile,
  state: HomeDayState
): EggVisualState {
  const dominant = [...scoreOrder].sort((left, right) => scores[right] - scores[left])[0] ?? 'calm';
  const selectedPath = parsePathId(selectedPathId);
  const presentation = homeScorePresentation[dominant];
  const pathPresentation = selectedPath ? homeScorePresentation[selectedPath.key] : null;
  const preferenceAccent = resolvePreferenceAccent(profile);
  const intensity = clampScore(
    scoreOrder.reduce((sum, key) => sum + scores[key], 0) / scoreOrder.length + (selectedPathId ? 0.12 : 0)
  );

  return {
    accentColor: pathPresentation?.accentColor ?? preferenceAccent ?? presentation.accentColor,
    haloColor: pathPresentation?.accentColor ?? presentation.accentColor,
    coreColor: pathPresentation?.coreColor ?? presentation.coreColor,
    intensity,
    shimmer: state === 'ready_to_hatch' || Boolean(selectedPathId),
    swirl: clampScore(scores.energy + scores.exploration * 0.8 + scores.social * 0.4),
    label:
      state === 'ready_to_hatch'
        ? 'Ready to hatch'
        : pathPresentation
          ? `${selectedPath?.mode === 'contrast' ? 'Pulling toward' : 'Leaning into'} ${pathPresentation.label.toLowerCase()}`
        : intensity > 0.5
          ? 'Gathering shape'
          : 'Still forming',
  };
}

function resolvePreferenceAccent(profile: OnboardingProfile) {
  const preference = preferenceOptions.find((option) => profile.preferenceIds.includes(option.id));
  return preference?.palette[1] ?? null;
}

function buildUnhatchedHighlight(day: StoredHomeDayRecord, state: HomeDayState) {
  if (state === 'ready_to_hatch') {
    return 'The day has enough shape now. It is ready to be revealed.';
  }

  if (day.moments.length === 0) {
    return 'Nothing has landed in the egg yet, but the day still has room to take shape.';
  }

  const lastMoment = day.moments[day.moments.length - 1];
  return `${lastMoment.label} was the latest thing to settle into the day.`;
}

function finalizeDayHatch(day: StoredHomeDayRecord, profile: OnboardingProfile, now: Date): StoredHomeDayRecord {
  const scores = computeDayScores(day);
  const sortedTraits = [...scoreOrder].sort((left, right) => scores[right] - scores[left]);
  const primaryTrait = sortedTraits[0] ?? 'calm';
  const secondaryTrait = sortedTraits[1] ?? 'focus';
  const signature = [
    day.isoDate,
    ...day.moments.map((moment) => moment.type),
    day.selectedPathId ?? 'none',
  ].join('|');
  const hash = stableHash(signature);
  const rarity = resolveRarity(scores, day.moments);
  const visualPool = homeVisualPools[primaryTrait];
  const visualKey = visualPool[hash % visualPool.length] ?? visualPool[0];
  const roots = homeNameRoots[primaryTrait];
  const suffixes = homeNameSuffixes[secondaryTrait];
  const name = `${roots[hash % roots.length]}${suffixes[(hash >> 3) % suffixes.length]}`;
  const highlightMoment = pickHighlightMoment(day.moments, primaryTrait);
  const accentColor = homeCreatureVisuals[visualKey].accentColor;

  return {
    ...day,
    state: 'hatched',
    creature: {
      id: `creature-${day.isoDate}-${hash}`,
      name,
      primaryTrait,
      secondaryTrait,
      rarity,
      visualKey,
      accentColor,
      highlightMomentId: highlightMoment?.id ?? null,
      highlight: buildHatchedHighlight(highlightMoment, primaryTrait),
      reflection: buildReflectionLine(profile, primaryTrait, secondaryTrait, day.selectedPathId),
      motifTags: uniqueMomentLabels(day.moments).slice(0, 2),
    },
  };
}

function resolveRarity(scores: DayScores, moments: HomeMoment[]) {
  const total = scoreOrder.reduce((sum, key) => sum + scores[key], 0);
  const diversityBonus = uniqueMomentLabels(moments).length * 0.14;
  const rarityValue = total + diversityBonus;

  if (rarityValue >= 1.8) {
    return 'legendary';
  }
  if (rarityValue >= 1.4) {
    return 'epic';
  }
  if (rarityValue >= 0.9) {
    return 'rare';
  }
  return 'common';
}

function pickHighlightMoment(moments: HomeMoment[], primaryTrait: HomeScoreKey) {
  const preferredType = preferredMomentTypeForTrait(primaryTrait);
  return [...moments].reverse().find((moment) => moment.type === preferredType) ?? moments[moments.length - 1] ?? null;
}

function buildHatchedHighlight(moment: HomeMoment | null, primaryTrait: HomeScoreKey) {
  if (!moment) {
    return 'Even a quieter day left enough behind to become visible.';
  }

  if (moment.type === 'coffee') {
    return 'A warm stop settled into the center of the day and gave it a glow.';
  }
  if (moment.type === 'walk') {
    return 'A little motion gave the day its forward pull.';
  }
  if (moment.type === 'new_place') {
    return 'A change in place bent the day toward something more curious.';
  }
  if (moment.type === 'social') {
    return 'Connection widened the day and softened its edges.';
  }
  if (moment.type === 'calm') {
    return 'Stillness became the part of the day that stayed visible.';
  }

  if (primaryTrait === 'focus') {
    return 'A sharper line ran through the day and held it together.';
  }

  return `${moment.label} ended up defining what the day became.`;
}

function buildReflectionLine(
  profile: OnboardingProfile,
  primary: HomeScoreKey,
  secondary: HomeScoreKey,
  selectedPathId: string | null
) {
  const selectedPath = parsePathId(selectedPathId);

  if (selectedPath && (selectedPath.key === primary || selectedPath.key === secondary)) {
    return `The chosen path kept tugging at the day, and the hatch answered with ${homeScorePresentation[selectedPath.key].label.toLowerCase()}.`;
  }
  if (profile.aspirationId === 'calm' && primary === 'calm') {
    return 'The hatch feels softer, steadier, and more grounded than the week before it.';
  }
  if (profile.aspirationId === 'adventurous' && primary === 'exploration') {
    return 'There is a little more openness here. The day leaned outward and kept the trace of it.';
  }

  return `This hatch carries ${homeScorePresentation[primary].label.toLowerCase()} first, with a quieter thread of ${homeScorePresentation[secondary].label.toLowerCase()} underneath.`;
}

function parsePathId(pathId: string | null): { mode: 'contrast' | 'reinforce'; key: HomeScoreKey } | null {
  if (!pathId) {
    return null;
  }

  const [mode, key] = pathId.split(':') as ['contrast' | 'reinforce' | undefined, HomeScoreKey | undefined];
  if (!mode || !key || !scoreOrder.includes(key)) {
    return null;
  }

  if (mode !== 'contrast' && mode !== 'reinforce') {
    return null;
  }

  return { mode, key };
}

function preferredMomentTypeForTrait(trait: HomeScoreKey) {
  if (trait === 'energy') return 'walk';
  if (trait === 'exploration') return 'new_place';
  if (trait === 'social') return 'social';
  if (trait === 'calm') return 'calm';
  if (trait === 'focus') return 'focus';
  return 'coffee';
}

function createMoment(type: HomeMoment['type'], now: Date): HomeMoment {
  const option = homeMomentOptions[type];
  return {
    id: `moment-${now.getTime().toString(36)}-${type}`,
    type,
    label: option.label,
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: now.toISOString(),
    source: 'quick_tag',
  };
}

function createSeedMoment(type: HomeMoment['type'], date: Date, index: number): HomeMoment {
  const option = homeMomentOptions[type];
  return {
    id: `seed-moment-${index}-${type}`,
    type,
    label: option.label,
    icon: option.icon,
    accentColor: option.accentColor,
    createdAt: date.toISOString(),
    source: 'quick_tag',
  };
}

function inferMomentTypeFromEntry(entryId: string): HomeMoment['type'] {
  if (entryId.includes('walk') || entryId.includes('gym')) {
    return 'walk';
  }
  if (entryId.includes('coffee') || entryId.includes('cafe')) {
    return 'coffee';
  }
  if (entryId.includes('family')) {
    return 'social';
  }
  return 'focus';
}

function inferPrimaryTraitFromMoment(momentType: HomeMoment['type']): HomeScoreKey {
  if (momentType === 'walk') return 'energy';
  if (momentType === 'coffee') return 'calm';
  if (momentType === 'new_place') return 'exploration';
  if (momentType === 'social') return 'social';
  if (momentType === 'focus') return 'focus';
  return 'calm';
}

function inferVisualKey(input: string) {
  if (input === 'voltstep') return 'voltstep';
  if (input === 'hearthsip') return 'hearthsip';
  if (input === 'skysette') return 'skysette';
  if (input === 'creamalume') return 'creamalume';
  if (input === 'pulsepounce') return 'pulsepounce';
  if (input === 'gatherglow') return 'gatherglow';
  return 'glimmuse';
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function uniqueMomentLabels(moments: HomeMoment[]) {
  return Array.from(new Set(moments.map((moment) => moment.label)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function shiftLocalDate(date: Date, dayOffset: number) {
  const nextDate = new Date(date);
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

export function toLocalDateId(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

function getDayLabel(isoDate: string, isToday: boolean) {
  if (isToday) {
    return 'Today';
  }
  const date = new Date(`${isoDate}T12:00:00`);
  return weekdayNames[date.getDay()];
}
