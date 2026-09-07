import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import type { ConversationTranscriptEntry } from '@/types/companion-conversation';

type History = { entries: ConversationTranscriptEntry[]; choices: Record<string, string> };
const key = (runId: string) => `katchimeras.ftue-narrative:${runId}`;
export function loadFtueNarrativeHistory(runId: string): History {
  return getStoredJson<History>(key(runId), { entries: [], choices: {} });
}
export function saveFtueNarrativeHistory(runId: string, entries: readonly ConversationTranscriptEntry[], choice?: { id: string; value: string }): History {
  const current = loadFtueNarrativeHistory(runId);
  const seen = new Set(current.entries.map((entry) => entry.id));
  const next = { entries: [...current.entries, ...entries.filter((entry) => !seen.has(entry.id))],
    choices: { ...current.choices, ...(choice ? { [choice.id]: choice.value } : {}) } };
  setStoredJson(key(runId), next);
  return next;
}
