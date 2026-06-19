import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type {
  AddMomentInput,
  ActivityPermissionState,
  DayInputTarget,
  DayPromptKind,
  DayScores,
  DayVisionSummary,
  HealthPermissionState,
  LocationPermissionState,
  RecentPhotoAsset,
  StoredHomeState,
} from '@/types/home';
import {
  addMomentToDay,
  answerDayPromptForToday,
  answerHeroPhotoMeaningForToday,
  applyBackfilledDays,
  applyCapturedMomentForToday,
  applyGeneratedReflection,
  deriveTomorrowDayRecord,
  dismissDayPromptForToday,
  hydrateHomeState,
  importHealthRoutesForDay as applyHealthRoutesForDay,
  type ImportedHealthRoutesPayload,
  recordForegroundLocationSample,
  seedPhotoLocationsByDay,
  selectHeroPhotoForToday,
  setDayWeatherForDay,
  setPlaceCategorySeedsForDay,
  triggerHatchForDay,
  updateActivityPermissionState,
  updateHealthPermissionState,
  updateLocationPermissionState,
  updateTodayStepCount,
} from '@/utils/home-engine';
import {
  listAvailableDayPrompts,
  selectActiveDayPrompt,
  type ActiveDayPrompt,
  type DayPromptPhotoCandidate,
} from '@/utils/day-prompt-engine';
import {
  clearStoredDevPromptPhotoCandidates,
  loadProductionDayPromptPhotoCandidates,
  loadStoredDevPromptPhotoCandidates,
} from '@/utils/day-prompt-photos';
import { collectBackfillDays } from '@/utils/day-backfill';
import { requestDayReflection } from '@/utils/day-reflection';
import { ensureDayVision } from '@/utils/photo-vision';
import { ensureDayWeather } from '@/utils/day-weather';
import {
  getHatchNotificationPermission,
  requestHatchNotificationPermission,
  syncHatchNotification,
} from '@/utils/hatch-notification';
import { resolvePlaceSeedsForDay } from '@/utils/place-categories';
import { syncWidgetState } from '@/utils/widget-state';
import { getHealthRouteAvailability, importRoutesForDay, requestHealthRoutePermission } from '@/utils/health-route-import';
import { clearStoredHomeState, loadStoredHomeState, saveStoredHomeState } from '@/utils/home-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';

