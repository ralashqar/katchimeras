import type { PhotoQuestEvaluation } from '@/utils/quests/photo-evaluation';

export type QuestCaptureSession = {
  questId: string;
  creatureId: string;
  sourceId: string | null;
  phase: 'capturing' | 'committed';
  evaluation: PhotoQuestEvaluation | null;
};

let session: QuestCaptureSession | null = null;

export function beginQuestCapture(questId: string, creatureId: string): void {
  session = { questId, creatureId, sourceId: null, phase: 'capturing', evaluation: null };
}

export function completeQuestCapture(questId: string, creatureId: string, sourceId: string, evaluation: PhotoQuestEvaluation): void {
  session = { questId, creatureId, sourceId, phase: 'committed', evaluation };
}

export function consumeCompletedQuestCapture(): QuestCaptureSession | null {
  if (session?.phase !== 'committed') return null;
  const completed = session;
  session = null;
  return completed;
}

export function cancelQuestCapture(questId?: string | null): void {
  if (!questId || session?.questId === questId) session = null;
}
