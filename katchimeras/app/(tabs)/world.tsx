import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import type { FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { CellDetailSheet, NotesDetailSheet, PlacesDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import { PatchInspector } from '@/components/katchadeck/world/patch-inspector';
import { BigMomentPickerSheet } from '@/components/katchadeck/world/big-moment-picker-sheet';
import { BigMomentSheet } from '@/components/katchadeck/world/big-moment-sheet';
import { ChronicleSheet } from '@/components/katchadeck/world/chronicle-sheet';
import { FoodMomentSheet, FoodVaultSheet } from '@/components/katchadeck/world/food-vault-sheet';
import { PlacePromptSheet, PLACE_CATEGORIES, type PlaceCategory, type PlaceMeaning } from '@/components/katchadeck/world/place-prompt-sheet';
import { SleepSheet } from '@/components/katchadeck/world/sleep-sheet';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { WorldDashboard } from '@/components/katchadeck/world/world-dashboard';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { collectUnlockedArtefacts, placeArtefacts } from '@/utils/discoveries-artefacts';
import { CosmeticsSheet } from '@/components/katchadeck/world/cosmetics-sheet';
import { NameDaySheet } from '@/components/katchadeck/world/name-day-sheet';
import { useCosmetics } from '@/hooks/use-cosmetics';
import { useEssence } from '@/hooks/use-essence';
import { WorldDaySwitcher } from '@/components/katchadeck/world/world-day-switcher';
import { ThemedText } from '@/components/themed-text';
import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import type { BigMomentType, DayMapNode, DayPromptKind, HomeDayRecord } from '@/types/home';
import type { MemoryNode, WorldObjectCategory, WorldPatch, WorldState } from '@/types/world';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { resolvePlaceName } from '@/utils/place-names';
import { isPointAtHome, loadHomeAnchor, saveHomeAnchor } from '@/utils/home-location';
import { deriveDayChronicle, type CalendarEventContext } from '@/utils/chronicle-engine';
import { loadCalendarEventsForDay } from '@/utils/calendar-events';
import { selectMemoryQuests, type MemoryQuestType } from '@/utils/memory-quests-engine';
import { detectFoodInVision } from '@/utils/food-detect';
import { loadSleepForDay } from '@/utils/sleep-health';
import { deriveTodayPatch } from '@/utils/today-patch-engine';
import { loadTodayPatch, saveTodayPatch } from '@/utils/today-patch-storage';
import { syncWorldFromDays } from '@/utils/world-engine';

// One ring of empty ground cells frames the day's patch in the home view.
const PATCH_RING = 1;

// TEMP: simplify every patch to the photos chest, the notes chest, the steps
// object (which now also holds the day's places), and the creature/egg — Reflection
// + the separate Places map object + Big-Moment landmarks are hidden for now. Flip
// to false to bring the full diorama back.
// Short "h:mm am – h:mm pm" range for a place's dwell window (manual format so it
// doesn't depend on Intl being available in the runtime).
function fmtTime(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours %= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}
function formatTimeRange(start?: string, end?: string): string | null {
  const startLabel = fmtTime(start);
  const endLabel = fmtTime(end);
  if (startLabel && endLabel && startLabel !== endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel ?? null;
}

const MEMORY_CHESTS_ONLY = true;
const VISIBLE_CATEGORIES = new Set(['memory', 'notes', 'journey', 'places', 'sleep', 'food']);
// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
const VISIBLE_CELLS = new Set(['memory', 'journey', 'places']);
function simplifyPatch(patch: WorldPatch): WorldPatch {
  if (!MEMORY_CHESTS_ONLY) return patch;
  return {
    ...patch,
    objects: patch.objects.filter(
      (o) => o.kind === 'creature' || o.kind === 'landmark' || (o.category && VISIBLE_CATEGORIES.has(o.category))
    ),
    cells: (patch.cells ?? []).filter((cell) => VISIBLE_CELLS.has(cell.type)),
  };
}

export default function WorldScreen() {
  const router = useRouter();
  const { days } = useAllDays();
  // Drives today's live patch + the egg's prompts (the same engine Home uses, so
  // answering here feeds the very same day), plus the day selection that picks
  // which patch the world centres on.
  const {
    timelineDays,
    selectedDay,
    selectedDayId,
    selectTimelineDay,
    availableDayPrompts,
    answerDayPrompt,
    answerPhotoMeaning,
    addNote,
    confirmPlace,
    markBigMoment,
    setSleep,
    addFoodMoment,
    setDayName,
    triggerHatchIfReady,
    refreshState,
    isTodayHatched,
    tomorrowDay,
    tomorrowAvailablePrompts,
  } = useHomeScreenState();

  // Discoveries (life milestones) — evaluates all of history, persists unlocks.
  const {
    entries: discoveryEntries,
    unlockedCount: discoveriesUnlocked,
    totalCount: discoveriesTotal,
    pending: pendingDiscoveries,
    backfillCount: discoveryBackfillCount,
    dismissBackfillNotice,
    markSeen: markDiscoverySeen,
  } = useDiscoveries();
  const [discoveriesOpen, setDiscoveriesOpen] = useState(false);
  // One reveal at a time — celebrate the highest-rarity pending discovery first.
  const celebrateDiscovery = useMemo(
    () => [...pendingDiscoveries].sort((a, b) => DISCOVERY_RARITY_ORDER[b.rarity] - DISCOVERY_RARITY_ORDER[a.rarity])[0] ?? null,
    [pendingDiscoveries]
  );
  // Permanent artefacts earned, placed on the world's outer ring.
  const worldArtefacts = useMemo(() => placeArtefacts(collectUnlockedArtefacts(discoveryEntries)), [discoveryEntries]);

  // Unlock currency for cosmetics = unlocked discovery ids.
  const unlockedDiscoveryIds = useMemo(
    () => new Set(discoveryEntries.filter((entry) => entry.record).map((entry) => entry.def.id)),
    [discoveryEntries]
  );

  // Essence (cosmetic currency). earned is derived from history; show a "+N" toast
  // whenever it grows from a real event (skip the initial baseline read).
  const { earned: essenceEarned, balance: essenceBalance, purchases: essencePurchases, spend: spendEssence } = useEssence();
  const prevEssenceRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevEssenceRef.current;
    prevEssenceRef.current = essenceEarned;
    if (prev !== null && essenceEarned > prev) {
      setMicrocopy(`✦ +${essenceEarned - prev} Essence`);
    }
  }, [essenceEarned]);

  // Cosmetics (Discovery-unlocked or Essence-bought; purely expressive). The only
  // rendered output is the egg's lantern-colour override.
  const { entries: cosmeticEntries, lanternColour, worldThemeAccent, select: selectCosmetic } = useCosmetics(
    unlockedDiscoveryIds,
    essencePurchases,
    essenceBalance
  );
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  // Buy a cosmetic with Essence, then auto-apply it.
  const handleBuyCosmetic = (id: string, cost: number) => {
    const def = cosmeticEntries.find((entry) => entry.def.id === id)?.def;
    if (!def) return;
    if (spendEssence(id, cost)) {
      selectCosmetic(def.type, id);
      setMicrocopy(`✦ ${def.name} unlocked`);
    }
  };

  const [world, setWorld] = useState<WorldState | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [focusMemory, setFocusMemory] = useState<MemoryNode | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  // When set, the prompt sheet opens straight into this prompt (the photos prompt
  // from the golden "!"); null = the normal category list.
  const [initialPrompt, setInitialPrompt] = useState<ActiveDayPrompt | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  // A photo flying into a cell's object after a capture (in-scene mote).
  const [captureFly, setCaptureFly] = useState<{ nonce: number; cellType: WorldObjectCategory; photoUri?: string } | null>(
    null
  );
  const captureNonce = useRef(0);
  const [selectedCell, setSelectedCell] = useState<WorldObjectCategory | null>(null);
  // The most-recently tapped cell — keeps a highlight ring under it.
  const [lastSelectedCell, setLastSelectedCell] = useState<WorldObjectCategory | null>(null);
  const feedNonce = useRef(0);
  // The commit to run when the flying mote lands in the egg (answer / seed).
  const pendingAction = useRef<(() => void) | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  // The day we've already run the morning sleep prompt for (once per day).
  const sleepPromptedRef = useRef<string | null>(null);

  // Inline voice note (hold the add-bar mic): record → analyse → accept/discard.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recPhase, setRecPhase] = useState<'idle' | 'recording' | 'analyzing' | 'confirm'>('idle');
  const [recElapsed, setRecElapsed] = useState(0);
  const [recResult, setRecResult] = useState<InterpretedNote | null>(null);
  const [recMarkBig, setRecMarkBig] = useState(true);
  const recAudioRef = useRef<string | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  // Fold any newly-hatched days into the persisted world on focus.
  useFocusEffect(
    useCallback(() => {
      setWorld(syncWorldFromDays(days));
    }, [days])
  );

  // Returning from the camera flow (launched from the Memory Vault): the photo
  // already folded into today; here we fly it into the chest as a celebration.
  useFocusEffect(
    useCallback(() => {
      const feed = consumeCaptureFeed();
      if (!feed) return;
      captureNonce.current += 1;
      setCaptureFly({ nonce: captureNonce.current, cellType: 'memory', photoUri: feed.photoUri });
    }, [])
  );

  // Today, while it is still forming, is the live patch the egg sits on.
  const todayForming = useMemo(() => {
    const today = timelineDays.find((day) => day.kind === 'day' && day.isToday) as HomeDayRecord | undefined;
    return today && today.state !== 'hatched' ? today : null;
  }, [timelineDays]);

  // Where new moments go: once today has HATCHED the live day is TOMORROW; until
  // then it's today (matches the camera capture's target). `onTomorrowForming` is
  // whether the user is currently VIEWING that tomorrow patch.
  const formingDay: HomeDayRecord | null = isTodayHatched ? tomorrowDay ?? null : todayForming;
  const formingTarget: 'today' | 'tomorrow' = isTodayHatched ? 'tomorrow' : 'today';
  const onTomorrowForming = !!(isTodayHatched && tomorrowDay && selectedDayId === tomorrowDay.id);
  // The day-switcher list: archived + today, plus a Tomorrow button once today hatched.
  const switcherDays = useMemo(
    () => (isTodayHatched && tomorrowDay ? [...days, tomorrowDay] : days),
    [days, isTodayHatched, tomorrowDay]
  );
  // Prompts for the forming day — tomorrow's once today has hatched, else today's.
  const formingPrompts = isTodayHatched ? tomorrowAvailablePrompts : availableDayPrompts;

  // Re-derive the live patch only when the forming day's inputs actually change.
  const todaySignature = formingDay
    ? [
        formingDay.id,
        formingDay.state,
        formingDay.moments.length,
        formingDay.promptAnswers?.length ?? 0,
        formingDay.capturedMeanings?.length ?? 0,
        formingDay.stepsCount,
        formingDay.newPlaceCount,
        formingDay.seedCompletions?.length ?? 0,
        formingDay.egg.intensity,
        // Inputs that grow their own patch objects but don't touch the fields
        // above — without these the tile never re-derives when they change.
        formingDay.sleep?.quality ?? '',
        formingDay.confirmedPlaces?.length ?? 0,
        formingDay.bigMoments?.length ?? 0,
        formingDay.notes?.length ?? 0,
        formingDay.foodMoments?.length ?? 0,
      ].join('|')
    : null;
  const todayPatch = useMemo(() => {
    if (!formingDay) return null;
    // Persist + reuse only today's patch (canonical-at-hatch); tomorrow derives fresh.
    const stored = loadTodayPatch();
    const prev = !isTodayHatched && stored && stored.dayId === formingDay.id ? stored : null;
    return deriveTodayPatch(formingDay, prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySignature]);

  // Persist today's growth (not tomorrow's) so placements carry across re-renders.
  useEffect(() => {
    if (todayPatch && !isTodayHatched) saveTodayPatch(todayPatch);
  }, [todayPatch, isTodayHatched]);

  // The day the world is currently showing (the day-switcher pick). Tomorrow isn't
  // in timelineDays, so resolve it explicitly.
  const selectedDayRecord = onTomorrowForming ? tomorrowDay : selectedDay?.kind === 'day' ? selectedDay : null;
  const selectedIsTodayForming = !!(selectedDayRecord?.isToday && selectedDayRecord.state !== 'hatched');
  // The selected day shows the live forming egg/patch when it IS the forming day.
  const selectedIsForming = !!(formingDay && selectedDayRecord?.id === formingDay.id);
  const eggReady = selectedIsForming && formingDay?.state === 'ready_to_hatch';

  // In-place egg hatch on the World page: tapping a ready egg plays the reveal
  // right where the egg sits (handled inside WorldCanvas), then settles into the
  // creature. The creature is read off the re-derived day once the hatch lands.
  const [isHatching, setIsHatching] = useState(false);
  const hatchedCreature = isHatching ? selectedDayRecord?.creature ?? null : null;
  const handleEggPress = () => {
    if (isHatching) return;
    if (eggReady) {
      setIsHatching(true);
      void triggerHatchIfReady();
      return;
    }
    openSheet(null);
  };
  const handleHatchComplete = () => {
    setIsHatching(false);
    refreshState();
  };

  // Which patch to centre the world on: today's live patch when today is showing,
  // otherwise the finalized patch for the selected (hatched) day.
  const selectedPatch = useMemo(() => {
    if (!selectedDayRecord) return null;
    if (todayPatch && selectedDayRecord.id === formingDay?.id) return todayPatch;
    return world?.patches.find((patch) => patch.dayId === selectedDayRecord.id) ?? null;
  }, [selectedDayRecord, todayPatch, formingDay, world]);

  // Hold the last shown patch so an in-place hatch never blanks the canvas mid-reveal
  // (during a hatch the today-patch stops matching before the finalized patch syncs).
  const lastShownPatchRef = useRef<WorldPatch | null>(null);
  if (selectedPatch) lastShownPatchRef.current = selectedPatch;
  const shownPatch = selectedPatch ?? (isHatching ? lastShownPatchRef.current : null);

  // The world shows a SINGLE patch, placed at the origin and framed by a ring of
  // empty ground. Switching days swaps the patch under the camera.
  const renderPatches = useMemo(() => {
    if (!shownPatch) return [];
    return [simplifyPatch({ ...shownPatch, gridCol: 0, gridRow: 0 })];
  }, [shownPatch]);

  const inspectedPatch = useMemo(
    () => renderPatches.find((patch) => patch.id === selectedPatchId) ?? null,
    [renderPatches, selectedPatchId]
  );

  // --- Inline voice note (hold the add-bar mic) ---
  const stopInlineRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
    } catch {
      // keep whatever we have
    }
    recAudioRef.current = uri;
    if (!uri) {
      setRecPhase('idle');
      return;
    }
    setRecPhase('analyzing');
    // Fly the captured note into the egg while it's read.
    feedNonce.current += 1;
    setEggFeed({
      nonce: feedNonce.current,
      fromX: screenW - 50,
      fromY: screenH - tabBarHeight - 110,
      toX: screenW / 2,
      toY: screenH * 0.5,
      label: '🎤',
      tint: '#7DE8CD',
    });
    try {
      // On-device transcription happens inside interpretNote (audio stays local).
      const interpreted = await interpretNote({ audioUri: uri });
      setRecResult(interpreted);
      setRecMarkBig(true);
      setRecPhase('confirm');
    } catch {
      setRecPhase('idle');
    }
  };

  const startInlineRecording = async () => {
    if (recordingRef.current || recPhase !== 'idle') return;
    recordingRef.current = true;
    setRecElapsed(0);
    setRecPhase('recording');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      recordingRef.current = false;
      setRecPhase('idle');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!recordingRef.current) return;
      await recorder.prepareToRecordAsync();
      if (!recordingRef.current) return;
      recorder.record();
    } catch {
      recordingRef.current = false;
      setRecPhase('idle');
      return;
    }
    recTimerRef.current = setInterval(() => {
      setRecElapsed((prev) => {
        if (prev + 1 >= 30) {
          void stopInlineRecording();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const acceptInlineNote = () => {
    if (!recResult) return;
    addNote(
      {
        kind: 'voice',
        text: recResult.transcript,
        audioUri: recAudioRef.current,
        durationMs: recElapsed * 1000,
        archetype: recResult.archetype,
        label: recResult.label,
        bigMoment: recResult.bigMoment && recMarkBig ? recResult.bigMoment : undefined,
      },
      formingTarget
    );
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${recResult.label} took root`);
    setRecResult(null);
    recAudioRef.current = null;
    setRecPhase('idle');
  };

  const discardInlineNote = () => {
    setRecResult(null);
    recAudioRef.current = null;
    setRecPhase('idle');
  };

  useEffect(
    () => () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    },
    []
  );

  // The egg's approximate on-screen spot — the diorama centres in the hero band.
  const eggTarget = { x: screenW / 2, y: screenH * 0.42 };

  // Fly the tapped choice as a glowing mote into the egg (same comet flight as
  // Home), deferring the real commit until it lands so the growth lands with it.
  const flyToEgg = (from: FeedSourceRect, label: string, commit: () => void) => {
    setPromptOpen(false);
    feedNonce.current += 1;
    pendingAction.current = commit;
    setEggFeed({
      nonce: feedNonce.current,
      fromX: from.x + from.w / 2,
      fromY: from.y + from.h / 2,
      toX: eggTarget.x,
      toY: eggTarget.y,
      label,
      tint: '#7DE8CD',
    });
  };

  const handleEggFeedArrive = () => {
    setEggFeed(null);
    const commit = pendingAction.current;
    pendingAction.current = null;
    commit?.();
  };

  const handleAnswer = (kind: DayPromptKind, choiceIds: string[], from: FeedSourceRect) => {
    const isPhotoMeaning = kind === 'meaning' && !!formingDay?.heroPhoto;
    flyToEgg(from, '✨', () => {
      if (isPhotoMeaning) {
        answerPhotoMeaning({ choiceIds }, formingTarget);
      } else {
        answerDayPrompt({ kind, choiceIds }, formingTarget);
      }
      setEggFeedKey((key) => key + 1);
    });
  };

  const handleSelectHeroPhoto = (photo: DayPromptPhotoCandidate, _from: FeedSourceRect) => {
    // Reading a photo's meaning happens full-screen (same flow as Home), which
    // then feeds the day and marks the hero photo.
    dismissPhotoAlert();
    setPromptOpen(false);
    router.push({
      pathname: '/photo-essence',
      params: {
        assetId: photo.assetId,
        thumbnailUri: photo.thumbnailUri ?? '',
        capturedAt: photo.capturedAt,
        target: 'today',
      },
    });
  };

  // Open the "add to today" sheet, optionally straight into a specific prompt.
  const openSheet = (initial: ActiveDayPrompt | null = null) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setInitialPrompt(initial);
    setPromptOpen(true);
  };
  const openPrompts = () => openSheet(null);

  // The phone has photos that could mean something → the photos prompt is live.
  // Surfacing it as a golden "!" on the photos cell guides the user to add them.
  const photoPrompt = useMemo(
    () => availableDayPrompts.find((prompt) => prompt.id === 'meaningful_photo' && prompt.photoCandidates.length > 0) ?? null,
    [availableDayPrompts]
  );
  // A signature of the current photo candidates — changes when new photos appear.
  const photoSig = useMemo(
    () => (photoPrompt ? photoPrompt.photoCandidates.map((candidate) => candidate.assetId).join('|') : null),
    [photoPrompt]
  );
  // Once the user has engaged with these photos (answered, pressed "Later", or
  // added one via the camera) the alert clears — until NEW photos change the sig.
  const [handledPhotoSig, setHandledPhotoSig] = useState<string | null>(null);
  const dismissPhotoAlert = useCallback(() => setHandledPhotoSig(photoSig), [photoSig]);
  const memoryAlert = selectedIsTodayForming && !!photoPrompt && photoSig !== handledPhotoSig;
  const handlePressMemoryAlert = () => {
    if (photoPrompt) openSheet(photoPrompt);
  };

  // The category list shown by the "+" sheet — the photos prompt is removed there
  // because the world's photos tile (golden "!") already surfaces it.
  const popupPrompts = useMemo(
    () => formingPrompts.filter((prompt) => prompt.id !== 'meaningful_photo'),
    [formingPrompts]
  );

  // Places guidance: the first detected place the user hasn't confirmed yet. A
  // golden "!" on the Places cell invites "what was it? / what did it mean?".
  const unconfirmedPlace = useMemo(() => {
    if (!selectedIsTodayForming || !selectedDayRecord) return null;
    const nodes = selectedDayRecord.dayMap?.nodes ?? [];
    if (nodes.length === 0) return null;
    const confirmed = new Set((selectedDayRecord.confirmedPlaces ?? []).map((place) => place.id));
    // Recognise it from the day's location history: any stop the user hasn't
    // confirmed yet (except home). NOTE: dwell-time gating (15+ min OR photo) is
    // intentionally off for now while testing — re-add once the flow is proven.
    return nodes.find((node) => !confirmed.has(node.id) && node.type !== 'home') ?? null;
  }, [selectedIsTodayForming, selectedDayRecord]);
  const placesAlert = !!unconfirmedPlace;
  const [placePromptOpen, setPlacePromptOpen] = useState(false);
  const [placesVaultOpen, setPlacesVaultOpen] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  // A place the user is adding by hand right now (when passive missed it / they
  // want control). Takes precedence over the detected place while the sheet's up.
  const [manualPlace, setManualPlace] = useState<{ id: string; name: string; latitude: number; longitude: number } | null>(
    null
  );
  // A specific place picked from the Places Vault to give meaning to.
  const [placeTarget, setPlaceTarget] = useState<{
    id: string;
    name: string;
    timeLabel: string | null;
    latitude: number;
    longitude: number;
  } | null>(null);

  // Resolve the detected place's name (reverse-geocode, cached) for the header.
  useEffect(() => {
    if (!unconfirmedPlace) {
      setPlaceName(null);
      return;
    }
    let active = true;
    setPlaceName(null);
    void (async () => {
      const resolved = await resolvePlaceName(unconfirmedPlace.latitude, unconfirmedPlace.longitude);
      if (active) setPlaceName(resolved.locality ? `${resolved.primary} · ${resolved.locality}` : resolved.primary);
    })();
    return () => {
      active = false;
    };
  }, [unconfirmedPlace]);

  // The place the prompt is about: a manual add wins, then a place picked from
  // the vault, else the detected unconfirmed stop. Normalised so the sheet +
  // confirm don't care which it is.
  const activePlace = useMemo(() => {
    if (manualPlace)
      return {
        id: manualPlace.id,
        name: manualPlace.name,
        timeLabel: 'Just now',
        isNew: true,
        latitude: manualPlace.latitude,
        longitude: manualPlace.longitude,
      };
    if (placeTarget) return { ...placeTarget, isNew: false };
    if (unconfirmedPlace) {
      return {
        id: unconfirmedPlace.id,
        name: placeName ?? 'A place you visited',
        timeLabel: formatTimeRange(unconfirmedPlace.startedAt, unconfirmedPlace.endedAt),
        isNew: (selectedDayRecord?.newPlaceCount ?? 0) > 0,
        latitude: unconfirmedPlace.latitude,
        longitude: unconfirmedPlace.longitude,
      };
    }
    return null;
  }, [manualPlace, placeTarget, unconfirmedPlace, placeName, selectedDayRecord]);

  // If the place is at the saved home anchor, skip "what is it?" — it's already home;
  // jump straight to "what's happening there?".
  const placePreset = useMemo(() => {
    if (!activePlace) return undefined;
    const atHome = isPointAtHome(activePlace.latitude, activePlace.longitude, loadHomeAnchor());
    return atHome ? PLACE_CATEGORIES.find((category) => category.id === 'home') : undefined;
  }, [activePlace]);

  const handlePressPlacesAlert = () => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setManualPlace(null);
    setPlacePromptOpen(true);
  };

  // Manual "Add current place": grab the current location, name it, and open the
  // same prompt so the user picks what it was + what it meant.
  const handleAddCurrentPlace = async () => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setMicrocopy('Location access is needed to add a place');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const resolved = await resolvePlaceName(latitude, longitude);
      const name = resolved.locality ? `${resolved.primary} · ${resolved.locality}` : resolved.primary;
      setManualPlace({ id: `manual-${Math.round(position.timestamp ?? 0)}-${Math.round(latitude * 1000)}`, name, latitude, longitude });
      setPlacePromptOpen(true);
    } catch {
      setMicrocopy("Couldn't read your location");
    }
  };

  const closePlacePrompt = () => {
    setPlacePromptOpen(false);
    setManualPlace(null);
    setPlaceTarget(null);
  };
  // From the Places Vault: give meaning to a specific stop.
  const handleConfirmPlaceFromVault = (node: DayMapNode, name: string) => {
    setPlacesVaultOpen(false);
    setManualPlace(null);
    setPlaceTarget({ id: node.id, name, timeLabel: formatTimeRange(node.startedAt, node.endedAt), latitude: node.latitude, longitude: node.longitude });
    setPlacePromptOpen(true);
  };
  const handleConfirmPlace = (category: PlaceCategory, meaning: PlaceMeaning) => {
    if (activePlace) {
      confirmPlace({ id: activePlace.id, category: category.id, archetype: meaning.id, label: category.label, meaningLabel: meaning.label }, formingTarget);
      // Tagging a place as Home remembers it as the home anchor, so future visits
      // there skip "what is it?" and ask straight away what's happening.
      if (category.id === 'home') {
        saveHomeAnchor({ lat: activePlace.latitude, lng: activePlace.longitude, source: 'manual', setAt: new Date().toISOString() });
      }
      setEggFeedKey((key) => key + 1);
      setMicrocopy(`${category.emoji} ${category.label} · ${meaning.label}`);
    }
    closePlacePrompt();
  };

  // Morning sleep: the first time the World is entered on a forming day, try Apple
  // Health for the night's sleep; if it has it, record it; otherwise auto-ask
  // "how was your sleep?" once (so it greets you first thing). The user can also
  // tap the sleep tile any time to check or change it.
  // Depend on STABLE primitives, not the whole todayForming object — that object
  // gets a new reference on every content change (hydration, each new moment), and
  // re-running this effect mid-await would cancel the in-flight Health read while
  // the ref-guard blocked any retry, so the prompt never opened.
  const todayFormingId = todayForming?.id ?? null;
  const todayFormingIso = todayForming?.isoDate ?? null;
  const todayHasSleep = !!todayForming?.sleep;
  useEffect(() => {
    if (!isFocused || !todayFormingId || !todayFormingIso || todayHasSleep) return;
    if (sleepPromptedRef.current === todayFormingId) return;
    sleepPromptedRef.current = todayFormingId;
    let active = true;
    void (async () => {
      const health = await loadSleepForDay(todayFormingIso);
      if (!active) return;
      if (health) setSleep(health);
      else setSleepSheetOpen(true);
    })();
    return () => {
      active = false;
    };
  }, [isFocused, todayFormingId, todayFormingIso, todayHasSleep, setSleep]);

  // Auto-dismiss the growth microcopy after a beat.
  useEffect(() => {
    if (!microcopy) return;
    const id = setTimeout(() => setMicrocopy(null), 2400);
    return () => clearTimeout(id);
  }, [microcopy]);

  // One quiet summary the first time history is backfilled into the Hall (no
  // retro-barrage of celebrations).
  useEffect(() => {
    if (discoveryBackfillCount > 0) {
      setMicrocopy(`${discoveryBackfillCount} ${discoveryBackfillCount === 1 ? 'discovery' : 'discoveries'} from your past are in your Hall`);
      dismissBackfillNotice();
    }
  }, [discoveryBackfillCount, dismissBackfillNotice]);

  // The Journey cell compares to the recent average — non-judgmentally.
  const recentAvgSteps = useMemo(() => {
    const withSteps = days.filter((day) => day.state === 'hatched' && (day.stepsCount ?? 0) > 0);
    if (withSteps.length === 0) return null;
    const recent = withSteps.slice(-7);
    return Math.round(recent.reduce((sum, day) => sum + (day.stepsCount ?? 0), 0) / recent.length);
  }, [days]);

  // Tapping a chest opens its reader: the photos vault, the notes reader, or (when
  // enabled) Places → the full day map. Only the live (today) patch has cells.
  const handleSelectCell = (cellType: WorldObjectCategory) => {
    setLastSelectedCell(cellType);
    if (cellType === 'places') {
      setPlacesVaultOpen(true);
      return;
    }
    if (cellType === 'sleep') {
      setSleepSheetOpen(true);
      return;
    }
    if (cellType === 'food') {
      setFoodVaultOpen(true);
      return;
    }
    setSelectedCell(cellType);
  };
  // Read cells from the SELECTED patch (any day — today, tomorrow, or a past day),
  // so hatched/past-day object taps open the same readers as today.
  const selectedCellData =
    selectedCell && selectedCell !== 'notes'
      ? selectedPatch?.cells?.find((cell) => cell.type === selectedCell) ?? null
      : null;

  // A short date label shown under the day buttons (Today / May 10).
  const dayLabel = selectedDayRecord
    ? selectedDayRecord.dayName ?? (selectedDayRecord.isToday ? 'Today' : selectedDayRecord.dayLabel)
    : null;

  // Chronicle — the selected day's story ("what was today about?"), from existing
  // signals plus (best-effort, on-device) calendar events. Shown as a tappable
  // card in the dashboard + a full reader.
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventContext[]>([]);
  useEffect(() => {
    if (!selectedDayRecord) {
      setCalendarEvents([]);
      return;
    }
    let active = true;
    setCalendarEvents([]);
    void (async () => {
      const events = await loadCalendarEventsForDay(selectedDayRecord.isoDate);
      if (active) setCalendarEvents(events);
    })();
    return () => {
      active = false;
    };
  }, [selectedDayRecord]);
  const chronicle = useMemo(
    () => (selectedDayRecord ? deriveDayChronicle(selectedDayRecord, calendarEvents) : null),
    [selectedDayRecord, calendarEvents]
  );

  // Memory Quests — contextual, optional captures that grow real patch objects
  // (they replace the generic Daily Seeds). Completion is derived from signals.
  const memoryQuests = useMemo(() => (formingDay ? selectMemoryQuests(formingDay, new Date()) : []), [formingDay]);
  const [bigMomentPickerOpen, setBigMomentPickerOpen] = useState(false);
  const [bigMomentSheetOpen, setBigMomentSheetOpen] = useState(false);
  const handlePickBigMoment = (type: BigMomentType) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    markBigMoment({ type }, formingTarget);
    setBigMomentPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy('A big moment, marked');
  };
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [foodVaultOpen, setFoodVaultOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  // Opening the sleep tile is also a chance to pull last night's HOURS from Apple
  // Health — the morning read only runs once, and a manual answer carries no hours.
  // If Health knows the duration and we don't have it yet, backfill it (keeping the
  // user's own quality answer when they gave one). Needs the native sleep build to
  // return anything; until then this safely no-ops.
  useEffect(() => {
    if (!sleepSheetOpen || !selectedIsTodayForming) return;
    const iso = selectedDayRecord?.isoDate;
    const current = selectedDayRecord?.sleep;
    if (!iso || current?.totalSleepMinutes) return; // already have the hours
    let active = true;
    void (async () => {
      const health = await loadSleepForDay(iso);
      if (!active || !health?.totalSleepMinutes) return;
      setSleep({
        quality: current?.source === 'manual' ? current.quality : health.quality,
        source: current?.source === 'manual' ? 'manual' : 'appleHealth',
        totalSleepMinutes: health.totalSleepMinutes,
      });
    })();
    return () => {
      active = false;
    };
  }, [sleepSheetOpen, selectedIsTodayForming, selectedDayRecord?.isoDate, selectedDayRecord?.sleep, setSleep]);
  // If Vision detected a specific food today, pre-fill the picker's "what".
  const foodSuggestion = useMemo(() => {
    const detection = detectFoodInVision(formingDay?.vision);
    return detection.label && detection.emoji ? { label: detection.label, emoji: detection.emoji } : null;
  }, [formingDay]);
  const handleAddFood = (input: Parameters<typeof addFoodMoment>[0]) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    addFoodMoment(input, formingTarget);
    setFoodPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · saved`);
  };
  const handleQuest = (type: MemoryQuestType) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    switch (type) {
      case 'captureMoment':
        router.push('/moment-capture');
        break;
      case 'recordVoiceMemory':
        router.push('/note-capture');
        break;
      case 'answerReflection': {
        const reflectionPrompt = formingPrompts.find((prompt) =>
          ['feeling', 'inner_weather', 'day_word', 'meaning', 'gratitude', 'highlight'].includes(prompt.id)
        );
        openSheet(reflectionPrompt ?? null);
        break;
      }
      case 'markPlace':
        if (unconfirmedPlace) handlePressPlacesAlert();
        else void handleAddCurrentPlace();
        break;
      case 'markBigMoment':
        setBigMomentPickerOpen(true);
        break;
      case 'saveFoodMemory':
        setFoodPickerOpen(true);
        break;
      case 'namePatch':
        setNameSheetOpen(true);
        break;
    }
  };

  const heroHeight = Math.max(300, Math.round(screenH * 0.46));
  const showActions = !!formingDay && recPhase !== 'confirm';

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(125,232,205,0.12)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 40 }]}
        showsVerticalScrollIndicator={false}>
        {/* Top bar is just the day picker — Today (right) + a creature per day. */}
        <View style={styles.switcher}>
          <WorldDaySwitcher days={switcherDays} selectedId={selectedDayId} onSelect={selectTimelineDay} />
        </View>
        {dayLabel ? (
          <ThemedText style={styles.dayLabel} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            {dayLabel}
          </ThemedText>
        ) : null}

        <View style={[styles.hero, { height: heroHeight }]}>
          {shownPatch ? (
            <WorldCanvas
              // Key by DAY, not patch id — so a day hatching (today-patch → finalized
              // patch, different id) does NOT remount the canvas and kill the in-place
              // hatch reveal mid-animation. Switching to a different day still remounts.
              key={shownPatch.dayId ?? shownPatch.id}
              patches={renderPatches}
              ring={PATCH_RING}
              animateOnMount
              lockCamera
              hideRecenter
              eggPatchId={selectedIsForming ? todayPatch?.id ?? null : null}
              eggVisual={selectedIsForming ? todayPatch?.eggVisual ?? null : null}
              eggReady={eggReady}
              hatching={isHatching}
              hatchingCreature={hatchedCreature}
              onHatchComplete={handleHatchComplete}
              artefacts={worldArtefacts}
              lanternColor={lanternColour}
              eggFeedKey={eggFeedKey}
              highlightedCell={lastSelectedCell}
              captureFly={selectedIsForming ? captureFly : null}
              memoryAlert={memoryAlert}
              onPressMemoryAlert={handlePressMemoryAlert}
              placesAlert={placesAlert}
              onPressPlacesAlert={handlePressPlacesAlert}
              onPressEgg={handleEggPress}
              onSelectCell={handleSelectCell}
              onSelectBigMoment={() => setBigMomentSheetOpen(true)}
              onSelectPatch={(id) => {
                setFocusMemory(null);
                setSelectedPatchId(id);
              }}
              onSelectMemory={(memory, patchId) => {
                setFocusMemory(memory);
                setSelectedPatchId(patchId);
              }}
            />
          ) : (
            <View style={styles.heroEmpty}>
              <ThemedText type="bodyLarge" lightColor={Lantern.moon300} darkColor={Lantern.moon300} style={styles.heroEmptyText}>
                Nothing has grown here yet.
              </ThemedText>
            </View>
          )}

          {/* World theme ambient — a gentle accent wash over the diorama (cosmetic,
              non-interactive). Default theme = none. Opacity is device-tunable. */}
          {worldThemeAccent ? (
            <View pointerEvents="none" style={[styles.themeWash, { backgroundColor: worldThemeAccent }]} />
          ) : null}

          {/* Capture controls float over the world's lower-right. */}
          {showActions ? (
            <View style={styles.actionWrap} pointerEvents="box-none">
              <WorldActionStack
                onCamera={() => {
                  dismissPhotoAlert();
                  router.push('/moment-capture');
                }}
                onMicTap={() => {
                  if (recPhase === 'idle') router.push('/note-capture');
                }}
                onMicPressIn={startInlineRecording}
                onMicPressOut={() => {
                  if (recordingRef.current) void stopInlineRecording();
                }}
                onAddPlace={handleAddCurrentPlace}
                onAdd={openPrompts}
                recording={recPhase === 'recording'}
              />
            </View>
          ) : null}

          {microcopy ? (
            <Animated.View
              key={microcopy}
              entering={FadeInDown.duration(260)}
              exiting={FadeOut.duration(220)}
              pointerEvents="none"
              style={styles.microcopy}>
              <ThemedText style={styles.microcopyText} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                {microcopy}
              </ThemedText>
            </Animated.View>
          ) : null}

          {/* "You hatched X" — the reveal headline, dropping in once the hatch
              settles and the katchimera's name is known. */}
          {isHatching && hatchedCreature ? (
            <Animated.View
              entering={FadeInDown.duration(380)}
              exiting={FadeOut.duration(260)}
              pointerEvents="none"
              style={styles.hatchHeader}>
              <ThemedText
                type="onboardingLabel"
                style={styles.hatchHeaderKicker}
                lightColor={Lantern.ember300}
                darkColor={Lantern.ember300}>
                You hatched
              </ThemedText>
              <ThemedText
                type="display"
                style={styles.hatchHeaderName}
                lightColor={Lantern.moon50}
                darkColor={Lantern.moon50}>
                {hatchedCreature.name}
              </ThemedText>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.dashboardWrap}>
          <WorldDashboard
            days={days}
            quests={memoryQuests}
            onQuest={handleQuest}
            chronicle={chronicle}
            onOpenChronicle={() => setChronicleOpen(true)}
            foodMoments={selectedDayRecord?.foodMoments ?? []}
            onOpenFood={() => setFoodVaultOpen(true)}
            discoveriesUnlocked={discoveriesUnlocked}
            discoveriesTotal={discoveriesTotal}
            onOpenDiscoveries={() => setDiscoveriesOpen(true)}
            onOpenCosmetics={() => setCosmeticsOpen(true)}
            essenceBalance={essenceBalance}
          />
        </View>
      </ScrollView>

      {inspectedPatch ? (
        <PatchInspector patch={inspectedPatch} focusMemory={focusMemory} onClose={() => setSelectedPatchId(null)} />
      ) : null}

      {promptOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts}
          initialPrompt={initialPrompt}
          onAnswer={handleAnswer}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onPromptDismiss={(promptId) => {
            if (promptId === 'meaningful_photo') dismissPhotoAlert();
          }}
          onClose={() => {
            setPromptOpen(false);
            setInitialPrompt(null);
          }}
        />
      ) : null}

      {chronicleOpen && chronicle && selectedDayRecord ? (
        <ChronicleSheet chronicle={chronicle} day={selectedDayRecord} onClose={() => setChronicleOpen(false)} />
      ) : null}

      {bigMomentPickerOpen ? (
        <BigMomentPickerSheet onPick={handlePickBigMoment} onClose={() => setBigMomentPickerOpen(false)} />
      ) : null}

      {bigMomentSheetOpen && selectedDayRecord ? (
        <BigMomentSheet
          bigMoments={selectedDayRecord.bigMoments ?? []}
          notes={selectedDayRecord.notes ?? []}
          onClose={() => setBigMomentSheetOpen(false)}
        />
      ) : null}

      {discoveriesOpen ? (
        <DiscoveriesHallSheet
          entries={discoveryEntries}
          unlockedCount={discoveriesUnlocked}
          totalCount={discoveriesTotal}
          onClose={() => setDiscoveriesOpen(false)}
        />
      ) : null}

      {cosmeticsOpen ? (
        <CosmeticsSheet
          entries={cosmeticEntries}
          balance={essenceBalance}
          onSelect={selectCosmetic}
          onBuy={handleBuyCosmetic}
          onClose={() => setCosmeticsOpen(false)}
        />
      ) : null}

      {nameSheetOpen ? (
        <NameDaySheet
          initialName={selectedDayRecord?.dayName ?? null}
          suggestion={chronicle?.title ?? null}
          onSave={(name) => {
            if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
            setDayName(name, formingTarget);
            setMicrocopy('Today, named');
          }}
          onClose={() => setNameSheetOpen(false)}
        />
      ) : null}

      {sleepSheetOpen ? (
        <SleepSheet
          sleep={selectedDayRecord?.sleep ?? null}
          onSet={
            selectedIsForming
              ? (quality) => {
                  setSleep({ quality, source: 'manual' }, formingTarget);
                  setMicrocopy('Your morning, remembered');
                  setSleepSheetOpen(false);
                }
              : undefined
          }
          onClose={() => setSleepSheetOpen(false)}
        />
      ) : null}

      {foodPickerOpen ? (
        <FoodMomentSheet onConfirm={handleAddFood} onClose={() => setFoodPickerOpen(false)} suggested={foodSuggestion} />
      ) : null}

      {foodVaultOpen && selectedDayRecord ? (
        <FoodVaultSheet
          foodMoments={selectedDayRecord.foodMoments ?? []}
          onAddFood={
            selectedIsForming
              ? () => {
                  setFoodVaultOpen(false);
                  setFoodPickerOpen(true);
                }
              : undefined
          }
          onClose={() => setFoodVaultOpen(false)}
        />
      ) : null}

      {placesVaultOpen && selectedDayRecord ? (
        <PlacesDetailSheet
          day={selectedDayRecord}
          onClose={() => setPlacesVaultOpen(false)}
          onAddPlace={selectedIsForming ? () => {
            setPlacesVaultOpen(false);
            void handleAddCurrentPlace();
          } : undefined}
          onOpenMap={() => {
            setPlacesVaultOpen(false);
            router.push({ pathname: '/day-map/[dayId]', params: { dayId: selectedDayRecord.id } });
          }}
          onConfirmPlace={selectedIsForming ? handleConfirmPlaceFromVault : undefined}
        />
      ) : null}

      {placePromptOpen && activePlace ? (
        <PlacePromptSheet
          // For a remembered place (home), don't show the generic "A place you
          // visited" — name it Home when we don't have a nicer resolved name.
          placeName={placePreset && activePlace.name === 'A place you visited' ? 'Welcome back' : activePlace.name}
          timeLabel={activePlace.timeLabel}
          isNew={activePlace.isNew}
          presetCategory={placePreset}
          onConfirm={handleConfirmPlace}
          onClose={closePlacePrompt}
        />
      ) : null}

      {selectedCell === 'notes' && selectedDayRecord ? (
        <NotesDetailSheet
          day={selectedDayRecord}
          onClose={() => setSelectedCell(null)}
          onAddNote={
            selectedIsForming
              ? () => {
                  setSelectedCell(null);
                  router.push('/note-capture');
                }
              : undefined
          }
        />
      ) : null}

      {selectedCell && selectedCellData && selectedDayRecord ? (
        <CellDetailSheet
          day={selectedDayRecord}
          cell={selectedCellData}
          recentAvgSteps={recentAvgSteps}
          onClose={() => setSelectedCell(null)}
          onAddPhoto={
            selectedIsForming
              ? () => {
                  setSelectedCell(null);
                  router.push('/moment-capture');
                }
              : undefined
          }
        />
      ) : null}

      {recPhase !== 'idle' ? (
        <InlineVoiceNote
          phase={recPhase}
          elapsed={recElapsed}
          result={recResult}
          markBig={recMarkBig}
          onToggleBig={() => setRecMarkBig((value) => !value)}
          onAccept={acceptInlineNote}
          onDiscard={discardInlineNote}
          bottom={tabBarHeight}
        />
      ) : null}

      <EggFeedOverlay feed={eggFeed} onArrive={handleEggFeedArrive} />

      {celebrateDiscovery ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 52 },
  // The diorama is overflow:visible (unmasked), so it bleeds beyond the hero box
  // and is hit-testable there. zIndex keeps the day buttons on top (always
  // tappable) and the dashboard above the patch's lower bleed (so it scrolls),
  // while the patch sits lowest and owns only its own area.
  switcher: { zIndex: 20, elevation: 20 },
  dayLabel: { paddingHorizontal: 20, marginTop: 6, fontSize: 14, fontWeight: '700', letterSpacing: 0.2, zIndex: 20, elevation: 20 },
  hero: { position: 'relative', marginTop: 4, zIndex: 1 },
  themeWash: { ...StyleSheet.absoluteFillObject, opacity: 0.07 },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  heroEmptyText: { textAlign: 'center' },
  // Capture controls float over the lower-right of the world patch.
  actionWrap: { position: 'absolute', right: 14, bottom: 16 },
  dashboardWrap: { paddingHorizontal: 20, marginTop: 6, zIndex: 10, elevation: 10 },
  microcopy: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(20,17,31,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.4)',
  },
  microcopyText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  hatchHeader: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
    zIndex: 30,
    elevation: 30,
  },
  hatchHeaderKicker: { fontSize: 12 },
  hatchHeaderName: { fontSize: 32, fontStyle: 'italic', lineHeight: 38, textAlign: 'center' },
});
