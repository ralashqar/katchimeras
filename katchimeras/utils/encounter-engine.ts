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

// Where a signal came from — drives Hatch Engine v2 weighting (explicit
// moment/prompt input counts as "intent") and the day-tag field's grouping.
export type EncounterSignalSource = 'place' | 'vision' | 'prompt' | 'moment' | 'passive';

export type EncounterSignal = {
  seedId: string;
  intensity: number;
  sourceMomentIds: string[];
  isRecovery: boolean;
  source: EncounterSignalSource;
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
      source: 'place',
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
        source: 'vision',
      });
    });
  }

  day.promptAnswers
    .filter((answer) => !answer.dismissed)
    .forEach((answer) => {
      (answer.encounterSeedBias ?? []).forEach((bias) => {
        signals.push({
          seedId: bias.seedId,
          intensity: clamp01(bias.intensity),
          sourceMomentIds: [],
          isRecovery:
            answer.semanticTags.includes('tender_day') ||
            answer.semanticTags.includes('activity:resting') ||
            answer.semanticTags.includes('meaning:got_through_it'),
          source: 'prompt',
        });
      });
    });

  const coffeeIds = momentsByType.get('coffee') ?? [];
  if (coffeeIds.length > 0) {
    signals.push({
      seedId: 'coffee_shop',
      intensity: clamp01(0.52 + 0.12 * (coffeeIds.length - 1)),
      sourceMomentIds: coffeeIds,
      isRecovery: false,
      source: 'moment',
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
      source: 'moment',
    });
  }

  const socialIds = momentsByType.get('social') ?? [];
  if (socialIds.length > 0) {
    signals.push({
      seedId: 'social_gathering',
      intensity: clamp01(0.5 + 0.12 * (socialIds.length - 1)),
      sourceMomentIds: socialIds,
      isRecovery: false,
      source: 'moment',
    });
  }

  if (hasRunWorkout(day)) {
    signals.push({
      seedId: 'run_session',
      intensity: 0.85,
      sourceMomentIds: [],
      isRecovery: false,
      source: 'passive',
    });
  } else if (day.stepsCount >= HIGH_STEPS_THRESHOLD) {
    signals.push({
      seedId: 'high_steps_day',
      intensity: clamp01(0.5 + Math.min((day.stepsCount - HIGH_STEPS_THRESHOLD) / 9000, 0.3)),
      sourceMomentIds: [],
      isRecovery: false,
      source: 'passive',
    });
  } else if (day.visitedPlaceCount >= 3) {
    signals.push({
      seedId: 'errand_loop',
      intensity: clamp01(0.4 + 0.06 * (day.visitedPlaceCount - 3)),
      sourceMomentIds: [],
      isRecovery: false,
      source: 'passive',
    });
  }

  const calmIds = momentsByType.get('calm') ?? [];
  if (calmIds.length > 0) {
    signals.push({
      seedId: 'home_evening',
      intensity: clamp01(0.42 + 0.08 * (calmIds.length - 1)),
      sourceMomentIds: calmIds,
      isRecovery: true,
      source: 'moment',
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
      source: 'passive',
    });
  }

  // The weather the day actually had: the wild (storm) and the hushed (fog) days
  // get their own companions. Rain/snow already arrive via vision concepts.
  if (day.weather?.condition === 'storm') {
    signals.push({ seedId: 'storm_day', intensity: 0.55, sourceMomentIds: [], isRecovery: false, source: 'passive' });
  } else if (day.weather?.condition === 'fog') {
    signals.push({ seedId: 'foggy_day', intensity: 0.5, sourceMomentIds: [], isRecovery: false, source: 'passive' });
  }

  // Time-of-day: being up in the small hours, or out before first light, is
  // unusual enough to read as a night-owl / dawn day. Kept low-intensity so any
  // resolved place or real activity outranks it, but it can carry an otherwise
  // quiet late night or early morning.
  const activityHours = collectDayHours(day);
  if (activityHours.some((hour) => hour >= 0 && hour < 4)) {
    signals.push({ seedId: 'night_owl', intensity: 0.46, sourceMomentIds: [], isRecovery: false, source: 'passive' });
  } else if (activityHours.some((hour) => hour >= 4 && hour < 7)) {
    signals.push({ seedId: 'first_light', intensity: 0.44, sourceMomentIds: [], isRecovery: false, source: 'passive' });
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
      source: 'passive',
    });
  }

  return signals;
}

