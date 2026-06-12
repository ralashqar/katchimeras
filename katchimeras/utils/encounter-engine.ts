import { encounterCastBySeedId, type EncounterCastEntry } from '@/constants/encounter-cast';
import { homeCreatureVisuals } from '@/constants/home-mvp';
import { katchimeraEncounterProfiles } from '@/constants/katchimera-encounter-profiles';
import type { KatchimeraEncounterProfile } from '@/types/katchimera';
import type {
  EncounterHistoryMap,
  HomeRarityTier,
  HomeScoreKey,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';

export type EncounterSignal = {
  seedId: string;
  intensity: number;
  sourceMomentIds: string[];
  isRecovery: boolean;
};

export type EncounterMatch = {
  castEntry: EncounterCastEntry;
  profile: KatchimeraEncounterProfile;
  signal: EncounterSignal;
  repeatDepth: number;
  rarity: HomeRarityTier;
};

const REPEAT_FAVOR_PER_VISIT = 0.06;
const REPEAT_FAVOR_CAP = 0.18;
const THIN_DAY_STEP_LIMIT = 2400;
const HIGH_STEPS_THRESHOLD = 6500;
const RUN_ACTIVITY_PATTERN = /run|jog/i;

const profilesById = new Map(katchimeraEncounterProfiles.map((profile) => [profile.id, profile]));

export function extractEncounterSignals(day: StoredHomeDayRecord): EncounterSignal[] {
  const signals: EncounterSignal[] = [];
  const momentsByType = groupMomentIdsByType(day);

  const coffeeIds = momentsByType.get('coffee') ?? [];
  if (coffeeIds.length > 0) {
    signals.push({
      seedId: 'coffee_shop',
      intensity: clamp01(0.52 + 0.12 * (coffeeIds.length - 1)),
      sourceMomentIds: coffeeIds,
      isRecovery: false,
    });
  }

  const walkIds = momentsByType.get('walk') ?? [];
  if (walkIds.length > 0) {
    const stepBoost = day.stepsCount >= 3200 ? 0.12 : 0;
    signals.push({
      seedId: 'park',
      intensity: clamp01(0.46 + 0.1 * (walkIds.length - 1) + stepBoost),
      sourceMomentIds: walkIds,
      isRecovery: false,
    });
  }

  if (hasRunWorkout(day)) {
    signals.push({
      seedId: 'run_session',
      intensity: 0.85,
      sourceMomentIds: [],
      isRecovery: false,
    });
  } else if (day.stepsCount >= HIGH_STEPS_THRESHOLD) {
    signals.push({
      seedId: 'high_steps_day',
      intensity: clamp01(0.5 + Math.min((day.stepsCount - HIGH_STEPS_THRESHOLD) / 9000, 0.3)),
      sourceMomentIds: [],
      isRecovery: false,
    });
  }

  const calmIds = momentsByType.get('calm') ?? [];
  if (calmIds.length > 0) {
    signals.push({
      seedId: 'home_evening',
      intensity: clamp01(0.42 + 0.08 * (calmIds.length - 1)),
      sourceMomentIds: calmIds,
      isRecovery: true,
    });
  }

  const isThinDay =
    day.moments.length === 0 &&
    day.stepsCount < THIN_DAY_STEP_LIMIT &&
    day.visitedPlaceCount <= 1 &&
    signals.length === 0;
  if (isThinDay) {
    signals.push({
      seedId: 'home_evening',
      intensity: 0.38,
      sourceMomentIds: [],
      isRecovery: true,
    });
  }

  return signals;
}

export function matchEncounterForDay(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap
): EncounterMatch | null {
  const candidates = extractEncounterSignals(day)
    .map((signal) => {
      const castEntry = encounterCastBySeedId.get(signal.seedId);
      if (!castEntry) {
        return null;
      }
      const profile = profilesById.get(castEntry.profileId);
      if (!profile) {
        return null;
      }
      const repeatDepth = history[castEntry.profileId]?.count ?? 0;
      const favored = clamp01(
        signal.intensity + Math.min(repeatDepth * REPEAT_FAVOR_PER_VISIT, REPEAT_FAVOR_CAP)
      );
      return { castEntry, profile, signal, repeatDepth, favored };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => {
      if (right.favored !== left.favored) {
        return right.favored - left.favored;
      }
      return (
        stableHash(`${day.isoDate}|${left.castEntry.seedId}`) -
        stableHash(`${day.isoDate}|${right.castEntry.seedId}`)
      );
    });

  const best = candidates[0];
  if (!best) {
    return null;
  }

  return {
    castEntry: best.castEntry,
    profile: best.profile,
    signal: best.signal,
    repeatDepth: best.repeatDepth,
    rarity: resolveEncounterRarity(best.profile.baseRarity, best.signal, day),
  };
}

export function buildEncounterCreature(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap,
  primaryTrait: HomeScoreKey,
  secondaryTrait: HomeScoreKey
): LocalCreatureRecord | null {
  const match = matchEncounterForDay(day, history);
  if (!match) {
    return null;
  }

  const { profile, castEntry, signal, repeatDepth, rarity } = match;
  const visual = homeCreatureVisuals[castEntry.visualKey];
  const lines = pickEncounterLines(profile, castEntry, repeatDepth, rarity, signal.isRecovery);
  const highlightMomentId = signal.sourceMomentIds[signal.sourceMomentIds.length - 1] ?? null;

  return {
    id: `creature-${day.isoDate}-${stableHash(`${day.isoDate}|${profile.id}`)}`,
    name: profile.name,
    primaryTrait,
    secondaryTrait,
    rarity,
    visualKey: castEntry.visualKey,
    accentColor: visual.accentColor,
    highlightMomentId,
    highlight: lines.highlight,
    reflection: lines.reflection,
    motifTags: buildMotifTags(profile, castEntry),
    encounterProfileId: profile.id,
    repeatDepth,
  };
}

export function recordEncounterHatch(
  history: EncounterHistoryMap,
  profileId: string,
  isoDate: string
): EncounterHistoryMap {
  const existing = history[profileId];
  if (existing?.lastSeenIsoDate === isoDate) {
    return history;
  }

  return {
    ...history,
    [profileId]: {
      count: (existing?.count ?? 0) + 1,
      lastSeenIsoDate: isoDate,
    },
  };
}

function resolveEncounterRarity(
  baseRarity: string,
  signal: EncounterSignal,
  day: StoredHomeDayRecord
): HomeRarityTier {
  const baseTier: HomeRarityTier =
    baseRarity === 'rare' ? 'epic' : baseRarity === 'uncommon' ? 'rare' : 'common';
  const patternBreak = signal.intensity >= 0.82 || day.newPlaceCount >= 2;
  if (!patternBreak) {
    return baseTier;
  }
  if (baseTier === 'common') return 'rare';
  if (baseTier === 'rare') return 'epic';
  return 'legendary';
}

function pickEncounterLines(
  profile: KatchimeraEncounterProfile,
  castEntry: EncounterCastEntry,
  repeatDepth: number,
  rarity: HomeRarityTier,
  isRecovery: boolean
): { highlight: string; reflection: string } {
  const category = castEntry.categoryLabel.toLowerCase();
  const repeatFallback = `Returning to ${category} moments is deepening your bond with ${profile.name}.`;
  const restorativeFallback = `${profile.name} is a reminder that quieter days still leave something worth keeping.`;
  const progressFallback = `${profile.name} keeps showing up — your ${category} ritual is becoming part of you.`;

  let highlight: string;
  if (rarity === 'epic' || rarity === 'legendary') {
    highlight = sanitizeLine(profile.rareLine, profile.unlockLine);
  } else if (isRecovery) {
    highlight = sanitizeLine(profile.restorativeLine, restorativeFallback);
  } else if (repeatDepth === 0) {
    highlight = sanitizeLine(profile.unlockLine, profile.caption);
  } else if (repeatDepth >= 4) {
    highlight = sanitizeLine(profile.progressLine, progressFallback);
  } else {
    highlight = sanitizeLine(profile.repeatLine, repeatFallback);
  }

  return {
    highlight,
    reflection: sanitizeLine(profile.identityInsight, profile.caption),
  };
}

// Some generated copy still carries parked "deck" framing; keep it out of the
// hatch until the generator templates are reworded.
function sanitizeLine(line: string, fallback: string) {
  return /deck/i.test(line) ? fallback : line;
}

function buildMotifTags(profile: KatchimeraEncounterProfile, castEntry: EncounterCastEntry) {
  const firstMotif = profile.visualMotifs[0];
  const motifTag = firstMotif ? firstMotif.charAt(0).toUpperCase() + firstMotif.slice(1) : null;
  return motifTag ? [castEntry.categoryLabel, motifTag] : [castEntry.categoryLabel];
}

function hasRunWorkout(day: StoredHomeDayRecord) {
  return day.exactRouteSegments.some((segment) => RUN_ACTIVITY_PATTERN.test(segment.activityType));
}

function groupMomentIdsByType(day: StoredHomeDayRecord) {
  const result = new Map<string, string[]>();
  day.moments.forEach((moment) => {
    const ids = result.get(moment.type) ?? [];
    ids.push(moment.id);
    result.set(moment.type, ids);
  });
  return result;
}

function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}
