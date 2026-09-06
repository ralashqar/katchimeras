// Bond is the second axis, fully independent of rarity. Rarity is how hard a
// creature was to meet (fixed at birth, see ./living-rarity); bond is how often
// you return to it. Bond rewards real rhythms — the coffee-gym-home regular's
// commons quietly become the most *theirs* in the world — and gates art
// evolution and history-aware reflections as it deepens.

export type BondStage = 0 | 1 | 2 | 3;

// Visit counts at which the bond visibly deepens (art evolves, reflections
// start referencing shared history).
export const BOND_STAGE_THRESHOLDS = [10, 30, 75] as const;

const BOND_STAGE_LABELS: Record<BondStage, string> = {
  0: 'new',
  1: 'familiar',
  2: 'devoted',
  3: 'kindred',
};

export function resolveBondStage(visitCount: number): BondStage {
  if (visitCount >= BOND_STAGE_THRESHOLDS[2]) return 3;
  if (visitCount >= BOND_STAGE_THRESHOLDS[1]) return 2;
  if (visitCount >= BOND_STAGE_THRESHOLDS[0]) return 1;
  return 0;
}

export function bondStageLabel(stage: BondStage): string {
  return BOND_STAGE_LABELS[stage];
}

export function nextBondMilestone(
  visitCount: number
): { stage: BondStage; visitsRemaining: number } | null {
  for (let index = 0; index < BOND_STAGE_THRESHOLDS.length; index += 1) {
    const threshold = BOND_STAGE_THRESHOLDS[index];
    if (visitCount < threshold) {
      return { stage: (index + 1) as BondStage, visitsRemaining: threshold - visitCount };
    }
  }
  return null;
}
