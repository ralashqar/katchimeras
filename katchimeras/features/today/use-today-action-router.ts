import { useCallback, useMemo } from 'react';

import type { DayStatKey } from '@/components/katchadeck/home/day-journal-sections';
import type { TodaySheetController } from '@/features/today/use-today-sheet-controller';
import type { HomeDayRecord } from '@/types/home';
import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { MemoryQuestType } from '@/utils/memory-quests-engine';
import type { TodayCategoryState } from '@/utils/today-categories';

type UseTodayActionRouterParams = {
  categories: TodayCategoryState[];
  viewedIsForming: boolean;
  formingDay: Pick<HomeDayRecord, 'id'> | null;
  formingPrompts: ActiveDayPrompt[];
  photoPrompt: ActiveDayPrompt | null;
  unconfirmedPlace: unknown | null;
  sheets: TodaySheetController;
  openPromptSheet: (prompt?: ActiveDayPrompt | null) => void;
  closePromptSheet: () => void;
  openCapture: () => void;
  openNoteCapture: () => void;
  openDayMap: (dayId: string) => void;
  addCurrentPlace: () => void;
};

export function useTodayActionRouter({
  categories,
  viewedIsForming,
  formingDay,
  formingPrompts,
  photoPrompt,
  unconfirmedPlace,
  sheets,
  openPromptSheet,
  closePromptSheet,
  openCapture,
  openNoteCapture,
  openDayMap,
  addCurrentPlace,
}: UseTodayActionRouterParams) {
  const ringCategories = useMemo(() => categories.filter((category) => category.id === 'quests'), [categories]);

  const panelCategories = useMemo(() => {
    const order = ['studio', 'mood', 'sleep', 'food'];
    return order
      .map((id) => categories.find((category) => category.id === id))
      .filter((category): category is TodayCategoryState => !!category);
  }, [categories]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const openMemoryVault = useCallback(
    (tab: 'photos' | 'notes') => {
      sheets.setMemoryVaultTab(tab);
      sheets.setMemoryVaultOpen(true);
    },
    [sheets]
  );

  const handleQuest = useCallback(
    (type: MemoryQuestType) => {
      sheets.setQuestBoardOpen(false);
      switch (type) {
        case 'captureMoment':
          openCapture();
          break;
        case 'recordVoiceMemory':
          openNoteCapture();
          break;
        case 'answerReflection': {
          const reflectionPrompt = formingPrompts.find((prompt) =>
            ['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight'].includes(prompt.id)
          );
          openPromptSheet(reflectionPrompt ?? null);
          break;
        }
        case 'markPlace':
          if (unconfirmedPlace) sheets.setPlacePromptOpen(true);
          else addCurrentPlace();
          break;
        case 'markBigMoment':
          sheets.setBigMomentPickerOpen(true);
          break;
        case 'saveFoodMemory':
          sheets.setFoodPickerOpen(true);
          break;
        case 'saveStudioMemory':
          sheets.setStudioPickerOpen(true);
          break;
        case 'namePatch':
          sheets.setNameSheetOpen(true);
          break;
      }
    },
    [addCurrentPlace, formingPrompts, openCapture, openNoteCapture, openPromptSheet, sheets, unconfirmedPlace]
  );

  const handleStatPress = useCallback(
    (key: DayStatKey) => {
      if (!viewedIsForming) {
        if (key === 'steps') sheets.setJourneySheetOpen(true);
        else if (key === 'places') sheets.setPlacesVaultOpen(true);
        else if (key === 'photos') openMemoryVault('photos');
        else sheets.setSanctuaryOpen(true);
        return;
      }

      switch (key) {
        case 'steps':
          if (categoryById.get('journey')?.needsAttention) sheets.setStepsSheetOpen(true);
          else sheets.setJourneySheetOpen(true);
          break;
        case 'places':
          sheets.setPlacesVaultOpen(true);
          break;
        case 'photos':
          if (categoryById.get('photos')?.needsAttention && photoPrompt) {
            openPromptSheet(photoPrompt);
          } else {
            openMemoryVault('photos');
          }
          break;
        case 'moments':
          sheets.setSanctuaryOpen(true);
          break;
      }
    },
    [categoryById, openMemoryVault, openPromptSheet, photoPrompt, sheets, viewedIsForming]
  );

  const statAttention = useMemo(
    () => ({
      steps: !!categoryById.get('journey')?.needsAttention,
      places: !!categoryById.get('places')?.needsAttention,
      photos: !!categoryById.get('photos')?.needsAttention,
    }),
    [categoryById]
  );

  const handleCategoryPress = useCallback(
    (category: TodayCategoryState) => {
      if (!viewedIsForming) {
        switch (category.id) {
          case 'photos':
            openMemoryVault('photos');
            break;
          case 'notes':
            openMemoryVault('notes');
            break;
          case 'places':
            sheets.setPlacesVaultOpen(true);
            break;
          case 'journey':
            sheets.setJourneySheetOpen(true);
            break;
          case 'reflection':
            sheets.setSanctuaryOpen(true);
            break;
          case 'food':
            sheets.setFoodVaultOpen(true);
            break;
          case 'studio':
            sheets.setStudioVaultOpen(true);
            break;
          case 'sleep':
            sheets.setSleepSheetOpen(true);
            break;
          case 'mood':
            sheets.setMoodSheetOpen(true);
            break;
        }
        return;
      }

      switch (category.id) {
        case 'photos':
          if (category.needsAttention && photoPrompt) {
            openPromptSheet(photoPrompt);
          } else {
            openMemoryVault('photos');
          }
          break;
        case 'notes':
          openMemoryVault('notes');
          break;
        case 'places':
          if (unconfirmedPlace) sheets.setPlacePromptOpen(true);
          else if (category.hasContent && formingDay) openDayMap(formingDay.id);
          else addCurrentPlace();
          break;
        case 'journey':
          sheets.setStepsSheetOpen(true);
          break;
        case 'reflection':
          if (category.needsAttention) sheets.setMoodSheetOpen(true);
          else sheets.setSanctuaryOpen(true);
          break;
        case 'food':
          if (category.hasContent) sheets.setFoodVaultOpen(true);
          else sheets.setFoodPickerOpen(true);
          break;
        case 'studio':
          if (category.hasContent) sheets.setStudioVaultOpen(true);
          else sheets.setStudioPickerOpen(true);
          break;
        case 'sleep':
          sheets.setSleepSheetOpen(true);
          break;
        case 'mood':
          sheets.setMoodSheetOpen(true);
          break;
        case 'quests':
          sheets.setQuestBoardOpen(true);
          break;
      }
    },
    [
      addCurrentPlace,
      formingDay,
      openDayMap,
      openMemoryVault,
      openPromptSheet,
      photoPrompt,
      sheets,
      unconfirmedPlace,
      viewedIsForming,
    ]
  );

  const handleCameraPress = useCallback(() => {
    if (categoryById.get('photos')?.needsAttention && photoPrompt) {
      openPromptSheet(photoPrompt);
      return;
    }
    openCapture();
  }, [categoryById, openCapture, openPromptSheet, photoPrompt]);

  const handleQuickCategory = useCallback(
    (id: string) => {
      closePromptSheet();
      if (id === 'sleep') sheets.setSleepSheetOpen(true);
      else if (id === 'mood') sheets.setMoodSheetOpen(true);
    },
    [closePromptSheet, sheets]
  );

  return {
    ringCategories,
    panelCategories,
    categoryById,
    statAttention,
    handleQuest,
    handleStatPress,
    handleCategoryPress,
    handleCameraPress,
    handleQuickCategory,
  };
}
