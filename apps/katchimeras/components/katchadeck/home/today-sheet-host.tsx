import { type ComponentProps, useCallback, useEffect, useRef } from 'react';

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
import type { TodaySheetController } from '@/features/today/use-today-sheet-controller';
import type { DayInputTarget, HomeDayRecord, LocationPermissionState } from '@/types/home';
import type { MemoryQuest, MemoryQuestType } from '@/utils/memory-quests-engine';
import type { Observation } from '@/utils/observations-engine';

type TodaySheetHostProps = {
  viewedDay: HomeDayRecord | null;
  viewedIsForming: boolean;
  focusedMemoryId?: string;
  formingTarget: DayInputTarget;
  sheets: TodaySheetController;
  observatoryOpen: boolean;
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
  openJournalCapture: (flowId?: string) => void;
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
  setMicrocopy: (message: string | null) => void;
  setDayName: (name: string, target?: DayInputTarget) => void;
};

export function TodaySheetHost({
  viewedDay,
  viewedIsForming,
  focusedMemoryId,
  formingTarget,
  sheets,
  observatoryOpen,
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
  openJournalCapture,
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
  setMicrocopy,
  setDayName,
}: TodaySheetHostProps) {
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);
  const transitionSheet = useCallback((close: () => void, open: () => void) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    close();
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      open();
    }, 220);
  }, []);
  if (!viewedDay) {
    return null;
  }

  return (
    <>
      {memoryVaultOpen ? (
        <MemoryVaultSheet
          day={viewedDay}
          initialMemoryId={focusedMemoryId}
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
      {foodVaultOpen ? (
        <FoodVaultSheet
          foodMoments={viewedDay.foodMoments ?? []}
          onAddFood={
            viewedIsForming
              ? () => {
                  setFoodVaultOpen(false);
                  openJournalCapture('food');
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
                  openJournalCapture('studio');
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
                  () => openJournalCapture()
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
                  openJournalCapture('movement');
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