// --- Hatch Engine v2 candidate surface -------------------------------------
// One scored candidate per distinct species the day's signals reach. This is
// the raw "candidate field" the probabilistic selector (utils/hatch-selection)
// consumes. Deterministic and pure — no pick, no randomness here.
export type EncounterCandidate = {
  castEntry: EncounterCastEntry;
  profile: KatchimeraEncounterProfile;
  signal: EncounterSignal;
  repeatDepth: number;
  lastSeenIsoDate: string | null;
  // The creature's intrinsic rarity floor (a landmark is never common).
  rarityFloor: HomeRarityTier;
};

// Collapse the day's signals to one candidate per species, keeping the
// strongest signal for each (and preferring explicit moment/prompt sources on a
// tie, so "you said so" wins the provenance). Drops signals with no live cast.
export function extractEncounterCandidates(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap
): EncounterCandidate[] {
  const byProfile = new Map<string, EncounterCandidate>();
  const intentSources: EncounterSignalSource[] = ['moment', 'prompt'];

  for (const signal of extractEncounterSignals(day)) {
    const castEntry = encounterCastBySeedId.get(signal.seedId);
    if (!castEntry) {
      continue;
    }
    const profile = profilesById.get(castEntry.profileId);
    if (!profile) {
      continue;
    }

    const existing = byProfile.get(castEntry.profileId);
    if (existing) {
      const strongerIntensity = signal.intensity > existing.signal.intensity;
      const sameIntensityButExplicit =
        signal.intensity === existing.signal.intensity &&
        intentSources.includes(signal.source) &&
        !intentSources.includes(existing.signal.source);
      if (!strongerIntensity && !sameIntensityButExplicit) {
        continue;
      }
    }

    byProfile.set(castEntry.profileId, {
      castEntry,
      profile,
      signal,
      repeatDepth: history[castEntry.profileId]?.count ?? 0,
      lastSeenIsoDate: history[castEntry.profileId]?.lastSeenIsoDate ?? null,
      rarityFloor: speciesRarityFloor(profile.baseRarity),
    });
  }

  return [...byProfile.values()];
}

// Build the persisted creature record for a chosen candidate. Shared by the
// legacy argmax path (buildEncounterCreature) and the v2 probabilistic path
// (utils/hatch-selection) so both produce identical records for a given match.
export function buildCreatureFromMatch(
  day: StoredHomeDayRecord,
  match: EncounterMatch,
  primaryTrait: HomeScoreKey,
  secondaryTrait: HomeScoreKey
): LocalCreatureRecord {
  const { profile, castEntry, signal, repeatDepth, rarity, livingRarity } = match;
  const visual = homeCreatureVisuals[castEntry.visualKey];
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

  return buildCreatureFromMatch(day, match, primaryTrait, secondaryTrait);
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
export function speciesRarityFloor(baseRarity: string): HomeRarityTier {
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

// Local hours (0–23) of everything the day timestamps — used to spot the small
// hours (night owl) and the dawn (first light).
function collectDayHours(day: StoredHomeDayRecord): number[] {
  const hours: number[] = [];
  const push = (iso: string | null | undefined) => {
    if (!iso) return;
    const time = new Date(iso);
    if (!Number.isNaN(time.getTime())) {
      hours.push(time.getHours());
    }
  };
  day.locations.forEach((point) => push(point.capturedAt));
  day.moments.forEach((moment) => push(moment.createdAt));
  day.exactRouteSegments.forEach((segment) => {
    push(segment.startedAt);
    segment.coordinates.forEach((coordinate) => push(coordinate.capturedAt));
  });
  return hours;
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
