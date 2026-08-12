import type { HomeDayRecord } from '@/types/home';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';

export type MergeActivityReward = {
  receiptId: string;
  amount: number;
  label: string;
  dayId?: string;
  kind?: 'journal' | 'check_in' | 'photo' | 'meaning' | 'steps' | 'quest';
};

/**
 * Projects already-persisted life activity into stable, replay-safe Merge
 * Energy receipts. The engine owns de-duplication, so rebuilding this list on
 * every focus is intentional and safe.
 */
export function mergeActivityRewards(days: readonly HomeDayRecord[]): MergeActivityReward[] {
  const rewards: MergeActivityReward[] = [];
  for (const day of days) {
    for (const answer of day.promptAnswers) {
      if (answer.dismissed || (answer.kind !== 'feeling' && answer.kind !== 'inner_weather')) continue;
      rewards.push({ receiptId: `activity:mood:${day.id}:${answer.id}`, amount: 5, label: 'Check-in', dayId: day.id, kind: 'check_in' });
    }
    for (const [index, record] of (day.journalRecords ?? []).entries()) {
      const amount = index === 0 ? 10 : index < 3 ? 5 : 0;
      rewards.push({ receiptId: `activity:journal:${day.id}:${record.id}`, amount, label: 'Journal', dayId: day.id, kind: 'journal' });
    }
    for (const moment of day.moments) {
      if (moment.type !== 'photo') continue;
      rewards.push({ receiptId: `activity:photo:${day.id}:${moment.id}`, amount: 5, label: 'Photo moment', dayId: day.id, kind: 'photo' });
    }
    for (const meaning of day.capturedMeanings ?? []) {
      rewards.push({ receiptId: `activity:meaning:${day.id}:${meaning.sourceId ?? meaning.createdAt}`, amount: 5, label: 'Captured moment', dayId: day.id, kind: 'meaning' });
    }
    if (day.stepsCount >= 5_000) {
      rewards.push({ receiptId: `activity:steps:${day.id}:5000`, amount: 10, label: 'Steps milestone', dayId: day.id, kind: 'steps' });
    }
  }
  return rewards;
}

export function mergeQuestActivityRewards(questState: CompanionQuestState): MergeActivityReward[] {
  return questState.quests.flatMap((quest) => {
    if (typeof quest.completedAt !== 'number') return [];
    const definition = questDefinition(quest.questId);
    if (!definition || definition.lane === 'mini_game') return [];
    return [{
      receiptId: `activity:quest:${quest.questRunId ?? `${quest.creatureId}:${quest.questId}:${quest.acceptedAt}`}`,
      amount: 15,
      label: 'Daily quest',
      dayId: quest.completedDayId,
      kind: 'quest' as const,
    }];
  });
}
