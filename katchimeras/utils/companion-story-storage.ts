import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { accumulateQuietBond, nextFeastleBundleOrderId, selectAuthoredCohortOrderKeys, selectFeastleActTwoOrderKeys, type AuthoredCohortFamilyId } from '@/utils/companion-story';

export type FeastleActId = 'act-1' | 'act-2' | 'act-3' | 'act-4' | 'act-5';
export type FeastleActPhase = 'opening' | 'regular_orders' | 'midpoint_return' | 'insight_return' | 'signature_order' | 'finale_return' | 'complete';
export type FeastleStorySignalValue = 'ease' | 'comfort' | 'connection' | 'curiosity';
export type FeastleStorySignal = {
  id: string;
  sourceType: 'conversation' | 'journal' | 'order';
  sourceId: string;
  value: FeastleStorySignalValue;
  recordedAt: number;
};
export type FeastleOrderDeck = { actId: FeastleActId; seed: string; requiredCount: number; templateKeys: string[]; servedOrderIds: string[] };

export type CompanionStoryStatus =
  | 'intro_available'
  | 'conversation_active'
  | 'order_active'
  | 'return_available'
  | 'haven_upgrade_available'
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
  pendingHavenStage?: number | null;
  unreadReturn: boolean;
  completedBeatIds: string[];
  completedOrderIds: string[];
  pendingBondPoints: number;
  processedQuietBondReceiptIds: string[];
  journalFtueStatus: 'not_started' | 'saved' | 'skipped';
  journalFtueRecordId: string | null;
  currentActId: FeastleActId;
  actPhase: FeastleActPhase;
  orderDeck: FeastleOrderDeck | null;
  storySignals: FeastleStorySignal[];
  relevantJournalRecordIds: string[];
  confirmedMemoryKeys: string[];
  completedActIds: FeastleActId[];
  updatedAt: number;
};

type CompanionStoryState = { schemaVersion: 3; arcs: CompanionStoryArc[] };

const STORAGE_KEY = 'katchadeck.companion-stories-v1';
const listeners = new Set<() => void>();

export function freshFeastleStory(now = Date.now()): CompanionStoryArc {
  return {
    id: 'feastle:table-story', familyId: 'feastle', version: 3,
    currentLevel: 1, targetLevel: 2, beatId: 'feastle-story:level-1',
    status: 'intro_available', activeOrderId: null, pendingConversationId: null,
    unreadReturn: false,
    completedBeatIds: [], completedOrderIds: [], pendingBondPoints: 0,
    processedQuietBondReceiptIds: [], updatedAt: now,
    journalFtueStatus: 'not_started', journalFtueRecordId: null,
    currentActId: 'act-1', actPhase: 'opening', orderDeck: null,
    storySignals: [], relevantJournalRecordIds: [], confirmedMemoryKeys: [], completedActIds: [],
  };
}

export function freshMossproutStory(now = Date.now()): CompanionStoryArc {
  return {
    id: 'mossprout:where-water-goes', familyId: 'mossprout', version: 3,
    currentLevel: 1, targetLevel: 2, beatId: 'mossprout-story:level-1',
    status: 'intro_available', activeOrderId: null, pendingConversationId: null,
    unreadReturn: false, completedBeatIds: [], completedOrderIds: [], pendingBondPoints: 0,
    processedQuietBondReceiptIds: [], updatedAt: now,
    journalFtueStatus: 'skipped', journalFtueRecordId: null,
    currentActId: 'act-1', actPhase: 'opening', orderDeck: null,
    storySignals: [], relevantJournalRecordIds: [], confirmedMemoryKeys: [], completedActIds: [],
  };
}

export function freshBaristabbitStory(now = Date.now()): CompanionStoryArc {
  return freshAuthoredCohortStory('baristabbit', now);
}

