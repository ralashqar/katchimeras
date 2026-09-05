import type { KatchaSheetCloseReason } from '@/components/katchadeck/ui/katcha-sheet';
import type { MemoryVaultTab } from '@/components/katchadeck/world/memory-vault-sheet';

export type TodaySurfaceState =
  | { kind: 'memory-vault'; tab: MemoryVaultTab }
  | { kind: 'food-picker' }
  | { kind: 'food-vault' }
  | { kind: 'studio-picker' }
  | { kind: 'studio-vault' }
  | { kind: 'sanctuary' }
  | { kind: 'mood' }
  | { kind: 'sleep' }
  | { kind: 'quest-board' }
  | { kind: 'big-moment-picker' }
  | { kind: 'place-prompt' }
  | { kind: 'places-vault' }
  | { kind: 'steps' }
  | { kind: 'journey' }
  | { kind: 'name' };

export type TodaySurfaceKind = TodaySurfaceState['kind'];

export type TodaySurfaceControllerState = {
  active: TodaySurfaceState | null;
  lastCloseReason: KatchaSheetCloseReason | 'completed' | 'replaced' | null;
};

export type TodaySurfaceAction =
  | { type: 'open'; surface: TodaySurfaceState }
  | { type: 'replace'; surface: TodaySurfaceState }
  | { type: 'close'; reason: TodaySurfaceControllerState['lastCloseReason'] }
  | { type: 'set-memory-tab'; tab: MemoryVaultTab };

export const initialTodaySurfaceState: TodaySurfaceControllerState = {
  active: null,
  lastCloseReason: null,
};

export function todaySurfaceReducer(
  state: TodaySurfaceControllerState,
  action: TodaySurfaceAction
): TodaySurfaceControllerState {
  switch (action.type) {
    case 'open':
      return { active: action.surface, lastCloseReason: state.active ? 'replaced' : null };
    case 'replace':
      return { active: action.surface, lastCloseReason: state.active ? 'replaced' : null };
    case 'close':
      return { active: null, lastCloseReason: action.reason };
    case 'set-memory-tab':
      return state.active?.kind === 'memory-vault'
        ? { ...state, active: { ...state.active, tab: action.tab } }
        : state;
  }
}

export function isTodaySurfaceActive(state: TodaySurfaceState | null, kind: TodaySurfaceKind) {
  return state?.kind === kind;
}

export function canPresentTodayFollowUp(active: TodaySurfaceState | null) {
  return active === null;
}
