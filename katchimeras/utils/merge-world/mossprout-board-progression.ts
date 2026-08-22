import { MERGE_ITEMS_BY_ID, MOSSPROUT_ROOTBOUND_GATES, MOSSPROUT_ROOTBOUND_GATES_BY_ID } from '@/constants/merge-world-catalog';
import { selectMemoryCard } from '@/constants/memory-card-catalog';
import type {
  MergeBoardCell,
  MergeWorldArrival,
  MergeWorldState,
  MossproutBoardChapter,
  MossproutBoardProgression,
  MossproutProgressionSignals,
  MossproutRootGateState,
} from '@/types/merge-world';
import { reconcileGardenGrowthMist } from '@/utils/merge-world/board-mist-progression';

const MOSSPROUT_WISP_IDS = new Set(['sprout', 'fern', 'bloom', 'grovelight', 'dewdrop']);

export function emptyMossproutBoardProgression(): MossproutBoardProgression {
  return {
    activeDayIds: [],
    chapter: 'quiet_patch',
    gates: {},
    lastParcelDayId: null,
    grovelightResonanceDayIds: [],
    signals: {
      activeJourneyDayIds: [], friendshipLevel: 1, natureMemoryDayIds: [], focusStage: 0,
      ownedWispIds: [], completedGardenDayIds: [],
    },
  };
}

export function normalizeMossproutBoardProgression(value: unknown): MossproutBoardProgression {
  const fallback = emptyMossproutBoardProgression();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<MossproutBoardProgression>;
  const gates: Record<string, MossproutRootGateState> = {};
  if (source.gates && typeof source.gates === 'object') {
    for (const [gateId, candidate] of Object.entries(source.gates)) {
      if (!MOSSPROUT_ROOTBOUND_GATES_BY_ID.has(gateId) || !candidate || typeof candidate !== 'object') continue;
      const gate = candidate as Partial<MossproutRootGateState>;
      const status = gate.status === 'ready' || gate.status === 'awakened' ? gate.status : 'sealed';
      gates[gateId] = {
        gateId, status,
        readyAt: typeof gate.readyAt === 'number' && Number.isFinite(gate.readyAt) ? gate.readyAt : null,
        awakenedAt: typeof gate.awakenedAt === 'number' && Number.isFinite(gate.awakenedAt) ? gate.awakenedAt : null,
        parcelId: typeof gate.parcelId === 'string' ? gate.parcelId : null,
        fallbackUsed: Boolean(gate.fallbackUsed),
      };
    }
  }
  const signals = normalizeSignals(source.signals);
  const activeDayIds = uniqueStrings(source.activeDayIds ?? signals.activeJourneyDayIds);
  return {
    activeDayIds,
    chapter: chapterForDay(activeDayIds.length),
    gates,
    lastParcelDayId: typeof source.lastParcelDayId === 'string' ? source.lastParcelDayId : null,
    grovelightResonanceDayIds: uniqueStrings(source.grovelightResonanceDayIds).slice(-12),
    signals,
  };
}

