import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadCompanionContentState, saveCompanionContentState } from '@/utils/companion-content-storage';
import { markFeastleJournalFtue, recordFeastleJournalEvidence } from '@/utils/companion-story-storage';
import type { ConversationNode, ConversationSession } from '@/types/companion-conversation';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import {
  advanceConversationForJournalHandoff,
  buildCompanionJournalHandoff,
  isCompanionJournalHandoff,
  type CompanionJournalHandoff,
} from '@/utils/companion-journal-handoff-domain';

export type { CompanionJournalHandoff, CompanionJournalHandoffStatus } from '@/utils/companion-journal-handoff-domain';

type CompanionJournalHandoffState = {
  schemaVersion: 1;
  handoffs: CompanionJournalHandoff[];
};

const STORAGE_KEY = 'katchadeck.companion-journal-handoffs-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1_000;

function loadState(): CompanionJournalHandoffState {
  const stored = getStoredJson<CompanionJournalHandoffState>(STORAGE_KEY, { schemaVersion: 1, handoffs: [] });
  return {
    schemaVersion: 1,
    handoffs: Array.isArray(stored.handoffs) ? stored.handoffs.filter(isCompanionJournalHandoff).slice(-20) : [],
  };
}

function saveState(state: CompanionJournalHandoffState): void {
  setStoredJson(STORAGE_KEY, { schemaVersion: 1, handoffs: state.handoffs.slice(-20) });
}

export function createCompanionJournalHandoff(input: {
  mode: 'story' | 'optional';
  familyId: KatchimeraFamilyId;
  creatureId: string;
  session?: ConversationSession | null;
  node?: Extract<ConversationNode, { kind: 'journal_handoff' }> | null;
  target: 'today' | 'tomorrow';
  now?: number;
}): CompanionJournalHandoff {
  const now = input.now ?? Date.now();
  const handoff = buildCompanionJournalHandoff({ ...input, now });
  const state = loadState();
  saveState({ ...state, handoffs: [...state.handoffs.filter((item) => item.id !== handoff.id), handoff] });
  return handoff;
}

export function loadCompanionJournalHandoff(id: string): CompanionJournalHandoff | null {
  return loadState().handoffs.find((handoff) => handoff.id === id) ?? null;
}

export function loadPendingCompanionJournalHandoff(now = Date.now()): CompanionJournalHandoff | null {
  const state = loadState();
  let changed = false;
  const handoffs = state.handoffs.map((handoff) => {
    if (handoff.status !== 'pending' || now - handoff.createdAt <= MAX_AGE_MS) return handoff;
    changed = true;
    return { ...handoff, status: 'cancelled' as const, updatedAt: now };
  });
  if (changed) saveState({ ...state, handoffs });
  return [...handoffs].reverse().find((handoff) => handoff.status === 'pending') ?? null;
}

export function cancelCompanionJournalHandoff(id: string, now = Date.now()): CompanionJournalHandoff | null {
  const state = loadState();
  const current = state.handoffs.find((handoff) => handoff.id === id);
  if (!current || current.status === 'saved') return current ?? null;
  const next = { ...current, status: 'cancelled' as const, updatedAt: now };
  saveState({ ...state, handoffs: state.handoffs.map((handoff) => handoff.id === id ? next : handoff) });
  return next;
}

export function completeCompanionJournalHandoff(
  id: string,
  journalRecordId: string,
  now = Date.now(),
): CompanionJournalHandoff | null {
  const state = loadState();
  const current = state.handoffs.find((handoff) => handoff.id === id);
  if (!current) return null;
  if (current.status === 'saved') return current;

  if (current.mode === 'story' && current.sessionId && current.definitionId && current.nodeId) {
    const content = loadCompanionContentState();
    const result = advanceConversationForJournalHandoff(content, current, journalRecordId, now);
    if (result.advanced) saveCompanionContentState(result.content);
    if (current.familyId === 'feastle') {
      markFeastleJournalFtue('saved', journalRecordId, now);
      recordFeastleJournalEvidence(journalRecordId, null, now);
    }
  }

  const next = { ...current, status: 'saved' as const, journalRecordId, updatedAt: now };
  saveState({ ...state, handoffs: state.handoffs.map((handoff) => handoff.id === id ? next : handoff) });
  return next;
}
