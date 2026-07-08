import { useMemo } from 'react';

import { deriveTodayCategories } from '@/utils/today-categories';
import { selectMemoryQuests } from '@/utils/memory-quests-engine';
import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { HomeDayRecord } from '@/types/home';

type UseTodayCategoryModelParams = {
  allDays: HomeDayRecord[];
  formingDay: HomeDayRecord | null;
  viewedDay: HomeDayRecord | null;
  viewedIsForming: boolean;
  formingPrompts: ActiveDayPrompt[];
  handledPhotoSig: string | null;
};

export function useTodayCategoryModel({
  allDays,
  formingDay,
  viewedDay,
  viewedIsForming,
  formingPrompts,
  handledPhotoSig,
}: UseTodayCategoryModelParams) {
  const recentAvgSteps = useMemo(() => {
    const withSteps = allDays.filter((day) => day.state === 'hatched' && (day.stepsCount ?? 0) > 0);
    if (withSteps.length === 0) return null;
    const recent = withSteps.slice(-7);
    return Math.round(recent.reduce((sum, day) => sum + (day.stepsCount ?? 0), 0) / recent.length);
  }, [allDays]);

  const memoryQuests = useMemo(
    () => (formingDay ? selectMemoryQuests(formingDay, new Date(), 3, []) : []),
    [formingDay]
  );

  const categories = useMemo(() => {
    if (!viewedDay) return [];
    const derived = deriveTodayCategories(viewedDay, {
      prompts: viewedIsForming ? formingPrompts : [],
      quests: viewedIsForming ? memoryQuests : [],
      recentAvgSteps,
      handledPhotoSig,
    });
    if (viewedIsForming) return derived;
    return derived
      .filter((category) => category.id !== 'quests')
      .map((category) => ({ ...category, needsAttention: false }));
  }, [viewedDay, viewedIsForming, formingPrompts, memoryQuests, recentAvgSteps, handledPhotoSig]);

  return {
    recentAvgSteps,
    memoryQuests,
    categories,
  };
}