const AUTHORED_STORY_CONFIG = {
  baristabbit: { id: 'baristabbit:pause-story', signatureKey: 'pause-table' },
  steppling: { id: 'steppling:path-outside-story', signatureKey: 'path-outside' },
  voyagle: { id: 'voyagle:blank-spaces-story', signatureKey: 'map-with-blank-spaces' },
  flexel: { id: 'flexel:rhythm-that-holds-story', signatureKey: 'rhythm-that-holds' },
  bedrotte: { id: 'bedrotte:room-that-asks-nothing-story', signatureKey: 'room-that-asks-nothing' },
} as const;

export function isAuthoredCohortFamily(familyId: string): familyId is AuthoredCohortFamilyId {
  return familyId === 'baristabbit' || familyId === 'steppling' || familyId === 'voyagle'
    || familyId === 'flexel' || familyId === 'bedrotte';
}

export function freshAuthoredCohortStory(familyId: AuthoredCohortFamilyId, now = Date.now()): CompanionStoryArc {
  const config = AUTHORED_STORY_CONFIG[familyId];
  return {
    id: config.id, familyId, version: 3,
    currentLevel: 1, targetLevel: 6, beatId: `${familyId}-story:first-meeting`,
    status: 'intro_available', activeOrderId: null, pendingConversationId: null,
    unreadReturn: false, completedBeatIds: [], completedOrderIds: [], pendingBondPoints: 0,
    processedQuietBondReceiptIds: [], updatedAt: now,
    journalFtueStatus: 'not_started', journalFtueRecordId: null,
    currentActId: 'act-1', actPhase: 'opening', orderDeck: null,
    storySignals: [], relevantJournalRecordIds: [], confirmedMemoryKeys: [], completedActIds: [],
  };
}

function normalize(value: unknown): CompanionStoryState {
  if (!value || typeof value !== 'object') return { schemaVersion: 3, arcs: [] };
  const candidate = value as Partial<CompanionStoryState>;
  return {
    schemaVersion: 3,
    arcs: Array.isArray(candidate.arcs) ? candidate.arcs.filter((arc): arc is CompanionStoryArc => Boolean(
      arc && typeof arc.id === 'string' && typeof arc.familyId === 'string' && typeof arc.status === 'string'
    )).map((arc) => ({
      ...arc,
      pendingBondPoints: Number.isFinite(arc.pendingBondPoints) ? Math.max(0, Math.floor(arc.pendingBondPoints)) : 0,
      processedQuietBondReceiptIds: Array.isArray(arc.processedQuietBondReceiptIds)
        ? [...new Set(arc.processedQuietBondReceiptIds.filter((id): id is string => typeof id === 'string'))]
        : [],
      version: 3,
      journalFtueStatus: arc.journalFtueStatus === 'saved' || arc.journalFtueStatus === 'skipped'
        ? arc.journalFtueStatus
        : isAuthoredCohortFamily(arc.familyId)
          ? 'not_started'
          : arc.currentLevel >= 3 || arc.completedBeatIds?.includes('feastle-story:level-2')
          ? 'skipped'
          : 'not_started',
      journalFtueRecordId: typeof arc.journalFtueRecordId === 'string' ? arc.journalFtueRecordId : null,
      currentActId: isActId(arc.currentActId) ? arc.currentActId : arc.currentLevel >= 5 ? 'act-2' : 'act-1',
      actPhase: isActPhase(arc.actPhase) ? arc.actPhase : arc.status === 'chapter_complete' ? 'complete' : 'opening',
      orderDeck: normalizeOrderDeck(arc.orderDeck),
      storySignals: Array.isArray(arc.storySignals) ? arc.storySignals.filter(isStorySignal) : [],
      relevantJournalRecordIds: uniqueStrings(arc.relevantJournalRecordIds),
      confirmedMemoryKeys: uniqueStrings(arc.confirmedMemoryKeys),
      completedActIds: uniqueStrings(arc.completedActIds).filter(isActId),
      pendingHavenStage: Number.isInteger(arc.pendingHavenStage) ? Math.max(1, Math.min(4, Number(arc.pendingHavenStage))) : null,
    })) : [],
  };
}

