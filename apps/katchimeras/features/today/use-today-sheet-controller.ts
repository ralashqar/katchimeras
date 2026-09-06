import { useCallback, useMemo, useReducer, useState } from 'react';

import type { KatchaSheetCloseReason } from '@/components/katchadeck/ui/katcha-sheet';
import type { MemoryVaultTab } from '@/components/katchadeck/world/memory-vault-sheet';
import {
  initialTodaySurfaceState,
  isTodaySurfaceActive,
  todaySurfaceReducer,
  type TodaySurfaceKind,
  type TodaySurfaceState,
} from '@/features/today/today-surface-state';

export function useTodaySheetController() {
  const [surfaceState, dispatch] = useReducer(todaySurfaceReducer, initialTodaySurfaceState);
  const [memoryVaultTab, setStoredMemoryVaultTab] = useState<MemoryVaultTab>('photos');

  const openSurface = useCallback((surface: TodaySurfaceState) => {
    dispatch({ type: 'open', surface });
  }, []);
  const replaceSurface = useCallback((surface: TodaySurfaceState) => {
    dispatch({ type: 'replace', surface });
  }, []);
  const closeSurface = useCallback((reason: KatchaSheetCloseReason | 'completed' = 'completed') => {
    dispatch({ type: 'close', reason });
  }, []);
  const setMemoryVaultTab = useCallback((tab: MemoryVaultTab) => {
    setStoredMemoryVaultTab(tab);
    dispatch({ type: 'set-memory-tab', tab });
  }, []);
  const setSurfaceVisibility = useCallback(
    (kind: TodaySurfaceKind, open: boolean) => {
      if (!open) {
        if (surfaceState.active?.kind === kind) closeSurface('completed');
        return;
      }
      openSurface(kind === 'memory-vault' ? { kind, tab: memoryVaultTab } : { kind });
    },
    [closeSurface, memoryVaultTab, openSurface, surfaceState.active?.kind]
  );

  return useMemo(() => {
    const active = surfaceState.active;
    const isOpen = (kind: TodaySurfaceKind) => isTodaySurfaceActive(active, kind);
    const setter = (kind: TodaySurfaceKind) => (open: boolean) => setSurfaceVisibility(kind, open);

    return {
      activeSurface: active,
      lastCloseReason: surfaceState.lastCloseReason,
      openSurface,
      replaceSurface,
      closeSurface,
      memoryVaultOpen: isOpen('memory-vault'),
      setMemoryVaultOpen: setter('memory-vault'),
      memoryVaultTab: active?.kind === 'memory-vault' ? active.tab : memoryVaultTab,
      setMemoryVaultTab,
      foodPickerOpen: isOpen('food-picker'),
      setFoodPickerOpen: setter('food-picker'),
      foodVaultOpen: isOpen('food-vault'),
      setFoodVaultOpen: setter('food-vault'),
      studioPickerOpen: isOpen('studio-picker'),
      setStudioPickerOpen: setter('studio-picker'),
      studioVaultOpen: isOpen('studio-vault'),
      setStudioVaultOpen: setter('studio-vault'),
      sanctuaryOpen: isOpen('sanctuary'),
      setSanctuaryOpen: setter('sanctuary'),
      moodSheetOpen: isOpen('mood'),
      setMoodSheetOpen: setter('mood'),
      sleepSheetOpen: isOpen('sleep'),
      setSleepSheetOpen: setter('sleep'),
      questBoardOpen: isOpen('quest-board'),
      setQuestBoardOpen: setter('quest-board'),
      bigMomentPickerOpen: isOpen('big-moment-picker'),
      setBigMomentPickerOpen: setter('big-moment-picker'),
      placePromptOpen: isOpen('place-prompt'),
      setPlacePromptOpen: setter('place-prompt'),
      placesVaultOpen: isOpen('places-vault'),
      setPlacesVaultOpen: setter('places-vault'),
      stepsSheetOpen: isOpen('steps'),
      setStepsSheetOpen: setter('steps'),
      journeySheetOpen: isOpen('journey'),
      setJourneySheetOpen: setter('journey'),
      nameSheetOpen: isOpen('name'),
      setNameSheetOpen: setter('name'),
      closeAllSheets: closeSurface,
    };
  }, [closeSurface, memoryVaultTab, openSurface, replaceSurface, setMemoryVaultTab, setSurfaceVisibility, surfaceState]);
}

export type TodaySheetController = ReturnType<typeof useTodaySheetController>;
