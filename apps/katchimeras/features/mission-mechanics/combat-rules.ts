/** Shared, data-only rules for the second lane combat ruleset. */
export const COMBAT_RULES_VERSION = 2 as const;
export const COMBAT_V2_ENABLED = process.env.EXPO_PUBLIC_COMBAT_V2 !== '0' && process.env.EXPO_PUBLIC_BATTLE_SCENE !== '0';
export type CombatChain = 'garden' | 'storm' | 'bulwark' | 'dew' | 'lantern';
export type SecondaryGenerator = 'storm-pot' | 'ward-planter' | 'dew-well' | 'lantern-post';
export type CombatTerrain = { cell: number; kind: 'sunny' | 'stone' | 'vent' | 'puddle' | 'echo' };
export type PlantVitality = { hearts: number; shield: number; immuneUntil: number; shieldAt: number; interceptAt: number; tier: number };
export type CombatWarning = { id: number; wisp: number; cells: number[]; kind: 'gunner' | 'bomber' | 'burrower'; landsAt: number };
export type CombatState = {
  plants: Record<string, PlantVitality>;
  hearts: number; breaches: number; prevented: number;
  warnings: CombatWarning[]; nextAttack: Record<string, number>;
  wave: number; waveStartedAt?: number; preparingMs: number;
};
export const SECONDARY_GENERATORS: readonly SecondaryGenerator[] = ['storm-pot', 'ward-planter', 'dew-well', 'lantern-post'];
export const SECONDARY_CHAINS: Record<SecondaryGenerator, CombatChain> = { 'storm-pot': 'storm', 'ward-planter': 'bulwark', 'dew-well': 'dew', 'lantern-post': 'lantern' };
export const COMBAT_CHAIN_NAMES: Record<CombatChain, string> = { garden: 'Garden', storm: 'Spark', bulwark: 'Bulwark', dew: 'Dew', lantern: 'Lantern' };
export const COMBAT_CHAIN_DESCRIPTIONS: Record<CombatChain, string> = {
  garden: 'Steady fire up one lane. Merging concentrates your firepower.',
  storm: 'Arcs between nearby enemies across lanes. Keep it near the danger.',
  bulwark: 'Explodes on contact, damaging and knocking wisps back. Higher tiers hit harder and recharge faster.',
  dew: 'Heals neighbours. Higher tiers cleanse frost and Mist.',
  lantern: 'Pierces enemies stacked in a lane. Best against groups.',
};
export const combatChain = (id: string): CombatChain | null => {
  const chain = id.split(':')[1];
  return ['garden', 'storm', 'bulwark', 'dew', 'lantern'].includes(chain) ? chain as CombatChain : null;
};
export const heroDamageMultiplier = (level: number) => 1 + 0.08 * (Math.max(1, Math.min(10, Math.floor(level))) - 1);
/** Each merge concentrates 110% of the two inputs' sustained Garden damage into one cell. */
export function combatFire(tier: number, chain: CombatChain = 'garden') {
  if (tier < 2 || chain === 'bulwark' || chain === 'dew') return null;
  const periodMs = [0, 0, 2500, 2200, 1900, 1700, 1500, 1300][Math.min(7, tier)]!;
  const damage = 0.4 * Math.pow(2.2, tier - 2) * periodMs / 1000;
  return { periodMs, damage: damage * (chain === 'lantern' ? 0.7 : 1) };
}
export const shieldCapacity = (tier: number) => tier < 2 ? 0 : tier >= 5 ? 3 : tier >= 3 ? 2 : 1;
/** Contact bursts are reusable, but cannot lock an enemy in place indefinitely. */
export function bulwarkImpact(tier: number) {
  const rank = Math.max(1, Math.min(5, Math.floor(tier)));
  return { damage: [0.5, 2, 4, 7, 11][rank - 1]!, pushRows: 0.25 + (rank - 1) * 0.3,
    holdMs: 150 + rank * 100, cooldownMs: 6500 - rank * 400 };
}
export const newCombatState = (hearts = 3): CombatState => ({ plants: {}, hearts, breaches: 0, prevented: 0, warnings: [], nextAttack: {}, wave: 0, preparingMs: 0 });

/** Old or malformed attempts start clean; no stale status leaks into another rules version. */
export function normalizeCombatState(value: unknown, hearts = 3): CombatState {
  const fresh = newCombatState(hearts);
  if (!value || typeof value !== 'object') return fresh;
  const raw = value as Partial<CombatState>;
  const finite = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : fallback;
  return { ...fresh, hearts: Math.min(hearts, finite(raw.hearts, hearts)), breaches: finite(raw.breaches), prevented: finite(raw.prevented),
    wave: Math.floor(finite(raw.wave)), waveStartedAt: finite(raw.waveStartedAt), preparingMs: Math.min(5000, finite(raw.preparingMs)),
    plants: Object.fromEntries(Object.entries(raw.plants ?? {}).flatMap(([id, p]) => p && typeof p === 'object' ? [[id, {
      hearts: finite(p.hearts), shield: Math.min(3, finite(p.shield)), immuneUntil: finite(p.immuneUntil),
      shieldAt: finite(p.shieldAt), interceptAt: finite(p.interceptAt), tier: Math.min(7, Math.max(1, finite(p.tier, 1))),
    }]] : [])),
    nextAttack: Object.fromEntries(Object.entries(raw.nextAttack ?? {}).filter(([, n]) => Number.isFinite(n))),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((w) => w && Number.isFinite(w.landsAt) && Number.isInteger(w.wisp) && w.wisp >= 0 && Array.isArray(w.cells) && ['gunner', 'bomber', 'burrower'].includes(w.kind)).map((w) => ({ ...w, cells: w.cells.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < 63) })).filter((w) => w.cells.length > 0) : [],
  };
}