export function reconcileMossproutBoardProgression(
  state: MergeWorldState,
  signalsInput: MossproutProgressionSignals,
  dayId: string,
  now: number,
): MergeWorldState {
  if (!state.unlockedCharacters.includes('mossprout')) return state;
  const signals = normalizeSignals(signalsInput);
  const activeDayIds = uniqueStrings(signals.activeJourneyDayIds);
  let progression: MossproutBoardProgression = {
    ...state.mossproutBoardProgression,
    activeDayIds,
    chapter: chapterForDay(activeDayIds.length),
    signals,
    gates: { ...state.mossproutBoardProgression.gates },
  };
  let arrivals = state.arrivals;
  const queuedRootParcels = arrivals.filter((arrival) => arrival.kind === 'root_match_parcel' && arrival.claimedAt == null).length;
  const canQueueToday = progression.lastParcelDayId !== dayId && queuedRootParcels < 2;
  const eligible = MOSSPROUT_ROOTBOUND_GATES.filter((definition) => {
    const current = progression.gates[definition.id];
    if (current?.status === 'ready' || current?.status === 'awakened') return false;
    if (activeDayIds.length < definition.revealDay) return false;
    return primaryProgress(definition.kind, signals, activeDayIds.length) >= definition.target
      || fallbackSatisfied(definition.kind, definition.revealDay, definition.fallbackDelay, activeDayIds.length);
  });
  if (canQueueToday && eligible[0]) {
    const definition = eligible[0];
    const fallbackUsed = primaryProgress(definition.kind, signals, activeDayIds.length) < definition.target;
    const parcelId = `arrival:root-match:${definition.id}`;
    progression.gates[definition.id] = {
      gateId: definition.id, status: 'ready', readyAt: now, awakenedAt: null, parcelId, fallbackUsed,
    };
    progression = { ...progression, lastParcelDayId: dayId };
    if (!arrivals.some((arrival) => arrival.id === parcelId)) {
      const item = MERGE_ITEMS_BY_ID.get(definition.rootMemoryDefinitionId)!;
      const arrival: MergeWorldArrival = {
        id: parcelId,
        kind: 'root_match_parcel',
        createdAt: now,
        dayId,
        label: `${definition.title} Root Memory`,
        theme: 'memory',
        familyId: item.familyId,
        chainId: item.chainId,
        characterId: 'mossprout',
        source: 'companion_progression',
        progressionGateId: definition.id,
        itemDefinitionIds: [definition.rootMemoryDefinitionId],
        claimedAt: null,
        seenAt: null,
      };
      arrivals = [...arrivals, arrival];
    }
  }
  const board = installMossproutRootboundEchoes(state.board, progression);
  const progressed = board === state.board && arrivals === state.arrivals && progressionEquals(progression, state.mossproutBoardProgression)
    ? state
    : { ...state, board, arrivals, mossproutBoardProgression: progression };
  return reconcileGardenGrowthMist(progressed, activeDayIds.length, now);
}

export function installMossproutRootboundEchoes(board: MergeBoardCell[], progression: MossproutBoardProgression): MergeBoardCell[] {
  let next = board;
  for (const definition of MOSSPROUT_ROOTBOUND_GATES) {
    const gate = progression.gates[definition.id];
    if (gate?.status === 'awakened') continue;
    const cell = next[definition.cell];
    if (!cell?.locked || cell.occupant || cell.mist?.kind === 'dreambound_item' || cell.mist?.kind === 'discovery_fork') continue;
    const ready = gate?.status === 'ready';
    if (cell.mist?.kind === 'rootbound_echo' && cell.mist.gateId === definition.id && cell.mist.ready === ready) continue;
    if (next === board) next = [...board];
    next[definition.cell] = {
      ...cell,
      blocker: 'vines',
      mist: { kind: 'rootbound_echo', id: definition.id, gateId: definition.id, definitionId: definition.rootMemoryDefinitionId, chapter: definition.chapter, ready },
    };
  }
  return next;
}

export function awakenMossproutRoot(state: MergeWorldState, gateId: string, now: number): MergeWorldState {
  const current = state.mossproutBoardProgression.gates[gateId];
  const definition = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(gateId);
  if (!current || current.status !== 'ready' || !definition) return state;
  let next = {
    ...state,
    mossproutBoardProgression: {
      ...state.mossproutBoardProgression,
      gates: {
        ...state.mossproutBoardProgression.gates,
        [gateId]: { ...current, status: 'awakened' as const, awakenedAt: now },
      },
    },
  };
  for (const reward of definition.rewards) {
    if (reward.kind === 'generator_unlock') next = unlockMemoryNursery(next, now);
    if (reward.kind === 'generator_level') {
      const generator = next.generators[reward.generatorId];
      if (generator && generator.level < reward.level) {
        next = { ...next, generators: { ...next.generators, [reward.generatorId]: { ...generator, level: reward.level } } };
      }
    }
    if (reward.kind === 'merge_item' && MERGE_ITEMS_BY_ID.has(reward.definitionId)) {
      const cell = definition.cell;
      if (!next.board[cell].occupant) {
        const board = [...next.board];
        board[cell] = { ...board[cell], occupant: { kind: 'item', instanceId: `merge-item:${next.nextInstance}`, definitionId: reward.definitionId } };
        next = { ...next, board, nextInstance: next.nextInstance + 1 };
      }
    }
    if (reward.kind === 'wisp') {
      const receiptId = `merge-wisp:mossprout:${reward.wispId}`;
      if (!next.externalRewardReceipts.some((receipt) => receipt.id === receiptId)) {
        next = {
          ...next,
          externalRewardReceipts: [...next.externalRewardReceipts, {
            id: receiptId, kind: 'wisp' as const, characterId: 'mossprout' as const, amount: 1,
            wispId: reward.wispId, sourceId: gateId, createdAt: now, appliedAt: null,
          }],
        };
      }
    }
    if (reward.kind === 'memory_card') {
      const receiptId = `merge-memory-card:${gateId}`;
      if (!next.ownedMemoryCards.some((card) => card.sourceReceiptId === receiptId)) {
        const selected = selectMemoryCard(reward.poolId, reward.rarityFloor, receiptId, next.ownedMemoryCards);
        if (selected) next = {
          ...next,
          ownedMemoryCards: [...next.ownedMemoryCards, {
            cardId: selected.id, poolId: selected.poolId, rarity: selected.rarity,
            sourceReceiptId: receiptId, acquiredAt: now, revealedAt: null,
          }],
        };
      }
    }
    if (reward.kind === 'landmark' && !next.landmarks.some((landmark) => landmark.id === reward.landmarkId)) {
      next = {
        ...next,
        landmarks: [...next.landmarks, { id: reward.landmarkId, characterId: 'mossprout', chapterId: 'mossprout-heartwood', unlockedAt: now }],
      };
    }
  }
  return next;
}

