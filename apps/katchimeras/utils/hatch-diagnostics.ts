import type { StoredHomeDayRecord } from '@/types/home';

export type HatchDiagnostics = {
  measuredHatches: number;
  journalLedHatches: number;
  leaderWins: number;
  weightedUpsets: number;
  keyMomentAlignedHatches: number;
  insufficientEvidenceHatches: number;
  backToBackFamilyRepeats: number;
  distinctFamilies: number;
  familyWins: Record<string, number>;
  skinWins: Record<string, number>;
  contributingRoutes: Record<string, number>;
};

/** Derives product/debug measures from immutable hatches; no parallel counters. */
export function deriveHatchDiagnostics(days: readonly StoredHomeDayRecord[]): HatchDiagnostics {
  const ordered = [...days]
    .filter((day) => day.state === 'hatched' && day.creature)
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate));
  const result: HatchDiagnostics = {
    measuredHatches: 0,
    journalLedHatches: 0,
    leaderWins: 0,
    weightedUpsets: 0,
    keyMomentAlignedHatches: 0,
    insufficientEvidenceHatches: 0,
    backToBackFamilyRepeats: 0,
    distinctFamilies: 0,
    familyWins: {},
    skinWins: {},
    contributingRoutes: {},
  };
  let previousFamily: string | null = null;
  for (const day of ordered) {
    const familyId = day.creature?.familyId ?? null;
    const skinId = day.creature?.skinId ?? null;
    if (familyId) increment(result.familyWins, familyId);
    if (skinId) increment(result.skinWins, skinId);
    if (familyId && previousFamily === familyId) result.backToBackFamilyRepeats += 1;
    if (familyId) previousFamily = familyId;

    const decision = day.creature?.hatchDecision;
    if (!decision) {
      result.insufficientEvidenceHatches += 1;
      continue;
    }
    result.measuredHatches += 1;
    if (decision.leaderFamilyId === decision.winnerFamilyId) result.leaderWins += 1;
    else result.weightedUpsets += 1;
    const leader = decision.candidates.find((candidate) => candidate.familyId === decision.leaderFamilyId);
    const winner = decision.candidates.find((candidate) => candidate.selected);
    if (leader?.contributions.length) result.journalLedHatches += 1;
    if (winner?.contributions.some((contribution) => contribution.keyMoment)) result.keyMomentAlignedHatches += 1;
    for (const contribution of winner?.contributions ?? []) increment(result.contributingRoutes, contribution.routeKey);
  }
  result.distinctFamilies = Object.keys(result.familyWins).length;
  return result;
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}
