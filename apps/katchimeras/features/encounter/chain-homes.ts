import type { MergeWorldState } from '@/types/merge-world';
import { buildingLevelCap, heartTreeLevel } from '@/constants/heart-tree';
import { HEARTWOOD_BUILDING_COSTS } from '@/constants/heartwood-buildings';
import type { CombatChain } from '@/features/mission-mechanics/combat-rules';

export type ChainProgress = { version: 1; unlocked: Partial<Record<CombatChain, number>>; levels: Partial<Record<CombatChain, number>>; salvage: Record<string, 'timber' | 'glow'> };
export const CHAIN_HOMES = [
  { chain: 'garden', tileId: 'frontier-1', name: 'Seed Nursery', generator: 'seed-sprinkler', chapter: null, building: 'seed-nursery' },
  { chain: 'storm', tileId: 'frontier-2', name: 'Storm Garden', generator: 'storm-pot', chapter: null, building: null },
  { chain: 'bulwark', tileId: 'frontier-3', name: 'Ward Grove', generator: 'ward-planter', chapter: 'explorers-lodge', building: null },
  { chain: 'dew', tileId: 'frontier-4', name: 'Dew Spring', generator: 'dew-well', chapter: 'the-signal', building: 'dew-spring' },
  { chain: 'lantern', tileId: 'frontier-5', name: 'Lantern Grove', generator: 'lantern-post', chapter: 'the-kitchen', building: null },
] as const;
export type ChainHome = typeof CHAIN_HOMES[number];
export type ChainWorld = Partial<Pick<MergeWorldState, 'chainProgress' | 'heartwoodBuildings' | 'heroBuildings' | 'chaptersClaimed' | 'heartTree' | 'encounters'>>;
export const chainHome = (chain: CombatChain) => CHAIN_HOMES.find(h => h.chain === chain)!;
export const chainHomeForTile = (id: string) => CHAIN_HOMES.find(h => h.tileId === id);
export const freshChainProgress = (): ChainProgress => ({ version: 1, unlocked: { garden: 0 }, levels: {}, salvage: {} });
export function chainUnlocked(world: ChainWorld, chain: CombatChain): boolean {
  if (chain === 'garden') return true;
  if (world.chainProgress) return world.chainProgress.unlocked[chain] != null;
  const home = chainHome(chain);
  return !home.chapter || Boolean(world.chaptersClaimed?.includes(home.chapter));
}
export function chainDiscoveryAvailable(world: ChainWorld, chain: CombatChain): boolean {
  const home = chainHome(chain);
  if (heartTreeLevel(world) < 1) return false;
  if (chainUnlocked(world, chain) && chain !== 'garden') return true;
  if (chain === 'storm') return Boolean(world.encounters?.clears?.['frontier:frontier-1']);
  // The Lodge chapter itself asks for three tiles, so its construction reveals Ward Grove.
  if (chain === 'bulwark') return (world.heroBuildings?.['explorers-lodge']?.level ?? 0) >= 1 || Boolean(world.chaptersClaimed?.includes('explorers-lodge'));
  return !home.chapter || Boolean(world.chaptersClaimed?.includes(home.chapter));
}
export function chainHomeLevel(world: ChainWorld, chain: CombatChain): number {
  const building = chainHome(chain).building;
  const level = building ? world.heartwoodBuildings?.[building]?.level : world.chainProgress?.levels[chain];
  return Math.max(chainUnlocked(world, chain) ? 1 : 0, Math.min(10, Math.floor(level ?? 0)));
}
export function chainBenefits(level: number) {
  const rank = Math.max(1, Math.min(10, Math.floor(level)));
  return { power: 1 + (rank - 1) * 0.05, recharge: Math.floor(rank / 3) * 0.05,
    tierTwoChance: rank * 0.03, tierThreeChance: rank >= 10 ? 0.05 : rank >= 7 ? 0.03 : 0 };
}
export function normalizeChainProgress(world: ChainWorld, saved: ChainProgress | undefined, now: number): ChainProgress {
  const result = freshChainProgress();
  for (const home of CHAIN_HOMES) {
    if (saved?.version === 1) {
      const receipt = saved.unlocked?.[home.chain];
      if (Number.isFinite(receipt)) result.unlocked[home.chain] = Math.max(0, receipt!);
      const level = saved.levels?.[home.chain];
      if (Number.isFinite(level)) result.levels[home.chain] = Math.max(1, Math.min(10, Math.floor(level!)));
    } else if (chainUnlocked(world, home.chain) || world.encounters?.clears?.[`frontier:${home.tileId}`]) {
      result.unlocked[home.chain] = now;
      result.levels[home.chain] = Math.max(1, world.heartwoodBuildings?.['seed-nursery']?.level ?? 0,
        world.heroBuildings?.['bloom-house']?.level ?? 0, home.chain === 'bulwark' ? world.heartwoodBuildings?.['root-cellar']?.level ?? 0 : 0);
    }
  }
  for (const [id, choice] of Object.entries(saved?.salvage ?? {})) if (choice === 'timber' || choice === 'glow') result.salvage[id] = choice;
  if (!saved) for (const id of Object.keys(world.encounters?.clears ?? {})) if (id.startsWith('frontier:')) result.salvage[id] = 'timber';
  return result;
}
export function unlockChainHome(world: MergeWorldState, tileId: string, now: number): MergeWorldState {
  const home = chainHomeForTile(tileId);
  if (!home) return world;
  const progress = world.chainProgress ?? normalizeChainProgress(world, undefined, now);
  const next = { ...world, chainProgress: { ...progress, unlocked: { ...progress.unlocked, [home.chain]: progress.unlocked[home.chain] ?? now }, levels: { ...progress.levels, [home.chain]: progress.levels[home.chain] ?? 1 } } };
  if (home.building && !world.heartwoodBuildings?.[home.building]) next.heartwoodBuildings = { ...world.heartwoodBuildings, [home.building]: { level: 1, builtAt: now } };
  return next;
}
export function upgradeChainHome(world: MergeWorldState, chain: CombatChain, expected: number, now: number): MergeWorldState {
  const level = chainHomeLevel(world, chain), cost = HEARTWOOD_BUILDING_COSTS[level];
  if (!chainUnlocked(world, chain) || level !== expected || cost == null || level >= buildingLevelCap(heartTreeLevel(world)) || world.coins < cost) return world;
  const home = chainHome(chain), progress = world.chainProgress ?? normalizeChainProgress(world, undefined, now);
  return { ...world, coins: world.coins - cost, chainProgress: { ...progress, levels: { ...progress.levels, [chain]: level + 1 } },
    ...(home.building ? { heartwoodBuildings: { ...world.heartwoodBuildings, [home.building]: { ...world.heartwoodBuildings?.[home.building], level: level + 1, builtAt: world.heartwoodBuildings?.[home.building]?.builtAt ?? now } } } : {}) };
}

/** Reward choice and receipt are written together, including after a resumed victory. */
export function claimFrontierSalvage(state: MergeWorldState, missionId: string, choice: 'timber' | 'glow', now: number): MergeWorldState {
  if (!state.encounters?.clears[missionId] || !missionId.startsWith('frontier:') || !state.chainProgress || state.chainProgress.salvage[missionId]) return state;
  return { ...state, revision: state.revision + 1, updatedAt: now,
    chainProgress: { ...state.chainProgress, salvage: { ...state.chainProgress.salvage, [missionId]: choice } },
    ...(choice === 'glow' ? { coins: state.coins + 18 } : { materials: { ...state.materials, timber: (state.materials?.timber ?? 0) + 4 } }) };
}
