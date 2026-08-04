import {
  buildCreatureFromMatch,
  extractEncounterCandidates,
  type EncounterCandidate,
  type EncounterMatch,
} from '@/utils/encounter-engine';
import { computeLivingRarity, maxRarity, type LivingRarity } from '@/utils/living-rarity';
import type {
  EncounterHistoryMap,
  HatchDecisionModifiers,
  HomeRarityTier,
  HomeScoreKey,
  KatchimeraFieldEcho,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import type { KatchimeraFamilyId, KatchimeraSkinId, LifeAspectId } from '@/types/katchimera';
import { identityForEncounter } from '@/utils/katchimera-identity';
import { dayForDevHatchSelection } from '@/utils/forced-low-signal-hatch';

// Hatch Engine v2 — the probabilistic draw.
//
// Every day's signals form a *candidate field* (extractEncounterCandidates).
// This module scores each candidate with an explicit, tunable weight, turns the
// top few into a softmax distribution, and draws one with an injected RNG. The
// winner is the hatch; the candidates it beat become "echoes" (the almost-
// caughts). Everything here is pure: the RNG and the resolved rarity are inputs,
// so a given (day, seed) always yields the identical winner + echoes, which is
// what keeps it reproducible across the engine's re-derivations and testable in
// the Node harness — exactly like utils/living-rarity.ts.

// --- Tunables --------------------------------------------------------------
const TEMPERATURE = 0.18; // softmax τ: leader wins ~70–85% when the gap is ~0.2–0.3
const TOP_K = 4; // candidates that enter the softmax (rest are dropped)
const MAX_ECHOES = 3; // almost-caughts persisted on the winner

const NOVELTY_BONUS = 0.22; // never hatched this species → discovery pull
const INTENT_BONUS = 0.15; // signal came from an explicit moment/prompt
const BOND_PER_VISIT = 0.04;
const BOND_CAP = 0.16;
const SEASONAL_BONUS = 0.12;
const AVOID_PREV_PENALTY = 0.15; // same species as yesterday's hatch
const SPECIFICITY_GENERIC = 0.7; // generic activity reads (how much you moved)
const SCORE_FLOOR = 0.02;
const SCORE_CEIL = 1.5;
const CONTEXT_LEADER_MARGIN = 0.06;

// Generic "activity" fallbacks describe HOW MUCH you moved, not what the day was
// about — they get a specificity haircut so a real scene/place/subject wins.
const GENERIC_FALLBACK_SEEDS = new Set(['high_steps_day', 'errand_loop', 'home_evening']);

// Rarity-floor → lure: a creature that is intrinsically hard to meet (a
// landmark) tugs a little harder on the draw, so an almost-legendary slipping
// away is the strongest "live that day again" hook.
const RARITY_LURE: Record<HomeRarityTier, number> = {
  common: 0,
  rare: 0.05,
  epic: 0.08,
  legendary: 0.1,
};

// Month windows (1–12) in which a seasonal species is in season. Outside its
// window it can still hatch from real evidence, just without the seasonal lift.
const SEASONAL_WINDOWS: Record<string, number[]> = {
  spring_blossom: [3, 4, 5],
  first_snow: [12, 1, 2],
  autumn_day: [9, 10, 11],
};

export type HatchSelectionInput = {
  day: StoredHomeDayRecord;
  history: EncounterHistoryMap;
  // The most recent previously-hatched day's encounterProfileId, demoted so two
  // consecutive days are less likely to hatch the identical creature.
  yesterdayProfileId?: string | null;
  // Injected RNG in [0, 1). Use makeSeededRng() so the draw is reproducible.
  rng: () => number;
  // The 5-axis mood traits, when the caller has already computed them
  // (computeDayScores). Falls back to a local derivation if omitted.
  primaryTrait?: HomeScoreKey;
  secondaryTrait?: HomeScoreKey;
};

export type HatchCandidateProbability = {
  profileId: string;
  aspectId: LifeAspectId;
  familyId: KatchimeraFamilyId;
  skinId: KatchimeraSkinId;
  name: string;
  probability: number;
  score: number;
  rarity: HomeRarityTier;
  seedId: string;
  modifiers: HatchDecisionModifiers;
};

export type HatchSelection = {
  // The winning creature record, carrying pickProbability / fieldEchoes /
  // birthSignals. Ready to persist (the caller still layers on mood/variant).
  creature: LocalCreatureRecord;
  echoes: KatchimeraFieldEcho[];
  probabilities: HatchCandidateProbability[];
};

type ScoredCandidate = {
  candidate: EncounterCandidate;
  score: number;
  rarity: HomeRarityTier;
  modifiers: HatchDecisionModifiers;
};

// Score and rank the day's candidate field — shared by the draw and the
// pre-hatch preview. Pure and rng-free; sorting is stable.
export function scoreField(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap,
  yesterdayProfileId: string | null | undefined = null
): ScoredCandidate[] {
  const hatchInputDay = dayForDevHatchSelection(day);
  const candidates = extractEncounterCandidates(hatchInputDay, history);
  if (candidates.length === 0) {
    return [];
  }
  // Rarity is a property of how the day was lived — computed once, shared by
  // every candidate (each then takes the higher of this and its own floor).
  const livingRarity = computeLivingRarity(hatchInputDay);
  const month = isoMonth(hatchInputDay.isoDate);

  const scored = candidates
    .map((candidate) => {
      const scored = scoreCandidate(candidate, { day: hatchInputDay, livingRarity, month, yesterdayProfileId });
      return {
        candidate,
        score: scored.score,
        modifiers: scored.modifiers,
        rarity: maxRarity(candidate.rarityFloor, livingRarity.tier),
      };
    });

  // A large step total is meaningful evidence, but it describes how much the
  // user moved rather than what the day was about. Keep it as a strong echo
  // beneath a credible museum/beach/city/photo/journal context unless the user
  // explicitly chose movement in the pre-hatch reflection.
  const explicitMovementChoice = hatchInputDay.hatchCheckIn?.status !== 'skipped'
    && hatchInputDay.hatchCheckIn?.flowId === 'movement'
    && (hatchInputDay.hatchCheckIn.answeredQuestionIds?.length ?? 0) > 0;
  if (!explicitMovementChoice) {
    const contextualLeader = scored
      .filter((entry) =>
        entry.candidate.familyId !== 'steppling'
        && !GENERIC_FALLBACK_SEEDS.has(entry.candidate.signal.seedId)
        && ['place', 'vision', 'prompt', 'moment', 'journal'].includes(entry.candidate.signal.source)
      )
      .sort((left, right) => right.score - left.score)[0];
    const movement = scored.find((entry) =>
      entry.candidate.familyId === 'steppling'
      && entry.candidate.signal.seedId === 'high_steps_day'
    );
    if (contextualLeader && movement && movement.score >= contextualLeader.score - CONTEXT_LEADER_MARGIN) {
      const adjusted = Math.max(SCORE_FLOOR, contextualLeader.score - CONTEXT_LEADER_MARGIN);
      movement.modifiers.contextualPriority = round3(adjusted - movement.score);
      movement.score = adjusted;
    }
  }

  return scored.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      // Stable tiebreak so ordering (and therefore the seeded draw) is fixed.
      return (
        stableHash(`${hatchInputDay.isoDate}|${left.candidate.castEntry.seedId}`) -
        stableHash(`${hatchInputDay.isoDate}|${right.candidate.castEntry.seedId}`)
      );
    });
}

