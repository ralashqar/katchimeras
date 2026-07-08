import type { ComponentProps } from 'react';

import { BigMomentPickerSheet } from '@/components/katchadeck/world/big-moment-picker-sheet';
import { JourneyDetailSheet, PlacesDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { FoodMomentSheet, FoodVaultSheet } from '@/components/katchadeck/world/food-vault-sheet';
import { MemoryVaultSheet } from '@/components/katchadeck/world/memory-vault-sheet';
import { MoodMonumentSheet } from '@/components/katchadeck/world/mood-monument-sheet';
import { NameDaySheet } from '@/components/katchadeck/world/name-day-sheet';
import { ObservatorySheet } from '@/components/katchadeck/world/observatory-sheet';
import { PlacePromptSheet } from '@/components/katchadeck/world/place-prompt-sheet';
import { QuestBoardSheet } from '@/components/katchadeck/world/quest-board-sheet';
import { SanctuarySheet } from '@/components/katchadeck/world/sanctuary-sheet';
import { SleepSheet } from '@/components/katchadeck/world/sleep-sheet';
import { StepsPromptSheet } from '@/components/katchadeck/world/steps-prompt-sheet';
import { StudioMomentSheet, StudioVaultSheet } from '@/components/katchadeck/world/studio-vault-sheet';
import type { FoodMomentFollowUp, StudioMomentFollowUp } from '@/features/today/use-moment-follow-up-controller';
import type { DayInputTarget, HomeDayRecord } from '@/types/home';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';
import type { Observation } from '@/utils/observations-engine';

type FoodConfirmInput = Parameters<ComponentProps<typeof FoodMomentSheet>['onConfirm']>[0];
type StudioConfirmInput = Parameters<ComponentProps<typeof StudioMomentSheet>['onConfirm']>[0];
type FoodSuggestion = ComponentProps<typeof FoodMomentSheet>['suggested'];
type StudioSuggestion = ComponentProps<typeof StudioMomentSheet>['suggested'];
type MemoryVaultTab = ComponentProps<typeof MemoryVaultSheet>['initialTab'];

type ActivePlace = {
  name: string;
  timeLabel: string | null;
  isNew: boolean;
};

type TodaySheetHostProps = {
  viewedDay: HomeDayRecord | null;
  viewedIsForming: boolean;
  formingTarget: DayInputTarget;
  memoryVaultOpen: boolean;
  memoryVaultTab: MemoryVaultTab;
  foodPickerOpen: boolean;
  foodVaultOpen: boolean;
  studioPickerOpen: boolean;
  studioVaultOpen: boolean;
  sanctuaryOpen: boolean;
  moodSheetOpen: boolean;
  sleepSheetOpen: boolean;
  questBoardOpen: boolean;
  bigMomentPickerOpen: boolean;
  stepsSheetOpen: boolean;
  journeySheetOpen: boolean;
  placesVaultOpen: boolean;
  observatoryOpen: boolean;
  placePromptOpen: boolean;
  nameSheetOpen: boolean;
  foodSuggestion: FoodSuggestion;
  studioSuggestion: StudioSuggestion;
  foodFollowUp: FoodMomentFollowUp | null;
  studioFollowUp: StudioMomentFollowUp | null;
  memoryQuests: MemoryQuest[];
  recentAvgSteps: number | null;
  activePlace: ActivePlace | null;
  placePreset: ComponentProps<typeof PlacePromptSheet>['presetCategory'];
  observations: Observation[];
  travelMemory: ComponentProps<typeof ObservatorySheet>['travelMemory'];
  setMemoryVaultOpen: (open: boolean) => void;
  setMemoryVaultTab: (tab: NonNullable<MemoryVaultTab>) => void;
  setFoodPickerOpen: (open: boolean) => void;
  setFoodVaultOpen: (open: boolean) => void;
  setStudioPickerOpen: (open: boolean) => void;
  setStudioVaultOpen: (open: boolean) => void;
  setSanctuaryOpen: (open: boolean) => void;
  setMoodSheetOpen: (open: boolean) => void;
  setSleepSheetOpen: (open: boolean) => void;
  setQuestBoardOpen: (open: boolean) => void;
  setBigMomentPickerOpen: (open: boolean) => void;
  setStepsSheetOpen: (open: boolean) => void;
  setJourneySheetOpen: (open: boolean) => void;
  setPlacesVaultOpen: (open: boolean) => void;
  setObservatoryOpen: (open: boolean) => void;
  setNameSheetOpen: (open: boolean) => void;
  onCapturePhoto: () => void;
  onCaptureNote: () => void;
  openPromptSheet: () => void;
  handleAddCurrentPlace: () => void | Promise<void>;
  handleOpenDayMap: (dayId: string) => void;
  handleAddFood: ComponentProps<typeof FoodMomentSheet>['onConfirm'];
  handleAddStudio: ComponentProps<typeof StudioMomentSheet>['onConfirm'];
  handlePickBigMoment: ComponentProps<typeof BigMomentPickerSheet>['onPick'];
  handleConfirmMood: NonNullable<ComponentProps<typeof MoodMonumentSheet>['onChoose']>;
  handleSetSleep: NonNullable<ComponentProps<typeof SleepSheet>['onSet']>;
  handleConfirmSteps: ComponentProps<typeof StepsPromptSheet>['onConfirm'];
  handleQuest: (type: MemoryQuestType) => void;
  handleConfirmPlaceFromVault: NonNullable<ComponentProps<typeof PlacesDetailSheet>['onConfirmPlace']>;
  handleConfirmPlace: ComponentProps<typeof PlacePromptSheet>['onConfirm'];
  closePlacePrompt: () => void;
  setFoodMomentMeaning: (input: { momentId: string; meaning: FoodConfirmInput['meaning'] }, target?: DayInputTarget) => void;
  setStudioMomentRating: (input: { momentId: string; rating: StudioConfirmInput['rating'] }, target?: DayInputTarget) => void;
  clearFoodFollowUp: () => void;
  clearStudioFollowUp: () => void;
  pulseEgg: () => void;
  setMicrocopy: (message: string | null) => void;
  setDayName: (name: string, target?: DayInputTarget) => void;
};

export function TodaySheetHost({
  viewedDay,
  viewedIsForming,
  formingTarget,
  memoryVaultOpen,
  memoryVaultTab,
  foodPickerOpen,
  foodVaultOpen,
  studioPickerOpen,
  studioVaultOpen,
  sanctuaryOpen,
  moodSheetOpen,
  sleepSheetOpen,
  questBoardOpen,
  bigMomentPickerOpen,
  stepsSheetOpen,
  journeySheetOpen,
  placesVaultOpen,
  observatoryOpen,
  placePromptOpen,
  nameSheetOpen,
  foodSuggestion,
  studioSuggestion,
  foodFollowUp,
  studioFollowUp,
  memoryQuests,
  recentAvgSteps,
  activePlace,
  placePreset,
  observations,
  travelMemory,
  setMemoryVaultOpen,
  setMemoryVaultTab,
  setFoodPickerOpen,
  setFoodVaultOpen,
  setStudioPickerOpen,
  setStudioVaultOpen,
  setSanctuaryOpen,
  setMoodSheetOpen,
  setSleepSheetOpen,
  setQuestBoardOpen,
  setBigMomentPickerOpen,
  setStepsSheetOpen,
  setJourneySheetOpen,
  setPlacesVaultOpen,
  setObservatoryOpen,
  setNameSheetOpen,
  onCapturePhoto,
  onCaptureNote,
  openPromptSheet,
  handleAddCurrentPlace,
  handleOpenDayMap,
  handleAddFood,
  handleAddStudio,
  handlePickBigMoment,
  handleConfirmMood,
  handleSetSleep,
  handleConfirmSteps,
  handleQuest,
  handleConfirmPlaceFromVault,
  handleConfirmPlace,
  closePlacePrompt,
  setFoodMomentMeaning,
  setStudioMomentRating,
  clearFoodFollowUp,
  clearStudioFollowUp,
  pulseEgg,
  setMicrocopy,
  setDayName,
}: TodaySheetHostProps) {
  if (!viewedDay) {
    return null;
  }

  return (
    <>
      {memoryVaultOpen ? (
        <MemoryVaultSheet
          day={viewedDay}
          initialTab={memoryVaultTab}
          onAddPhoto={
            viewedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  onCapturePhoto();
                }
              : undefined
          }
          onRecordVoice={
            viewedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  onCaptureNote();
                }
              : undefined
          }
          onAddNote={
            viewedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  onCaptureNote();
                }
              : undefined
          }
          onClose={() => setMemoryVaultOpen(false)}
        />
      ) : null}
      {foodPickerOpen ? (
        <FoodMomentSheet onConfirm={handleAddFood} onClose={() => setFoodPickerOpen(false)} suggested={foodSuggestion} />
      ) : null}
      {foodFollowUp ? (
        <FoodMomentSheet
          suggested={{ label: foodFollowUp.label, emoji: foodFollowUp.emoji }}
          onConfirm={({ meaning }) => {
            setFoodMomentMeaning({ momentId: foodFollowUp.momentId, meaning }, formingTarget);
            clearFoodFollowUp();
            pulseEgg();
            setMicrocopy(`${foodFollowUp.emoji} ${foodFollowUp.label} - noted`);
          }}
          onClose={clearFoodFollowUp}
        />
      ) : null}
      {studioFollowUp ? (
        <StudioMomentSheet
          suggested={{ mediaType: studioFollowUp.mediaType, label: studioFollowUp.label, emoji: studioFollowUp.emoji }}
          onConfirm={({ rating }) => {
            setStudioMomentRating({ momentId: studioFollowUp.momentId, rating }, formingTarget);
            clearStudioFollowUp();
            pulseEgg();
            setMicrocopy(`${studioFollowUp.emoji} ${studioFollowUp.label} - noted`);
          }}
          onClose={clearStudioFollowUp}
        />
      ) : null}
      {foodVaultOpen ? (
        <FoodVaultSheet
          foodMoments={viewedDay.foodMoments ?? []}
          onAddFood={
            viewedIsForming
              ? () => {
                  setFoodVaultOpen(false);
                  setFoodPickerOpen(true);
                }
              : undefined
          }
          onClose={() => setFoodVaultOpen(false)}
        />
      ) : null}
      {studioPickerOpen ? (
        <StudioMomentSheet onConfirm={handleAddStudio} onClose={() => setStudioPickerOpen(false)} suggested={studioSuggestion} />
      ) : null}
      {studioVaultOpen ? (
        <StudioVaultSheet
          studioMoments={viewedDay.studioMoments ?? []}
          onAddStudio={
            viewedIsForming
              ? () => {
                  setStudioVaultOpen(false);
                  setStudioPickerOpen(true);
                }
              : undefined
          }
          onClose={() => setStudioVaultOpen(false)}
        />
      ) : null}
      {sanctuaryOpen ? (
        <SanctuarySheet
          day={viewedDay}
          onReflect={
            viewedIsForming
              ? () => {
                  setSanctuaryOpen(false);
                  openPromptSheet();
                }
              : undefined
          }
          onClose={() => setSanctuaryOpen(false)}
        />
      ) : null}
      {moodSheetOpen ? (
        <MoodMonumentSheet
          day={viewedDay}
          onChoose={viewedIsForming ? handleConfirmMood : undefined}
          onOpenSanctuary={() => {
            setMoodSheetOpen(false);
            setSanctuaryOpen(true);
          }}
          onClose={() => setMoodSheetOpen(false)}
        />
      ) : null}
      {sleepSheetOpen ? (
        <SleepSheet
          sleep={viewedDay.sleep ?? null}
          onSet={viewedIsForming ? handleSetSleep : undefined}
          onClose={() => setSleepSheetOpen(false)}
        />
      ) : null}
      {questBoardOpen ? (
        <QuestBoardSheet quests={memoryQuests} onQuest={handleQuest} onClose={() => setQuestBoardOpen(false)} />
      ) : null}
      {bigMomentPickerOpen ? (
        <BigMomentPickerSheet onPick={handlePickBigMoment} onClose={() => setBigMomentPickerOpen(false)} />
      ) : null}
      {stepsSheetOpen ? (
        <StepsPromptSheet
          stepsCount={viewedDay.stepsCount ?? null}
          onConfirm={handleConfirmSteps}
          onClose={() => setStepsSheetOpen(false)}
        />
      ) : null}
      {journeySheetOpen ? (
        <JourneyDetailSheet
          day={viewedDay}
          recentAvgSteps={recentAvgSteps}
          onClose={() => setJourneySheetOpen(false)}
          onViewMemories={() => {
            setJourneySheetOpen(false);
            setMemoryVaultTab('photos');
            setMemoryVaultOpen(true);
          }}
          onInterpret={
            viewedIsForming
              ? () => {
                  setJourneySheetOpen(false);
                  setStepsSheetOpen(true);
                }
              : undefined
          }
        />
      ) : null}
      {placesVaultOpen ? (
        <PlacesDetailSheet
          day={viewedDay}
          onClose={() => setPlacesVaultOpen(false)}
          onAddPlace={
            viewedIsForming
              ? () => {
                  setPlacesVaultOpen(false);
                  void handleAddCurrentPlace();
                }
              : undefined
          }
          onOpenMap={() => {
            setPlacesVaultOpen(false);
            handleOpenDayMap(viewedDay.id);
          }}
          onConfirmPlace={viewedIsForming ? handleConfirmPlaceFromVault : undefined}
          onOpenObservatory={() => {
            setPlacesVaultOpen(false);
            setObservatoryOpen(true);
          }}
        />
      ) : null}
      {observatoryOpen ? (
        <ObservatorySheet
          day={viewedDay}
          observations={observations}
          focusedObservationId={null}
          travelMemory={travelMemory}
          onViewPlaces={() => {
            setObservatoryOpen(false);
            setPlacesVaultOpen(true);
          }}
          onReflect={
            viewedIsForming
              ? () => {
                  setObservatoryOpen(false);
                  openPromptSheet();
                }
              : undefined
          }
          onClose={() => setObservatoryOpen(false)}
        />
      ) : null}
      {placePromptOpen && activePlace ? (
        <PlacePromptSheet
          placeName={placePreset && activePlace.name === 'A place you visited' ? 'Welcome back' : activePlace.name}
          timeLabel={activePlace.timeLabel}
          isNew={activePlace.isNew}
          presetCategory={placePreset}
          onConfirm={handleConfirmPlace}
          onClose={closePlacePrompt}
        />
      ) : null}
      {nameSheetOpen ? (
        <NameDaySheet
          initialName={viewedDay.dayName ?? null}
          suggestion={null}
          onSave={(name) => {
            setDayName(name, formingTarget);
            setMicrocopy('Today, named');
          }}
          onClose={() => setNameSheetOpen(false)}
        />
      ) : null}
    </>
  );
}
