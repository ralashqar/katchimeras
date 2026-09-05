import type { HomeDayRecord } from '@/types/home';
import type { MergeCharacterId, MergeWorldState } from '@/types/merge-world';
import type { CompanionDiscoveryAffinity } from '@/constants/companion-discovery-catalog';
import { EARLY_COMPANION_DISCOVERY_POOLS } from '@/constants/companion-discovery-catalog';

export type CompanionDiscoveryGateDefinition = {
  gateId: string;
  prerequisiteGateId: string;
  minimumMergeLevel: number;
  minimumCompletedOrders: number;
  minimumExpansions: number;
  minimumMeaningfulDays: number;
  candidatePolicy: 'early_remaining';
  choiceMode: 'fork' | 'single';
  maximumCandidates: number;
};

export const COMPANION_DISCOVERY_GATE_CATALOG: readonly CompanionDiscoveryGateDefinition[] = [
  {
    gateId: 'gate-3-first-choice', prerequisiteGateId: 'gate-2-steppling',
    minimumMergeLevel: 3, minimumCompletedOrders: 6, minimumExpansions: 0, minimumMeaningfulDays: 1,
    candidatePolicy: 'early_remaining', choiceMode: 'fork', maximumCandidates: 3,
  },
  {
    gateId: 'gate-4-expanding-world', prerequisiteGateId: 'gate-3-first-choice',
    minimumMergeLevel: 5, minimumCompletedOrders: 15, minimumExpansions: 1, minimumMeaningfulDays: 2,
    candidatePolicy: 'early_remaining', choiceMode: 'fork', maximumCandidates: 2,
  },
  {
    gateId: 'gate-5-complete-foundations', prerequisiteGateId: 'gate-4-expanding-world',
    minimumMergeLevel: 7, minimumCompletedOrders: 28, minimumExpansions: 2, minimumMeaningfulDays: 3,
    candidatePolicy: 'early_remaining', choiceMode: 'single', maximumCandidates: 1,
  },
] as const;

export function companionDiscoveryGate(gateId: string) {
  return COMPANION_DISCOVERY_GATE_CATALOG.find((gate) => gate.gateId === gateId) ?? null;
}

export type CompanionAffinityProfile = Record<CompanionDiscoveryAffinity, number>;

const EMPTY_AFFINITY: CompanionAffinityProfile = {
  nature: 0, adventure: 0, social: 0, rest: 0,
  creativity: 0, discovery: 0, food: 0, home: 0,
};

const CHARACTER_AFFINITIES: Partial<Record<MergeCharacterId, Partial<CompanionAffinityProfile>>> = {
  feastle: { food: 1, home: 0.7, social: 0.45 },
  baristabbit: { food: 0.65, social: 0.55, rest: 0.45, home: 0.35 },
  bedrotte: { rest: 1, home: 0.6 },
  shellio: { nature: 0.7, discovery: 0.75, adventure: 0.35 },
  voyagle: { adventure: 1, discovery: 0.8 },
};

/** Local-only, broad affinity scoring. Raw journal, place, photo and health data never leave the day domain. */
export function buildCompanionAffinityProfile(days: readonly HomeDayRecord[]): CompanionAffinityProfile {
  const meaningful = days.filter((day) => Boolean(
    day.journalRecords?.length || day.moments?.length || day.stepsCount || day.dailyHatch || day.card,
  )).slice(-14);
  return meaningful.reduce<CompanionAffinityProfile>((scores, day, index) => {
    const recency = meaningful.length - index;
    const weight = recency <= 3 ? 1 : recency <= 7 ? 0.6 : 0.3;
    const add = (affinity: CompanionDiscoveryAffinity, amount = 1) => { scores[affinity] += amount * weight; };
    const routes = (day.journalRecords ?? []).map((record) => `${record.flowId}.${record.categoryId}`.toLowerCase());
    for (const route of routes) {
      if (route.includes('food') || route.includes('coffee') || route.includes('meal')) add('food');
      if (route.includes('movement') || route.includes('walk') || route.includes('went_somewhere')) add('adventure');
      if (route.includes('people') || route.includes('social') || route.includes('big_event')) add('social');
      if (route.includes('rest') || route.includes('sleep') || route.includes('wellbeing')) add('rest');
      if (route.includes('studio') || route.includes('creative')) add('creativity');
      if (route.includes('park') || route.includes('nature')) add('nature');
      if (route.includes('home')) add('home');
      if (route.includes('place') || route.includes('travel') || route.includes('learn')) add('discovery');
    }
    if ((day.stepsCount ?? 0) >= 5_000) add('adventure', 0.8);
    if (day.scores?.exploration) add('discovery', Math.min(1, day.scores.exploration / 10));
    if (day.scores?.social) add('social', Math.min(1, day.scores.social / 10));
    if (day.scores?.calm) add('rest', Math.min(1, day.scores.calm / 10));
    return scores;
  }, { ...EMPTY_AFFINITY });
}

export function recommendCompanionPath(
  candidateIds: readonly MergeCharacterId[],
  affinity: CompanionAffinityProfile,
): { characterId: MergeCharacterId | null; strength: 'none' | 'weak' | 'strong' } {
  const ranked = candidateIds.map((characterId) => ({
    characterId,
    score: Object.entries(CHARACTER_AFFINITIES[characterId] ?? {}).reduce((total, [key, weight]) => (
      total + affinity[key as CompanionDiscoveryAffinity] * (weight ?? 0)
    ), 0),
  })).sort((left, right) => right.score - left.score || left.characterId.localeCompare(right.characterId));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  if (!leader || leader.score < 2) return { characterId: null, strength: 'none' };
  const lead = leader.score - (runnerUp?.score ?? 0);
  return { characterId: leader.characterId, strength: lead >= 1.5 ? 'strong' : 'weak' };
}

export function nextEligibleCompanionGate(
  state: MergeWorldState,
  meaningfulDayCount: number,
): { gateId: string; candidateIds: MergeCharacterId[] } | null {
  if (state.companionDiscovery.active || state.arrivals.some((arrival) => arrival.kind === 'discovery_parcel' && arrival.claimedAt == null)) return null;
  for (const gate of COMPANION_DISCOVERY_GATE_CATALOG) {
    if (state.companionDiscovery.completedGateIds.includes(gate.gateId)) continue;
    const prerequisiteRecord = state.companionDiscovery.records.find((record) => record.gateId === gate.prerequisiteGateId);
    if (!prerequisiteRecord?.firstOrderCompletedAt) return null;
    if (state.mergeLevel < gate.minimumMergeLevel
      || state.completedOrderCount < gate.minimumCompletedOrders
      || state.expansions.length < gate.minimumExpansions
      || meaningfulDayCount < gate.minimumMeaningfulDays) return null;
    const sourcePool = EARLY_COMPANION_DISCOVERY_POOLS[gate.gateId] ?? EARLY_COMPANION_DISCOVERY_POOLS['gate-3-first-choice'];
    const candidateIds = sourcePool
      .filter((id) => !state.unlockedCharacters.includes(id))
      .slice(0, gate.maximumCandidates);
    if (!candidateIds.length) continue;
    return { gateId: gate.gateId, candidateIds };
  }
  return null;
}