// The leading candidate's *kind of day* (category label + seed) without naming
// the creature — feeds the pre-hatch egg copy ("a coffee-shop day is forming")
// while keeping the hatch itself a surprise. Returns null on an empty field.
export function previewLeadingCandidate(
  input: Omit<HatchSelectionInput, 'rng' | 'primaryTrait' | 'secondaryTrait'>
): { categoryLabel: string; seedId: string } | null {
  const field = scoreField(input.day, input.history, input.yesterdayProfileId);
  const leader = field[0];
  if (!leader) {
    return null;
  }
  return { categoryLabel: leader.candidate.castEntry.categoryLabel, seedId: leader.candidate.castEntry.seedId };
}

export function selectHatch(input: HatchSelectionInput): HatchSelection | null {
  const { history, yesterdayProfileId, rng } = input;
  const day = dayForDevHatchSelection(input.day);
  const scored = scoreField(day, history, yesterdayProfileId);
  if (scored.length === 0) {
    return null;
  }
  const livingRarity = computeLivingRarity(day);

  const field = scored.slice(0, TOP_K);
  const probabilities = softmax(field.map((entry) => entry.score), TEMPERATURE);
  const winnerIndex = sampleIndex(probabilities, rng());
  const winner = field[winnerIndex];

  const probabilityRows: HatchCandidateProbability[] = field.map((entry, index) => ({
    profileId: entry.candidate.profile.id,
    aspectId: entry.candidate.aspectId,
    familyId: entry.candidate.familyId,
    skinId: entry.candidate.skinId,
    name: entry.candidate.profile.name,
    probability: round3(probabilities[index]),
    score: round3(entry.score),
    rarity: entry.rarity,
    seedId: entry.candidate.signal.seedId,
    modifiers: entry.modifiers,
  }));

  const echoes: KatchimeraFieldEcho[] = field
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => index !== winnerIndex)
    .slice(0, MAX_ECHOES)
    .map(({ entry, index }) => ({
      speciesId: entry.candidate.profile.id,
      aspectId: entry.candidate.aspectId,
      familyId: entry.candidate.familyId,
      skinId: entry.candidate.skinId,
      name: entry.candidate.profile.name,
      visualKey: entry.candidate.castEntry.visualKey,
      rarity: entry.rarity,
      probability: round3(probabilities[index]),
      reason: entry.rarity === 'common' ? null : livingRarity.reason,
    }));

  const match: EncounterMatch = {
    castEntry: winner.candidate.castEntry,
    profile: winner.candidate.profile,
    signal: winner.candidate.signal,
    repeatDepth: winner.candidate.repeatDepth,
    rarity: winner.rarity,
    livingRarity,
  };
  const base = buildCreatureFromMatch(
    day,
    match,
    input.primaryTrait ?? deriveTrait(day, 'primary'),
    input.secondaryTrait ?? deriveTrait(day, 'secondary')
  );

  return {
    creature: {
      ...base,
      pickProbability: round3(probabilities[winnerIndex]),
      fieldEchoes: echoes,
      birthSignals: [...new Set([
        winner.candidate.signal.seedId,
        ...(winner.candidate.signal.journalEvidence ?? []).map((row) => row.seedId),
      ])],
      hatchDecision: {
        version: 1,
        engineVersion: 'journal-field-v2',
        leaderFamilyId: field[0].candidate.familyId,
        winnerFamilyId: winner.candidate.familyId,
        candidates: field.map((entry, index) => ({
          profileId: entry.candidate.profile.id,
          familyId: entry.candidate.familyId,
          skinId: entry.candidate.skinId,
          seedId: entry.candidate.signal.seedId,
          score: round3(entry.score),
          probability: round3(probabilities[index]),
          selected: index === winnerIndex,
          modifiers: entry.modifiers,
          contributions: (entry.candidate.signal.journalEvidence ?? []).map((row) => ({
            journalRecordId: row.journalRecordId,
            routeKey: row.routeKey,
            sourceKind: row.sourceKind,
            weight: row.weight,
            keyMoment: row.keyMoment,
            explanation: row.explanation,
          })),
        })),
      },
    },
    echoes,
    probabilities: probabilityRows,
  };
}

