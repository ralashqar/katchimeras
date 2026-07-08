import { useCallback, useEffect, useState } from 'react';

import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import {
  clearStoredDevPromptPhotoCandidates,
  loadProductionDayPromptPhotoCandidates,
  loadStoredDevPromptPhotoCandidates,
} from '@/utils/day-prompt-photos';

type PromptPhotoCandidateParams = {
  dayId: string | null;
  isToday: boolean;
  dayState: string | null;
};

export function usePromptPhotoCandidates({ dayId, isToday, dayState }: PromptPhotoCandidateParams) {
  const [promptPhotoCandidates, setPromptPhotoCandidates] = useState<DayPromptPhotoCandidate[]>([]);
  const [forceMeaningfulPhotoPrompt, setForceMeaningfulPhotoPrompt] = useState(false);

  const clearForcedMeaningfulPhotoPrompt = useCallback(() => {
    clearStoredDevPromptPhotoCandidates();
    setForceMeaningfulPhotoPrompt(false);
    setPromptPhotoCandidates([]);
  }, []);

  useEffect(() => {
    if (!dayId || !isToday || dayState === 'hatched') {
      setPromptPhotoCandidates([]);
      setForceMeaningfulPhotoPrompt(false);
      return;
    }

    let active = true;

    void (async () => {
      const devCandidates = __DEV__ ? loadStoredDevPromptPhotoCandidates() : [];
      if (devCandidates.length > 0) {
        if (active) {
          setPromptPhotoCandidates(devCandidates);
          setForceMeaningfulPhotoPrompt(true);
        }
        return;
      }

      const candidates = await loadProductionDayPromptPhotoCandidates(new Date());
      if (active) {
        setPromptPhotoCandidates(candidates);
        setForceMeaningfulPhotoPrompt(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [dayId, isToday, dayState]);

  return {
    promptPhotoCandidates,
    forceMeaningfulPhotoPrompt,
    clearForcedMeaningfulPhotoPrompt,
  };
}