export function useHomeScreenState() {
  const [storedState, setStoredState] = useState<StoredHomeState | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string>('today');
  const [importingHealthRouteDayId, setImportingHealthRouteDayId] = useState<string | null>(null);
  const [promptPhotoCandidates, setPromptPhotoCandidates] = useState<DayPromptPhotoCandidate[]>([]);
  const [forceMeaningfulPhotoPrompt, setForceMeaningfulPhotoPrompt] = useState(false);
  const storedStateRef = useRef<StoredHomeState | null>(storedState);

  useEffect(() => {
    storedStateRef.current = storedState;
  }, [storedState]);

  const syncState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(loadStoredHomeState() ?? storedStateRef.current, profile, now);

    setStoredState((current) => (areStoredStatesEqual(current, hydrated.state) ? current : hydrated.state));
    setSelectedDayId((current) => {
      // Always land on TODAY (and keep an explicit selection when it's still a
      // real day in the timeline). We deliberately do NOT auto-jump to an
      // unhatched past day: backfilled/missed days resolve to "ready_to_hatch",
      // so auto-selecting one made the app open on a "Reveal hatch" screen that
      // read as today even before the hatch hour. Past days are reached via the
      // timeline instead.
      if (hydrated.timelineDays.some((day) => day.id === current)) {
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

    saveStoredHomeState(storedState);
  }, [storedState]);

  const viewModel = useMemo(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(storedState, profile, now);
    return hydrated;
  }, [storedState]);

  const timelineDays = viewModel.timelineDays;
  const selectedDay =
    timelineDays.find((day) => day.id === selectedDayId) ??
    timelineDays.find((day) => day.kind === 'day' && day.isToday) ??
    timelineDays[0] ??
    null;
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

  const selectedPromptDayId = selectedDay?.kind === 'day' ? selectedDay.id : null;
  const selectedPromptDayIsToday = selectedDay?.kind === 'day' ? selectedDay.isToday : false;
  const selectedPromptDayState = selectedDay?.kind === 'day' ? selectedDay.state : null;

  useEffect(() => {
    if (selectedDay?.kind !== 'day' || !selectedDay.isToday || selectedDay.state === 'hatched') {
      setPromptPhotoCandidates([]);
      setForceMeaningfulPhotoPrompt(false);
      return;
    }

    let active = true;

    void (async () => {
      const devCandidates = __DEV__ ? loadStoredDevPromptPhotoCandidates() : [];
      if (devCandidates.length > 0) {
        if (active) {
          setPromptPhotoCandidates(devCandidates);
          setForceMeaningfulPhotoPrompt(true);
        }
        return;
      }

      const candidates = await loadProductionDayPromptPhotoCandidates(new Date());
      if (active) {
        setPromptPhotoCandidates(candidates);
        setForceMeaningfulPhotoPrompt(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedDay, selectedPromptDayId, selectedPromptDayIsToday, selectedPromptDayState]);

  const addMoment = useCallback((momentInput: AddMomentInput, target: DayInputTarget = 'today') => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return addMomentToDay(hydrated.state, profile, momentInput, now, target);
    });
  }, []);

  const answerDayPrompt = useCallback(
    (
      input: { kind: DayPromptKind; choiceIds: string[]; noteText?: string | null },
      target: DayInputTarget = 'today'
    ) => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return answerDayPromptForToday(
          hydrated.state,
          {
            kind: input.kind,
            choiceIds: input.choiceIds,
            noteText: input.noteText,
          },
          profile,
          now,
          target
        );
      });
    },
    []
  );

  const dismissDayPrompt = useCallback(
    (kind: DayPromptKind, target: DayInputTarget = 'today') => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      if (kind === 'meaningful_photo' && forceMeaningfulPhotoPrompt) {
        clearStoredDevPromptPhotoCandidates();
        setForceMeaningfulPhotoPrompt(false);
        setPromptPhotoCandidates([]);
      }

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return dismissDayPromptForToday(hydrated.state, kind, profile, now, target);
      });
    },
    [forceMeaningfulPhotoPrompt]
  );

  const selectHeroPhoto = useCallback(
    (photo: DayPromptPhotoCandidate, target: DayInputTarget = 'today') => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      if (forceMeaningfulPhotoPrompt) {
        clearStoredDevPromptPhotoCandidates();
        setForceMeaningfulPhotoPrompt(false);
      }

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return selectHeroPhotoForToday(
          hydrated.state,
          {
            assetId: photo.assetId,
            thumbnailUri: photo.thumbnailUri,
            localUri: photo.localUri,
          },
          profile,
          now,
          target
        );
      });
    },
    [forceMeaningfulPhotoPrompt]
  );

  // Fold a camera capture into today: its captured energy (score deltas) and the
  // detected subject (vision) both contribute to the hatch + reflection.
  const applyCapturedMoment = useCallback(
    (capture: { energy: Partial<DayScores>; vision: DayVisionSummary | null }, target: DayInputTarget = 'today') => {
      const now = new Date();
      const profile = loadOnboardingProfile();
      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return applyCapturedMomentForToday(hydrated.state, capture, profile, now, target);
      });
    },
    []
  );

  const answerPhotoMeaning = useCallback(
    (input: { choiceIds: string[]; noteText?: string | null }, target: DayInputTarget = 'today') => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return answerHeroPhotoMeaningForToday(hydrated.state, input, profile, now, target);
      });
    },
    []
  );

  const setLocationPermission = useCallback((permission: LocationPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateLocationPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setHealthPermission = useCallback((permission: HealthPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateHealthPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setActivityPermission = useCallback((permission: ActivityPermissionState) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateActivityPermissionState(hydrated.state, permission, profile, now);
    });
  }, []);

  const setTodayStepCount = useCallback((stepsCount: number) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return updateTodayStepCount(hydrated.state, stepsCount, profile, now);
    });
  }, []);

  const addForegroundLocationSample = useCallback(
    (sample: {
      lat: number;
      lng: number;
      capturedAt: string;
      accuracyMeters?: number;
    }) => {
      const now = new Date();
      const profile = loadOnboardingProfile();

      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return recordForegroundLocationSample(hydrated.state, sample, profile, now);
      });
    },
    []
  );

  const seedRecentPhotoLocations = useCallback((photos: RecentPhotoAsset[]) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return seedPhotoLocationsByDay(hydrated.state, photos, profile, now);
    });
  }, []);

  const selectTimelineDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
  }, []);

  const selectPath = useCallback((pathId: string) => {
    const now = new Date();
    const profile = loadOnboardingProfile();

    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return {
        ...hydrated.state,
        today: {
          ...hydrated.state.today,
          selectedPathId: hydrated.state.today.selectedPathId === pathId ? null : pathId,
        },
      };
    });
  }, []);

  const todayId = viewModel.state.today.id;
  const todayState = viewModel.state.today.state;

  useEffect(() => {
    const state = storedStateRef.current;
    if (!state) {
      return;
    }

    const profile = loadOnboardingProfile();
    void syncHatchNotification(state, profile);
    void syncWidgetState(state, profile);
  }, [todayId, todayState]);

  // One-shot retrospective init: reconstruct the last few days from pedometer
  // history and already-granted photo geotags, replacing the demo seed days.
  const backfillAttempted = useRef(false);
  const hasBackfilled = Boolean(viewModel.state.backfilledAt);

  useEffect(() => {
    if (backfillAttempted.current || hasBackfilled) {
      return;
    }
    backfillAttempted.current = true;

    void (async () => {
      const profile = loadOnboardingProfile();
      // Reconstruct the last 5 days, reading each day's photos on-device so the
      // stored day carries its vision — that's what lets a later hatch pick the
      // creature the photos showed and write a specific (non-generic) quote.
      const days = await collectBackfillDays(new Date(), 5, { analyzeVision: true });
      const now = new Date();
      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        if (hydrated.state.backfilledAt) {
          return hydrated.state;
        }
        return applyBackfilledDays(hydrated.state, days, profile, now);
      });
    })();
  }, [hasBackfilled]);

  const placeResolutionInFlight = useRef<string | null>(null);

  useEffect(() => {
    const today = viewModel.state.today;
    if (
      today.state !== 'ready_to_hatch' ||
      today.placeCategorySeeds !== undefined ||
      today.locations.length === 0 ||
      placeResolutionInFlight.current === today.id
    ) {
      return;
    }

    placeResolutionInFlight.current = today.id;
    void (async () => {
      const seeds = await resolvePlaceSeedsForDay(today, viewModel.state.archivedDays);
      const profile = loadOnboardingProfile();
      const now = new Date();
      setStoredState((currentState) => {
        const hydrated = hydrateHomeState(currentState, profile, now);
        return setPlaceCategorySeedsForDay(hydrated.state, today.id, seeds, profile, now);
      });
    })();
  }, [viewModel]);

  const enhanceDayReflection = useCallback(async (hatchedState: StoredHomeState, dayId: string) => {
    const profile = loadOnboardingProfile();
    const day =
      hatchedState.today.id === dayId
        ? hatchedState.today
        : hatchedState.archivedDays.find((candidate) => candidate.id === dayId) ?? null;

    if (!day?.creature || day.creature.reflectionSource === 'generated') {
      return;
    }

    // Make sure the day's photos have been read so the quote can name what they
    // actually showed; falls back to whatever vision (or none) was there.
    const vision = await ensureDayVision(day);
    const dayForReflection = vision ? { ...day, vision } : day;

    // The days before this one give the line its temporal read (streaks,
    // recovery after a busy stretch, shared history with this creature).
    const pastDays = hatchedState.archivedDays.filter((candidate) => candidate.id !== dayId);
    const generated = await requestDayReflection(dayForReflection, profile, pastDays);
    if (!generated) {
      return;
    }

    const now = new Date();
    setStoredState((currentState) => {
      const hydrated = hydrateHomeState(currentState, profile, now);
      return applyGeneratedReflection(hydrated.state, dayId, generated, profile, now);
    });
  }, []);

  const triggerHatchIfReady = useCallback(async () => {
    if (!selectedDay || selectedDay.kind !== 'day') {
      return;
    }

    const profile = loadOnboardingProfile();
    let now = new Date();
    const hydrated = hydrateHomeState(loadStoredHomeState() ?? storedStateRef.current, profile, now);
    let baseState = hydrated.state;

    const targetDay =
      baseState.today.id === selectedDay.id
        ? baseState.today
        : baseState.archivedDays.find((day) => day.id === selectedDay.id) ?? null;

    if (targetDay && targetDay.placeCategorySeeds === undefined && targetDay.locations.length > 0) {
      const seeds = await Promise.race([
        resolvePlaceSeedsForDay(
          targetDay,
          baseState.archivedDays.filter((day) => day.id !== targetDay.id)
        ),
        new Promise<string[]>((resolve) => {
          setTimeout(() => resolve([]), 2500);
        }),
      ]);
      now = new Date();
      baseState = setPlaceCategorySeedsForDay(baseState, selectedDay.id, seeds, profile, now);
    }

    // Resolve the day's weather before hatching so the mood read (and the
    // persisted variant) can account for a rainy stay-in vs a fair-day choice,
    // and so the small weather icon has something to show. Best-effort.
    const weatherTarget =
      baseState.today.id === selectedDay.id
        ? baseState.today
        : baseState.archivedDays.find((day) => day.id === selectedDay.id) ?? null;
    if (weatherTarget && weatherTarget.weather === undefined && weatherTarget.locations.length > 0) {
      const weather = await ensureDayWeather(weatherTarget);
      if (weather) {
        now = new Date();
        baseState = setDayWeatherForDay(baseState, selectedDay.id, weather, profile, now);
      }
    }

    const hatchedState = triggerHatchForDay(baseState, selectedDay.id, profile, now);
    setStoredState(hatchedState);
    void enhanceDayReflection(hatchedState, selectedDay.id);
    void (async () => {
      const permission = await getHatchNotificationPermission();
      if (permission === 'undetermined') {
        await requestHatchNotificationPermission();
      }
      await syncHatchNotification(hatchedState, profile);
    })();
  }, [enhanceDayReflection, selectedDay]);

  const refreshState = useCallback(() => {
    syncState();
  }, [syncState]);

  const resetHomeState = useCallback(() => {
    const now = new Date();
    const profile = loadOnboardingProfile();
    const hydrated = hydrateHomeState(null, profile, now);

    clearStoredHomeState();
    setStoredState(hydrated.state);
    setSelectedDayId(hydrated.todayId);
  }, []);

  const importHealthRoutesForDay = useCallback(async (dayId: string): Promise<ImportedHealthRoutesPayload> => {
    const profile = loadOnboardingProfile();
    const initialNow = new Date();
    const hydrated = hydrateHomeState(loadStoredHomeState() ?? storedStateRef.current, profile, initialNow);
    const targetDay =
      hydrated.state.today.id === dayId
        ? hydrated.state.today
        : hydrated.state.archivedDays.find((day) => day.id === dayId) ?? null;

    if (!targetDay) {
        return {
          status: 'error',
          importedWorkoutCount: 0,
          sampledPointCount: 0,
          segmentCount: 0,
        workoutIds: [],
        message: 'That day could not be resolved from local state.',
      };
    }

    setImportingHealthRouteDayId(dayId);

    try {
      const availability = await getHealthRouteAvailability();
      let permissionState = availability.permissionState;

      if (permissionState === 'unknown') {
        permissionState = await requestHealthRoutePermission();
      }

      const permissionNow = new Date();
      setStoredState((currentState) => {
        const currentHydrated = hydrateHomeState(currentState, profile, permissionNow);
        return updateHealthPermissionState(currentHydrated.state, permissionState, profile, permissionNow);
      });

      if (permissionState !== 'granted') {
        return {
          status: permissionState === 'unavailable' ? 'unavailable' : 'denied',
          importedWorkoutCount: 0,
          sampledPointCount: 0,
          segmentCount: 0,
          workoutIds: [],
          message:
            permissionState === 'unavailable'
              ? 'Health route import is only available on iPhone builds with HealthKit enabled.'
              : 'Apple Health route access was not granted.',
        };
      }

      const result = await importRoutesForDay({ isoDate: targetDay.isoDate });
      const resultNow = new Date();

      setStoredState((currentState) => {
        const currentHydrated = hydrateHomeState(currentState, profile, resultNow);
        const withHealthPermission = updateHealthPermissionState(
          currentHydrated.state,
          'granted',
          profile,
          resultNow
        );
        return applyHealthRoutesForDay(withHealthPermission, dayId, result, profile, resultNow);
      });

      return result;
    } finally {
      setImportingHealthRouteDayId((current) => (current === dayId ? null : current));
    }
  }, []);

  return {
    timelineDays,
    selectedDayId: selectedDay?.id ?? viewModel.todayId,
    selectedDay,
    activeDayPrompt,
    availableDayPrompts,
    applyCapturedMoment,
    isTodayHatched,
    tomorrowDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    locationPermission: viewModel.state.locationPermission,
    activityPermission: viewModel.state.activityPermission,
    healthPermission: viewModel.state.healthPermission,
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