export function markFeastleJournalFtue(
  status: 'saved' | 'skipped',
  journalRecordId: string | null = null,
  now = Date.now(),
): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.journalFtueStatus === 'saved') return current;
  if (current.journalFtueStatus === status && current.journalFtueRecordId === journalRecordId) return current;
  return saveFeastleStory({
    ...current,
    journalFtueStatus: status,
    journalFtueRecordId: status === 'saved' ? journalRecordId : null,
    updatedAt: now,
  });
}

export function loadCompanionStoryState(): CompanionStoryState {
  return normalize(getStoredJson<CompanionStoryState>(STORAGE_KEY, { schemaVersion: 3, arcs: [] }));
}

function saveState(state: CompanionStoryState) {
  setStoredJson(STORAGE_KEY, normalize(state));
  queueMicrotask(() => listeners.forEach((listener) => listener()));
}

export function loadFeastleStory(): CompanionStoryArc {
  return loadCompanionStoryState().arcs.find((arc) => arc.familyId === 'feastle') ?? freshFeastleStory();
}

export function loadMossproutStory(): CompanionStoryArc {
  return loadCompanionStoryState().arcs.find((arc) => arc.familyId === 'mossprout') ?? freshMossproutStory();
}

export function saveMossproutStory(arc: CompanionStoryArc): CompanionStoryArc {
  const state = loadCompanionStoryState();
  saveState({ ...state, arcs: [...state.arcs.filter((item) => item.familyId !== 'mossprout'), arc] });
  return arc;
}

export function beginMossproutChapterOne(now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.status !== 'intro_available') return current;
  return saveMossproutStory({
    ...current, status: 'order_active', actPhase: 'regular_orders', targetLevel: 2,
    beatId: 'mossprout-story:level-1', completedBeatIds: [...new Set([...current.completedBeatIds, 'mossprout-story:level-1'])], updatedAt: now,
  });
}

export function markMossproutOrderActive(orderId: string, now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.status !== 'order_active' || current.activeOrderId === orderId) return current;
  return saveMossproutStory({ ...current, activeOrderId: orderId, updatedAt: now });
}

export function markMossproutOrderServed(orderId: string, targetLevel: number, now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.completedOrderIds.includes(orderId)) return current;
  const level = Math.max(2, Math.min(4, targetLevel));
  return saveMossproutStory({
    ...current, currentLevel: level, targetLevel: level, status: 'return_available',
    actPhase: level === 4 ? 'finale_return' : 'midpoint_return', activeOrderId: null,
    pendingConversationId: `mossprout:story:${level}`, unreadReturn: true,
    completedOrderIds: [...current.completedOrderIds, orderId], updatedAt: now,
  });
}

export function beginMossproutReturn(now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.status !== 'return_available') return current;
  return saveMossproutStory({ ...current, status: 'conversation_active', unreadReturn: false, updatedAt: now });
}

export function completeMossproutConversation(level: number, now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.status !== 'conversation_active' || current.pendingConversationId !== `mossprout:story:${level}`) return current;
  const beatId = `mossprout-story:level-${level}`;
  return saveMossproutStory({
    ...current, currentLevel: level, targetLevel: level, beatId, status: 'haven_upgrade_available',
    actPhase: level >= 4 ? 'finale_return' : level === 3 ? 'signature_order' : 'regular_orders', activeOrderId: null,
    pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    pendingHavenStage: level,
    completedBeatIds: [...new Set([...current.completedBeatIds, beatId])], updatedAt: now,
  });
}

