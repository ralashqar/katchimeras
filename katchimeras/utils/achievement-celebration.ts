import type { CompanionAchievementDef } from '@/types/companion-achievements';

export function orderAchievementCelebrationQueue(
  achievements: readonly CompanionAchievementDef[],
): CompanionAchievementDef[] {
  const unique = new Map<string, { achievement: CompanionAchievementDef; sourceIndex: number }>();
  achievements.forEach((achievement, sourceIndex) => {
    if (!unique.has(achievement.id)) unique.set(achievement.id, { achievement, sourceIndex });
  });
  return [...unique.values()]
    .sort((a, b) => b.achievement.tier - a.achievement.tier || a.sourceIndex - b.sourceIndex)
    .map(({ achievement }) => achievement);
}

export function pickRandomAchievement(
  achievements: readonly CompanionAchievementDef[],
  previousId?: string | null,
  random: () => number = Math.random,
): CompanionAchievementDef | null {
  if (!achievements.length) return null;
  const candidates = achievements.length > 1 && previousId
    ? achievements.filter((achievement) => achievement.id !== previousId)
    : [...achievements];
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length));
  return candidates[index] ?? null;
}