function scoreCandidate(
  candidate: EncounterCandidate,
  context: {
    day: StoredHomeDayRecord;
    livingRarity: LivingRarity;
    month: number;
    yesterdayProfileId?: string | null;
  }
): { score: number; modifiers: HatchDecisionModifiers } {
  const { signal, repeatDepth, rarityFloor, lastSeenIsoDate, profile, castEntry } = candidate;

  const specificity = GENERIC_FALLBACK_SEEDS.has(castEntry.seedId) ? SPECIFICITY_GENERIC : 1;
  let score = signal.intensity * specificity;
  const modifiers: HatchDecisionModifiers = {
    novelty: 0,
    intent: 0,
    measuredMovement: 0,
    corroboration: 0,
    contextualPriority: 0,
    bond: 0,
    seasonal: 0,
    rarity: 0,
    recency: 0,
    previousDay: 0,
  };

  if (repeatDepth === 0) {
    modifiers.novelty = NOVELTY_BONUS;
  }
  if (signal.source === 'moment' || signal.source === 'prompt' || signal.source === 'journal') {
    modifiers.intent = INTENT_BONUS;
  }
  if (candidate.familyId === 'steppling') {
    modifiers.measuredMovement = measuredMovementBonus(context.day.stepsCount ?? 0);
    modifiers.corroboration = movementCorroborationBonus(context.day, signal);
  }
  modifiers.bond = Math.min(repeatDepth * BOND_PER_VISIT, BOND_CAP);
  if (SEASONAL_WINDOWS[castEntry.seedId]?.includes(context.month)) {
    modifiers.seasonal = SEASONAL_BONUS;
  }
  modifiers.rarity = RARITY_LURE[rarityFloor] ?? 0;
  modifiers.recency = -recencyPenalty(daysBetween(lastSeenIsoDate, context.day.isoDate));
  const yesterdayIdentity = identityForEncounter(context.yesterdayProfileId, null);
  if (
    context.yesterdayProfileId &&
    (yesterdayIdentity
      ? candidate.familyId === yesterdayIdentity.familyId
      : profile.id === context.yesterdayProfileId)
  ) {
    modifiers.previousDay = -AVOID_PREV_PENALTY;
  }

  score += Object.values(modifiers).reduce((sum, value) => sum + value, 0);
  return {
    score: clamp(score, SCORE_FLOOR, SCORE_CEIL),
    modifiers: Object.fromEntries(Object.entries(modifiers).map(([key, value]) => [key, round3(value)])) as HatchDecisionModifiers,
  };
}

