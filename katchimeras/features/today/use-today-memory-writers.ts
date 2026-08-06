import { useCallback } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import type {
  addFoodMomentForToday,
  addStudioMomentForToday,
  markBigMomentForToday,
  setSleepForToday,
  setStepsInterpretationForToday,
} from '@/game/days/actions';
import type { MoodMonumentChoiceId } from '@/components/katchadeck/world/mood-monument-sheet';
import type { DayInputTarget } from '@/types/home';
import { resolveFoodMomentDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';
import { TODAY_GROWTH_REWARDS } from '@/utils/today-growth';

type AddFoodInput = Parameters<typeof addFoodMomentForToday>[1];
type AddStudioInput = Parameters<typeof addStudioMomentForToday>[1];
type BigMomentInput = Parameters<typeof markBigMomentForToday>[1];
type SleepInput = Parameters<typeof setSleepForToday>[1];
type StepsInput = Parameters<typeof setStepsInterpretationForToday>[1];

type UseTodayMemoryWritersParams = {
  formingTarget: DayInputTarget;
  addFoodMoment: (input: AddFoodInput, target?: DayInputTarget) => void;
  addStudioMoment: (input: AddStudioInput, target?: DayInputTarget) => void;
  markBigMoment: (input: BigMomentInput, target?: DayInputTarget) => void;
  setSleep: (sleep: SleepInput, target?: DayInputTarget) => void;
  setStepsInterpretation: (input: StepsInput, target?: DayInputTarget) => void;
  answerDayPrompt: (input: { kind: 'feeling'; choiceIds: MoodMonumentChoiceId[] }, target?: DayInputTarget) => void;
  setFoodPickerOpen: (open: boolean) => void;
  setStudioPickerOpen: (open: boolean) => void;
  setBigMomentPickerOpen: (open: boolean) => void;
  setMoodSheetOpen: (open: boolean) => void;
  setSleepSheetOpen: (open: boolean) => void;
  setStepsSheetOpen: (open: boolean) => void;
  startEggFeed: (from: FeedSourceRect, payload: { currencyFrom?: FeedSourceRect; energyAmount?: number; imageSource?: number; label?: string; photoUri?: string; tint?: string }, commit: () => void) => void;
  pulseEgg: () => void;
  setMicrocopy: (message: string | null) => void;
};

export function useTodayMemoryWriters({
  formingTarget,
  addFoodMoment,
  addStudioMoment,
  markBigMoment,
  setSleep,
  setStepsInterpretation,
  answerDayPrompt,
  setFoodPickerOpen,
  setStudioPickerOpen,
  setBigMomentPickerOpen,
  setMoodSheetOpen,
  setSleepSheetOpen,
  setStepsSheetOpen,
  startEggFeed,
  pulseEgg,
  setMicrocopy,
}: UseTodayMemoryWritersParams) {
  const handleAddFood = useCallback(
    (input: AddFoodInput) => {
      const display = resolveFoodMomentDisplay(input);
      addFoodMoment(input, formingTarget);
      setFoodPickerOpen(false);
      pulseEgg();
      setMicrocopy(`${display.emoji} ${display.label} - saved`);
    },
    [addFoodMoment, formingTarget, pulseEgg, setFoodPickerOpen, setMicrocopy]
  );

  const handleAddStudio = useCallback(
    (input: AddStudioInput) => {
      const display = resolveStudioMomentDisplay(input);
      addStudioMoment(input, formingTarget);
      setStudioPickerOpen(false);
      pulseEgg();
      setMicrocopy(`${display.emoji} ${display.label} - kept`);
    },
    [addStudioMoment, formingTarget, pulseEgg, setMicrocopy, setStudioPickerOpen]
  );

  const handlePickBigMoment = useCallback(
    (type: BigMomentInput['type']) => {
      markBigMoment({ type }, formingTarget);
      setBigMomentPickerOpen(false);
      pulseEgg();
      setMicrocopy('A big moment, marked');
    },
    [formingTarget, markBigMoment, pulseEgg, setBigMomentPickerOpen, setMicrocopy]
  );

  const handleConfirmMood = useCallback(
    (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect, imageSource?: number, tint?: string, currencyFrom?: FeedSourceRect) => {
      setMoodSheetOpen(false);
      startEggFeed(from, { currencyFrom, energyAmount: TODAY_GROWTH_REWARDS.mood, imageSource, label, tint }, () => {
        answerDayPrompt({ kind: 'feeling', choiceIds: [choiceId] }, formingTarget);
        setMicrocopy(`Mood noted: ${label}`);
      });
    },
    [answerDayPrompt, formingTarget, setMicrocopy, setMoodSheetOpen, startEggFeed]
  );

  const handleSetSleep = useCallback(
    (quality: SleepInput['quality'], label: string, from: FeedSourceRect, imageSource?: number, tint?: string, currencyFrom?: FeedSourceRect) => {
      setSleepSheetOpen(false);
      startEggFeed(from, { currencyFrom, energyAmount: TODAY_GROWTH_REWARDS.sleep, imageSource, label, tint }, () => {
        setSleep({ quality, source: 'manual' }, formingTarget);
        setMicrocopy('Your morning, remembered');
      });
    },
    [formingTarget, setMicrocopy, setSleep, setSleepSheetOpen, startEggFeed]
  );

  const handleConfirmSteps = useCallback(
    (input: StepsInput) => {
      setStepsInterpretation(input, formingTarget);
      setStepsSheetOpen(false);
      pulseEgg();
      setMicrocopy(`${input.emoji} ${input.label} - noted`);
    },
    [formingTarget, pulseEgg, setMicrocopy, setStepsInterpretation, setStepsSheetOpen]
  );

  return {
    handleAddFood,
    handleAddStudio,
    handlePickBigMoment,
    handleConfirmMood,
    handleSetSleep,
    handleConfirmSteps,
  };
}