export function useGrovelightResonance(state: MergeWorldState, gateId: string, dayId: string, now: number): MergeWorldState | null {
  const progression = state.mossproutBoardProgression;
  const gate = progression.gates[gateId];
  const definition = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(gateId);
  if (!gate || gate.status !== 'ready' || !definition || !progression.signals.ownedWispIds.includes('grovelight')) return null;
  if (state.arrivals.some((arrival) => arrival.progressionGateId === gateId && arrival.claimedAt == null)) return null;
  if (progression.grovelightResonanceDayIds.some((used) => activeDayDistance(progression.activeDayIds, used, dayId) < 7)) return null;
  const arrivalId = `arrival:grovelight:${gateId}:${dayId}`;
  if (state.arrivals.some((arrival) => arrival.id === arrivalId)) return null;
  const item = MERGE_ITEMS_BY_ID.get(definition.rootMemoryDefinitionId)!;
  return {
    ...state,
    arrivals: [...state.arrivals, {
      id: arrivalId, kind: 'root_match_parcel', createdAt: now, dayId,
      label: 'Grovelight Resonance', theme: 'nature', familyId: item.familyId, chainId: item.chainId,
      characterId: 'mossprout', source: 'companion_progression', progressionGateId: gateId,
      itemDefinitionIds: [definition.rootMemoryDefinitionId], claimedAt: null, seenAt: null,
    }],
    mossproutBoardProgression: {
      ...progression,
      grovelightResonanceDayIds: [...progression.grovelightResonanceDayIds, dayId].slice(-12),
    },
  };
}

/** Rewrites v15 cross-family parcels without deleting any ordinary item the player may already own. */
export function migrateMossproutRootParcels(state: MergeWorldState, rawVersion: unknown, now: number): MergeWorldState {
  if (!state.unlockedCharacters.includes('mossprout')) return state;
  const legacy = typeof rawVersion === 'number' && rawVersion <= 15;
  let arrivals = state.arrivals.map((arrival) => {
    if (arrival.kind !== 'root_match_parcel' || !arrival.progressionGateId) return arrival;
    const definition = MOSSPROUT_ROOTBOUND_GATES_BY_ID.get(arrival.progressionGateId);
    if (!definition) return arrival;
    const item = MERGE_ITEMS_BY_ID.get(definition.rootMemoryDefinitionId)!;
    return {
      ...arrival,
      label: arrival.source === 'companion_progression' ? `${definition.title} Root Memory` : arrival.label,
      theme: 'memory' as const,
      familyId: item.familyId,
      chainId: item.chainId,
      itemDefinitionIds: [definition.rootMemoryDefinitionId],
    };
  });
  let progression = state.mossproutBoardProgression;
  if (legacy) {
    for (const definition of MOSSPROUT_ROOTBOUND_GATES) {
      const gate = progression.gates[definition.id];
      if (gate?.status !== 'ready') continue;
      const hasUnclaimed = arrivals.some((arrival) => arrival.progressionGateId === definition.id && arrival.claimedAt == null);
      if (hasUnclaimed) continue;
      const item = MERGE_ITEMS_BY_ID.get(definition.rootMemoryDefinitionId)!;
      const id = `arrival:root-memory-reissue:${definition.id}:v16`;
      arrivals = [...arrivals, {
        id, kind: 'root_match_parcel', createdAt: now, dayId: gate.readyAt ? `migration-${gate.readyAt}` : 'migration-v16',
        label: `${definition.title} Root Memory`, theme: 'memory', familyId: item.familyId, chainId: item.chainId,
        characterId: 'mossprout', source: 'companion_progression', progressionGateId: definition.id,
        itemDefinitionIds: [definition.rootMemoryDefinitionId], claimedAt: null, seenAt: null,
      }];
      progression = {
        ...progression,
        gates: { ...progression.gates, [definition.id]: { ...gate, parcelId: id } },
      };
    }
  }
  return arrivals === state.arrivals && progression === state.mossproutBoardProgression ? state : { ...state, arrivals, mossproutBoardProgression: progression };
}

