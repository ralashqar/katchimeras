import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { accumulateQuietBond, nextFeastleBundleOrderId } from '@/utils/companion-story';

export type CompanionStoryStatus =
  | 'intro_available'
  | 'conversation_active'
  | 'order_active'
  | 'return_available'
  | 'chapter_complete'
  | 'arc_complete';

export type CompanionStoryArc = {
  id: string;
  familyId: string;
  version: number;
  currentLevel: number;
  targetLevel: number;
  beatId: string;
  status: CompanionStoryStatus;
  activeOrderId: string | null;
  pendingConversationId: string | null;
  unreadReturn: boolean;
  starterParcelGranted: boolean;
  completedBeatIds: string[];
  completedOrderIds: string[];
  pendingBondPoints: number;
  processedQuietBondReceiptIds: string[];
  updatedAt: number;
};

type CompanionStoryState = { schemaVersion: 1; arcs: CompanionStoryArc[] };

const STORAGE_KEY = 'katchadeck.companion-stories-v1';
const listeners = new Set<() => void>();

export function freshFeastleStory(now = Date.now()): CompanionStoryArc {
  return {
    id: 'feastle:table-story', familyId: 'feastle', version: 1,
    currentLevel: 1, targetLevel: 2, beatId: 'feastle-story:level-1',
    status: 'intro_available', activeOrderId: null, pendingConversationId: null,
    unreadReturn: false, starterParcelGranted: false,
    completedBeatIds: [], completedOrderIds: [], pendingBondPoints: 0,
    processedQuietBondReceiptIds: [], updatedAt: now,
  };
}

function normalize(value: unknown): CompanionStoryState {
  if (!value || typeof value !== 'object') return { schemaVersion: 1, arcs: [] };
  const candidate = value as Partial<CompanionStoryState>;
  return {
    schemaVersion: 1,
    arcs: Array.isArray(candidate.arcs) ? candidate.arcs.filter((arc): arc is CompanionStoryArc => Boolean(
      arc && typeof arc.id === 'string' && typeof arc.familyId === 'string' && typeof arc.status === 'string'
    )).map((arc) => ({
      ...arc,
      pendingBondPoints: Number.isFinite(arc.pendingBondPoints) ? Math.max(0, Math.floor(arc.pendingBondPoints)) : 0,
      processedQuietBondReceiptIds: Array.isArray(arc.processedQuietBondReceiptIds)
        ? [...new Set(arc.processedQuietBondReceiptIds.filter((id): id is string => typeof id === 'string'))]
        : [],
    })) : [],
  };
}

export function loadCompanionStoryState(): CompanionStoryState {
  return normalize(getStoredJson<CompanionStoryState>(STORAGE_KEY, { schemaVersion: 1, arcs: [] }));
}

function saveState(state: CompanionStoryState) {
  setStoredJson(STORAGE_KEY, normalize(state));
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

export function loadFeastleStory(): CompanionStoryArc {
  return loadCompanionStoryState().arcs.find((arc) => arc.familyId === 'feastle') ?? freshFeastleStory();
}

export function saveFeastleStory(arc: CompanionStoryArc): CompanionStoryArc {
  const state = loadCompanionStoryState();
  saveState({ ...state, arcs: [...state.arcs.filter((item) => item.familyId !== 'feastle'), arc] });
  return arc;
}

export function beginFeastleStory(now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.status !== 'intro_available') return current;
  return saveFeastleStory({
    ...current, status: 'order_active', starterParcelGranted: true,
    beatId: 'feastle-story:level-1', targetLevel: 2, updatedAt: now,
  });
}

export function markFeastleOrderActive(orderId: string, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.status !== 'order_active' || current.activeOrderId === orderId) return current;
  return saveFeastleStory({ ...current, activeOrderId: orderId, updatedAt: now });
}

export function recordFeastleQuietBond(receiptId: string, points: number, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  const accumulated = accumulateQuietBond(current.pendingBondPoints, current.processedQuietBondReceiptIds, receiptId, points);
  if (!accumulated.changed) return current;
  return saveFeastleStory({
    ...current,
    pendingBondPoints: accumulated.points,
    processedQuietBondReceiptIds: accumulated.processedReceiptIds,
    updatedAt: now,
  });
}

export function markFeastleOrderServed(orderId: string, targetLevel: number, now = Date.now(), storyStepCount = 1): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.completedOrderIds.includes(orderId)) return current;
  const completedOrderIds = [...current.completedOrderIds, orderId];
  const bundlePrefix = `merge-story:feastle:chapter-1:level-${targetLevel}:order-`;
  const completedBundleSteps = completedOrderIds.filter((id) => id.startsWith(bundlePrefix)).length;
  if (storyStepCount > 1 && completedBundleSteps < storyStepCount) {
    const nextActiveOrderId = nextFeastleBundleOrderId(completedOrderIds, targetLevel, storyStepCount);
    return saveFeastleStory({
      ...current,
      status: 'order_active',
      // Keep the story pointed at a real remaining tray. This prevents the
      // provider from having to write a second story update while the serve
      // receipt is still being applied.
      activeOrderId: nextActiveOrderId,
      completedOrderIds,
      updatedAt: now,
    });
  }
  return saveFeastleStory({
    ...current,
    currentLevel: Math.max(current.currentLevel, targetLevel),
    targetLevel,
    status: 'return_available',
    activeOrderId: null,
    pendingConversationId: `feastle:friendship:${targetLevel}`,
    unreadReturn: true,
    completedOrderIds,
    updatedAt: now,
  });
}

export function beginFeastleReturn(now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.status !== 'return_available') return current;
  return saveFeastleStory({ ...current, status: 'conversation_active', unreadReturn: false, updatedAt: now });
}

export function completeFeastleConversation(level: number, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  const beatId = `feastle-story:level-${level}`;
  if (current.status !== 'conversation_active' || current.pendingConversationId !== `feastle:friendship:${level}`) return current;
  if (current.completedBeatIds.includes(beatId)) return current;
  if (level >= 4) return saveFeastleStory({
    ...current, currentLevel: 4, targetLevel: 4, beatId,
    status: 'chapter_complete', pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  return saveFeastleStory({
    ...current, currentLevel: level, targetLevel: level + 1,
    beatId: `feastle-story:level-${level}`, status: 'order_active',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
}

export function resetCompanionStoriesForDebug(): void {
  saveState({ schemaVersion: 1, arcs: [] });
}

export function setFeastleStoryStateForDebug(status: CompanionStoryStatus, level: number, now = Date.now()): CompanionStoryArc {
  const targetLevel = status === 'order_active' ? Math.min(4, level + 1) : level;
  return saveFeastleStory({
    ...freshFeastleStory(now), currentLevel: level, targetLevel,
    beatId: `feastle-story:level-${Math.max(1, level)}`, status,
    pendingConversationId: status === 'return_available' ? `feastle:friendship:${level}` : null,
    unreadReturn: status === 'return_available', starterParcelGranted: status !== 'intro_available', updatedAt: now,
  });
}

export function subscribeCompanionStories(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
