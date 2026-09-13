import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { acknowledgeCompanionBondCelebration, COMPANION_BOND_REWARDS, recordCompanionBondEvent, type CompanionBondAwardReceipt } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import type { MergeCharacterId } from '@/types/merge-world';

/**
 * A friend's daily photo card, completed: one per friend per day, worth the
 * life-activity Bond once. Only the fact and the category are kept; the
 * photo itself stays in the player's camera roll where it belongs.
 */
export type CompanionPhotoActivityCompletion = {
  id: string;
  companion: MergeCharacterId;
  dayId: string;
  occurredAt: number;
  categoryId: string | null;
  receipt?: CompanionBondAwardReceipt;
  /** When the completed row and its reward were shown. */
  presentedAt?: number;
};
type State = { version: 1; completions: Record<string, CompanionPhotoActivityCompletion> };

const KEY = 'katchimeras.companion-photo-activities.v1';
const listeners = new Set<() => void>();

export const companionPhotoActivityId = (companion: MergeCharacterId, dayId: string) => `${companion}:photo:${dayId}`;

export function loadCompanionPhotoActivities(): State {
  const value = getStoredJson<State | null>(KEY, null);
  return value?.version === 1 && value.completions ? value : { version: 1, completions: {} };
}

function save(state: State) {
  setStoredJson(KEY, state);
  listeners.forEach((listener) => listener());
}

export function subscribeCompanionPhotoActivities(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Records today's photo for a friend and awards its Bond once; a second call the same day returns the first completion. */
export function completeCompanionPhotoActivity(companion: MergeCharacterId, dayId: string, categoryId: string | null, now = Date.now()): CompanionPhotoActivityCompletion {
  const id = companionPhotoActivityId(companion, dayId);
  const state = loadCompanionPhotoActivities();
  const existing = state.completions[id];
  if (existing) return existing;
  const bond = loadCompanionBondState();
  const award = recordCompanionBondEvent(bond, {
    id, kind: 'life_activity_completed', creatureId: companionIdForFamily(companion),
    occurredAt: now, dayId, points: COMPANION_BOND_REWARDS.life_activity_completed,
  }, { queueCelebration: true });
  const receipt = award.receipt ?? bond.pendingCelebrations?.find((item) => item.eventId === id);
  if (award.awarded) saveCompanionBondState(award.state);
  const completion: CompanionPhotoActivityCompletion = { id, companion, dayId, occurredAt: now, categoryId, receipt };
  save({ ...state, completions: { ...state.completions, [id]: completion } });
  return completion;
}

export function acknowledgeCompanionPhotoActivity(id: string, now = Date.now()) {
  const state = loadCompanionPhotoActivities();
  const completion = state.completions[id];
  if (!completion || completion.presentedAt) return;
  if (completion.receipt) saveCompanionBondState(acknowledgeCompanionBondCelebration(loadCompanionBondState(), completion.receipt.id));
  save({ ...state, completions: { ...state.completions, [id]: { ...completion, presentedAt: now } } });
}
