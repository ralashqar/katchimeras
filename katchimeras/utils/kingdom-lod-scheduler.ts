import { KINGDOM_RENDERING } from '@/constants/kingdom-rendering';
import type { KingdomHexTileLod } from '@/utils/world-visuals';

export type KingdomLodSchedulerState = {
  active: Record<string, KingdomHexTileLod>;
  desired: Record<string, KingdomHexTileLod>;
  loading: Record<string, KingdomHexTileLod>;
  paused: boolean;
  priority: string[];
};

export type KingdomLodSchedulerAction =
  | {
      type: 'sync';
      desired: Record<string, KingdomHexTileLod>;
      paused: boolean;
      priority: string[];
    }
  | { type: 'loaded'; id: string; lod: KingdomHexTileLod };

export const EMPTY_KINGDOM_LOD_SCHEDULER: KingdomLodSchedulerState = {
  active: {},
  desired: {},
  loading: {},
  paused: false,
  priority: [],
};

function promote(state: KingdomLodSchedulerState): KingdomLodSchedulerState {
  if (state.paused) return state;
  let available = KINGDOM_RENDERING.maxConcurrentLodLoads - Object.keys(state.loading).length;
  if (available <= 0) return state;

  let active = state.active;
  let loading = state.loading;
  for (const id of state.priority) {
    const desired = state.desired[id];
    if (!desired || loading[id] || (active[id] ?? 'thumb') === desired) continue;
    if (active === state.active) active = { ...state.active };
    if (loading === state.loading) loading = { ...state.loading };
    active[id] = desired;
    loading[id] = desired;
    available -= 1;
    if (available === 0) break;
  }
  return active === state.active && loading === state.loading ? state : { ...state, active, loading };
}

export function kingdomLodSchedulerReducer(
  state: KingdomLodSchedulerState,
  action: KingdomLodSchedulerAction
): KingdomLodSchedulerState {
  if (action.type === 'sync') {
    const ids = new Set(Object.keys(action.desired));
    const active = Object.fromEntries(Object.entries(state.active).filter(([id]) => ids.has(id)));
    const loading = Object.fromEntries(Object.entries(state.loading).filter(([id]) => ids.has(id)));
    return promote({
      active,
      desired: action.desired,
      loading,
      paused: action.paused,
      priority: action.priority,
    });
  }

  if (state.loading[action.id] !== action.lod) return state;
  const loading = { ...state.loading };
  delete loading[action.id];
  return promote({ ...state, loading });
}

export function activeKingdomTileLod(state: KingdomLodSchedulerState, id: string): KingdomHexTileLod {
  return state.active[id] ?? 'thumb';
}
