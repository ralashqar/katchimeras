import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';

export type KingdomTilePhase = 'queued' | 'loading' | 'visible' | 'exiting' | 'failed';

export type KingdomTileRuntime = {
  failed: boolean;
  id: string;
  loadStarted: boolean;
  loaded: boolean;
  phase: KingdomTilePhase;
};

export type KingdomTileSchedulerState = {
  entries: Record<string, KingdomTileRuntime>;
  paused: boolean;
  priority: string[];
};

export type KingdomTileSchedulerAction =
  | { type: 'sync'; paused: boolean; preloadIds: string[]; priority: string[] }
  | { type: 'loaded'; id: string }
  | { type: 'failed'; id: string }
  | { type: 'exited'; id: string };

export const EMPTY_KINGDOM_TILE_SCHEDULER: KingdomTileSchedulerState = {
  entries: {},
  paused: false,
  priority: [],
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function promoteQueued(entries: Record<string, KingdomTileRuntime>, priority: string[], paused: boolean) {
  if (paused) return entries;
  let activeLoads = Object.values(entries).filter((entry) => entry.loadStarted && !entry.loaded).length;
  if (activeLoads >= KINGDOM_RENDERING.maxConcurrentTileLoads) return entries;

  let next = entries;
  for (const id of priority) {
    const entry = next[id];
    if (!entry || entry.phase !== 'queued' || entry.loadStarted) continue;
    if (next === entries) next = { ...entries };
    next[id] = { ...entry, loadStarted: true, phase: 'loading' };
    activeLoads += 1;
    if (activeLoads >= KINGDOM_RENDERING.maxConcurrentTileLoads) break;
  }
  return next;
}

export function kingdomTileSchedulerReducer(
  state: KingdomTileSchedulerState,
  action: KingdomTileSchedulerAction
): KingdomTileSchedulerState {
  if (action.type === 'sync') {
    const preload = new Set(action.preloadIds);
    let entries = state.entries;

    for (const [id, entry] of Object.entries(state.entries)) {
      const shouldRetain = preload.has(id);
      if (!shouldRetain && entry.phase !== 'exiting') {
        if (entries === state.entries) entries = { ...state.entries };
        entries[id] = { ...entry, phase: 'exiting' };
      } else if (shouldRetain && entry.phase === 'exiting') {
        if (entries === state.entries) entries = { ...state.entries };
        entries[id] = {
          ...entry,
          phase: entry.loaded ? (entry.failed ? 'failed' : 'visible') : entry.loadStarted ? 'loading' : 'queued',
        };
      }
    }

    for (const id of action.preloadIds) {
      if (entries[id]) continue;
      if (entries === state.entries) entries = { ...state.entries };
      entries[id] = { failed: false, id, loaded: false, loadStarted: false, phase: 'queued' };
    }

    entries = promoteQueued(entries, action.priority, action.paused);
    if (entries === state.entries && state.paused === action.paused && arraysEqual(state.priority, action.priority)) return state;
    return { entries, paused: action.paused, priority: action.priority };
  }

  const current = state.entries[action.id];
  if (!current) return state;

  if (action.type === 'exited') {
    const entries = { ...state.entries };
    delete entries[action.id];
    return { ...state, entries: promoteQueued(entries, state.priority, state.paused) };
  }

  if (current.loaded) return state;
  const entries = {
    ...state.entries,
    [action.id]: {
      ...current,
      failed: action.type === 'failed',
      loaded: true,
      phase:
        current.phase === 'exiting'
          ? 'exiting'
          : action.type === 'failed'
            ? 'failed'
            : 'visible',
    } satisfies KingdomTileRuntime,
  };
  return { ...state, entries: promoteQueued(entries, state.priority, state.paused) };
}
