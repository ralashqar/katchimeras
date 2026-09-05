import type { EggVisualState, HomeDayRecord, LocalCreatureRecord, StoredHomeDayRecord } from '@/types/home';

export type HatchPresentationPolicy = 'daily' | 'ftue_discovery';

export type TodayHatchPhase =
  | 'idle'
  | 'preparing'
  | 'shaking'
  | 'cracking'
  | 'crossfading_subject'
  | 'subject_settling'
  | 'forming_card'
  | 'assembling_deck'
  | 'awaiting_claim'
  | 'claiming'
  | 'new_day_intro'
  | 'restoring_today'
  | 'awaiting_interaction'
  | 'world_shift'
  | 'dashboard_settling'
  | 'complete';

export type TodayHatchPresentation = {
  animationKey: number;
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
  | { type: 'begin'; animationKey: number; day: HomeDayRecord }
  | { type: 'begin_discovery'; animationKey: number; day: HomeDayRecord; creature: LocalCreatureRecord }
  | { type: 'restore_discovery'; animationKey: number; day: HomeDayRecord; creature: LocalCreatureRecord }
  | { type: 'restore_daily'; animationKey: number; day: HomeDayRecord }
  | { type: 'committed'; day: StoredHomeDayRecord }
  | { type: 'advance'; phase: Exclude<TodayHatchPhase, 'idle' | 'preparing'> }
  | { type: 'failed'; reason: string }
  | { type: 'reset' };

export const IDLE_TODAY_HATCH_PRESENTATION: TodayHatchPresentation = {
  animationKey: 0,
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
  forming_card: 6,
  assembling_deck: 7,
  awaiting_claim: 8,
  claiming: 9,
  new_day_intro: 10,
  restoring_today: 11,
  awaiting_interaction: 12,
  world_shift: 13,
  dashboard_settling: 14,
  complete: 15,
};

export function todayHatchPresentationReducer(
  state: TodayHatchPresentation,
  action: TodayHatchAction,
): TodayHatchPresentation {
  switch (action.type) {
    case 'begin':
      return {
        animationKey: action.animationKey,
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
        animationKey: action.animationKey,
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
        animationKey: action.animationKey,
        committedDay: null,
        dayId: action.day.id,
        daySnapshot: action.day,
        egg: action.day.egg,
        creatureOverride: action.creature,
        error: null,
        phase: 'awaiting_interaction',
        policy: 'ftue_discovery',
      };
    case 'restore_daily':
      return {
        animationKey: action.animationKey,
        committedDay: action.day,
        dayId: action.day.id,
        daySnapshot: action.day,
        egg: action.day.egg,
        creatureOverride: null,
        error: null,
        phase: 'awaiting_claim',
        policy: 'daily',
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

export function todayDailyHatchActive(presentation: TodayHatchPresentation): boolean {
  return presentation.phase !== 'idle'
    && presentation.policy === 'daily'
    && presentation.phase !== 'new_day_intro'
    && presentation.phase !== 'restoring_today';
}

export function todayHatchRunsInPlace(presentation: TodayHatchPresentation): boolean {
  return presentation.phase !== 'idle' && presentation.policy === 'ftue_discovery';
}

export function todayHatchCreature(presentation: TodayHatchPresentation) {
  return presentation.creatureOverride ?? presentation.committedDay?.creature ?? null;
}
