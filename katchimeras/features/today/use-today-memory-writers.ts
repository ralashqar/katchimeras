import { useCallback, useMemo } from 'react';

import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import type {
  addFoodMomentForToday,
  addStudioMomentForToday,
  markBigMomentForToday,
  setSleepForToday,
  setStepsInterpretationForToday,
} from '@/game/days/actions';
import type { MoodMonumentChoiceId } from '@/components/katchadeck/world/mood-monument-sheet';
import type { DayInputTarget, HomeDayRecord } from '@/types/home';
import { detectFoodInVision } from '@/utils/food-detect';
import { detectStudioInVision } from '@/utils/studio-detect';

type AddFoodInput = Parameters<typeof addFoodMomentForToday>[1];
type AddStudioInput = Parameters<typeof addStudioMomentForToday>[1];
type BigMomentInput = Parameters<typeof markBigMomentForToday>[1];
type SleepInput = Parameters<typeof setSleepForToday>[1];
type StepsInput = Parameters<typeof setStepsInterpretationForToday>[1];

type UseTodayMemoryWritersParams = {
  formingDay: HomeDayRecord | null;
  formingTarget: DayInputTarget;
  isFormingToday: boolean;
  todayHasMood: boolean;
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
  startEggFeed: (from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) => void;
  pulseEgg: () => void;
  setMicrocopy: (message: string | null) => void;
};

export function useTodayMemoryWriters({
  formingDay,
  formingTarget,
  isFormingToday,
  todayHasMood,
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
  const foodSuggestion = useMemo(() => {
    const detection = detectFoodInVision(formingDay?.vision);
    return detection.label && detection.emoji ? { label: detection.label, emoji: detection.emoji } : null;
  }, [formingDay]);

  const studioSuggestion = useMemo(() => {
    const detection = detectStudioInVision(formingDay?.vision);
    return detection.detected && detection.mediaType && detection.label && detection.emoji
      ? { mediaType: detection.mediaType, label: detection.label, emoji: detection.emoji }
      : null;
  }, [formingDay]);

  const handleAddFood = useCallback(
    (input: AddFoodInput) => {
      addFoodMoment(input, formingTarget);
      setFoodPickerOpen(false);
      pulseEgg();
      setMicrocopy(`${input.emoji} ${input.label} - saved`);
    },
    [addFoodMoment, formingTarget, pulseEgg, setFoodPickerOpen, setMicrocopy]
  );

  const handleAddStudio = useCallback(
    (input: AddStudioInput) => {
      addStudioMoment(input, formingTarget);
      setStudioPickerOpen(false);
      pulseEgg();
      setMicrocopy(`${input.emoji} ${input.label} - kept`);
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
    (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect) => {
      setMoodSheetOpen(false);
      startEggFeed(from, { label }, () => {
        answerDayPrompt({ kind: 'feeling', choiceIds: [choiceId] }, formingTarget);
        setMicrocopy(`Mood noted: ${label}`);
      });
    },
    [answerDayPrompt, formingTarget, setMicrocopy, setMoodSheetOpen, startEggFeed]
  );

  const handleSetSleep = useCallback(
    (quality: SleepInput['quality'], label: string, from: FeedSourceRect) => {
      setSleepSheetOpen(false);
      startEggFeed(from, { label }, () => {
        setSleep({ quality, source: 'manual' }, formingTarget);
        setMicrocopy('Your morning, remembered');
        if (isFormingToday && !todayHasMood) setMoodSheetOpen(true);
      });
    },
    [formingTarget, isFormingToday, setMicrocopy, setMoodSheetOpen, setSleep, setSleepSheetOpen, startEggFeed, todayHasMood]
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
    foodSuggestion,
    studioSuggestion,
    handleAddFood,
    handleAddStudio,
    handlePickBigMoment,
    handleConfirmMood,
    handleSetSleep,
    handleConfirmSteps,
  };
}
