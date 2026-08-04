import type {
  CompanionAchievementContext,
  CompanionAchievementDef,
  CompanionAchievementEntry,
  CompanionAchievementRecord,
} from '@/types/companion-achievements';

export function companionAchievementValue(
  context: CompanionAchievementContext,
  signal: string
): number {
  return context.values[signal] ?? 0;
}

export function evaluateCompanionAchievements(
  context: CompanionAchievementContext,
  unlocked: Record<string, CompanionAchievementRecord>,
  catalog: readonly CompanionAchievementDef[]
): CompanionAchievementDef[] {
  return catalog.filter(
    (def) => !unlocked[def.id] && companionAchievementValue(context, def.metric.signal) >= def.metric.target
  );
}

export function companionAchievementEntries(
  context: CompanionAchievementContext,
  unlocked: Record<string, CompanionAchievementRecord>,
  catalog: readonly CompanionAchievementDef[]
): CompanionAchievementEntry[] {
  return catalog.map((def) => {
    const current = companionAchievementValue(context, def.metric.signal);
    return {
      def,
      record: unlocked[def.id] ?? null,
      current,
      target: def.metric.target,
      ratio: Math.min(1, Math.max(0, current / def.metric.target)),
    };
  });
}
