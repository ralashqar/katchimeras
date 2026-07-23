import type { EggVisualState, HomeDayRecord, StoredHomeDayRecord } from '@/types/home';

export type TodayHatchPhase =
  | 'idle'
  | 'preparing'
  | 'cracking'
  | 'revealing'
  | 'world_shift'
  | 'settling'
  | 'tomorrow_arrival';

export type TodayHatchPresentation = {
  committedDay: StoredHomeDayRecord | null;
  dayId: string | null;
  daySnapshot: HomeDayRecord | null;
  egg: EggVisualState | null;
  error: string | null;
  phase: TodayHatchPhase;
};

export type TodayHatchAction =
  | { type: 'begin'; day: HomeDayRecord }
  | { type: 'committed'; day: StoredHomeDayRecord }
  | { type: 'advance'; phase: Exclude<TodayHatchPhase, 'idle' | 'preparing'> }
  | { type: 'failed'; reason: string }
  | { type: 'reset' };

export const IDLE_TODAY_HATCH_PRESENTATION: TodayHatchPresentation = {
  committedDay: null,
  dayId: null,
  daySnapshot: null,
  egg: null,
  error: null,
  phase: 'idle',
};

const PHASE_ORDER: Record<TodayHatchPhase, number> = {
  idle: 0,
  preparing: 1,
  cracking: 2,
  revealing: 3,
  world_shift: 4,
  settling: 5,
  tomorrow_arrival: 6,
};

export function todayHatchPresentationReducer(
  state: TodayHatchPresentation,
  action: TodayHatchAction,
): TodayHatchPresentation {
  switch (action.type) {
    case 'begin':
      return {
        committedDay: null,
        dayId: action.day.id,
        daySnapshot: action.day,
        egg: action.day.egg,
        error: null,
        phase: 'preparing',
      };
    case 'committed':
      if (state.phase === 'idle' || state.dayId !== action.day.id) return state;
      return { ...state, committedDay: action.day, phase: 'cracking' };
    case 'advance':
      if (state.phase === 'idle' || PHASE_ORDER[action.phase] <= PHASE_ORDER[state.phase]) return state;
      return { ...state, phase: action.phase };
    case 'failed':
      return { ...IDLE_TODAY_HATCH_PRESENTATION, error: action.reason };
    case 'reset':
      return IDLE_TODAY_HATCH_PRESENTATION;
  }
}

export function todayHatchShowsResident(phase: TodayHatchPhase): boolean {
  return PHASE_ORDER[phase] >= PHASE_ORDER.settling;
}

export function todayHatchShowsTomorrow(phase: TodayHatchPhase): boolean {
  return PHASE_ORDER[phase] >= PHASE_ORDER.tomorrow_arrival;
}
