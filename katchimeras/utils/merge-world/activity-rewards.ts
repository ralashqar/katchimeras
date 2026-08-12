import type { HomeDayRecord } from '@/types/home';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';

export type MergeActivityReward = {
  receiptId: string;
  amount: number;
  label: string;
  dayId?: string;
  kind?: 'journal' | 'check_in' | 'photo' | 'meaning' | 'steps' | 'quest';
  pantryCharges?: number;
  grantDayId?: string;
};

/**
 * Projects already-persisted life activity into stable, replay-safe Merge
 * Energy or Pantry receipts. Journaling nourishes the Egg first; only food
 * journals echo into Merge World as Pantry stock. The engine owns de-duplication.
 */
export function mergeActivityRewards(days: readonly HomeDayRecord[]): MergeActivityReward[] {
  const rewards: MergeActivityReward[] = [];
  for (const day of days) {
    for (const answer of day.promptAnswers) {
      if (answer.dismissed || (answer.kind !== 'feeling' && answer.kind !== 'inner_weather')) continue;
      rewards.push({ receiptId: `activity:mood:${day.id}:${answer.id}`, amount: 5, label: 'Check-in', dayId: day.id, kind: 'check_in' });
    }
    for (const record of day.journalRecords ?? []) {
      if (record.flowId !== 'food') continue;
      rewards.push({
        receiptId: `activity:journal:${day.id}:${record.id}`,
        amount: 0,
        label: 'Food journal',
        dayId: day.id,
        kind: 'journal',
        pantryCharges: 6,
        grantDayId: localDayIdForTimestamp(record.createdAt),
      });
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

function localDayIdForTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
