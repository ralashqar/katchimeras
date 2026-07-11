import { useCallback, useEffect, useRef, useState } from 'react';

import type { HomeDayRecord, StudioMediaType } from '@/types/home';
import {
  derivedMomentHasConfirmedFacet,
  derivedMomentIsRejected,
} from '@/utils/intelligence/classification-policy';
import { resolveFoodMomentDisplay, resolveStudioMomentDisplay } from '@/utils/memory-display';

export type FoodMomentFollowUp = {
  momentId: string;
  label: string;
  emoji: string;
};

export type StudioMomentFollowUp = FoodMomentFollowUp & {
  mediaType: StudioMediaType;
};

type UseMomentFollowUpControllerParams = {
  formingDay: HomeDayRecord | null;
  blocked?: boolean;
  suppressFoodFollowUp?: boolean;
  suppressStudioFollowUp?: boolean;
};

type FreshMoment = {
  id: string;
  createdAt: string;
  source?: string | null;
  sourceId?: string | null;
  noteId?: string | null;
  thumbnailUri?: string | null;
};

const FOLLOW_UP_DELAY_MS = 900;
const FRESH_WINDOW_MS = 5 * 60_000;

function isFreshAutoDetectedMoment(moment: FreshMoment, askedIds: Set<string>) {
  return (
    !!moment.source &&
    moment.source !== 'manual' &&
    !askedIds.has(moment.id) &&
    Date.now() - Date.parse(moment.createdAt) < FRESH_WINDOW_MS
  );
}

export function useMomentFollowUpController({
  formingDay,
  blocked = false,
  suppressFoodFollowUp = false,
  suppressStudioFollowUp = false,
}: UseMomentFollowUpControllerParams) {
  const [foodFollowUp, setFoodFollowUp] = useState<FoodMomentFollowUp | null>(null);
  const [studioFollowUp, setStudioFollowUp] = useState<StudioMomentFollowUp | null>(null);
  const followUpAskedRef = useRef<Set<string>>(new Set());

  const clearFoodFollowUp = useCallback(() => setFoodFollowUp(null), []);
  const clearStudioFollowUp = useCallback(() => setStudioFollowUp(null), []);

  useEffect(() => {
    if (!formingDay) return;

    if (suppressFoodFollowUp && foodFollowUp) {
      setFoodFollowUp(null);
      return;
    }
    if (suppressStudioFollowUp && studioFollowUp) {
      setStudioFollowUp(null);
      return;
    }

    if (foodFollowUp) {
      const active = (formingDay.foodMoments ?? []).find((moment) => moment.id === foodFollowUp.momentId);
      if (!active || derivedMomentIsRejected(active, formingDay.classifiedMemories, 'food')) {
        setFoodFollowUp(null);
        return;
      }
    }
    if (studioFollowUp) {
      const active = (formingDay.studioMoments ?? []).find((moment) => moment.id === studioFollowUp.momentId);
      if (!active || derivedMomentIsRejected(active, formingDay.classifiedMemories, 'media')) {
        setStudioFollowUp(null);
        return;
      }
    }
    if (blocked || foodFollowUp || studioFollowUp) return;

    const isFresh = (moment: FreshMoment) => isFreshAutoDetectedMoment(moment, followUpAskedRef.current);
    const food = (formingDay.foodMoments ?? [])
      .filter((moment) => !derivedMomentIsRejected(moment, formingDay.classifiedMemories, 'food'))
      .filter((moment) => !derivedMomentHasConfirmedFacet(moment, formingDay.classifiedMemories, 'food_meaning'))
      .filter(isFresh)
      .pop();
    const studio = food
      ? null
      : (formingDay.studioMoments ?? [])
          .filter((moment) => !derivedMomentIsRejected(moment, formingDay.classifiedMemories, 'media'))
          .filter((moment) => !derivedMomentHasConfirmedFacet(moment, formingDay.classifiedMemories, 'media_rating'))
          .filter(isFresh)
          .pop();
    if (!food && !studio) return;

    const timeoutId = setTimeout(() => {
      if (food) {
        const display = resolveFoodMomentDisplay(food);
        followUpAskedRef.current.add(food.id);
        setFoodFollowUp({ momentId: food.id, label: display.label, emoji: display.emoji });
      } else if (studio) {
        const display = resolveStudioMomentDisplay(studio);
        followUpAskedRef.current.add(studio.id);
        setStudioFollowUp({
          momentId: studio.id,
          label: display.label,
          emoji: display.emoji,
          mediaType: studio.mediaType,
        });
      }
    }, FOLLOW_UP_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [blocked, foodFollowUp, formingDay, studioFollowUp, suppressFoodFollowUp, suppressStudioFollowUp]);

  return {
    foodFollowUp,
    studioFollowUp,
    clearFoodFollowUp,
    clearStudioFollowUp,
  };
}
