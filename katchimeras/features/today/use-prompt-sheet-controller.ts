import { useCallback, useState } from 'react';

import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';

export function usePromptSheetController() {
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<ActiveDayPrompt | null>(null);

  const openPromptSheet = useCallback((prompt: ActiveDayPrompt | null = null) => {
    setInitialPrompt(prompt);
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
