import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { DayStepCountReading } from '@/hooks/use-day-step-capture';
import type {
  AddMomentInput,
  ActivityPermissionState,
  DayInputTarget,
  DayPromptKind,
  HealthPermissionState,
  LocationPermissionState,
  RecentPhotoAsset,
  StoredHomeState,
  ClassifiedMemory,
  TodayCareActionState,
  TodayGrowthSource,
  TodayEnergyActionCompletion,
} from '@/types/home';
import {
  addMomentToDay,
  answerDayPromptForToday,
  answerHatchCheckInForDay,
  startHatchCheckInForDay,
  finishHatchCheckInForDay,
  answerHeroPhotoMeaningForToday,
  applyCapturedMomentForDay,
  applyCapturedMomentForToday,
  applyNoteForToday,
  addManualJournalEntryForToday,
  addFoodMomentForToday,
  addStudioMomentForToday,
  setFoodMomentMeaningForToday,
  setStudioMomentRatingForToday,
  completeSeedForToday,
  confirmPlaceForToday,
  dismissPlaceCandidateForToday,
  enrichDayPlaceForToday,
  markBigMomentForToday,
  setSleepForToday,
  setStepsInterpretationForToday,
  setFeaturedMemoryForToday,
  setDayNameForToday,
  deriveTomorrowDayRecord,
  dismissDayPromptForToday,
  hydrateAllDays,
  hydrateHomeState,
  recordForegroundLocationSample,
  removeDayPlaceForToday,
  saveDayPlaceForToday,
  seedPhotoLocationsByDay,
  selectHeroPhotoForToday,
  selectPathForToday,
  updateActivityPermissionState,
  updateHealthPermissionState,
  updateLocationPermissionState,
  updateTodayStepCount,
  updateClassifiedMemoryForToday,
  awardGrowthForToday,
  completeTodayEnergyAction,
  updateTodayCareAction,
} from '@/game/days';
import {
  listAvailableDayPrompts,
  selectActiveDayPrompt,
  type ActiveDayPrompt,
  type DayPromptPhotoCandidate,
} from '@/utils/day-prompt-engine';
import { earnedSeeds, selectDailySeeds, type DailySeed } from '@/utils/daily-seeds-engine';
import { markPhotoProcessed } from '@/utils/processed-photos';
import { homeRepository } from '@/storage/repositories/home-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { useHatchController } from '@/features/today/use-hatch-controller';
import { useHealthRouteImport } from '@/features/today/use-health-route-import';
import { usePromptPhotoCandidates } from '@/features/today/use-prompt-photo-candidates';
import { useHomeStateMutation } from '@/features/today/use-home-state-mutation';
import { useQuestCapabilities } from '@/hooks/use-quest-capabilities';

type HomeScreenStateOptions = {
  /**
   * Media-library discovery and microphone probing are screen services, not
   * repository concerns. Background consumers opt out so they cannot duplicate
   * Today's expensive native permission/media work.
   */
  enableInteractiveServices?: boolean;
  /**
   * Full app screens persist lifecycle/hydration repairs after loading. Short-
   * lived capture routes can opt out so merely opening and cancelling a modal
   * does not replace the repository state and make Today rebuild its UI.
   * Explicit mutations still persist through useHomeStateMutation.
   */
  persistHydrationRepairs?: boolean;
};

