import { JOURNAL_CLASSIFICATION_CATALOG } from '@/utils/journal-classification-catalog';
import { KATCHIMERA_MERGE_PROFILES, MERGE_CHARACTER_NAMES, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import type { HomeDayRecord, JournalRecord } from '@/types/home';
import type { MergeActivityReward, MergeChainId, MergeCharacterId, MergeLifeTheme, MergeWorldState } from '@/types/merge-world';
import type { CompanionQuickGoalState } from '@/utils/companion-quick-goals';
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
type MergeActivityContext = {
  state?: MergeWorldState | null;
  quickGoals?: CompanionQuickGoalState | null;
};

type ContextualChain = { chainId: MergeChainId; theme: MergeLifeTheme };

const ROUTE_CHAINS: Readonly<Record<string, ContextualChain>> = {
  'food.dessert': { chainId: 'food:dessert', theme: 'celebration' },
  'food.coffee': { chainId: 'drink:hot', theme: 'ritual' },
  'food.tea': { chainId: 'drink:hot', theme: 'ritual' },
  'food.drink': { chainId: 'drink:refresh', theme: 'ritual' },
  'went_somewhere.cafe': { chainId: 'drink:hot', theme: 'ritual' },
  'went_somewhere.travel': { chainId: 'adventure:travel', theme: 'travel' },
  'movement.walk': { chainId: 'adventure:trail', theme: 'movement' },
  'movement.run': { chainId: 'adventure:trail', theme: 'movement' },
  'movement.cycle': { chainId: 'adventure:trail', theme: 'movement' },
  'movement.workout': { chainId: 'adventure:trail', theme: 'movement' },
  'movement.sport': { chainId: 'adventure:trail', theme: 'movement' },
  'movement.hike': { chainId: 'adventure:trail', theme: 'nature' },
  'movement.travel': { chainId: 'adventure:travel', theme: 'travel' },
  'general.rest': { chainId: 'comfort:rest', theme: 'rest' },
  'general.nature': { chainId: 'nature:garden', theme: 'nature' },
  'work.learning': { chainId: 'mind:books', theme: 'learning' },
  'work.creative': { chainId: 'creative:art', theme: 'creativity' },
  'studio.book': { chainId: 'mind:books', theme: 'learning' },
  'studio.art': { chainId: 'creative:art', theme: 'creativity' },
  'studio.game': { chainId: 'creative:screen', theme: 'play' },
  'studio.film': { chainId: 'creative:screen', theme: 'play' },
  'studio.show': { chainId: 'creative:screen', theme: 'play' },
};

export function mergeActivityRewards(days: readonly HomeDayRecord[], now = new Date(), context: MergeActivityContext = {}): MergeActivityReward[] {
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
    const contextual = contextualRewardForDay(records, eggDayId, context.state);
    if (contextual) rewards.push(contextual);
    const memory = memoryRewardForDay(records, eggDayId, contextual);
    if (memory) rewards.push(memory);
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
    const profile = KATCHIMERA_MERGE_PROFILES[familyId];
    const itemDefinitionIds = profile.coreChains.map((chainId) => `${chainId}:1`);
    const primaryItem = MERGE_ITEMS_BY_ID.get(itemDefinitionIds[0]);
    if (!primaryItem) continue;
    rewards.push({
      receiptId: `activity:companion-story-starter:${familyId}`,
      kind: 'companion_story_starter',
      amount: 0,
      label: `${MERGE_CHARACTER_NAMES[familyId]} starter supplies`,
      grantDayId,
      itemDefinitionIds,
      arrival: {
        id: `arrival:companion-story-starter:${familyId}`,
        kind: 'contextual_parcel',
        dayId: grantDayId,
        label: `${MERGE_CHARACTER_NAMES[familyId]}'s starter parcel`,
        theme: themeForChain(profile.coreChains[0]),
        familyId: primaryItem.familyId,
        chainId: profile.coreChains[0],
        characterId: familyId,
        source: 'companion_story',
        itemDefinitionIds,
      },
    });
  }
  const goalCompletions = context.quickGoals?.completions
    .filter((completion) => completion.dayId === grantDayId)
    .sort((left, right) => left.completedAt - right.completedAt) ?? [];
  const firstGoal = goalCompletions[0];
  if (firstGoal) {
    const familyId = firstGoal.familyId as MergeCharacterId;
    const profile = KATCHIMERA_MERGE_PROFILES[familyId];
    const chainId = profile?.coreChains.find((id) => context.state?.unlockedChains.includes(id)) ?? profile?.coreChains[0];
    if (profile && chainId && (!context.state || context.state.unlockedChains.includes(chainId))) {
      const familyIdForChain = MERGE_ITEMS_BY_ID.get(`${chainId}:1`)!.familyId;
      rewards.push({
        receiptId: `activity:goal-chest:${firstGoal.id}`,
        kind: 'goal_chest', amount: 0, grantDayId,
        label: `${MERGE_CHARACTER_NAMES[familyId]} adventure chest`,
        itemDefinitionIds: [`${chainId}:1`, `${chainId}:1`, `${chainId}:2`],
        arrival: {
          id: `arrival:goal:${firstGoal.id}`, kind: 'goal_chest', dayId: grantDayId,
          label: `${MERGE_CHARACTER_NAMES[familyId]}'s adventure chest`, theme: themeForChain(chainId),
          familyId: familyIdForChain, chainId, characterId: familyId,
          source: 'goal',
          itemDefinitionIds: [`${chainId}:1`, `${chainId}:1`, `${chainId}:2`],
        },
      });
    }
  }
  return rewards;
}