function unlockMemoryNursery(state: MergeWorldState, now: number): MergeWorldState {
  if (state.generators['memory-nursery']) return state;
  const preferred = 45;
  const cell = state.board[preferred]?.occupant == null && !state.board[preferred]?.locked && !state.board[preferred]?.mist
    ? preferred
    : state.board.findIndex((candidate) => !candidate.locked && !candidate.mist && !candidate.occupant);
  if (cell < 0) return state;
  const board = [...state.board];
  board[cell] = { ...board[cell], occupant: { kind: 'generator', generatorId: 'memory-nursery' } };
  return {
    ...state,
    board,
    generators: {
      ...state.generators,
      'memory-nursery': {
        id: 'memory-nursery', name: 'Memory Nursery', level: 1, upgradeFragments: 0,
        chainIds: ['nature:keepsake', 'nature:keepsake'],
        tierOneDropDefinitionIds: ['nature:keepsake:1', 'nature:keepsake:1'], forcedDropDefinitionId: null,
        capacity: 10, charges: 10, restDurationMs: 24 * 60_000, restStartedAt: null,
      },
    },
    unlockedChains: [...new Set([...state.unlockedChains, 'nature:keepsake' as const])],
    generatorUnlockReceipts: state.generatorUnlockReceipts.some((receipt) => receipt.id === 'generator-unlock:memory-nursery')
      ? state.generatorUnlockReceipts
      : [...state.generatorUnlockReceipts, { id: 'generator-unlock:memory-nursery', generatorId: 'memory-nursery', createdAt: now, seenAt: null }],
  };
}

function primaryProgress(kind: string, signals: MossproutProgressionSignals, activeDays: number) {
  if (kind === 'journey_day' || kind === 'mastery') return activeDays;
  if (kind === 'friendship') return signals.friendshipLevel;
  if (kind === 'memory') return signals.natureMemoryDayIds.length;
  if (kind === 'focus') return signals.focusStage;
  if (kind === 'wisp') return signals.ownedWispIds.filter((id) => MOSSPROUT_WISP_IDS.has(id)).length;
  return 0;
}

function fallbackSatisfied(kind: string, revealDay: number, delay: number, activeDays: number) {
  // Privacy- or consent-sensitive inputs may resolve through additional days
  // together. Bond, story-day and mastery locks never yield to Merge play.
  if (kind !== 'memory' && kind !== 'focus' && kind !== 'wisp') return false;
  return activeDays >= revealDay + delay;
}

function chapterForDay(day: number): MossproutBoardChapter {
  if (day >= 22) return 'heartwood';
  if (day >= 15) return 'memory_nursery';
  if (day >= 8) return 'returning_pond';
  return 'quiet_patch';
}

function normalizeSignals(value: unknown): MossproutProgressionSignals {
  const source = value && typeof value === 'object' ? value as Partial<MossproutProgressionSignals> : {};
  return {
    activeJourneyDayIds: uniqueStrings(source.activeJourneyDayIds),
    friendshipLevel: Math.max(1, Math.min(20, Math.floor(Number(source.friendshipLevel) || 1))),
    natureMemoryDayIds: uniqueStrings(source.natureMemoryDayIds),
    focusStage: Math.max(0, Math.min(4, Math.floor(Number(source.focusStage) || 0))),
    ownedWispIds: uniqueStrings(source.ownedWispIds) as MossproutProgressionSignals['ownedWispIds'],
    completedGardenDayIds: uniqueStrings(source.completedGardenDayIds),
  };
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}

function activeDayDistance(ids: string[], from: string, to: string) {
  const fromIndex = ids.indexOf(from);
  const toIndex = ids.indexOf(to);
  return fromIndex < 0 || toIndex < 0 ? Number.POSITIVE_INFINITY : Math.abs(toIndex - fromIndex);
}

function progressionEquals(left: MossproutBoardProgression, right: MossproutBoardProgression) {
  return JSON.stringify(left) === JSON.stringify(right);
}
