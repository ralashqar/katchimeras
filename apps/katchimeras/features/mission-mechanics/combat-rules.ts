/** Shared, data-only rules for the second lane combat ruleset. */
export const COMBAT_RULES_VERSION = 2 as const;
export const COMBAT_V2_ENABLED = process.env.EXPO_PUBLIC_COMBAT_V2 !== '0' && process.env.EXPO_PUBLIC_BATTLE_SCENE !== '0';
export type CombatChain = 'garden' | 'storm' | 'bulwark' | 'dew' | 'lantern';
export type SecondaryGenerator = 'storm-pot' | 'ward-planter' | 'dew-well' | 'lantern-post';
export type CombatTerrain = { cell: number; kind: 'sunny' | 'stone' | 'vent' | 'puddle' | 'echo' };
export type PlantVitality = { hearts: number; shield: number; immuneUntil: number; shieldAt: number; interceptAt: number; charge?: { at: number; target: number; startedAt?: number; toColumn?: number; toRow?: number }; tier: number };
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
  garden: 'Steady lane fire. Merging fires a rapid burst: higher tiers shoot more bullets.',
  storm: 'Arcs across nearby enemies. Merge to zap several targets at once; higher tiers hit more.',
  bulwark: 'Merge for a shockwave. Charges near a wisp, then sacrifices itself in a powerful explosion.',
  dew: 'Heals neighbours. Merge for an immediate healing and thawing pulse.',
  lantern: 'Pierces enemies stacked in a lane. Merge for a rapid piercing volley.',
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
/** Merge bonuses scale independently of sustained fire. */
export function mergeAttack(tier: number) {
  const rank = Math.max(1, Math.min(7, Math.floor(tier)));
  return { bullets: rank - 1, targets: Math.max(1, rank - 1), damage: Math.pow(1.65, rank - 2), reach: 2 + rank * 0.25 };
}
export function bulwarkBlast(tier: number) {
  const rank = Math.max(1, Math.min(7, Math.floor(tier)));
  return { radius: 1.25 + rank * 0.2, damage: 3 * Math.pow(1.85, rank - 1), chargeMs: 720, triggerRange: 1.65, pushRows: 1.25 + rank * 0.25 };
}
/** Circular falloff: full at the centre, 25% at the edge, zero beyond it. */
export const rippleFalloff = (distance: number, radius: number) => distance > radius ? 0 : 1 - 0.75 * Math.max(0, distance) / radius;
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
      ...(p.charge && Number.isFinite(p.charge.at) && Number.isInteger(p.charge.target) && p.charge.target >= 0 ? { charge: { at: p.charge.at, target: p.charge.target,
        ...(Number.isFinite(p.charge.startedAt) ? { startedAt: p.charge.startedAt } : {}),
        ...(Number.isFinite(p.charge.toColumn) ? { toColumn: p.charge.toColumn } : {}),
        ...(Number.isFinite(p.charge.toRow) ? { toRow: p.charge.toRow } : {}) } } : {}),
      shieldAt: finite(p.shieldAt), interceptAt: finite(p.interceptAt), tier: Math.min(7, Math.max(1, finite(p.tier, 1))),
    }]] : [])),
    nextAttack: Object.fromEntries(Object.entries(raw.nextAttack ?? {}).filter(([, n]) => Number.isFinite(n))),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((w) => w && Number.isFinite(w.landsAt) && Number.isInteger(w.wisp) && w.wisp >= 0 && Array.isArray(w.cells) && ['gunner', 'bomber', 'burrower'].includes(w.kind)).map((w) => ({ ...w, cells: w.cells.filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < 63) })).filter((w) => w.cells.length > 0) : [],
  };
}

/** Ordinary wisps engage the first plant ahead; specialists retain their telegraphed attacks. */
export function wispWeapon(spec: import('@/types/mission-mechanic').LaneWisp) {
  if (!spec.weapon && (spec.attack || spec.crawlEvery)) return null;
  const mode = spec.weapon ?? (spec.strikeEvery ? 'skirmisher' : 'bullet');
  return { mode, range: spec.weaponRange ?? (mode === 'skirmisher' ? 3.5 : mode === 'zap' ? 1.25 : 1),
    everyMs: spec.weaponEveryMs ?? spec.strikeEvery ?? (mode === 'zap' ? 3200 : mode === 'skirmisher' ? 4500 : 2800),
    damage: spec.strikeEvery ? 2 : 1, moving: mode === 'skirmisher' };
}
