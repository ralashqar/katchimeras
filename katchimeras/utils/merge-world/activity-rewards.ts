import { KATCHIMERA_MERGE_PROFILES, MERGE_CHARACTER_NAMES } from '@/constants/merge-world-catalog';
import type { HomeDayRecord } from '@/types/home';
import type { MergeActivityReward, MergeCharacterId } from '@/types/merge-world';
import type { CompanionQuestState } from '@/utils/katchimera-quests';
import {
  journalRecordsForEggDay,
  MERGE_DAILY_COMPANION_ENERGY,
  MERGE_DAILY_JOURNAL_ENERGY,
  MERGE_DAILY_QUEST_ENERGY,
  mergeLocalDayId,
  mergeTomorrowDayId,
} from '@/utils/merge-world/economy-policy';
import { questDefinition } from '@/utils/quests/definitions';

/**
 * Projects today's real-life activity into deterministic receipts. The Merge
 * reducer remains the authority for idempotency and the shared daily limit.
 */
export function mergeActivityRewards(days: readonly HomeDayRecord[], now = new Date()): MergeActivityReward[] {
  const grantDayId = mergeLocalDayId(now);
  const eligibleEggDayIds = [grantDayId, mergeTomorrowDayId(now)];
  const rewards: MergeActivityReward[] = [];
  for (const eggDayId of eligibleEggDayIds) {
    const records = journalRecordsForEggDay(days, eggDayId);
    if (!records.length) continue;
    rewards.push({
      receiptId: `activity:egg-journal:${eggDayId}`,
      kind: 'daily_journal_energy',
      amount: MERGE_DAILY_JOURNAL_ENERGY,
      label: eggDayId === grantDayId ? 'Today journal' : 'Tomorrow Egg journal',
      grantDayId: eggDayId,
    });
    const companionRecord = records.find((record) => record.source?.origin?.kind === 'companion_reflection');
    if (companionRecord?.source.origin?.kind === 'companion_reflection') {
      const familyId = companionRecord.source.origin.familyId as MergeCharacterId | undefined;
      rewards.push({
        receiptId: `activity:egg-companion:${eggDayId}`,
        kind: 'daily_companion_energy',
        amount: MERGE_DAILY_COMPANION_ENERGY,
        label: familyId && MERGE_CHARACTER_NAMES[familyId] ? `${MERGE_CHARACTER_NAMES[familyId]} reflection` : 'Companion reflection',
        grantDayId: eggDayId,
      });
    }
  }
  const storyFamilies = new Set<MergeCharacterId>();
  for (const record of days.flatMap((day) => day.journalRecords ?? [])) {
    const origin = record.source?.origin;
    if (origin?.kind !== 'companion_reflection' || origin.reflectionMode !== 'story' || !origin.familyId) continue;
    const familyId = origin.familyId as MergeCharacterId;
    if (!KATCHIMERA_MERGE_PROFILES[familyId]) continue;
    storyFamilies.add(familyId);
  }
  for (const familyId of storyFamilies) {
    rewards.push({
      receiptId: `activity:companion-story-starter:${familyId}`,
      kind: 'companion_story_starter',
      amount: 0,
      label: `${MERGE_CHARACTER_NAMES[familyId]} starter supplies`,
      grantDayId,
      itemDefinitionIds: KATCHIMERA_MERGE_PROFILES[familyId].coreChains.map((chainId) => `${chainId}:1`),
    });
  }
  return rewards;
}

export function mergeQuestActivityRewards(questState: CompanionQuestState, now = new Date()): MergeActivityReward[] {
  const grantDayId = mergeLocalDayId(now);
  const first = questState.quests
    .filter((quest) => typeof quest.completedAt === 'number' && quest.completedDayId === grantDayId)
    .filter((quest) => {
      const definition = questDefinition(quest.questId);
      return Boolean(definition && definition.lane !== 'mini_game');
    })
    .sort((left, right) => (left.completedAt ?? 0) - (right.completedAt ?? 0))[0];
  return first ? [{
    receiptId: `activity:daily-quest:${grantDayId}`,
    kind: 'daily_quest_energy',
    amount: MERGE_DAILY_QUEST_ENERGY,
    label: 'Daily real-life quest',
    grantDayId,
  }] : [];
}
