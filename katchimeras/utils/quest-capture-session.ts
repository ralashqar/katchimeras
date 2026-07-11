export type QuestCaptureSession = {
  questId: string;
  creatureId: string;
  sourceId: string | null;
  phase: 'capturing' | 'committed';
};

let session: QuestCaptureSession | null = null;

export function beginQuestCapture(questId: string, creatureId: string): void {
  session = { questId, creatureId, sourceId: null, phase: 'capturing' };
}

export function completeQuestCapture(questId: string, creatureId: string, sourceId: string): void {
  session = { questId, creatureId, sourceId, phase: 'committed' };
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