export function completeMossproutHavenUpgrade(stage: number, now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  if (current.status !== 'haven_upgrade_available' || current.pendingHavenStage !== stage) return current;
  if (stage >= 4) return saveMossproutStory({
    ...current,
    currentLevel: 4,
    targetLevel: 4,
    status: 'chapter_complete',
    actPhase: 'complete',
    pendingHavenStage: null,
    completedActIds: [...new Set([...current.completedActIds, 'act-1' as const])],
    updatedAt: now,
  });
  return saveMossproutStory({
    ...current,
    targetLevel: stage + 1,
    status: 'order_active',
    actPhase: stage === 3 ? 'signature_order' : 'regular_orders',
    pendingHavenStage: null,
    updatedAt: now,
  });
}

export function recordMossproutQuietBond(receiptId: string, points: number, now = Date.now()): CompanionStoryArc {
  const current = loadMossproutStory();
  const accumulated = accumulateQuietBond(current.pendingBondPoints, current.processedQuietBondReceiptIds, receiptId, points);
  if (!accumulated.changed) return current;
  return saveMossproutStory({ ...current, pendingBondPoints: accumulated.points, processedQuietBondReceiptIds: accumulated.processedReceiptIds, updatedAt: now });
}

export function saveFeastleStory(arc: CompanionStoryArc): CompanionStoryArc {
  const state = loadCompanionStoryState();
  saveState({ ...state, arcs: [...state.arcs.filter((item) => item.familyId !== 'feastle'), arc] });
  return arc;
}

export function loadBaristabbitStory(): CompanionStoryArc {
  return loadAuthoredCohortStory('baristabbit');
}

export function saveBaristabbitStory(arc: CompanionStoryArc): CompanionStoryArc {
  return saveAuthoredCohortStory('baristabbit', arc);
}

export function loadAuthoredCohortStory(familyId: AuthoredCohortFamilyId): CompanionStoryArc {
  return loadCompanionStoryState().arcs.find((arc) => arc.familyId === familyId) ?? freshAuthoredCohortStory(familyId);
}

export function saveAuthoredCohortStory(familyId: AuthoredCohortFamilyId, arc: CompanionStoryArc): CompanionStoryArc {
  const state = loadCompanionStoryState();
  saveState({ ...state, arcs: [...state.arcs.filter((item) => item.familyId !== familyId), arc] });
  return arc;
}

export function beginBaristabbitStory(now = Date.now()): CompanionStoryArc {
  return beginAuthoredCohortStory('baristabbit', now);
}

export function beginAuthoredCohortStory(familyId: AuthoredCohortFamilyId, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.status !== 'intro_available') return current;
  const seed = `${familyId}:chapter-1:${now}`;
  return saveAuthoredCohortStory(familyId, {
    ...current,
    currentLevel: 5, targetLevel: 6, beatId: `${familyId}-story:first-meeting`,
    status: 'order_active', actPhase: 'regular_orders',
    orderDeck: { actId: 'act-1', seed, requiredCount: 5, templateKeys: selectAuthoredCohortOrderKeys(familyId, seed), servedOrderIds: [] },
    completedBeatIds: [...new Set([...current.completedBeatIds, `${familyId}-story:first-meeting`])],
    updatedAt: now,
  });
}

export function markBaristabbitJournalFtue(journalRecordId: string, now = Date.now()): CompanionStoryArc {
  return markAuthoredCohortJournalFtue('baristabbit', journalRecordId, now);
}

export function markAuthoredCohortJournalFtue(familyId: AuthoredCohortFamilyId, journalRecordId: string, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.journalFtueStatus === 'saved' && current.journalFtueRecordId === journalRecordId) return current;
  return saveAuthoredCohortStory(familyId, {
    ...current,
    journalFtueStatus: 'saved', journalFtueRecordId: journalRecordId,
    relevantJournalRecordIds: [...new Set([...current.relevantJournalRecordIds, journalRecordId])],
    updatedAt: now,
  });
}

export function markBaristabbitOrderActive(orderId: string, now = Date.now()): CompanionStoryArc {
  return markAuthoredCohortOrderActive('baristabbit', orderId, now);
}

export function markAuthoredCohortOrderActive(familyId: AuthoredCohortFamilyId, orderId: string, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.status !== 'order_active' || current.activeOrderId === orderId) return current;
  return saveAuthoredCohortStory(familyId, { ...current, activeOrderId: orderId, updatedAt: now });
}

