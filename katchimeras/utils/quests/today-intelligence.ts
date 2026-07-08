import type { HomeDayRecord } from '@/types/home';
import type { QuestCapabilityMap } from '@/utils/capabilities/quest-capabilities';
import type { CompanionQuest, CompanionQuestState } from '@/utils/katchimera-quests';
import type { MemoryQuest } from '@/utils/memory-quests-engine';
import type { Facts } from '@/utils/signals/facts';
import { resolveFactsForDay } from '@/utils/signals/resolve';

import { evaluateQuestRuntime, type QuestRuntimeStatus } from './runtime';

export type TodayQuestIntelligence = {
  companion: {
    active: (CompanionQuest & { runtime: QuestRuntimeStatus })[];
    complete: (CompanionQuest & { runtime: QuestRuntimeStatus })[];
    blocked: (CompanionQuest & { runtime: QuestRuntimeStatus })[];
  };
  memory: MemoryQuest[];
  nextActionQuest: (CompanionQuest & { runtime: QuestRuntimeStatus }) | null;
  matchedEvidenceIds: string[];
  blockedCount: number;
  completeCount: number;
};

export function deriveTodayQuestIntelligence(input: {
  day: HomeDayRecord | null;
  memoryQuests: MemoryQuest[];
  companionQuests: CompanionQuestState;
  capabilities?: QuestCapabilityMap | null;
  facts?: Partial<Facts>;
}): TodayQuestIntelligence {
  const facts = input.facts ?? resolveFactsForDay(input.day);
  const enriched = input.companionQuests.quests
    .filter((quest) => !quest.completedAt)
    .map((quest) => ({
      ...quest,
      runtime: evaluateQuestRuntime({
        questId: quest.questId,
        day: input.day,
        facts,
        capabilities: input.capabilities,
      }),
    }));

  const complete = enriched.filter((quest) => quest.runtime.state === 'complete');
  const blocked = enriched.filter((quest) => quest.runtime.state === 'blocked_permission' || quest.runtime.state === 'unavailable');
  const active = enriched.filter((quest) => quest.runtime.state === 'in_progress' || quest.runtime.state === 'impossible_today');
  const nextActionQuest =
    complete[0] ??
    active.find((quest) => quest.runtime.nextAction !== 'none') ??
    blocked.find((quest) => quest.runtime.nextAction !== 'none') ??
    null;

  return {
    companion: { active, complete, blocked },
    memory: input.memoryQuests,
    nextActionQuest,
    matchedEvidenceIds: Array.from(new Set(enriched.flatMap((quest) => quest.runtime.matchedEvidenceIds))),
    blockedCount: blocked.length,
    completeCount: complete.length,
  };
}

