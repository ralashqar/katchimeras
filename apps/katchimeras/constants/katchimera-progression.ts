import type { KatchimeraProgress, MergeCharacterId, MergeWorldState } from '@/types/merge-world';

/**
 * A playable Katchimera's level: ten steps, each reached with experience
 * from the Mist and paid for in Glow, each carrying the ability's next tier
 * (`constants/companion-abilities.ts`). Bond is another thing entirely.
 */
export const KATCHIMERA_MAX_LEVEL = 10;
/** Experience needed, in all, to be ready for each level (index = level - 1; level 1 needs none). */
export const KATCHIMERA_LEVEL_XP: readonly number[] = [0, 40, 100, 180, 280, 400, 540, 700, 880, 1080];
/** Glow to go from a level to the next (index = level - 1). */
export const KATCHIMERA_LEVEL_GLOW: readonly number[] = [15, 30, 50, 80, 120, 170, 230, 300, 380];
export const PLAYABLE_KATCHIMERAS: readonly MergeCharacterId[] = ['mossprout', 'steppling', 'baristabbit'];

export const isPlayableKatchimera = (id: string): id is MergeCharacterId => (PLAYABLE_KATCHIMERAS as readonly string[]).includes(id);

const FRESH: KatchimeraProgress = { level: 1, xp: 0, upgradedAt: null };

export function katchimeraProgress(world: Pick<MergeWorldState, 'katchimeraProgress'> | null | undefined, id: MergeCharacterId): KatchimeraProgress {
  return world?.katchimeraProgress?.[id] ?? FRESH;
}

export const katchimeraLevel = (world: Pick<MergeWorldState, 'katchimeraProgress'> | null | undefined, id: MergeCharacterId): number => katchimeraProgress(world, id).level;

/** Experience needed, in all, to be ready for `level`. */
export function katchimeraXpForLevel(level: number): number {
  const at = Math.max(1, Math.min(KATCHIMERA_MAX_LEVEL, Math.floor(level)));
  return KATCHIMERA_LEVEL_XP[at - 1] ?? KATCHIMERA_LEVEL_XP[KATCHIMERA_LEVEL_XP.length - 1]!;
}

/** Glow to go from `level` to the next; null at the top. */
export function katchimeraUpgradeCost(level: number): number | null {
  const at = Math.max(1, Math.floor(level));
  return at >= KATCHIMERA_MAX_LEVEL ? null : KATCHIMERA_LEVEL_GLOW[at - 1] ?? null;
}

export type KatchimeraUpgradeCheck = { ok: true } | { ok: false; reason: 'top' | 'xp' | 'glow'; message: string };

export function canUpgradeKatchimera(world: Pick<MergeWorldState, 'katchimeraProgress' | 'coins'>, id: MergeCharacterId): KatchimeraUpgradeCheck {
  const progress = katchimeraProgress(world, id);
  const cost = katchimeraUpgradeCost(progress.level);
  if (cost == null) return { ok: false, reason: 'top', message: 'Nothing more to learn here.' };
  const needed = katchimeraXpForLevel(progress.level + 1);
  if (progress.xp < needed) return { ok: false, reason: 'xp', message: `${(needed - progress.xp).toLocaleString()} more experience in the Mist first.` };
  if (world.coins < cost) return { ok: false, reason: 'glow', message: `You need ${(cost - world.coins).toLocaleString()} more Glow.` };
  return { ok: true };
}
