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
import { computeLivingRarity, computeDaySpanMeters, maxRarity, type LivingRarity } from '@/utils/living-rarity';
import { resolveBondStage, type BondStage } from '@/utils/bond';
import { buildVisionSignals } from '@/utils/vision-signals';

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
  livingRarity: LivingRarity;
};

const REPEAT_FAVOR_PER_VISIT = 0.06;
const REPEAT_FAVOR_CAP = 0.18;
// Generic "activity" fallbacks — these describe HOW MUCH you moved, not what the
// day was actually about. When the photos/places say something specific (a
// museum, a child, a landmark, a café), that should win over "you walked a lot".
const GENERIC_FALLBACK_SEEDS = new Set(['high_steps_day', 'errand_loop', 'home_evening']);
// How much a specific (scene/subject/place/social) signal is favored over a
// generic activity one. Big enough that a clear museum beats a high-steps day,
// small enough that a genuinely empty walking day still hatches its walker.
const SPECIFICITY_BONUS = 0.22;
// When asked to avoid a profile (e.g. the previous backfilled day's creature),
// demote it so a different creature wins IF one is competitive — but it can still
// win when it's the only real candidate.
const AVOID_REPEAT_PENALTY = 0.3;
const THIN_DAY_STEP_LIMIT = 2400;
const HIGH_STEPS_THRESHOLD = 6500;
const RUN_ACTIVITY_PATTERN = /run|jog/i;
// Passive "stayed in" read: a quiet, low-movement day spent inside one tight
// area reads as a home/rest day with no manual tag required.
const STAY_PUT_SPREAD_METERS = 350;
const QUIET_DAY_STEP_LIMIT = 4000;

const profilesById = new Map(katchimeraEncounterProfiles.map((profile) => [profile.id, profile]));

export function extractEncounterSignals(day: StoredHomeDayRecord): EncounterSignal[] {
  const signals: EncounterSignal[] = [];
  const momentsByType = groupMomentIdsByType(day);

  (day.placeCategorySeeds ?? []).forEach((seedId, index) => {
    signals.push({
      seedId,
      intensity: index === 0 ? 0.58 : 0.5,
      sourceMomentIds: [],
      isRecovery: false,
    });
  });

  // On-device vision read: what the day's photos actually showed (scenes, signs,
  // people) becomes encounter signals — including social_gathering from a face
  // count, the one signal passive sensors can't reach. Present only once the
  // native vision module has analysed the day.
  if (day.vision) {
    buildVisionSignals(day.vision).forEach((visionSignal) => {
      signals.push({
        seedId: visionSignal.seedId,
        intensity: visionSignal.intensity,
        sourceMomentIds: [],
        isRecovery: visionSignal.isRecovery,
      });
    });
  }

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

  const socialIds = momentsByType.get('social') ?? [];
  if (socialIds.length > 0) {
    signals.push({
      seedId: 'social_gathering',
      intensity: clamp01(0.5 + 0.12 * (socialIds.length - 1)),
      sourceMomentIds: socialIds,
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
  } else if (day.visitedPlaceCount >= 3) {
    signals.push({
      seedId: 'errand_loop',
      intensity: clamp01(0.4 + 0.06 * (day.visitedPlaceCount - 3)),
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

  // Passive home/rest read — no tag needed. A low-movement day spent in one
  // tight area hatches the home-evening companion on its own, which is what
  // makes tagging optional for the most common quiet day. Its intensity is kept
  // low on purpose: any resolved place or real activity above outranks it in
  // the candidate sort, so it only wins when nothing more specific is present.
  const stayedPut =
    day.locations.length >= 2 && computeDaySpanMeters(day.locations) <= STAY_PUT_SPREAD_METERS;
  if (stayedPut && day.stepsCount < QUIET_DAY_STEP_LIMIT && calmIds.length === 0) {
    signals.push({
      seedId: 'home_evening',
      intensity: clamp01(0.4 + Math.min((day.locations.length - 2) * 0.01, 0.06)),
      sourceMomentIds: [],
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
  history: EncounterHistoryMap,
  options: { avoidProfileId?: string } = {}
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
      // Specific scene/subject/place signals are favored over generic activity
      // fallbacks, so "what the day was about" beats "how much you moved".
      const specificityBonus = GENERIC_FALLBACK_SEEDS.has(signal.seedId) ? 0 : SPECIFICITY_BONUS;
      // Avoid repeating the day-before's creature when something else is close.
      const avoidPenalty = options.avoidProfileId === castEntry.profileId ? AVOID_REPEAT_PENALTY : 0;
      const favored = clamp01(
        signal.intensity +
          Math.min(repeatDepth * REPEAT_FAVOR_PER_VISIT, REPEAT_FAVOR_CAP) +
          specificityBonus -
          avoidPenalty
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

  // Rarity is fixed at birth: the higher of the creature's intrinsic floor (a
  // landmark is never "common") and the rarity the day's living conditions
  // earned. It no longer reacts to signal intensity — only to how the day was
  // actually lived.
  const livingRarity = computeLivingRarity(day);
  const rarity = maxRarity(speciesRarityFloor(best.profile.baseRarity), livingRarity.tier);

  return {
    castEntry: best.castEntry,
    profile: best.profile,
    signal: best.signal,
    repeatDepth: best.repeatDepth,
    rarity,
    livingRarity,
  };
}

export function buildEncounterCreature(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap,
  primaryTrait: HomeScoreKey,
  secondaryTrait: HomeScoreKey,
  options: { avoidProfileId?: string } = {}
): LocalCreatureRecord | null {
  const match = matchEncounterForDay(day, history, options);
  if (!match) {
    return null;
  }

  const { profile, castEntry, signal, repeatDepth, rarity, livingRarity } = match;
  const visual = homeCreatureVisuals[castEntry.visualKey];
  // This hatch is the (repeatDepth + 1)th time you've met this creature.
  const bondVisitCount = repeatDepth + 1;
  const bondStage = resolveBondStage(bondVisitCount);
  const lines = pickEncounterLines(profile, castEntry, repeatDepth, rarity, signal.isRecovery, bondStage);
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
    rarityReason: livingRarity.reason,
    livingFactors: livingRarity.factors,
    bondStage,
    bondVisitCount,
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

// A creature's intrinsic rarity floor — how hard it is to meet at all,
// independent of any one day. The day's living conditions can lift a creature
// above its floor (see computeLivingRarity), never below it.
function speciesRarityFloor(baseRarity: string): HomeRarityTier {
  if (baseRarity === 'rare') return 'epic';
  if (baseRarity === 'uncommon') return 'rare';
  return 'common';
}

function pickEncounterLines(
  profile: KatchimeraEncounterProfile,
  castEntry: EncounterCastEntry,
  repeatDepth: number,
  rarity: HomeRarityTier,
  isRecovery: boolean,
  bondStage: BondStage
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
  } else if (bondStage >= 1 || repeatDepth >= 4) {
    // A deepened bond speaks to the shared history, not the single day.
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
