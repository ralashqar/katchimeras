import { hashSeed, mergeHeat, startHeat, tickHeat, HEAT_MAX_TIER, type HeatRules, type HeatSpec, type HeatState } from './heat';

/**
 * The day's ladder: ten heats, generated from the date alone, so everyone plays the same ladder on the same day, a
 * retry is a real rematch, and a record means something. Every heat is the same question (how many wisps can you
 * strike down before the clock runs out?) asked harder: tougher wisps that toughen faster, more chains sharing the
 * board so pairs are harder to find, fewer free tier-twos. Difficulty is a table, not a formula buried in code.
 */
export const HEATS_PER_DAY = 10;
/** Steppling's chains first; a third joins halfway up the ladder to thin out the obvious pairs. */
export const RUSH_CHAINS = ['adventure:trail', 'adventure:travel', 'nature:waterside'] as const;

const SHARED = { startFill: 10, fill: 18, dealDelayMs: 450 } as const;
type Rung = Omit<HeatRules, 'chains' | keyof typeof SHARED> & { chains: number };
export const RUSH_LADDER: readonly Rung[] = [
  { durationMs: 45_000, up: 2, wispEveryMs: 4_000, hp: 3, hpRampEvery: 4, thickChance: 0, chains: 2, dealEveryMs: 1_400, tierTwoChance: 0.35 },
  { durationMs: 45_000, up: 2, wispEveryMs: 4_000, hp: 3, hpRampEvery: 3, thickChance: 0.15, chains: 2, dealEveryMs: 1_400, tierTwoChance: 0.35 },
  { durationMs: 50_000, up: 3, wispEveryMs: 3_500, hp: 4, hpRampEvery: 3, thickChance: 0.2, chains: 2, dealEveryMs: 1_500, tierTwoChance: 0.3 },
  { durationMs: 50_000, up: 3, wispEveryMs: 3_500, hp: 4, hpRampEvery: 3, thickChance: 0.25, chains: 2, dealEveryMs: 1_500, tierTwoChance: 0.3 },
  { durationMs: 55_000, up: 3, wispEveryMs: 3_200, hp: 5, hpRampEvery: 3, thickChance: 0.25, chains: 3, dealEveryMs: 1_500, tierTwoChance: 0.3 },
  { durationMs: 55_000, up: 3, wispEveryMs: 3_200, hp: 5, hpRampEvery: 2, thickChance: 0.3, chains: 3, dealEveryMs: 1_600, tierTwoChance: 0.25 },
  { durationMs: 60_000, up: 4, wispEveryMs: 3_000, hp: 6, hpRampEvery: 2, thickChance: 0.3, chains: 3, dealEveryMs: 1_600, tierTwoChance: 0.25 },
  { durationMs: 60_000, up: 4, wispEveryMs: 3_000, hp: 6, hpRampEvery: 2, thickChance: 0.35, chains: 3, dealEveryMs: 1_700, tierTwoChance: 0.25 },
  { durationMs: 60_000, up: 4, wispEveryMs: 2_800, hp: 7, hpRampEvery: 2, thickChance: 0.4, chains: 3, dealEveryMs: 1_700, tierTwoChance: 0.2 },
  { durationMs: 60_000, up: 4, wispEveryMs: 2_800, hp: 8, hpRampEvery: 2, thickChance: 0.45, chains: 3, dealEveryMs: 1_800, tierTwoChance: 0.2 },
];

/** A heat from its rules: the id names it, and is all its seed comes from. */
export const heatFromRules = (id: string, rules: HeatRules): HeatSpec => ({ ...rules, id, seed: hashSeed(id) });

export function heatFor(dayId: string, index: number, trialId = 'wisp-rush'): HeatSpec {
  const { chains, ...rung } = RUSH_LADDER[Math.max(0, Math.min(RUSH_LADDER.length - 1, index))]!;
  return heatFromRules(`${trialId}:${dayId}:${index}`, { ...SHARED, ...rung, chains: RUSH_CHAINS.slice(0, chains) });
}

// ---- the par bot ------------------------------------------------------------------------------------------------------
/**
 * A plain, steady player: one merge every `tapMs` (a drag takes about that long once the pair is found), always the
 * highest pair on the board. Its score is the heat's Silver; it is also the proof that a generated heat always has
 * something to merge, which is why no heat ships without being played by it in the tests.
 */
export function playHeatWithBot(spec: HeatSpec, tapMs = 1_300): { score: number; merges: number; idleTaps: number; state: HeatState } {
  let state = startHeat(spec);
  let idleTaps = 0;
  for (let at = tapMs; at < spec.durationMs; at += tapMs) {
    state = tickHeat(state, at).state;
    let best: { from: number; to: number; tier: number } | null = null;
    for (let from = 0; from < state.slots.length; from++) for (let to = from + 1; to < state.slots.length; to++) {
      const [a, b] = [state.slots[from], state.slots[to]];
      if (!a || !b || a.chainId !== b.chainId || a.tier !== b.tier || a.tier >= HEAT_MAX_TIER) continue;
      if (!best || a.tier > best.tier) best = { from, to, tier: a.tier };
    }
    if (!best) { idleTaps += 1; continue; }
    state = mergeHeat(state, best.from, best.to, at).state;
  }
  state = tickHeat(state, spec.durationMs).state;
  return { score: state.cleared, merges: state.merges, idleTaps, state };
}

export type HeatMedal = 'gold' | 'silver' | 'bronze';
/** Wisps to strike down for each medal. Bronze is also what clears the heat and opens the next. */
export type HeatPars = Record<HeatMedal, number>;
const parCache = new Map<string, HeatPars>();
/** Silver is the bot's own score; Gold is a quarter more; Bronze, which clears the heat, a little over half. */
export function heatPars(spec: HeatSpec): HeatPars {
  const cached = parCache.get(spec.id);
  if (cached) return cached;
  const silver = Math.max(2, playHeatWithBot(spec).score);
  const pars = { gold: Math.max(silver + 1, Math.ceil(silver * 1.25)), silver, bronze: Math.max(1, Math.floor(silver * 0.6)) };
  parCache.set(spec.id, pars);
  return pars;
}
export function medalFor(score: number, pars: HeatPars): HeatMedal | null {
  return score >= pars.gold ? 'gold' : score >= pars.silver ? 'silver' : score >= pars.bronze ? 'bronze' : null;
}
export const MEDAL_RANK: Record<HeatMedal, number> = { bronze: 1, silver: 2, gold: 3 };

/** The most wisps any hand could strike down: one can only fall to a merge, and no hand merges faster than this. */
export const maxPlausibleScore = (spec: HeatSpec) => Math.ceil(spec.durationMs / 250);
