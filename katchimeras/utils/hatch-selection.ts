import {
  buildCreatureFromMatch,
  extractEncounterCandidates,
  type EncounterCandidate,
  type EncounterMatch,
} from '@/utils/encounter-engine';
import { computeLivingRarity, maxRarity, type LivingRarity } from '@/utils/living-rarity';
import type {
  EncounterHistoryMap,
  HomeRarityTier,
  HomeScoreKey,
  KatchimeraFieldEcho,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import type { KatchimeraFamilyId, KatchimeraSkinId, LifeAspectId } from '@/types/katchimera';
import { identityForEncounter } from '@/utils/katchimera-identity';

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
};

// Score and rank the day's candidate field — shared by the draw and the
// pre-hatch preview. Pure and rng-free; sorting is stable.
function scoreField(
  day: StoredHomeDayRecord,
  history: EncounterHistoryMap,
  yesterdayProfileId: string | null | undefined
): ScoredCandidate[] {
  const candidates = extractEncounterCandidates(day, history);
  if (candidates.length === 0) {
    return [];
  }
  // Rarity is a property of how the day was lived — computed once, shared by
  // every candidate (each then takes the higher of this and its own floor).
  const livingRarity = computeLivingRarity(day);
  const month = isoMonth(day.isoDate);

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, { day, livingRarity, month, yesterdayProfileId }),
      rarity: maxRarity(candidate.rarityFloor, livingRarity.tier),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      // Stable tiebreak so ordering (and therefore the seeded draw) is fixed.
      return (
        stableHash(`${day.isoDate}|${left.candidate.castEntry.seedId}`) -
        stableHash(`${day.isoDate}|${right.candidate.castEntry.seedId}`)
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
  const { day, history, yesterdayProfileId, rng } = input;
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
      birthSignals: [winner.candidate.signal.seedId],
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
): number {
  const { signal, repeatDepth, rarityFloor, lastSeenIsoDate, profile, castEntry } = candidate;

  const specificity = GENERIC_FALLBACK_SEEDS.has(castEntry.seedId) ? SPECIFICITY_GENERIC : 1;
  let score = signal.intensity * specificity;

  if (repeatDepth === 0) {
    score += NOVELTY_BONUS;
  }
  if (signal.source === 'moment' || signal.source === 'prompt') {
    score += INTENT_BONUS;
  }
  score += Math.min(repeatDepth * BOND_PER_VISIT, BOND_CAP);
  if (SEASONAL_WINDOWS[castEntry.seedId]?.includes(context.month)) {
    score += SEASONAL_BONUS;
  }
  score += RARITY_LURE[rarityFloor] ?? 0;
  score -= recencyPenalty(daysBetween(lastSeenIsoDate, context.day.isoDate));
  const yesterdayIdentity = identityForEncounter(context.yesterdayProfileId, null);
  if (
    context.yesterdayProfileId &&
    (yesterdayIdentity
      ? candidate.familyId === yesterdayIdentity.familyId
      : profile.id === context.yesterdayProfileId)
  ) {
    score -= AVOID_PREV_PENALTY;
  }

  return clamp(score, SCORE_FLOOR, SCORE_CEIL);
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
