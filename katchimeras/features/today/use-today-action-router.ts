import { useCallback, useMemo } from 'react';

import type { DayStatKey } from '@/components/katchadeck/home/day-journal-sections';
import type { TodaySheetController } from '@/features/today/use-today-sheet-controller';
import type { ActiveDayPrompt } from '@/utils/day-prompt-engine';
import type { MemoryQuestType } from '@/utils/memory-quests-engine';
import type { QuestNextAction } from '@/utils/quests/runtime';
import type { PendingQuestActionIntent } from '@/utils/quest-action-signal';
import type { TodayCategoryState } from '@/utils/today-categories';

type UseTodayActionRouterParams = {
  categories: TodayCategoryState[];
  viewedIsForming: boolean;
  formingPrompts: ActiveDayPrompt[];
  photoPrompt: ActiveDayPrompt | null;
  sheets: TodaySheetController;
  openPromptSheet: (prompt?: ActiveDayPrompt | null) => void;
  closePromptSheet: () => void;
  openCapture: (questId?: string | null) => void;
  openQuickNote: (input?: 'text' | 'voice') => void;
  openObservatory: () => void;
  openManualJournal: (flowId?: string, categoryId?: string, contextId?: string | null) => void;
  requestMicrophonePermission?: () => Promise<{ granted?: boolean } | null>;
};

export function useTodayActionRouter({
  categories,
  viewedIsForming,
  formingPrompts,
  photoPrompt,
  sheets,
  openPromptSheet,
  closePromptSheet,
  openCapture,
  openQuickNote,
  openObservatory,
  openManualJournal,
  requestMicrophonePermission,
}: UseTodayActionRouterParams) {
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
    async (type: MemoryQuestType) => {
      sheets.setQuestBoardOpen(false);
      switch (type) {
        case 'captureMoment':
          openCapture();
          break;
        case 'recordVoiceMemory':
          if (requestMicrophonePermission) {
            const permission = await requestMicrophonePermission();
            if (!permission?.granted) break;
          }
          openQuickNote('voice');
          break;
        case 'answerReflection': {
          const reflectionPrompt = formingPrompts.find((prompt) =>
            ['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight'].includes(prompt.id)
          );
          if (reflectionPrompt) openPromptSheet(reflectionPrompt);
          else openManualJournal();
          break;
        }
        case 'markPlace':
          openManualJournal('went_somewhere');
          break;
        case 'markBigMoment':
          openManualJournal('big_event');
          break;
        case 'saveFoodMemory':
          openManualJournal('food');
          break;
        case 'saveStudioMemory':
          openManualJournal('studio');
          break;
        case 'namePatch':
          sheets.setNameSheetOpen(true);
          break;
      }
    },
    [formingPrompts, openCapture, openManualJournal, openPromptSheet, openQuickNote, requestMicrophonePermission, sheets]
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
          if (category.hasContent) sheets.setPlacesVaultOpen(true);
          else openManualJournal('went_somewhere');
          break;
        case 'journey':
          if (category.hasContent) sheets.setStepsSheetOpen(true);
          else openManualJournal('movement');
          break;
        case 'reflection':
          if (category.needsAttention) sheets.setMoodSheetOpen(true);
          else sheets.setSanctuaryOpen(true);
          break;
        case 'food':
          if (category.hasContent) sheets.setFoodVaultOpen(true);
          else openManualJournal('food');
          break;
        case 'studio':
          if (category.hasContent) sheets.setStudioVaultOpen(true);
          else openManualJournal('studio');
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
      openMemoryVault,
      openManualJournal,
      openPromptSheet,
      photoPrompt,
      sheets,
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
    async (id: string) => {
      closePromptSheet();
      sheets.closeAllSheets();
      if (id === 'photo') openCapture();
      else if (id === 'voice_note') {
        if (requestMicrophonePermission) {
          const permission = await requestMicrophonePermission();
          if (!permission?.granted) return;
        }
        openQuickNote('voice');
      }
      else if (id === 'written_note' || id === 'note') openQuickNote('text');
      else if (id === 'place') openManualJournal('went_somewhere');
      else if (id === 'food') openManualJournal('food');
      else if (id === 'studio') openManualJournal('studio');
      else if (id === 'movement') openManualJournal('movement');
      else if (id === 'people') openManualJournal('people');
      else if (id === 'work') openManualJournal('work');
      else if (id === 'sleep') sheets.setSleepSheetOpen(true);
      else if (id === 'mood') sheets.setMoodSheetOpen(true);
      else if (id === 'life_event') openManualJournal('big_event');
      else if (id === 'manual_journal') openManualJournal();
    },
    [
      closePromptSheet,
      openCapture,
      openQuickNote,
      openManualJournal,
      requestMicrophonePermission,
      sheets,
    ]
  );

  const handleQuestActionIntent = useCallback(
    async (intent: PendingQuestActionIntent) => {
      const action: QuestNextAction = intent.action;
      closePromptSheet();
      switch (action) {
        case 'take_photo':
        case 'enable_camera':
          openCapture(intent.questId ?? null);
          break;
        case 'enable_photos':
          if (photoPrompt) openPromptSheet(photoPrompt);
          else openMemoryVault('photos');
          break;
        case 'enable_location':
        case 'confirm_place':
          sheets.setPlacesVaultOpen(true);
          break;
        case 'enable_travel_memory':
          openObservatory();
          break;
        case 'record_voice':
          if (requestMicrophonePermission) {
            const permission = await requestMicrophonePermission();
            if (!permission?.granted) break;
          }
          openQuickNote('voice');
          break;
        case 'add_note':
          if (intent.journalRoute) {
            openManualJournal(
              intent.journalRoute.flowId,
              intent.journalRoute.categoryId,
              intent.journalRoute.contextId
            );
          } else {
            openQuickNote('text');
          }
          break;
        case 'open_health':
          sheets.setStepsSheetOpen(true);
          break;
        case 'none':
          break;
      }
    },
    [
      closePromptSheet,
      openCapture,
      openMemoryVault,
      openManualJournal,
      openObservatory,
      openPromptSheet,
      openQuickNote,
      photoPrompt,
      requestMicrophonePermission,
      sheets,
    ]
  );

  return {
    panelCategories,
    categoryById,
    statAttention,
    handleQuest,
    handleStatPress,
    handleCategoryPress,
    handleCameraPress,
    handleQuickCategory,
    handleQuestActionIntent,
  };
}