function contextualRewardForDay(records: readonly JournalRecord[], dayId: string, state?: MergeWorldState | null): MergeActivityReward | null {
  if (!records.length || !state?.unlockedChains.length) return null;
  const record = records[0];
  const routeKey = `${record.flowId}.${record.categoryId}`;
  const mapped = ROUTE_CHAINS[routeKey] ?? fallbackChain(record.flowId, record.categoryId);
  const activeCharacterId = state.favouriteCharacterId
    ?? state.activeOrders.find((order) => order.storyArcId)?.characterId
    ?? state.unlockedCharacters[0]
    ?? null;
  const profile = activeCharacterId ? KATCHIMERA_MERGE_PROFILES[activeCharacterId] : null;
  if (!profile) return null;
  const eligibleChains = profile.coreChains.filter((chainId) => state.unlockedChains.includes(chainId));
  if (!eligibleChains.length) return null;
  const activeChains = state.activeOrders.filter((order) => order.characterId === activeCharacterId).flatMap((order) => order.requirements
    .map((requirement) => MERGE_ITEMS_BY_ID.get(requirement.definitionId)?.chainId)
    .filter((chainId): chainId is MergeChainId => Boolean(chainId)));
  const chainId = eligibleChains.includes(mapped.chainId)
    ? mapped.chainId
    : eligibleChains.find((candidate) => activeChains.includes(candidate)) ?? eligibleChains[0];
  const item = MERGE_ITEMS_BY_ID.get(`${chainId}:1`);
  if (!item) return null;
  const id = `activity:contextual-parcel:${dayId}`;
  return {
    receiptId: id, kind: 'contextual_parcel', amount: 0, grantDayId: dayId,
    label: `${MERGE_CHARACTER_NAMES[activeCharacterId]}'s life parcel`, itemDefinitionIds: [`${chainId}:1`, `${chainId}:1`],
    arrival: {
      id: `arrival:parcel:${dayId}`, kind: 'contextual_parcel', dayId,
      label: `${MERGE_CHARACTER_NAMES[activeCharacterId]}'s life parcel`, theme: themeForChain(chainId), familyId: item.familyId, chainId,
      characterId: activeCharacterId, source: 'journal', itemDefinitionIds: [`${chainId}:1`, `${chainId}:1`],
    },
  };
}

function memoryRewardForDay(records: readonly JournalRecord[], dayId: string, contextual: MergeActivityReward | null): MergeActivityReward | null {
  if (!contextual?.arrival) return null;
  const record = records.find((item) => item.source.kind === 'photo' || item.source.kind === 'voice_note') ?? records[0];
  if (!record) return null;
  const routeKey = `${record.flowId}.${record.categoryId}`;
  const routeLabel = JOURNAL_CLASSIFICATION_CATALOG.find((entry) => entry.routeKey === routeKey)?.label ?? 'A moment from today';
  return {
    receiptId: `activity:memory-arrival:${dayId}`, kind: 'memory_arrival', amount: 0, grantDayId: dayId,
    label: `${routeLabel} memory`,
    arrival: {
      id: `arrival:memory:${dayId}`, kind: 'memory_arrival', dayId,
      label: `${routeLabel} memory`, theme: 'memory', familyId: contextual.arrival.familyId,
      chainId: contextual.arrival.chainId, characterId: contextual.arrival.characterId, source: 'journal', itemDefinitionIds: [],
      memoryRef: { dayId, journalRecordId: record.id, sourceKind: record.source.kind },
    },
  };
}

function fallbackChain(flowId: string, categoryId: string): ContextualChain {
  if (flowId === 'food') return { chainId: 'food:table', theme: 'food' };
  if (flowId === 'movement') return { chainId: 'adventure:trail', theme: 'movement' };
  if (flowId === 'went_somewhere') return { chainId: categoryId === 'park' ? 'nature:garden' : 'adventure:travel', theme: categoryId === 'park' ? 'nature' : 'travel' };
  if (flowId === 'people') return { chainId: 'social:gathering', theme: 'connection' };
  if (flowId === 'big_event') return { chainId: 'social:celebration', theme: 'celebration' };
  if (flowId === 'work') return { chainId: 'mind:work', theme: 'focus' };
  if (flowId === 'studio') return { chainId: 'creative:art', theme: 'creativity' };
  return { chainId: 'comfort:care', theme: 'memory' };
}

function themeForChain(chainId: MergeChainId): MergeLifeTheme {
  if (chainId.startsWith('food:')) return 'food';
  if (chainId.startsWith('drink:')) return 'ritual';
  if (chainId === 'adventure:travel') return 'travel';
  if (chainId.startsWith('adventure:')) return 'movement';
  if (chainId.startsWith('nature:')) return 'nature';
  if (chainId.startsWith('comfort:')) return 'rest';
  if (chainId.startsWith('social:')) return 'connection';
  if (chainId.startsWith('mind:')) return 'focus';
  return 'creativity';
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
