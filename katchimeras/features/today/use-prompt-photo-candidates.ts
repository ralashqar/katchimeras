import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import {
  clearStoredDevPromptPhotoCandidates,
  loadProductionDayPromptPhotoCandidates,
  loadStoredDevPromptPhotoCandidates,
} from '@/utils/day-prompt-photos';

type PromptPhotoCandidateParams = {
  dayId: string | null;
  dayState: string | null;
  enabled?: boolean;
  interactionKey: string;
  paused?: boolean;
};

const PHOTO_SCAN_IDLE_DELAY_MS = 900;

export function usePromptPhotoCandidates({
  dayId,
  dayState,
  enabled = true,
  interactionKey,
  paused = false,
}: PromptPhotoCandidateParams) {
  const [promptPhotoCandidates, setPromptPhotoCandidates] = useState<DayPromptPhotoCandidate[]>([]);
  const [forceMeaningfulPhotoPrompt, setForceMeaningfulPhotoPrompt] = useState(false);

  const clearForcedMeaningfulPhotoPrompt = useCallback(() => {
    clearStoredDevPromptPhotoCandidates();
    setForceMeaningfulPhotoPrompt((current) => current ? false : current);
    setPromptPhotoCandidates((current) => current.length === 0 ? current : []);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (!enabled || !dayId || dayState === 'hatched') {
      setPromptPhotoCandidates((current) => current.length === 0 ? current : []);
      setForceMeaningfulPhotoPrompt((current) => current ? false : current);
      return;
    }

    let active = true;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      idleTimer = setTimeout(() => {
        void (async () => {
          const devCandidates = __DEV__ ? loadStoredDevPromptPhotoCandidates() : [];
          if (devCandidates.length > 0) {
            if (active) {
              setPromptPhotoCandidates((current) => sameCandidates(current, devCandidates) ? current : devCandidates);
              setForceMeaningfulPhotoPrompt(true);
            }
            return;
          }

          const candidates = await loadProductionDayPromptPhotoCandidates(new Date(), abortController.signal);
          if (active && !abortController.signal.aborted) {
            setPromptPhotoCandidates((current) => sameCandidates(current, candidates) ? current : candidates);
            setForceMeaningfulPhotoPrompt((current) => current ? false : current);
          }
        })();
      }, PHOTO_SCAN_IDLE_DELAY_MS);
    });

    return () => {
      active = false;
      interactionTask.cancel();
      if (idleTimer !== null) clearTimeout(idleTimer);
      abortController.abort();
    };
  }, [dayId, dayState, enabled, interactionKey, paused]);

  return {
    promptPhotoCandidates,
    forceMeaningfulPhotoPrompt,
    clearForcedMeaningfulPhotoPrompt,
  };
}

function sameCandidates(left: DayPromptPhotoCandidate[], right: DayPromptPhotoCandidate[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index].assetId !== right[index].assetId) return false;
  }
  return true;
}
