import { startTransition, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';

import { deriveTodayCategories, type TodayCategoryState } from '@/utils/today-categories';
import { selectMemoryQuests } from '@/utils/memory-quests-engine';
import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';

type UseTodayCategoryModelParams = {
  allDays: HomeDayRecord[];
  formingDay: HomeDayRecord | null;
  viewedDay: HomeDayRecord | null;
  viewedIsForming: boolean;
  formingPrompts: ActiveDayPrompt[];
  handledPhotoSig: string | null;
  timelineDays: HomeTimelineDay[];
};

// Hatched cards are immutable snapshots. Cache their dock projection by the
// day object itself so revisiting a card does not rebuild the moment timeline,
// food/studio detections, and category metadata on the selection frame.
const archivedCategoryCache = new WeakMap<HomeDayRecord, TodayCategoryState[]>();

function deriveArchivedCategories(day: HomeDayRecord): TodayCategoryState[] {
  const cached = archivedCategoryCache.get(day);
  if (cached) return cached;
  const categories = deriveTodayCategories(day, {
    prompts: [],
    quests: [],
    recentAvgSteps: null,
    handledPhotoSig: null,
  })
    .filter((category) => category.id !== 'quests')
    .map((category) => ({ ...category, needsAttention: false }));
  archivedCategoryCache.set(day, categories);
  return categories;
}

export function useTodayCategoryModel({
  allDays,
  formingDay,
  viewedDay,
  viewedIsForming,
  formingPrompts,
  handledPhotoSig,
  timelineDays,
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
  const [archiveSnapshot, setArchiveSnapshot] = useState<{
    day: HomeDayRecord;
    categories: TodayCategoryState[];
  } | null>(() => (
    viewedDay && !viewedIsForming
      ? { day: viewedDay, categories: deriveArchivedCategories(viewedDay) }
      : null
  ));

  useEffect(() => {
    // Warm one archived card per frame after active interactions. The cache is
    // ref-only: warming never schedules a React render and therefore cannot
    // compete with the carousel. A quick swipe before warming still falls back
    // to the exact synchronous derivation below.
    let cancelled = false;
    let frame: ReturnType<typeof requestAnimationFrame> | null = null;
    let cursor = 0;
    // Use the exact objects supplied to the carousel. `useAllDays` hydrates a
    // separate archive view, so warming those instances would miss this
    // WeakMap when the timeline selection changes.
    const archivedDays = timelineDays.filter(
      (day): day is HomeDayRecord =>
        day.kind === 'day' && day.state === 'hatched' && !archivedCategoryCache.has(day)
    ).reverse();
    if (archivedDays.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const warmNext = () => {
        if (cancelled) return;
        const day = archivedDays[cursor];
        cursor += 1;
        if (day) deriveArchivedCategories(day);
        if (cursor < archivedDays.length) frame = requestAnimationFrame(warmNext);
      };
      frame = requestAnimationFrame(warmNext);
    });

    return () => {
      cancelled = true;
      task.cancel();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [timelineDays]);

  const cachedArchiveCategories = viewedDay && !viewedIsForming
    ? archivedCategoryCache.get(viewedDay) ?? (
      archiveSnapshot?.day === viewedDay ? archiveSnapshot.categories : null
    )
    : null;

  useEffect(() => {
    if (!viewedDay || viewedIsForming || archivedCategoryCache.has(viewedDay)) return;
    let frame: ReturnType<typeof requestAnimationFrame> | null = null;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const categories = deriveArchivedCategories(viewedDay);
        startTransition(() => {
          if (!cancelled) setArchiveSnapshot({ day: viewedDay, categories });
        });
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [viewedDay, viewedIsForming]);

  const categories = useMemo(() => {
    if (!viewedDay) return [];
    if (!viewedIsForming) return cachedArchiveCategories ?? [];
    const derived = deriveTodayCategories(viewedDay, {
      prompts: viewedIsForming ? formingPrompts : [],
      quests: viewedIsForming ? memoryQuests : [],
      recentAvgSteps,
      handledPhotoSig,
    });
    return derived;
  }, [cachedArchiveCategories, viewedDay, viewedIsForming, formingPrompts, memoryQuests, recentAvgSteps, handledPhotoSig]);

  return {
    recentAvgSteps,
    memoryQuests,
    categories,
    categoriesLoading: Boolean(viewedDay && !viewedIsForming && !cachedArchiveCategories),
  };
}
