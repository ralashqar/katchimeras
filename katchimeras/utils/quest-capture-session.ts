import type { PhotoQuestEvaluation } from '@/utils/quests/photo-evaluation';

export type QuestCaptureSession = {
  questId: string;
  creatureId: string;
  sourceId: string | null;
  phase: 'capturing' | 'committed';
  evaluation: PhotoQuestEvaluation | null;
  sourceType: 'photo' | 'text_note' | 'voice_note' | null;
};

let session: QuestCaptureSession | null = null;

export function beginQuestCapture(questId: string, creatureId: string): void {
  session = { questId, creatureId, sourceId: null, sourceType: null, phase: 'capturing', evaluation: null };
}

export function completeQuestCapture(
  questId: string,
  creatureId: string,
  sourceId: string,
  evaluation: PhotoQuestEvaluation,
  sourceType: QuestCaptureSession['sourceType'] = 'photo'
): void {
  session = { questId, creatureId, sourceId, sourceType, phase: 'committed', evaluation };
}

export function activeQuestCapture(): QuestCaptureSession | null {
  return session;
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

export function questCaptureBelongsTo(
  capture: { questId?: string | null; creatureId?: string | null } | null | undefined,
  questId: string | null | undefined,
  creatureId: string | null | undefined
): boolean {
  return Boolean(
    capture &&
    questId &&
    creatureId &&
    capture.questId === questId &&
    capture.creatureId === creatureId
  );
}
