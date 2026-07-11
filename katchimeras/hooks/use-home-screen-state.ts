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
} from '@/types/home';
import {
  addMomentToDay,
  answerDayPromptForToday,
  answerHeroPhotoMeaningForToday,
  applyCapturedMomentForToday,
  applyNoteForToday,
  addFoodMomentForToday,
  addStudioMomentForToday,
  setFoodMomentMeaningForToday,
  setStudioMomentRatingForToday,
  completeSeedForToday,
  confirmPlaceForToday,
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
  seedPhotoLocationsByDay,
  selectHeroPhotoForToday,
  selectPathForToday,
  updateActivityPermissionState,
  updateHealthPermissionState,
  updateLocationPermissionState,
  updateTodayStepCount,
  updateClassifiedMemoryForToday,
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

export function useHomeScreenState() {
  const [storedState, setStoredState] = useState<StoredHomeState | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('today');
  const storedStateRef = useRef<StoredHomeState | null>(storedState);
  const mutateHomeState = useHomeStateMutation(setStoredState, storedStateRef);

  useEffect(() => {
    storedStateRef.current = storedState;
  }, [storedState]);

  const syncState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(homeRepository.load() ?? storedStateRef.current, profile, now);

    setStoredState((current) => (areStoredStatesEqual(current, hydrated.state) ? current : hydrated.state));
    setSelectedDayId((current) => {
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
        syncState();
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
      syncState();
    }, 60_000);

    return () => clearInterval(interval);
  }, [syncState]);

  useEffect(() => {
    if (!storedState) {
      return;
    }

    homeRepository.save(storedState);
  }, [storedState]);

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
  const selectedPromptDayId = selectedDay?.kind === 'day' ? selectedDay.id : null;
  const selectedPromptDayIsToday = selectedDay?.kind === 'day' ? selectedDay.isToday : false;
  const selectedPromptDayState = selectedDay?.kind === 'day' ? selectedDay.state : null;
  const {
    promptPhotoCandidates,
    forceMeaningfulPhotoPrompt,
    clearForcedMeaningfulPhotoPrompt,
  } = usePromptPhotoCandidates({
    dayId: selectedPromptDayId,
    isToday: selectedPromptDayIsToday,
    dayState: selectedPromptDayState,
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
  const { capabilities: questCapabilities, requestMicrophonePermission } = useQuestCapabilities(viewModel.state);

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
    dailySeeds,
    completeSeed,
    addNote,
    confirmPlace,
    markBigMoment,
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

function areStoredStatesEqual(left: StoredHomeState | null, right: StoredHomeState | null) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}
