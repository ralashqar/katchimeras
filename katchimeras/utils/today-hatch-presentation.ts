import type { EggVisualState, HomeDayRecord, LocalCreatureRecord, StoredHomeDayRecord } from '@/types/home';

export type HatchPresentationPolicy = 'daily' | 'ftue_discovery';

export type TodayHatchPhase =
  | 'idle'
  | 'preparing'
  | 'shaking'
  | 'cracking'
  | 'crossfading_subject'
  | 'subject_settling'
  | 'awaiting_interaction'
  | 'world_shift'
  | 'dashboard_settling'
  | 'complete';

export type TodayHatchPresentation = {
  committedDay: StoredHomeDayRecord | null;
  dayId: string | null;
  daySnapshot: HomeDayRecord | null;
  egg: EggVisualState | null;
  creatureOverride: LocalCreatureRecord | null;
  error: string | null;
  phase: TodayHatchPhase;
  policy: HatchPresentationPolicy;
};

export type TodayHatchAction =
  | { type: 'begin'; day: HomeDayRecord }
  | { type: 'begin_discovery'; day: HomeDayRecord; creature: LocalCreatureRecord }
  | { type: 'restore_discovery'; day: HomeDayRecord; creature: LocalCreatureRecord }
  | { type: 'committed'; day: StoredHomeDayRecord }
  | { type: 'advance'; phase: Exclude<TodayHatchPhase, 'idle' | 'preparing'> }
  | { type: 'failed'; reason: string }
  | { type: 'reset' };

export const IDLE_TODAY_HATCH_PRESENTATION: TodayHatchPresentation = {
  committedDay: null,
  dayId: null,
  daySnapshot: null,
  egg: null,
  creatureOverride: null,
  error: null,
  phase: 'idle',
  policy: 'daily',
};

const PHASE_ORDER: Record<TodayHatchPhase, number> = {
  idle: 0,
  preparing: 1,
  shaking: 2,
  cracking: 3,
  crossfading_subject: 4,
  subject_settling: 5,
  awaiting_interaction: 6,
  world_shift: 7,
  dashboard_settling: 8,
  complete: 9,
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
        creatureOverride: null,
        error: null,
        phase: 'preparing',
        policy: 'daily',
      };
    case 'begin_discovery':
      return {
        committedDay: null,
        dayId: action.day.id,
        daySnapshot: action.day,
        egg: action.day.egg,
        creatureOverride: action.creature,
        error: null,
        phase: 'preparing',
        policy: 'ftue_discovery',
      };
    case 'restore_discovery':
      return {
        committedDay: null,
        dayId: action.day.id,
        daySnapshot: action.day,
        egg: action.day.egg,
        creatureOverride: action.creature,
        error: null,
        phase: 'awaiting_interaction',
        policy: 'ftue_discovery',
      };
    case 'committed':
      if (state.phase === 'idle' || state.dayId !== action.day.id) return state;
      return { ...state, committedDay: action.day, phase: 'shaking' };
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
  return PHASE_ORDER[phase] >= PHASE_ORDER.subject_settling;
}

export function todayHatchShowsTomorrow(phase: TodayHatchPhase): boolean {
  return PHASE_ORDER[phase] >= PHASE_ORDER.complete;
}

export function todayHatchShowsWorldShift(presentation: TodayHatchPresentation): boolean {
  return presentation.policy === 'daily' && PHASE_ORDER[presentation.phase] >= PHASE_ORDER.world_shift;
}

export function todayHatchShowsDashboard(presentation: TodayHatchPresentation): boolean {
  return presentation.policy === 'daily' && PHASE_ORDER[presentation.phase] >= PHASE_ORDER.dashboard_settling;
}

export function todayHatchOwnsSurface(presentation: TodayHatchPresentation): boolean {
  return presentation.phase !== 'idle' && presentation.policy === 'daily';
}

export function todayHatchRunsInPlace(presentation: TodayHatchPresentation): boolean {
  return presentation.phase !== 'idle' && presentation.policy === 'ftue_discovery';
}

export function todayHatchCreature(presentation: TodayHatchPresentation) {
  return presentation.creatureOverride ?? presentation.committedDay?.creature ?? null;
}