export function recordBaristabbitQuietBond(receiptId: string, points: number, now = Date.now()): CompanionStoryArc {
  return recordAuthoredCohortQuietBond('baristabbit', receiptId, points, now);
}

export function recordAuthoredCohortQuietBond(familyId: AuthoredCohortFamilyId, receiptId: string, points: number, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  const accumulated = accumulateQuietBond(current.pendingBondPoints, current.processedQuietBondReceiptIds, receiptId, points);
  if (!accumulated.changed) return current;
  return saveAuthoredCohortStory(familyId, { ...current, pendingBondPoints: accumulated.points, processedQuietBondReceiptIds: accumulated.processedReceiptIds, updatedAt: now });
}

export function markBaristabbitOrderServed(orderId: string, now = Date.now()): CompanionStoryArc {
  return markAuthoredCohortOrderServed('baristabbit', orderId, now);
}

export function markAuthoredCohortOrderServed(familyId: AuthoredCohortFamilyId, orderId: string, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.completedOrderIds.includes(orderId)) return current;
  const completedOrderIds = [...current.completedOrderIds, orderId];
  const orderDeck = current.orderDeck
    ? { ...current.orderDeck, servedOrderIds: [...new Set([...current.orderDeck.servedOrderIds, orderId])] }
    : null;
  const prefix = `merge-story:${familyId}:chapter-1:`;
  if (orderId === `${prefix}${AUTHORED_STORY_CONFIG[familyId].signatureKey}`) return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 8, targetLevel: 8, status: 'return_available', actPhase: 'finale_return',
    activeOrderId: null, pendingConversationId: `${familyId}:story:8`, unreadReturn: true,
    completedOrderIds, orderDeck, updatedAt: now,
  });
  const servedCount = orderDeck?.servedOrderIds.filter((id) => id.startsWith(prefix)).length ?? 0;
  if (servedCount === 2 && current.currentLevel < 6) return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 6, targetLevel: 6, status: 'return_available', actPhase: 'midpoint_return',
    activeOrderId: null, pendingConversationId: `${familyId}:story:6`, unreadReturn: true,
    completedOrderIds, orderDeck, updatedAt: now,
  });
  if (servedCount >= 5) return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 7, targetLevel: 7, status: 'return_available', actPhase: 'insight_return',
    activeOrderId: null, pendingConversationId: `${familyId}:story:7`, unreadReturn: true,
    completedOrderIds, orderDeck, updatedAt: now,
  });
  return saveAuthoredCohortStory(familyId, { ...current, status: 'order_active', activeOrderId: null, completedOrderIds, orderDeck, updatedAt: now });
}

export function beginBaristabbitReturn(now = Date.now()): CompanionStoryArc {
  return beginAuthoredCohortReturn('baristabbit', now);
}

export function beginAuthoredCohortReturn(familyId: AuthoredCohortFamilyId, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.status !== 'return_available') return current;
  return saveAuthoredCohortStory(familyId, { ...current, status: 'conversation_active', unreadReturn: false, updatedAt: now });
}

export function completeBaristabbitConversation(level: number, now = Date.now()): CompanionStoryArc {
  return completeAuthoredCohortConversation('baristabbit', level, now);
}