function measuredMovementBonus(steps: number): number {
  if (steps < 6_500) return 0;
  if (steps < 10_000) return interpolate(0, 0.05, (steps - 6_500) / 3_500);
  if (steps < 15_000) return interpolate(0.05, 0.11, (steps - 10_000) / 5_000);
  if (steps < 20_000) return interpolate(0.11, 0.18, (steps - 15_000) / 5_000);
  if (steps < 25_000) return interpolate(0.18, 0.24, (steps - 20_000) / 5_000);
  return Math.min(0.28, 0.24 + ((steps - 25_000) / 10_000) * 0.04);
}

function movementCorroborationBonus(day: StoredHomeDayRecord, signal: EncounterCandidate['signal']): number {
  const measuredSteps = (day.stepsCount ?? 0) >= 6_500;
  const journalMovement = (signal.journalEvidence ?? []).some((row) =>
    /^journal\.route:movement\.(walk|hike|run)(?:\.|$)/.test(row.routeKey)
  );
  const measuredRoute = (day.exactRouteSegments ?? []).some((segment) =>
    /walk|hike|run|jog/i.test(segment.activityType)
  );
  const sourceCount = [measuredSteps, journalMovement, measuredRoute].filter(Boolean).length;
  if (sourceCount < 2) return 0;
  return sourceCount === 2 ? 0.1 : 0.14;
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * Math.min(Math.max(progress, 0), 1);
}

// Anti-dupe: a species hatched very recently is suppressed, decaying to nothing
// by ~5 days, so real rhythms still resurface their regular within the week.
function recencyPenalty(daysSince: number | null): number {
  if (daysSince === null) {
    return 0;
  }
  if (daysSince <= 1) return 0.35;
  if (daysSince === 2) return 0.22;
  if (daysSince === 3) return 0.12;
  if (daysSince === 4) return 0.05;
  return 0;
}

// --- Seeded RNG ------------------------------------------------------------
// mulberry32 — tiny, fast, deterministic. Seeded from a string so the caller
// can build the seed from isoDate + input signature + storedNonce.
export function makeSeededRng(seed: string): () => number {
  let state = stableHash(seed) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Math helpers ----------------------------------------------------------
function softmax(scores: number[], temperature: number): number[] {
  if (scores.length === 0) {
    return [];
  }
  const max = Math.max(...scores);
  const exps = scores.map((score) => Math.exp((score - max) / temperature));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

function sampleIndex(probabilities: number[], roll: number): number {
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (roll < cumulative) {
      return index;
    }
  }
  return probabilities.length - 1;
}

function daysBetween(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) {
    return null;
  }
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }
  const diff = Math.floor((to - from) / 86_400_000);
  return diff < 0 ? null : diff;
}

function isoMonth(isoDate: string): number {
  return Number.parseInt(isoDate.slice(5, 7), 10) || 0;
}

// The 5-axis mood read still names the creature's primary/secondary trait. We
// derive it locally so this module stays self-contained; the scores it reads are
// the same ones computeDayScores produces, minus the path/step shaping that only
// matters for the egg visuals.
const TRAIT_ORDER: HomeScoreKey[] = ['energy', 'calm', 'social', 'exploration', 'focus'];

function deriveTrait(day: StoredHomeDayRecord, which: 'primary' | 'secondary'): HomeScoreKey {
  const totals: Record<HomeScoreKey, number> = { energy: 0, calm: 0, social: 0, exploration: 0, focus: 0 };
  day.moments.forEach((moment) => {
    if (moment.type === 'walk') totals.energy += 1;
    else if (moment.type === 'new_place') totals.exploration += 1;
    else if (moment.type === 'social') totals.social += 1;
    else if (moment.type === 'calm') totals.calm += 1;
    else if (moment.type === 'focus') totals.focus += 1;
    else if (moment.type === 'coffee') totals.calm += 0.5;
  });
  if (day.stepsCount >= 6000) totals.energy += 1;
  if (day.newPlaceCount > 0) totals.exploration += 1;
  const ordered = [...TRAIT_ORDER].sort((left, right) => totals[right] - totals[left]);
  return which === 'primary' ? ordered[0] ?? 'calm' : ordered[1] ?? 'focus';
}

function stableHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
