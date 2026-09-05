import type { PhotoQuestEvaluation } from '@/utils/quests/photo-evaluation';

export type QuestCaptureSession = {
  questId: string;
  creatureId: string;
  sourceId: string | null;
  phase: 'capturing' | 'committed';
  evaluation: PhotoQuestEvaluation | null;
  sourceType: 'photo' | 'text_note' | 'voice_note' | null;
  questRunId?: string | null;
};

const STORAGE_KEY = 'katchadeck.quest-capture-session-v2';
let memorySession: QuestCaptureSession | null = null;

export function beginQuestCapture(questId: string, creatureId: string, questRunId?: string | null): void {
  saveSession({ questId, creatureId, questRunId: questRunId ?? null, sourceId: null, sourceType: null, phase: 'capturing', evaluation: null });
}

export function completeQuestCapture(
  questId: string,
  creatureId: string,
  sourceId: string,
  evaluation: PhotoQuestEvaluation,
  sourceType: QuestCaptureSession['sourceType'] = 'photo'
): void {
  const current = activeQuestCapture();
  saveSession({ questId, creatureId, questRunId: current?.questRunId ?? null, sourceId, sourceType, phase: 'committed', evaluation });
}

export function activeQuestCapture(): QuestCaptureSession | null {
  const storage = globalThis.localStorage;
  if (!storage) return memorySession;
  try {
    const value = storage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as QuestCaptureSession : memorySession;
  } catch {
    return memorySession;
  }
}

export function consumeCompletedQuestCapture(): QuestCaptureSession | null {
  const session = activeQuestCapture();
  if (session?.phase !== 'committed') return null;
  const completed = session;
  clearSession();
  return completed;
}

export function cancelQuestCapture(questId?: string | null): void {
  const session = activeQuestCapture();
  if (!questId || session?.questId === questId) clearSession();
}

function saveSession(value: QuestCaptureSession): void {
  memorySession = value;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The in-memory copy keeps the active navigation flow usable.
  }
}

function clearSession(): void {
  memorySession = null;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Best effort; the in-memory state is already cleared.
  }
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