export function completeAuthoredCohortConversation(familyId: AuthoredCohortFamilyId, level: number, now = Date.now()): CompanionStoryArc {
  const current = loadAuthoredCohortStory(familyId);
  if (current.status !== 'conversation_active' || current.pendingConversationId !== `${familyId}:story:${level}`) return current;
  const beatId = `${familyId}-story:level-${level}`;
  if (current.completedBeatIds.includes(beatId)) return current;
  if (level === 6) return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 6, targetLevel: 7, beatId, status: 'order_active', actPhase: 'regular_orders',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    journalFtueStatus: current.journalFtueStatus === 'not_started' ? 'skipped' : current.journalFtueStatus,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  if (level === 7) return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 7, targetLevel: 8, beatId, status: 'order_active', actPhase: 'signature_order',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  return saveAuthoredCohortStory(familyId, {
    ...current, currentLevel: 8, targetLevel: 8, beatId, status: 'chapter_complete', actPhase: 'complete',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedActIds: [...new Set([...current.completedActIds, 'act-1' as const])],
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
}

export function beginFeastleStory(now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.status !== 'intro_available') return current;
  return saveFeastleStory({
    ...current, status: 'order_active',
    beatId: 'feastle-story:level-1', targetLevel: 2, updatedAt: now,
  });
}

export function beginFeastleActTwo(now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.currentActId !== 'act-1' || current.status !== 'chapter_complete') return current;
  return saveFeastleStory({
    ...current,
    currentActId: 'act-2', actPhase: 'opening', status: 'conversation_active',
    targetLevel: 5, pendingConversationId: 'feastle:friendship:5', unreadReturn: false, updatedAt: now,
  });
}

export function recordFeastleJournalEvidence(recordId: string, signal?: FeastleStorySignalValue | null, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  const relevantJournalRecordIds = [...new Set([...current.relevantJournalRecordIds, recordId])];
  const storySignals = signal && !current.storySignals.some((item) => item.id === `journal:${recordId}`)
    ? [...current.storySignals, { id: `journal:${recordId}`, sourceType: 'journal' as const, sourceId: recordId, value: signal, recordedAt: now }]
    : current.storySignals;
  if (relevantJournalRecordIds.length === current.relevantJournalRecordIds.length && storySignals === current.storySignals) return current;
  return saveFeastleStory({ ...current, relevantJournalRecordIds, storySignals, updatedAt: now });
}

export function recordFeastleStorySignal(sourceId: string, value: FeastleStorySignalValue, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  const id = `conversation:${sourceId}`;
  if (current.storySignals.some((signal) => signal.id === id)) return current;
  return saveFeastleStory({
    ...current,
    storySignals: [...current.storySignals, { id, sourceType: 'conversation', sourceId, value, recordedAt: now }],
    updatedAt: now,
  });
}

