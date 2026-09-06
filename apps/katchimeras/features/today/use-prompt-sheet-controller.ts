import { useCallback, useState } from 'react';

import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';

export function usePromptSheetController() {
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<ActiveDayPrompt | null>(null);

  const openPromptSheet = useCallback((prompt: ActiveDayPrompt | null = null) => {
    setInitialPrompt(isActiveDayPrompt(prompt) ? prompt : null);
    setPromptSheetOpen(true);
  }, []);

  const closePromptSheet = useCallback(() => {
    setPromptSheetOpen(false);
    setInitialPrompt(null);
  }, []);

  return {
    promptSheetOpen,
    initialPrompt,
    openPromptSheet,
    closePromptSheet,
  };
}

function isActiveDayPrompt(value: unknown): value is ActiveDayPrompt {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ActiveDayPrompt>;
  return typeof candidate.id === 'string' && typeof candidate.title === 'string';
}
