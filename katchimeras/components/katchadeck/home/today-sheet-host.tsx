import type { ComponentProps } from 'react';

import { BigMomentPickerSheet } from '@/components/katchadeck/world/big-moment-picker-sheet';
import { JourneyDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { TodayPlacesSheet } from '@/components/katchadeck/home/today-places-sheet';
import { FoodMomentSheet, FoodVaultSheet } from '@/components/katchadeck/world/food-vault-sheet';
import { MemoryVaultSheet } from '@/components/katchadeck/world/memory-vault-sheet';
import { MoodMonumentSheet } from '@/components/katchadeck/world/mood-monument-sheet';
import { NameDaySheet } from '@/components/katchadeck/world/name-day-sheet';
import { ObservatorySheet } from '@/components/katchadeck/world/observatory-sheet';
import { QuestBoardSheet } from '@/components/katchadeck/world/quest-board-sheet';
import { SanctuarySheet } from '@/components/katchadeck/world/sanctuary-sheet';
import { SleepSheet } from '@/components/katchadeck/world/sleep-sheet';
import { StepsPromptSheet } from '@/components/katchadeck/world/steps-prompt-sheet';
import { StudioMomentSheet, StudioVaultSheet } from '@/components/katchadeck/world/studio-vault-sheet';
import type { FoodMomentFollowUp, StudioMomentFollowUp } from '@/features/today/use-moment-follow-up-controller';
import type { TodaySheetController } from '@/features/today/use-today-sheet-controller';
import type { DayInputTarget, HomeDayRecord, LocationPermissionState } from '@/types/home';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';
import type { Observation } from '@/utils/observations-engine';

type FoodConfirmInput = Parameters<ComponentProps<typeof FoodMomentSheet>['onConfirm']>[0];
type StudioConfirmInput = Parameters<ComponentProps<typeof StudioMomentSheet>['onConfirm']>[0];
type TodaySheetHostProps = {
  viewedDay: HomeDayRecord | null;
  viewedIsForming: boolean;
  formingTarget: DayInputTarget;
  sheets: TodaySheetController;
  observatoryOpen: boolean;
  foodFollowUp: FoodMomentFollowUp | null;
  studioFollowUp: StudioMomentFollowUp | null;
  suppressFollowUps: boolean;
  memoryQuests: MemoryQuest[];
  recentAvgSteps: number | null;
  observations: Observation[];
  travelMemory: ComponentProps<typeof ObservatorySheet>['travelMemory'];
  cloudIntelligenceEnabled: boolean;
  setCloudIntelligenceEnabled: (enabled: boolean) => void;
  onOpenIntelligenceLab?: () => void;
  setObservatoryOpen: (open: boolean) => void;
  onCapturePhoto: () => void;
  onCaptureNote: (input?: 'text' | 'voice') => void;
  openPromptSheet: () => void;
  openManualJournal: (flowId?: string) => void;
  handleOpenDayMap: (dayId: string) => void;
  handleAddFood: ComponentProps<typeof FoodMomentSheet>['onConfirm'];
  handleAddStudio: ComponentProps<typeof StudioMomentSheet>['onConfirm'];
  handlePickBigMoment: ComponentProps<typeof BigMomentPickerSheet>['onPick'];
  handleConfirmMood: NonNullable<ComponentProps<typeof MoodMonumentSheet>['onChoose']>;
  handleSetSleep: NonNullable<ComponentProps<typeof SleepSheet>['onSet']>;
  handleConfirmSteps: ComponentProps<typeof StepsPromptSheet>['onConfirm'];
  handleQuest: (type: MemoryQuestType) => void;
  locationPermission: LocationPermissionState;
  saveDayPlace: (input: Parameters<ComponentProps<typeof TodayPlacesSheet>['onSavePlace']>[0], target?: DayInputTarget) => void;
  enrichDayPlace: (input: Parameters<ComponentProps<typeof TodayPlacesSheet>['onEnrichPlace']>[0], target?: DayInputTarget) => void;
  removeDayPlace: (id: string, target?: DayInputTarget) => void;
  dismissPlaceCandidate: (id: string, target?: DayInputTarget) => void;
  setLocationPermission: (permission: LocationPermissionState) => void;
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
  sheets,
  observatoryOpen,
  foodFollowUp,
  studioFollowUp,
  suppressFollowUps,
  memoryQuests,
  recentAvgSteps,
  observations,
  travelMemory,
  cloudIntelligenceEnabled,
  setCloudIntelligenceEnabled,
  onOpenIntelligenceLab,
  setObservatoryOpen,
  onCapturePhoto,
  onCaptureNote,
  openPromptSheet,
  openManualJournal,
  handleOpenDayMap,
  handleAddFood,
  handleAddStudio,
  handlePickBigMoment,
  handleConfirmMood,
  handleSetSleep,
  handleConfirmSteps,
  handleQuest,
  locationPermission,
  saveDayPlace,
  enrichDayPlace,
  removeDayPlace,
  dismissPlaceCandidate,
  setLocationPermission,
  setFoodMomentMeaning,
  setStudioMomentRating,
  clearFoodFollowUp,
  clearStudioFollowUp,
  pulseEgg,
  setMicrocopy,
  setDayName,
}: TodaySheetHostProps) {
  const {
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
    nameSheetOpen,
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
    setNameSheetOpen,
  } = sheets;

  // React Native can retain an invisible interaction layer when one native
  // Modal is removed in the same commit that another is mounted. Sequence
  // reader-to-reader transitions so the first portal fully releases touches.
  const transitionSheet = (close: () => void, open: () => void) => {
    close();
    setTimeout(open, 220);
  };
  if (!viewedDay) {
    return null;
  }

  const blockingSheetOpen =
    memoryVaultOpen ||
    foodPickerOpen ||
    foodVaultOpen ||
    studioPickerOpen ||
    studioVaultOpen ||
    sanctuaryOpen ||
    moodSheetOpen ||
    sleepSheetOpen ||
    questBoardOpen ||
    bigMomentPickerOpen ||
    stepsSheetOpen ||
    journeySheetOpen ||
    placesVaultOpen ||
    observatoryOpen ||
    nameSheetOpen;

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
                  onCaptureNote('voice');
                }
              : undefined
          }
          onAddNote={
            viewedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  onCaptureNote('text');
                }
              : undefined
          }
          onClose={() => setMemoryVaultOpen(false)}
        />
      ) : null}
      {foodPickerOpen ? (
        <FoodMomentSheet onConfirm={handleAddFood} onClose={() => setFoodPickerOpen(false)} />
      ) : null}
      {foodFollowUp && !blockingSheetOpen && !suppressFollowUps ? (
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
      {studioFollowUp && !blockingSheetOpen && !suppressFollowUps ? (
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
                  openManualJournal('food');
                }
              : undefined
          }
          onClose={() => setFoodVaultOpen(false)}
        />
      ) : null}
      {studioPickerOpen ? (
        <StudioMomentSheet onConfirm={handleAddStudio} onClose={() => setStudioPickerOpen(false)} />
      ) : null}
      {studioVaultOpen ? (
        <StudioVaultSheet
          studioMoments={viewedDay.studioMoments ?? []}
          onAddStudio={
            viewedIsForming
              ? () => {
                  setStudioVaultOpen(false);
                  openManualJournal('studio');
                }
              : undefined
          }
          onClose={() => setStudioVaultOpen(false)}
        />
      ) : null}
      {sanctuaryOpen ? (
        <SanctuarySheet
          day={viewedDay}
          onAddMoment={
            viewedIsForming
              ? () => transitionSheet(
                  () => setSanctuaryOpen(false),
                  () => openManualJournal()
                )
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
            transitionSheet(
              () => setMoodSheetOpen(false),
              () => setSanctuaryOpen(true)
            );
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
          detectedActivityTypes={(viewedDay.exactRouteSegments ?? []).map((segment) => segment.activityType)}
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
                  openManualJournal('movement');
                }
              : undefined
          }
        />
      ) : null}
      {placesVaultOpen ? (
        <TodayPlacesSheet
          day={viewedDay}
          editable={viewedIsForming}
          locationPermission={locationPermission}
          target={formingTarget}
          onClose={() => setPlacesVaultOpen(false)}
          onDismissCandidate={(id) => dismissPlaceCandidate(id, formingTarget)}
          onEnrichPlace={(input) => enrichDayPlace(input, formingTarget)}
          onLocationPermissionChange={setLocationPermission}
          onOpenMap={() => transitionSheet(() => setPlacesVaultOpen(false), () => handleOpenDayMap(viewedDay.id))}
          onRemovePlace={(id) => removeDayPlace(id, formingTarget)}
          onSavePlace={(input) => saveDayPlace(input, formingTarget)}
        />
      ) : null}
      {observatoryOpen ? (
        <ObservatorySheet
          day={viewedDay}
          observations={observations}
          focusedObservationId={null}
          travelMemory={travelMemory}
          cloudIntelligenceEnabled={cloudIntelligenceEnabled}
          onCloudIntelligenceChange={setCloudIntelligenceEnabled}
          onOpenIntelligenceLab={onOpenIntelligenceLab}
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
