import type { HomeDayRecord } from '@/types/home';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import { questDefinition } from '@/utils/quests/definitions';

export type MergeActivityReward = {
  receiptId: string;
  amount: number;
  label: string;
  grantDayId: string;
  rewardClass: 'daily_journal' | 'daily_quest' | 'food_basket';
  itemDefinitionIds?: string[];
};

/**
 * Merge World only rewards activity saved on the current local day. This keeps
 * reconciliation replay-safe without granting a backlog when an existing save
 * first migrates to the consolidated Energy economy.
 */
export function mergeActivityRewards(days: readonly HomeDayRecord[], now = new Date()): MergeActivityReward[] {
  const grantDayId = localDayId(now);
  const records = days.flatMap((day) => (day.journalRecords ?? []).map((record) => ({ day, record })))
    .filter(({ record }) => localDayIdForTimestamp(record.createdAt) === grantDayId)
    .sort((left, right) => left.record.createdAt.localeCompare(right.record.createdAt));
  if (!records.length) return [];
  const rewards: MergeActivityReward[] = [{
    receiptId: `activity:daily-journal:${grantDayId}`,
    amount: 8,
    label: 'Daily journal',
    grantDayId,
    rewardClass: 'daily_journal',
  }];
  const firstFood = records.find(({ record }) => record.flowId === 'food');
  if (firstFood) rewards.push({
    receiptId: `activity:food-basket:${grantDayId}`,
    amount: 0,
    label: 'Pantry Basket',
    grantDayId,
    rewardClass: 'food_basket',
    itemDefinitionIds: ['food:table:1', 'food:table:1'],
  });
  return rewards;
}

export function mergeQuestActivityRewards(questState: CompanionQuestState, now = new Date()): MergeActivityReward[] {
  const grantDayId = localDayId(now);
  const first = questState.quests
    .filter((quest) => typeof quest.completedAt === 'number' && quest.completedDayId === grantDayId)
    .filter((quest) => {
      const definition = questDefinition(quest.questId);
      return Boolean(definition && definition.lane !== 'mini_game');
    })
    .sort((left, right) => (left.completedAt ?? 0) - (right.completedAt ?? 0))[0];
  return first ? [{
    receiptId: `activity:daily-quest:${grantDayId}`,
    amount: 4,
    label: 'Daily real-life quest',
    grantDayId,
    rewardClass: 'daily_quest',
  }] : [];
}

function localDayId(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function localDayIdForTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return localDayId(parsed);
}
