import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { DayInputTarget, HomeDayRecord, HomeTimelineDay } from '@/types/home';

export type HomeLoopMode =
  | 'forming-today'
  | 'forming-tomorrow'
  | 'hatching'
  | 'hatched-today'
  | 'historical'
  | 'locked-tomorrow';

export type HomeFormingContext = {
  activePrompt: ActiveDayPrompt | null;
  day: HomeDayRecord;
  isTomorrow: boolean;
  prompts: ActiveDayPrompt[];
  target: DayInputTarget;
};

export function resolveHomeLoopPresentation(input: {
  activeDayPrompt: ActiveDayPrompt | null;
  availableDayPrompts: ActiveDayPrompt[];
  isHatching: boolean;
  isTodayHatched: boolean;
  selectedDay: HomeTimelineDay | null;
  tomorrowActivePrompt: ActiveDayPrompt | null;
  tomorrowAvailablePrompts: ActiveDayPrompt[];
  tomorrowDay: HomeDayRecord;
}): { forming: HomeFormingContext | null; mode: HomeLoopMode } {
  if (input.isHatching) return { forming: null, mode: 'hatching' };

  const selected = input.selectedDay;
  if (selected?.kind === 'day' && selected.isToday) {
    if (selected.state === 'hatched') return { forming: null, mode: 'hatched-today' };
    return {
      forming: {
        activePrompt: input.activeDayPrompt,
        day: selected,
        isTomorrow: false,
        prompts: input.availableDayPrompts,
        target: 'today',
      },
      mode: 'forming-today',
    };
  }

  if (selected?.kind === 'tomorrow') {
    if (!input.isTodayHatched) return { forming: null, mode: 'locked-tomorrow' };
    return {
      forming: {
        activePrompt: input.tomorrowActivePrompt,
        day: input.tomorrowDay,
        isTomorrow: true,
        prompts: input.tomorrowAvailablePrompts,
        target: 'tomorrow',
      },
      mode: 'forming-tomorrow',
    };
  }

  return { forming: null, mode: 'historical' };
}