export function useHomeScreenState({
  enableInteractiveServices = true,
  persistHydrationRepairs = true,
}: HomeScreenStateOptions = {}) {
  // Today is intentionally unmounted while full-screen routes (notably the
  // camera) are active. Seed a remount from the repository's in-memory state
  // so cancelling capture cannot render a brand-new day/check-in queue before
  // the focus effect restores the real state.
  const [storedState, setStoredState] = useState<StoredHomeState | null>(() => homeRepository.load());
  const [selectedDayId, setSelectedDayId] = useState<string>('today');
  const storedStateRef = useRef<StoredHomeState | null>(storedState);
  // The lazy initial value came directly from the repository and is already
  // scheduled/durable. Do not write it back during the first remount effect;
  // the focus hydration below will persist only an actually-derived repair.
  const scheduledStateRef = useRef<StoredHomeState | null>(storedState);
  const hasSynchronizedStateRef = useRef(false);
  const mutateHomeState = useHomeStateMutation(setStoredState, storedStateRef, scheduledStateRef);

  useEffect(() => {
    storedStateRef.current = storedState;
  }, [storedState]);

  const syncState = useCallback((forceDerive = false) => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const repositoryState = homeRepository.load();
    const previousTodayId = storedStateRef.current?.today.id ?? null;
    // Focus and repository events commonly point at the exact state already in
    // memory. Avoid cloning/normalizing the whole archive merely because a
    // screen regained focus. Timed/foreground refreshes still force lifecycle
    // derivation for hatch-hour and midnight transitions.
    if (
      hasSynchronizedStateRef.current
      && !forceDerive
      && repositoryState
      && repositoryState === storedStateRef.current
    ) {
      return;
    }
    const hydrated = hydrateHomeState(repositoryState ?? storedStateRef.current, profile, now);
    hasSynchronizedStateRef.current = true;

    // Repository notifications can arrive while an async screen callback is
    // still in flight. Update the mutation source synchronously so that callback
    // cannot rebuild and persist the pre-reset Today before React commits.
    storedStateRef.current = hydrated.state;
    setStoredState(hydrated.state);
    setSelectedDayId((current) => {
      // Follow a selected Today across midnight. The old tile stays immediately
      // to the left while the prepared Tomorrow record becomes centered Today.
      if (previousTodayId && previousTodayId !== hydrated.todayId && current === previousTodayId) {
        return hydrated.todayId;
      }
      // Keep an explicit selection when it's still a real day — either in the
      // recent timeline window OR anywhere in the archive (so a day opened from
      // the calendar / life-map survives re-derives). We deliberately do NOT
      // auto-jump to an unhatched past day; only an explicit selection sticks.
      if (
        hydrated.timelineDays.some((day) => day.id === current) ||
        hydrated.state.archivedDays.some((day) => day.id === current)
      ) {
        return current;
      }

      return hydrated.todayId;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncState();
    }, [syncState])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncState(true);
      } else {
        void homeRepository.flush();
      }
    });

    return () => subscription.remove();
  }, [syncState]);

  useEffect(() => homeRepository.subscribe(syncState), [syncState]);

  // Re-derive on a minute tick so a continuously-open app crosses its hatch hour
  // (forming → ready) and the midnight rollover on its own — without it, the
  // derived day state only refreshes on focus / foreground / a state mutation,
  // which is what made "today" look hatchable (or not) until you reselected it.
  // syncState no-ops when nothing actually changed, so this stays cheap.
  useEffect(() => {
    const interval = setInterval(() => {
      syncState(true);
    }, 60_000);

    return () => clearInterval(interval);
  }, [syncState]);

  useEffect(() => {
    if (!storedState || !persistHydrationRepairs) {
      return;
    }

    if (scheduledStateRef.current === storedState) {
      return;
    }
    scheduledStateRef.current = storedState;
    // Non-mutation state writers (hatching, health import, hydration repair)
    // share the same non-blocking persistence path.
    void homeRepository.saveDeferred(storedState, { notify: false });
  }, [persistHydrationRepairs, storedState]);

  const viewModel = useMemo(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    return hydrateHomeState(storedState, profile, now);
  }, [storedState]);

  const timelineDays = viewModel.timelineDays;
  const selectedInTimeline = timelineDays.find((day) => day.id === selectedDayId) ?? null;
  // Fall back to the full archive so a day chosen from the calendar / life-map
  // (outside the recent window) still resolves and shows on the Home page.
  // PERF: hydrating EVERY archived day is ~100x the work of the timeline and
  // used only for this rare path — so it runs only when the timeline missed,
  // never on the everyday today-mutation hot path.
  const selectedInArchive = useMemo(() => {
    if (!selectedDayId || selectedInTimeline) return null;
    return (
      hydrateAllDays(storedState, loadOnboardingProfile(), new Date()).find((day) => day.id === selectedDayId) ?? null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayId, selectedInTimeline === null, storedState]);
  const selectedDay =
    selectedInTimeline ??
    selectedInArchive ??
    timelineDays.find((day) => day.kind === 'day' && day.isToday) ??
    timelineDays[0] ??
    null;
  // Photo suggestions belong to the actual current day, not whichever card is
  // being viewed. The selected id is only an idle signal so carousel activity
  // cancels/postpones scanning without clearing already-curated candidates.
  const promptCandidateDay = viewModel.state.today;
  const {
    promptPhotoCandidates,
    forceMeaningfulPhotoPrompt,
    clearForcedMeaningfulPhotoPrompt,
  } = usePromptPhotoCandidates({
    dayId: promptCandidateDay.id,
    dayState: promptCandidateDay.state,
    enabled: enableInteractiveServices,
    interactionKey: selectedDayId,
  });
  const { triggerHatchIfReady } = useHatchController({
    selectedDay,
    state: viewModel.state,
    storedStateRef,
    setStoredState,
  });
  const { importingHealthRouteDayId, importHealthRoutesForDay } = useHealthRouteImport({
    storedStateRef,
    setStoredState,
  });

  const activeDayPrompt =
    selectedDay?.kind === 'day' && selectedDay.isToday && selectedDay.state !== 'hatched'
      ? selectActiveDayPrompt(selectedDay, new Date(), {
          photoCandidates: promptPhotoCandidates.length > 0 ? promptPhotoCandidates : undefined,
          forceMeaningfulPhoto: forceMeaningfulPhotoPrompt,
        })
      : null;
  // Every prompt the user could pick from the "Add to today" menu right now.
  const availableDayPrompts: ActiveDayPrompt[] =
    selectedDay?.kind === 'day' && selectedDay.isToday && selectedDay.state !== 'hatched'
      ? listAvailableDayPrompts(selectedDay, new Date(), {
          photoCandidates: promptPhotoCandidates.length > 0 ? promptPhotoCandidates : undefined,
          forceMeaningfulPhoto: forceMeaningfulPhotoPrompt,
        })
      : [];
  // Once today has hatched, the Add/Camera controls feed a forming "tomorrow"
  // (until the rollover makes a fresh egg). Expose that day + its prompts.
  const isTodayHatched = viewModel.state.today.state === 'hatched';

  // Today Patch V2 — the ≤3 Daily Seeds suggested for today, each flagged with
  // whether it has been earned (manually completed or passively satisfied).
  const todaySeedRecord = viewModel.state.today;
  const dailySeeds = useMemo<(DailySeed & { earned: boolean })[]>(() => {
    if (todaySeedRecord.state === 'hatched') return [];
    const earnedIds = new Set(earnedSeeds(todaySeedRecord).map((seed) => seed.id));
    return selectDailySeeds(todaySeedRecord).map((seed) => ({ ...seed, earned: earnedIds.has(seed.id) }));
  }, [todaySeedRecord]);
  const tomorrowDay = useMemo(
    () => deriveTomorrowDayRecord(viewModel.state, loadOnboardingProfile(), new Date()),
    [viewModel.state]
  );
  const tomorrowActivePrompt = isTodayHatched
    ? selectActiveDayPrompt(tomorrowDay, new Date(), {
        photoCandidates: promptPhotoCandidates.length > 0 ? promptPhotoCandidates : undefined,
        forceMeaningfulPhoto: forceMeaningfulPhotoPrompt,
      })
    : null;
  const tomorrowAvailablePrompts: ActiveDayPrompt[] = isTodayHatched
    ? listAvailableDayPrompts(tomorrowDay, new Date(), {
        photoCandidates: promptPhotoCandidates.length > 0 ? promptPhotoCandidates : undefined,
        forceMeaningfulPhoto: forceMeaningfulPhotoPrompt,
      })
    : [];
  const { capabilities: questCapabilities, requestMicrophonePermission } = useQuestCapabilities(
    viewModel.state,
    { refreshMicrophoneOnMount: enableInteractiveServices },
  );

  const addMoment = useCallback((momentInput: AddMomentInput, target: DayInputTarget = 'today') => {
    mutateHomeState((state, profile, now) => addMomentToDay(state, profile, momentInput, now, target));
  }, [mutateHomeState]);

  const completeSeed = useCallback((seedId: string, target: DayInputTarget = 'today') => {
    mutateHomeState((state, profile, now) => completeSeedForToday(state, seedId, profile, now, target));
  }, [mutateHomeState]);

  const addNote = useCallback(
    (note: Parameters<typeof applyNoteForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => applyNoteForToday(state, note, profile, now, target));
    },
    [mutateHomeState]
  );

  const confirmPlace = useCallback(
    (input: Parameters<typeof confirmPlaceForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => confirmPlaceForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const markBigMoment = useCallback(
    (input: Parameters<typeof markBigMomentForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => markBigMomentForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setSleep = useCallback(
    (sleep: Parameters<typeof setSleepForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setSleepForToday(state, sleep, profile, now, target));
    },
    [mutateHomeState]
  );

  const setStepsInterpretation = useCallback(
    (input: Parameters<typeof setStepsInterpretationForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setStepsInterpretationForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setFeaturedMemory = useCallback(
    (input: Parameters<typeof setFeaturedMemoryForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setFeaturedMemoryForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setDayName = useCallback(
    (name: string, target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setDayNameForToday(state, name, profile, now, target));
    },
    [mutateHomeState]
  );

  const addFoodMoment = useCallback(
    (input: Parameters<typeof addFoodMomentForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => addFoodMomentForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const addStudioMoment = useCallback(
    (input: Parameters<typeof addStudioMomentForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => addStudioMomentForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setFoodMomentMeaning = useCallback(
    (input: Parameters<typeof setFoodMomentMeaningForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setFoodMomentMeaningForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setStudioMomentRating = useCallback(
    (input: Parameters<typeof setStudioMomentRatingForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => setStudioMomentRatingForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const answerDayPrompt = useCallback(
    (
      input: { kind: DayPromptKind; choiceIds: string[]; noteText?: string | null },
      target: DayInputTarget = 'today'
    ) => {
      mutateHomeState((state, profile, now) =>
        answerDayPromptForToday(
          state,
          {
            kind: input.kind,
            choiceIds: input.choiceIds,
            noteText: input.noteText,
          },
          profile,
          now,
          target
        )
      );
    },
    [mutateHomeState]
  );

  const startHatchCheckIn = useCallback((dayId: string, reason: 'empty' | 'thin' | 'regular' | 'rich') => {
    mutateHomeState((state, profile, now) => startHatchCheckInForDay(state, dayId, reason, profile, now));
  }, [mutateHomeState]);

  const awardGrowth = useCallback((
    input: { source: TodayGrowthSource; sourceId: string; actionId?: string | null; amount?: number },
    target: DayInputTarget = 'today',
  ) => {
    mutateHomeState((state, profile, now) => awardGrowthForToday(state, input, profile, now, target));
  }, [mutateHomeState]);

  const updateCareAction = useCallback((
    input: Omit<TodayCareActionState, 'updatedAt'>,
    target: DayInputTarget = 'today',
  ) => {
    mutateHomeState((state, profile, now) => updateTodayCareAction(state, input, profile, now, target));
  }, [mutateHomeState]);

  const completeEnergyAction = useCallback((
    input: TodayEnergyActionCompletion,
    target: DayInputTarget = 'today',
  ) => {
    mutateHomeState((state, profile, now) => completeTodayEnergyAction(state, input, profile, now, target));
  }, [mutateHomeState]);

  const answerHatchCheckIn = useCallback(
    (dayId: string, input: { kind: 'flow' | 'category' | 'moment' | 'meaning'; id: string }) => {
      mutateHomeState((state, profile, now) => answerHatchCheckInForDay(state, dayId, input, profile, now));
    },
    [mutateHomeState]
  );

  const finishHatchCheckIn = useCallback(
    (dayId: string, status: 'completed' | 'partial' | 'skipped') => {
      mutateHomeState((state, profile, now) => finishHatchCheckInForDay(state, dayId, status, profile, now));
    },
    [mutateHomeState]
  );

  const dismissDayPrompt = useCallback(
    (kind: DayPromptKind, target: DayInputTarget = 'today') => {
      if (kind === 'meaningful_photo' && forceMeaningfulPhotoPrompt) {
        clearForcedMeaningfulPhotoPrompt();
      }

      mutateHomeState((state, profile, now) => dismissDayPromptForToday(state, kind, profile, now, target));
    },
    [clearForcedMeaningfulPhotoPrompt, forceMeaningfulPhotoPrompt, mutateHomeState]
  );

  const selectHeroPhoto = useCallback(
    (photo: DayPromptPhotoCandidate, target: DayInputTarget = 'today') => {
      // Remember this asset globally so it never prompts again (survives restart),
      // independent of the day record.
      markPhotoProcessed(photo.assetId);

      if (forceMeaningfulPhotoPrompt) {
        clearForcedMeaningfulPhotoPrompt();
      }

      mutateHomeState((state, profile, now) =>
        selectHeroPhotoForToday(
          state,
          {
            assetId: photo.assetId,
            thumbnailUri: photo.thumbnailUri,
            localUri: photo.localUri,
          },
          profile,
          now,
          target
        )
      );
    },
    [clearForcedMeaningfulPhotoPrompt, forceMeaningfulPhotoPrompt, mutateHomeState]
  );

  // Fold a camera capture into today: its captured energy (score deltas) and the
  // detected subject (vision) both contribute to the hatch + reflection.
  const applyCapturedMoment = useCallback(
    (
      capture: Parameters<typeof applyCapturedMomentForToday>[1],
      target: DayInputTarget = 'today'
    ) => {
      mutateHomeState((state, profile, now) => applyCapturedMomentForToday(state, capture, profile, now, target));
    },
    [mutateHomeState]
  );

  const answerPhotoMeaning = useCallback(
    (input: { choiceIds: string[]; noteText?: string | null }, target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => answerHeroPhotoMeaningForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const setLocationPermission = useCallback((permission: LocationPermissionState) => {
    mutateHomeState((state, profile, now) => updateLocationPermissionState(state, permission, profile, now));
  }, [mutateHomeState]);

  const setHealthPermission = useCallback((permission: HealthPermissionState) => {
    mutateHomeState((state, profile, now) => updateHealthPermissionState(state, permission, profile, now));
  }, [mutateHomeState]);

  const setActivityPermission = useCallback((permission: ActivityPermissionState) => {
    mutateHomeState((state, profile, now) => updateActivityPermissionState(state, permission, profile, now));
  }, [mutateHomeState]);

  const setTodayStepCount = useCallback((reading: DayStepCountReading) => {
    mutateHomeState((state, profile, now) => updateTodayStepCount(state, reading, profile, now));
  }, [mutateHomeState]);

  const addForegroundLocationSample = useCallback(
    (sample: {
      lat: number;
      lng: number;
      capturedAt: string;
      accuracyMeters?: number;
    }) => {
      mutateHomeState((state, profile, now) => recordForegroundLocationSample(state, sample, profile, now));
    },
    [mutateHomeState]
  );

  const seedRecentPhotoLocations = useCallback((photos: RecentPhotoAsset[]) => {
    mutateHomeState((state, profile, now) => seedPhotoLocationsByDay(state, photos, profile, now));
  }, [mutateHomeState]);

  const selectTimelineDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
  }, []);

  const selectPath = useCallback((pathId: string) => {
    mutateHomeState((state, profile, now) => selectPathForToday(state, pathId, profile, now));
  }, [mutateHomeState]);

  // NOTE: there is intentionally NO automatic retrospective backfill here.
  // "Hatch your past" (run from onboarding, app/hatch-your-past.tsx) is the
  // single source of the initial reconstruction — it reconstructs AND hatches
  // the last few days, and the home then shows exactly those katchimeras. A
  // separate auto-backfill used to run here and create *forming* (un-hatched)
  // days, which diverged from the hatch-your-past reveal; it was removed so the
  // two can never disagree.


  const refreshState = useCallback(() => {
    syncState();
  }, [syncState]);

  const resetHomeState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(null, profile, now);

    homeRepository.clear();
    setStoredState(hydrated.state);
    setSelectedDayId(hydrated.todayId);
  }, []);

  const setCloudIntelligenceEnabled = useCallback(
    (enabled: boolean) => {
      mutateHomeState((state) => ({ ...state, cloudIntelligenceEnabled: enabled }));
    },
    [mutateHomeState]
  );

  const applyCapturedMomentToDay = useCallback(
    (
      dayId: string,
      capture: Parameters<typeof applyCapturedMomentForDay>[1],
      observedAt?: string | null
    ) => {
      mutateHomeState((state, profile, now) =>
        applyCapturedMomentForDay(state, capture, dayId, profile, now, observedAt)
      );
    },
    [mutateHomeState]
  );

  const saveDayPlace = useCallback(
    (input: Parameters<typeof saveDayPlaceForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => saveDayPlaceForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );
  const enrichDayPlace = useCallback(
    (input: Parameters<typeof enrichDayPlaceForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => enrichDayPlaceForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );
  const removeDayPlace = useCallback((id: string, target: DayInputTarget = 'today') => {
    mutateHomeState((state, profile, now) => removeDayPlaceForToday(state, id, profile, now, target));
  }, [mutateHomeState]);
  const dismissPlaceCandidate = useCallback((id: string, target: DayInputTarget = 'today') => {
    mutateHomeState((state, profile, now) => dismissPlaceCandidateForToday(state, id, profile, now, target));
  }, [mutateHomeState]);

  const addManualJournalEntry = useCallback(
    (input: Parameters<typeof addManualJournalEntryForToday>[1], target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => addManualJournalEntryForToday(state, input, profile, now, target));
    },
    [mutateHomeState]
  );

  const updateClassifiedMemory = useCallback(
    (memory: ClassifiedMemory, target: DayInputTarget = 'today') => {
      mutateHomeState((state, profile, now) => updateClassifiedMemoryForToday(state, memory, profile, now, target));
    },
    [mutateHomeState]
  );

  return {
    timelineDays,
    selectedDayId: selectedDay?.id ?? viewModel.todayId,
    selectedDay,
    activeDayPrompt,
    availableDayPrompts,
    applyCapturedMoment,
    applyCapturedMomentToDay,
    dailySeeds,
    completeSeed,
    awardGrowth,
    completeEnergyAction,
    updateCareAction,
    addNote,
    confirmPlace,
    saveDayPlace,
    enrichDayPlace,
    removeDayPlace,
    dismissPlaceCandidate,
    markBigMoment,
    addManualJournalEntry,
    setSleep,
    setStepsInterpretation,
    setFeaturedMemory,
    setDayName,
    addFoodMoment,
    addStudioMoment,
    setFoodMomentMeaning,
    setStudioMomentRating,
    isTodayHatched,
    tomorrowDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    locationPermission: viewModel.state.locationPermission,
    activityPermission: viewModel.state.activityPermission,
    healthPermission: viewModel.state.healthPermission,
    cloudIntelligenceEnabled: viewModel.state.cloudIntelligenceEnabled,
    personalEntities: viewModel.state.personalEntities,
    setCloudIntelligenceEnabled,
    updateClassifiedMemory,
    questCapabilities,
    requestMicrophonePermission,
    importingHealthRouteDayId,
    addMoment,
    answerDayPrompt,
    startHatchCheckIn,
    answerHatchCheckIn,
    finishHatchCheckIn,
    answerPhotoMeaning,
    dismissDayPrompt,
    addForegroundLocationSample,
    importHealthRoutesForDay,
    seedRecentPhotoLocations,
    selectHeroPhoto,
    setActivityPermission,
    setHealthPermission,
    setLocationPermission,
    setTodayStepCount,
    selectTimelineDay,
    selectPath,
    triggerHatchIfReady,
    refreshState,
    resetHomeState,
  };
}
