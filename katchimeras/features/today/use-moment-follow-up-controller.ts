import { useCallback, useEffect, useRef, useState } from 'react';

import type { HomeDayRecord, StudioMediaType } from '@/types/home';

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
};

type FreshMoment = {
  id: string;
  createdAt: string;
  source?: string | null;
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

export function useMomentFollowUpController({ formingDay, blocked = false }: UseMomentFollowUpControllerParams) {
  const [foodFollowUp, setFoodFollowUp] = useState<FoodMomentFollowUp | null>(null);
  const [studioFollowUp, setStudioFollowUp] = useState<StudioMomentFollowUp | null>(null);
  const followUpAskedRef = useRef<Set<string>>(new Set());

  const clearFoodFollowUp = useCallback(() => setFoodFollowUp(null), []);
  const clearStudioFollowUp = useCallback(() => setStudioFollowUp(null), []);

  useEffect(() => {
    if (!formingDay || blocked || foodFollowUp || studioFollowUp) return;

    const isFresh = (moment: FreshMoment) => isFreshAutoDetectedMoment(moment, followUpAskedRef.current);
    const food = (formingDay.foodMoments ?? []).filter(isFresh).pop();
    const studio = food ? null : (formingDay.studioMoments ?? []).filter(isFresh).pop();
    if (!food && !studio) return;

    const timeoutId = setTimeout(() => {
      if (food) {
        followUpAskedRef.current.add(food.id);
        setFoodFollowUp({ momentId: food.id, label: food.label, emoji: food.emoji });
      } else if (studio) {
        followUpAskedRef.current.add(studio.id);
        setStudioFollowUp({
          momentId: studio.id,
          label: studio.label,
          emoji: studio.emoji,
          mediaType: studio.mediaType,
        });
      }
    }, FOLLOW_UP_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [blocked, foodFollowUp, formingDay, studioFollowUp]);

  return {
    foodFollowUp,
    studioFollowUp,
    clearFoodFollowUp,
    clearStudioFollowUp,
  };
}
