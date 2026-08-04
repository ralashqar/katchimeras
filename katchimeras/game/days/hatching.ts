import {
  homeCreatureVisuals,
  homeNameRoots,
  homeNameSuffixes,
  homeScorePresentation,
  homeVisualPools,
} from '@/constants/home-mvp';
import type { DayScores, HomeMoment, HomeScoreKey, LocalCreatureRecord, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import type { EncounterHistoryMap } from '@/types/home';
import { recordEncounterHatch } from '@/utils/encounter-engine';
import {
  identityForCreature,
  recordIdentityHatch,
  withKatchimeraIdentity,
} from '@/utils/katchimera-identity';
import type { OnboardingProfile } from '@/utils/onboarding-state';
import { selectHatch, makeSeededRng } from '@/utils/hatch-selection';
import { buildReflectionContext } from '@/utils/reflection-context';
import { resolveVariantCellId } from '@/utils/creature-variant';
import { buildDailyCreatureCard } from '@/utils/daily-card';
import { deriveDaySkySnapshot } from '@/utils/day-sky';
import { dayForDevHatchSelection } from '@/utils/forced-low-signal-hatch';
import { stableHash } from './hash';
import { resolveDayState, resolveHatchHour } from './lifecycle';
import { computeDayScores, parsePathId, resolveRarity } from './scoring';
import { dayInputSignature } from './shape';
import { scoreOrder } from './scores';
import { normalizeStoredHomeState } from './state-normalization';

export function finalizeDayHatch(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  now: Date,
  encounterHistory: EncounterHistoryMap,
  pastDays: readonly StoredHomeDayRecord[] = []
): StoredHomeDayRecord {
  const hatchInputDay = dayForDevHatchSelection(day);
  const scores = computeDayScores(hatchInputDay);
  const sortedTraits = [...scoreOrder].sort((left, right) => scores[right] - scores[left]);
  const primaryTrait = sortedTraits[0] ?? 'calm';
  const secondaryTrait = sortedTraits[1] ?? 'focus';

  const yesterdayProfileId = resolveYesterdayProfileId(day, pastDays);
  const seed = `${day.isoDate}|${dayInputSignature(hatchInputDay)}|${day.storedNonce ?? ''}`;
  const selection = selectHatch({
    day: hatchInputDay,
    history: encounterHistory,
    yesterdayProfileId,
    rng: makeSeededRng(seed),
    primaryTrait,
    secondaryTrait,
  });
  if (selection) {
    const encounterCreature = selection.creature;
    const context = buildReflectionContext({ ...day, creature: encounterCreature }, pastDays);
    const sealedAt = day.shareReadyAt ?? now.toISOString();
    const creature = {
      ...encounterCreature,
      mood: context.mood,
      bondDepth: context.bondDepth,
      variantCell: resolveVariantCellId(context.mood, context.bondDepth) ?? undefined,
    };
    return {
      ...day,
      state: 'hatched',
      devForceReadyToHatch: undefined,
      devHatchReflectionMode: undefined,
      shareReadyAt: sealedAt,
      sky: deriveDaySkySnapshot(day),
      skyPolicy: 'live_frozen',
      creature,
      card: buildDailyCreatureCard({ ...day, creature }, creature, {
        mode: 'live_hatch',
        sealedAt,
        pastDays,
        scores,
      }),
    };
  }

  return finalizeFallbackHatch(day, profile, now, scores, primaryTrait, secondaryTrait, pastDays, hatchInputDay);
}

export function triggerHatchForDay(
  state: StoredHomeState,
  dayId: string,
  profile: OnboardingProfile,
  now: Date
): StoredHomeState {
  if (state.today.id === dayId) {
    const todayState = resolveDayState(state.today, now, resolveHatchHour(profile));
    if (todayState !== 'ready_to_hatch') {
      return state;
    }

    const hatchedToday = finalizeDayHatch(
      state.today,
      profile,
      now,
      state.aspectHistory ?? state.encounterHistory,
      state.archivedDays
    );

    return normalizeStoredHomeState(
      {
        ...state,
        encounterHistory: recordHatchedEncounter(state.encounterHistory, hatchedToday),
        aspectHistory: recordHatchedIdentity(state.aspectHistory ?? {}, hatchedToday, 'family'),
        skinHistory: recordHatchedIdentity(state.skinHistory ?? {}, hatchedToday, 'skin'),
        today: hatchedToday,
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
  if (resolveDayState(target, now, resolveHatchHour(profile)) !== 'ready_to_hatch') {
    return state;
  }

  const nextArchived = [...state.archivedDays];
  const pastDays = [state.today, ...state.archivedDays].filter((entry) => entry.id !== dayId);
  const hatchedDay = finalizeDayHatch(
    target,
    profile,
    now,
    state.aspectHistory ?? state.encounterHistory,
    pastDays
  );
  nextArchived[archivedIndex] = hatchedDay;

  return normalizeStoredHomeState(
    {
      ...state,
      encounterHistory: recordHatchedEncounter(state.encounterHistory, hatchedDay),
      aspectHistory: recordHatchedIdentity(state.aspectHistory ?? {}, hatchedDay, 'family'),
      skinHistory: recordHatchedIdentity(state.skinHistory ?? {}, hatchedDay, 'skin'),
      archivedDays: nextArchived,
    },
    profile,
    now
  );
}

function recordHatchedEncounter(history: EncounterHistoryMap, day: StoredHomeDayRecord) {
  if (!day.creature?.encounterProfileId) {
    return history;
  }
  return recordEncounterHatch(history, day.creature.encounterProfileId, day.isoDate);
}

function recordHatchedIdentity(
  history: EncounterHistoryMap,
  day: StoredHomeDayRecord,
  kind: 'family' | 'skin'
): EncounterHistoryMap {
  if (!day.creature) return history;
  const identity = identityForCreature(day.creature);
  if (!identity) return history;
  return recordIdentityHatch(
    history,
    kind === 'family' ? identity.familyId : identity.skinId,
    day.isoDate
  );
}

function finalizeFallbackHatch(
  day: StoredHomeDayRecord,
  profile: OnboardingProfile,
  now: Date,
  scores: DayScores,
  primaryTrait: HomeScoreKey,
  secondaryTrait: HomeScoreKey,
  pastDays: readonly StoredHomeDayRecord[],
  hatchInputDay: StoredHomeDayRecord = day
): StoredHomeDayRecord {
  const signature = [
    hatchInputDay.isoDate,
    ...hatchInputDay.moments.map((moment) => moment.type),
    hatchInputDay.selectedPathId ?? 'none',
  ].join('|');
  const hash = stableHash(signature);
  const rarity = resolveRarity(scores, hatchInputDay.moments);
  const visualPool = homeVisualPools[primaryTrait];
  const visualKey = visualPool[hash % visualPool.length] ?? visualPool[0];
  const roots = homeNameRoots[primaryTrait];
  const suffixes = homeNameSuffixes[secondaryTrait];
  const name = `${roots[hash % roots.length]}${suffixes[(hash >> 3) % suffixes.length]}`;
  const highlightMoment = pickHighlightMoment(hatchInputDay.moments, primaryTrait);
  const accentColor = homeCreatureVisuals[visualKey].accentColor;

  const creature: LocalCreatureRecord = withKatchimeraIdentity({
    id: `creature-${day.isoDate}-${hash}`,
    name,
    primaryTrait,
    secondaryTrait,
    rarity,
    visualKey,
    accentColor,
    highlightMomentId: highlightMoment?.id ?? null,
    highlight: buildHatchedHighlight(day, highlightMoment, primaryTrait),
    reflection: buildReflectionLine(profile, primaryTrait, secondaryTrait, day.selectedPathId),
    motifTags: uniqueMomentLabels(day.moments).slice(0, 2),
    encounterProfileId: null,
    repeatDepth: 0,
  });
  const sealedAt = day.shareReadyAt ?? now.toISOString();
  return {
    ...day,
    state: 'hatched',
    devForceReadyToHatch: undefined,
    devHatchReflectionMode: undefined,
    shareReadyAt: sealedAt,
    sky: deriveDaySkySnapshot(day),
    skyPolicy: 'live_frozen',
    creature,
    card: buildDailyCreatureCard({ ...day, creature }, creature, {
      mode: 'live_hatch',
      sealedAt,
      pastDays,
      scores,
    }),
  };
}

function resolveYesterdayProfileId(
  day: StoredHomeDayRecord,
  pastDays: readonly StoredHomeDayRecord[]
): string | null {
  let best: StoredHomeDayRecord | null = null;
  for (const candidate of pastDays) {
    if (candidate.isoDate >= day.isoDate || !candidate.creature?.encounterProfileId) {
      continue;
    }
    if (!best || candidate.isoDate > best.isoDate) {
      best = candidate;
    }
  }
  return best?.creature?.encounterProfileId ?? null;
}

function pickHighlightMoment(moments: HomeMoment[], primaryTrait: HomeScoreKey) {
  const preferredType = preferredMomentTypeForTrait(primaryTrait);
  return [...moments].reverse().find((moment) => moment.type === preferredType) ?? moments[moments.length - 1] ?? null;
}

function buildHatchedHighlight(day: StoredHomeDayRecord, moment: HomeMoment | null, primaryTrait: HomeScoreKey) {
  if (!moment) {
    if (day.stepsCount >= 3200 && day.newPlaceCount > 0) {
      return 'Distance and a changed setting gave the day enough contrast to become something vivid.';
    }

    if (day.stepsCount >= 3200) {
      return 'Movement alone carried enough energy to give the day a visible form.';
    }

    if (day.locationSampleCount > 0) {
      return 'The places you moved through quietly shaped the hatch, even without a saved moment.';
    }

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
  if (moment.type === 'photo') {
    return 'One image caught the day at the right angle and kept it glowing.';
  }
  if (moment.type === 'inspiration') {
    return 'A small line of meaning gave the day a direction it kept.';
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

function preferredMomentTypeForTrait(trait: HomeScoreKey) {
  if (trait === 'energy') return 'walk';
  if (trait === 'exploration') return 'new_place';
  if (trait === 'social') return 'social';
  if (trait === 'calm') return 'calm';
  if (trait === 'focus') return 'focus';
  return 'coffee';
}

function uniqueMomentLabels(moments: HomeMoment[]) {
  return Array.from(new Set(moments.map((moment) => moment.label)));
}
