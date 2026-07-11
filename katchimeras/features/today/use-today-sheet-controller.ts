import { useCallback, useState } from 'react';

import type { MemoryVaultTab } from '@/components/katchadeck/world/memory-vault-sheet';

export function useTodaySheetController() {
  const [memoryVaultOpen, setMemoryVaultOpen] = useState(false);
  const [memoryVaultTab, setMemoryVaultTab] = useState<MemoryVaultTab>('photos');
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [foodVaultOpen, setFoodVaultOpen] = useState(false);
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [studioVaultOpen, setStudioVaultOpen] = useState(false);
  const [sanctuaryOpen, setSanctuaryOpen] = useState(false);
  const [moodSheetOpen, setMoodSheetOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [questBoardOpen, setQuestBoardOpen] = useState(false);
  const [bigMomentPickerOpen, setBigMomentPickerOpen] = useState(false);
  const [placePromptOpen, setPlacePromptOpen] = useState(false);
  const [placesVaultOpen, setPlacesVaultOpen] = useState(false);
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);
  const [journeySheetOpen, setJourneySheetOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);

  // The Today hub uses state-backed sheets rather than navigator modals. Keep
  // transitions exclusive so a manual "+" action can never inherit or stack on
  // top of a previously-open reader, picker, or automatic follow-up surface.
  const closeAllSheets = useCallback(() => {
    setMemoryVaultOpen(false);
    setFoodPickerOpen(false);
    setFoodVaultOpen(false);
    setStudioPickerOpen(false);
    setStudioVaultOpen(false);
    setSanctuaryOpen(false);
    setMoodSheetOpen(false);
    setSleepSheetOpen(false);
    setQuestBoardOpen(false);
    setBigMomentPickerOpen(false);
    setPlacePromptOpen(false);
    setPlacesVaultOpen(false);
    setStepsSheetOpen(false);
    setJourneySheetOpen(false);
    setNameSheetOpen(false);
  }, []);

  return {
    memoryVaultOpen,
    setMemoryVaultOpen,
    memoryVaultTab,
    setMemoryVaultTab,
    foodPickerOpen,
    setFoodPickerOpen,
    foodVaultOpen,
    setFoodVaultOpen,
    studioPickerOpen,
    setStudioPickerOpen,
    studioVaultOpen,
    setStudioVaultOpen,
    sanctuaryOpen,
    setSanctuaryOpen,
    moodSheetOpen,
    setMoodSheetOpen,
    sleepSheetOpen,
    setSleepSheetOpen,
    questBoardOpen,
    setQuestBoardOpen,
    bigMomentPickerOpen,
    setBigMomentPickerOpen,
    placePromptOpen,
    setPlacePromptOpen,
    placesVaultOpen,
    setPlacesVaultOpen,
    stepsSheetOpen,
    setStepsSheetOpen,
    journeySheetOpen,
    setJourneySheetOpen,
    nameSheetOpen,
    setNameSheetOpen,
    closeAllSheets,
  };
}

export type TodaySheetController = ReturnType<typeof useTodaySheetController>;
