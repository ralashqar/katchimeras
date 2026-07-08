import type { QuestNextAction } from '@/utils/quests/runtime';

export type PendingQuestActionIntent = {
  action: QuestNextAction;
  questId?: string | null;
};

let pending: PendingQuestActionIntent | null = null;

export function requestQuestActionIntent(intent: PendingQuestActionIntent): void {
  pending = intent;
}

export function consumeQuestActionIntent(): PendingQuestActionIntent | null {
  const value = pending;
  pending = null;
  return value;
}