export function recordFeastleConfirmedMemory(memoryKey: string, now = Date.now()): CompanionStoryArc {
  const current = loadFeastleStory();
  if (current.confirmedMemoryKeys.includes(memoryKey)) return current;
  return saveFeastleStory({ ...current, confirmedMemoryKeys: [...current.confirmedMemoryKeys, memoryKey], updatedAt: now });
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
  if (current.currentActId === 'act-2' && current.orderDeck) {
    const servedOrderIds = [...new Set([...current.orderDeck.servedOrderIds, orderId])];
    const orderDeck = { ...current.orderDeck, servedOrderIds };
    if (current.actPhase === 'signature_order' || targetLevel === 8) return saveFeastleStory({
      ...current, currentLevel: 8, targetLevel: 8, status: 'return_available', actPhase: 'finale_return',
      activeOrderId: null, pendingConversationId: 'feastle:friendship:8', unreadReturn: true,
      completedOrderIds, orderDeck, updatedAt: now,
    });
    const regularServed = servedOrderIds.filter((id) => id.startsWith('merge-story:feastle:act-2:')).length;
    if (regularServed === 2 && current.currentLevel < 6) return saveFeastleStory({
      ...current, currentLevel: 6, targetLevel: 6, status: 'return_available', actPhase: 'midpoint_return',
      activeOrderId: null, pendingConversationId: 'feastle:friendship:6', unreadReturn: true,
      completedOrderIds, orderDeck, updatedAt: now,
    });
    if (regularServed >= current.orderDeck.requiredCount) return saveFeastleStory({
      ...current, currentLevel: 7, targetLevel: 7, status: 'return_available', actPhase: 'insight_return',
      activeOrderId: null, pendingConversationId: 'feastle:friendship:7', unreadReturn: true,
      completedOrderIds, orderDeck, updatedAt: now,
    });
    return saveFeastleStory({ ...current, status: 'order_active', activeOrderId: null, completedOrderIds, orderDeck, updatedAt: now });
  }
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
  if (level === 4) return saveFeastleStory({
    ...current, currentLevel: 4, targetLevel: 4, beatId,
    status: 'chapter_complete', actPhase: 'complete', pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedActIds: [...new Set([...current.completedActIds, 'act-1' as const])], completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  if (level === 5) {
    const seed = `feastle:act-2:${now}`;
    return saveFeastleStory({
      ...current, currentLevel: 5, targetLevel: 6, beatId, status: 'order_active', actPhase: 'regular_orders',
      activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
      orderDeck: { actId: 'act-2', seed, requiredCount: 5, templateKeys: selectFeastleActTwoOrderKeys(seed), servedOrderIds: [] },
      completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
    });
  }
  if (level === 6) return saveFeastleStory({
    ...current, currentLevel: 6, targetLevel: 6, beatId, status: 'order_active', actPhase: 'regular_orders',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  if (level === 7) return saveFeastleStory({
    ...current, currentLevel: 7, targetLevel: 8, beatId, status: 'order_active', actPhase: 'signature_order',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedBeatIds: [...current.completedBeatIds, beatId], updatedAt: now,
  });
  if (level === 8) return saveFeastleStory({
    ...current, currentLevel: 8, targetLevel: 8, beatId, status: 'chapter_complete', actPhase: 'complete',
    activeOrderId: null, pendingConversationId: null, unreadReturn: false, pendingBondPoints: 0,
    completedActIds: [...new Set([...current.completedActIds, 'act-2' as const])],
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
  saveState({ schemaVersion: 3, arcs: [] });
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}

function isActId(value: unknown): value is FeastleActId {
  return value === 'act-1' || value === 'act-2' || value === 'act-3' || value === 'act-4' || value === 'act-5';
}

function isActPhase(value: unknown): value is FeastleActPhase {
  return value === 'opening' || value === 'regular_orders' || value === 'midpoint_return' || value === 'insight_return' || value === 'signature_order' || value === 'finale_return' || value === 'complete';
}

function normalizeOrderDeck(value: unknown): FeastleOrderDeck | null {
  if (!value || typeof value !== 'object') return null;
  const deck = value as Partial<FeastleOrderDeck>;
  if (!isActId(deck.actId) || typeof deck.seed !== 'string') return null;
  return { actId: deck.actId, seed: deck.seed, requiredCount: Math.max(1, Math.floor(deck.requiredCount ?? 5)), templateKeys: uniqueStrings(deck.templateKeys), servedOrderIds: uniqueStrings(deck.servedOrderIds) };
}

function isStorySignal(value: unknown): value is FeastleStorySignal {
  if (!value || typeof value !== 'object') return false;
  const signal = value as Partial<FeastleStorySignal>;
  return typeof signal.id === 'string' && typeof signal.sourceId === 'string'
    && (signal.sourceType === 'conversation' || signal.sourceType === 'journal' || signal.sourceType === 'order')
    && (signal.value === 'ease' || signal.value === 'comfort' || signal.value === 'connection' || signal.value === 'curiosity')
    && typeof signal.recordedAt === 'number';
}

export function setFeastleStoryStateForDebug(status: CompanionStoryStatus, level: number, now = Date.now()): CompanionStoryArc {
  const targetLevel = status === 'order_active' ? Math.min(4, level + 1) : level;
  return saveFeastleStory({
    ...freshFeastleStory(now), currentLevel: level, targetLevel,
    beatId: `feastle-story:level-${Math.max(1, level)}`, status,
    pendingConversationId: status === 'return_available' ? `feastle:friendship:${level}` : null,
    unreadReturn: status === 'return_available', updatedAt: now,
  });
}

export function subscribeCompanionStories(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
