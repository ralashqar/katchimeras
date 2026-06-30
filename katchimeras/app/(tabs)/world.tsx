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
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView, type GestureType } from 'react-native-gesture-handler';
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
import { QuestBoardSheet } from '@/components/katchadeck/world/quest-board-sheet';
import { FoodMomentSheet, FoodVaultSheet } from '@/components/katchadeck/world/food-vault-sheet';
import { StudioMomentSheet, StudioVaultSheet } from '@/components/katchadeck/world/studio-vault-sheet';
import { StepsPromptSheet } from '@/components/katchadeck/world/steps-prompt-sheet';
import { SanctuarySheet } from '@/components/katchadeck/world/sanctuary-sheet';
import { MoodMonumentSheet, type MoodMonumentChoiceId } from '@/components/katchadeck/world/mood-monument-sheet';
import { ObservatorySheet } from '@/components/katchadeck/world/observatory-sheet';
import { StarterPropSheet } from '@/components/katchadeck/world/starter-prop-sheet';
import { FeaturedBoardSheet } from '@/components/katchadeck/world/featured-board-sheet';
import { MemoryVaultSheet, type MemoryVaultTab } from '@/components/katchadeck/world/memory-vault-sheet';
import { PlacePromptSheet, PLACE_CATEGORIES, type PlaceCategory, type PlaceMeaning } from '@/components/katchadeck/world/place-prompt-sheet';
import { SleepSheet } from '@/components/katchadeck/world/sleep-sheet';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { WorldCanvas } from '@/components/katchadeck/world/world-canvas';
import { WorldDaySwitcher } from '@/components/katchadeck/world/world-day-switcher';
import { DiscoveriesHallSheet } from '@/components/katchadeck/world/discoveries-hall-sheet';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { HatchPayoffReveal } from '@/components/katchadeck/world/hatch-payoff-reveal';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { collectUnlockedArtefacts, placeArtefacts } from '@/utils/discoveries-artefacts';
import { CosmeticsSheet } from '@/components/katchadeck/world/cosmetics-sheet';
import { NameDaySheet } from '@/components/katchadeck/world/name-day-sheet';
import { useCosmetics } from '@/hooks/use-cosmetics';
import { useEssence } from '@/hooks/use-essence';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { interpretNote, type InterpretedNote } from '@/utils/note-interpret';
import { KatchaDeckUI, Lantern } from '@/constants/theme';
import { useAllDays } from '@/hooks/use-all-days';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useTravelMemoryMode } from '@/hooks/use-travel-memory-mode';
import type { BigMomentType, DayMapNode, DayPromptKind, HomeDayRecord } from '@/types/home';
import type { MemoryNode, WorldObjectCategory, WorldPatch, WorldState } from '@/types/world';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { resolvePlaceName } from '@/utils/place-names';
import { isPointAtHome, loadHomeAnchor, saveHomeAnchor } from '@/utils/home-location';
import { deriveDayChronicle, type CalendarEventContext } from '@/utils/chronicle-engine';
import { deriveContinuityMotifs } from '@/utils/continuity-engine';
import { deriveObservations } from '@/utils/observations-engine';
import { loadCalendarEventsForDay } from '@/utils/calendar-events';
import { selectMemoryQuests, type MemoryQuestType } from '@/utils/memory-quests-engine';
import { detectFoodInVision } from '@/utils/food-detect';
import { detectStudioInVision } from '@/utils/studio-detect';
import { loadSleepForDay } from '@/utils/sleep-health';
import { deriveTodayPatch } from '@/utils/today-patch-engine';
import {
  addDecor,
  bloomBudget,
  decorObjects,
  loadDayDecor,
  moveDecor,
  removeDecor,
  type DecorItem,
} from '@/utils/world-decor';
import { deriveWorldPropInventory, type WorldPropInventoryEntry } from '@/utils/world-props-engine';
import { chooseStarterProp, loadWorldPropsState, markWorldPropSeen, saveWorldPropsState } from '@/utils/world-props-storage';
import { loadTodayPatch, saveTodayPatch } from '@/utils/today-patch-storage';
import { syncWorldFromDays } from '@/utils/world-engine';
import { worldAssetSource } from '@/utils/world-visuals';
import type { TravelMemoryModeState } from '@/utils/travel-memory-mode';

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

const MEMORY_CHESTS_ONLY = false;
const VISIBLE_CATEGORIES = new Set(['memory', 'notes', 'journey', 'places', 'sleep', 'mood', 'food', 'studio', 'chronicle', 'quests', 'reflection', 'featured', 'photos']);
// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };
const VISIBLE_CELLS = new Set(['memory', 'journey', 'places', 'reflection']);
const DAY_SWITCHER_TOP = 48;
const DAY_SWITCHER_HEIGHT = 88;
const MICROCOPY_TOP = DAY_SWITCHER_TOP + DAY_SWITCHER_HEIGHT + 12;

function travelMemoryStatusLabel(state: TravelMemoryModeState): string {
  if (state.status === 'enabled') return 'Remembering meaningful stops';
  if (state.status === 'paused_today') return 'Paused for today';
  if (state.status === 'denied') return 'Permission needed';
  if (state.status === 'unavailable') return 'Not available on this device';
  return 'Off by default';
}

function travelMemoryBody(state: TravelMemoryModeState): string {
  if (state.status === 'enabled') {
    return 'When you travel, Katchimera can add coarse background stops to today so the patch does not depend on photos or opening the app.';
  }
  if (state.status === 'paused_today') return 'Background place capture is paused until tomorrow. You can resume it any time.';
  if (state.status === 'denied') return 'Allow background location if you want travel days to become places even when the app was not open.';
  if (state.status === 'unavailable') return 'This build or platform cannot run background place capture yet.';
  return 'Optional. Turn it on after you trust the app, especially for days when you move between places.';
}

function travelMemoryEnableLabel(state: TravelMemoryModeState): string {
  if (state.status === 'paused_today') return 'Resume Travel Memory';
  if (state.status === 'denied') return 'Try Travel Memory';
  return 'Travel Memory';
}

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

type HatchPayoff = {
  dayId: string;
  creatureName: string;
  chronicleTitle: string;
  sources: string[];
};

type PropTrayFilter = 'starter' | 'earned' | 'nature' | 'landmark' | 'locked';

function hatchSources(day: HomeDayRecord, chronicle: ReturnType<typeof deriveDayChronicle> | null): string[] {
  const sources: string[] = [];
  const memoryCount = (day.capturedMeanings?.length ?? 0) + (day.heroPhoto ? 1 : 0) + (day.notes?.length ?? 0);
  if (memoryCount > 0) sources.push(`${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} kept`);
  const places = (day.confirmedPlaces?.length ?? 0) || (day.visitedPlaceCount ?? 0);
  if (places > 0) sources.push(`${places} ${places === 1 ? 'place' : 'places'} shaped it`);
  const steps = day.stepsCount ?? 0;
  if (steps >= 1000) sources.push(`${steps.toLocaleString()} steps became a trail`);
  if ((day.bigMoments?.length ?? 0) > 0) sources.push(day.bigMoments?.[0]?.label ?? 'A big moment');
  if ((day.foodMoments?.length ?? 0) > 0) sources.push('A food memory joined the patch');
  if ((day.studioMoments?.length ?? 0) > 0) sources.push('An inspiration joined the Study');
  if (sources.length === 0 && chronicle?.shaped.length) sources.push(...chronicle.shaped.slice(0, 2));
  return sources.slice(0, 3);
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
    setStepsInterpretation,
    setFeaturedMemory,
    addFoodMoment,
    addStudioMoment,
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
  const {
    state: travelMemoryState,
    isActive: travelMemoryActive,
    enable: enableTravelMemory,
    pauseToday: pauseTravelMemoryToday,
    disable: disableTravelMemory,
    deleteTodayPlaces: deleteTodayTravelMemoryPlaces,
  } = useTravelMemoryMode();
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
        (formingDay.promptAnswers ?? [])
          .map((answer) => `${answer.kind}:${answer.choiceIds.join(',')}:${answer.dismissed ? 'dismissed' : 'active'}`)
          .join(';'),
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
        formingDay.studioMoments?.length ?? 0,
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
  const backgroundPlaceCount = useMemo(
    () => selectedDayRecord?.locations.filter((point) => point.source === 'background').length ?? 0,
    [selectedDayRecord?.locations]
  );

  // In-place egg hatch on the World page: tapping a ready egg plays the reveal
  // right where the egg sits (handled inside WorldCanvas), then settles into the
  // creature. The creature is read off the re-derived day once the hatch lands.
  const [isHatching, setIsHatching] = useState(false);
  const [pendingHatchPayoffDayId, setPendingHatchPayoffDayId] = useState<string | null>(null);
  const [hatchPayoff, setHatchPayoff] = useState<HatchPayoff | null>(null);
  const hatchedCreature = isHatching ? selectedDayRecord?.creature ?? null : null;
  const handleEggPress = () => {
    if (isHatching) return;
    if (eggReady) {
      setPendingHatchPayoffDayId(selectedDayRecord?.id ?? null);
      setHatchPayoff(null);
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

  // Decorate-your-day: user-planted decorations on the shown day's patch. Earned
  // from the day's living (bloomBudget), placed/dragged in Customise mode.
  const decorDayId = shownPatch?.dayId ?? null;
  const [decorItems, setDecorItems] = useState<DecorItem[]>([]);
  const [worldPropsState, setWorldPropsState] = useState(() => loadWorldPropsState());
  const [starterSheetOpen, setStarterSheetOpen] = useState(false);
  const [starterPromptDismissed, setStarterPromptDismissed] = useState(false);
  const [propTrayFilter, setPropTrayFilter] = useState<PropTrayFilter>('earned');
  useEffect(() => {
    setDecorItems(decorDayId ? loadDayDecor(decorDayId) : []);
  }, [decorDayId]);
  // Customise / Decorate mode is owned here so the plant tray can live at the
  // screen bottom (clear of the world patch). The toggle button is on the canvas.
  const [customising, setCustomising] = useState(false);
  // Ref to the canvas's camera-pan gesture, so the capture buttons that float over
  // the patch can BLOCK a pan when a drag starts on them (don't move the world).
  const panRef = useRef<GestureType | undefined>(undefined);
  // Filled by the canvas with a getter for the cell at the screen centre.
  const getCenterCellRef = useRef<(() => { col: number; row: number } | null) | null>(null);
  const decorBudget = selectedDayRecord ? bloomBudget(selectedDayRecord) : 0;
  const starterAlreadyPlaced = !!worldPropsState.starterPropId && decorItems.some((item) => item.propId === worldPropsState.starterPropId);
  const paidDecorCount = decorItems.filter((item) => item.propId !== worldPropsState.starterPropId).length;
  const bloomsLeft = Math.max(0, decorBudget - paidDecorCount);
  // TESTING: planting is currently unlimited (no budget gate) — re-enable the
  // `bloomsLeft > 0` check to tie it to earned blooms / essence later. New decor is
  // planted wherever the camera is centred (drag the world, then tap a plant).
  const handleAddPropDecor = (entry: WorldPropInventoryEntry) => {
    if (!decorDayId) return;
    if (!entry.owned) {
      setMicrocopy(entry.lockedLabel);
      return;
    }
    const isStarter = entry.def.unlockKind === 'starter';
    if (isStarter && starterAlreadyPlaced) {
      setMicrocopy('First Seed already planted');
      return;
    }
    if (!isStarter && bloomsLeft <= 0) {
      setMicrocopy('Add a memory, place, note, or reflection to earn another bloom');
      return;
    }
    const at = getCenterCellRef.current?.();
    setDecorItems((items) =>
      addDecor(decorDayId, items, entry.def.assetKey, at?.col, at?.row, {
        propId: entry.def.id,
        sourceLabel: entry.def.sourceLabel,
        earnedFrom: entry.def.name,
        sizeScale: entry.def.sizeScale,
      })
    );
    if (entry.newlyAvailable) {
      setWorldPropsState((prev) => {
        const next = markWorldPropSeen(prev, entry.def.id);
        if (next !== prev) saveWorldPropsState(next);
        return next;
      });
    }
    setMicrocopy(`${entry.def.name} planted`);
  };
  const handleMoveDecor = (id: string, col: number, row: number) => {
    if (decorDayId) setDecorItems((items) => moveDecor(decorDayId, items, id, col, row));
  };
  const handleRemoveDecor = (id: string) => {
    if (decorDayId) setDecorItems((items) => removeDecor(decorDayId, items, id));
  };

  // The world shows a SINGLE patch, placed at the origin and framed by a ring of
  // empty ground. Switching days swaps the patch under the camera. Decorations are
  // merged in so they render + drag like any other object.
  const renderPatches = useMemo(() => {
    if (!shownPatch) return [];
    const patch = simplifyPatch({ ...shownPatch, gridCol: 0, gridRow: 0 });
    return [{ ...patch, objects: [...patch.objects, ...decorObjects(decorItems)] }];
  }, [shownPatch, decorItems]);

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
  const handleConfirmMood = (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setMoodSheetOpen(false);
    flyToEgg(from, '✨', () => {
      answerDayPrompt({ kind: 'feeling', choiceIds: [choiceId] }, formingTarget);
      setEggFeedKey((key) => key + 1);
      setMicrocopy(`Mood Monument lit: ${label}`);
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
  const openMoodMonument = () => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setPromptOpen(false);
    setInitialPrompt(null);
    setMoodSheetOpen(true);
  };
  const openSheet = (initial: ActiveDayPrompt | null = null) => {
    if (initial?.id === 'feeling') {
      openMoodMonument();
      return;
    }
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
  const placeRecoveryNeeded = useMemo(() => {
    if (!selectedIsTodayForming || !selectedDayRecord) return false;
    if ((selectedDayRecord.confirmedPlaces?.length ?? 0) > 0) return false;
    if ((selectedDayRecord.dayMap?.nodes.length ?? 0) > 0) return false;
    if ((selectedDayRecord.locations?.length ?? 0) > 0) return false;
    return (selectedDayRecord.stepsCount ?? 0) >= 4500;
  }, [selectedIsTodayForming, selectedDayRecord]);
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

  const handleEnableTravelMemory = useCallback(async () => {
    setMicrocopy('Asking for Travel Memory permission...');
    const next = await enableTravelMemory();
    if (next.status === 'enabled') {
      setMicrocopy('Travel Memory Mode is on');
    } else if (next.status === 'denied') {
      setMicrocopy('Background location permission is needed');
    } else if (next.status === 'unavailable') {
      setMicrocopy('Travel Memory is not available here');
    }
  }, [enableTravelMemory]);

  const handlePauseTravelMemoryToday = useCallback(async () => {
    await pauseTravelMemoryToday();
    setMicrocopy('Travel Memory paused for today');
  }, [pauseTravelMemoryToday]);

  const handleDisableTravelMemory = useCallback(async () => {
    await disableTravelMemory();
    setMicrocopy('Travel Memory turned off');
  }, [disableTravelMemory]);

  const handleDeleteTodayTravelMemoryPlaces = useCallback(() => {
    deleteTodayTravelMemoryPlaces();
    refreshState();
    setMicrocopy("Today's background places deleted");
  }, [deleteTodayTravelMemoryPlaces, refreshState]);

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
  // Key the once-per-day guard on the day's INSTANCE (id + storedNonce), not just
  // its date id. "Reset today" rebuilds the day with the SAME date id but a NEW
  // storedNonce and no sleep — keying on the nonce re-arms the prompt so the
  // SleepSheet re-opens after a reset (otherwise sleep can never be set again,
  // since the sleep tile only exists once sleep is set). A plain dismiss keeps the
  // same nonce, so it still won't nag.
  const todayFormingKey = todayForming ? `${todayForming.id}:${todayForming.storedNonce ?? ''}` : null;
  useEffect(() => {
    if (!isFocused || !todayFormingId || !todayFormingIso || todayHasSleep) return;
    if (sleepPromptedRef.current === todayFormingKey) return;
    sleepPromptedRef.current = todayFormingKey;
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
  }, [isFocused, todayFormingId, todayFormingIso, todayFormingKey, todayHasSleep, setSleep]);

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

  // Steps guidance: when today's steps SPIKE (an unmistakably active day, or well
  // above the recent norm) and the day hasn't been interpreted yet, a golden "!"
  // on the Steps structure invites "what kind of day was it? (hike / walk / ...)".
  const stepsAlert = useMemo(() => {
    if (!selectedIsTodayForming || !selectedDayRecord) return false;
    if (selectedDayRecord.stepsInterpretation) return false; // already interpreted
    const steps = selectedDayRecord.stepsCount ?? 0;
    const spike = recentAvgSteps ? steps >= Math.max(4500, recentAvgSteps * 1.6) : false;
    return steps >= 7000 || spike; // 7k = clearly active; or a big jump vs. the norm
  }, [selectedIsTodayForming, selectedDayRecord, recentAvgSteps]);
  const moodAlert = useMemo(
    () =>
      selectedIsForming &&
      !!selectedDayRecord &&
      !(selectedDayRecord.promptAnswers ?? []).some(
        (answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.length > 0
      ),
    [selectedIsForming, selectedDayRecord]
  );
  const sleepAlert = selectedIsForming && !!selectedDayRecord && !selectedDayRecord.sleep;
  const structureAttention = useMemo(
    () => ({ memory: memoryAlert, places: placesAlert, journey: stepsAlert, mood: moodAlert, sleep: sleepAlert }),
    [memoryAlert, moodAlert, placesAlert, sleepAlert, stepsAlert]
  );
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);
  const handlePressStepsAlert = () => setStepsSheetOpen(true);
  const handleConfirmSteps = (input: Parameters<typeof setStepsInterpretation>[0]) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setStepsInterpretation(input, formingTarget);
    setStepsSheetOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · noted`);
  };
  const handlePickFeatured = (photo: { assetId?: string; thumbnailUri: string }) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    setFeaturedMemory({ kind: 'photo', assetId: photo.assetId, thumbnailUri: photo.thumbnailUri }, formingTarget);
    setFeaturedPickerOpen(false);
    setMicrocopy('Featured memory set 🖼️');
  };

  // Tapping a chest opens its reader: the photos vault, the notes reader, or (when
  // enabled) Places → the full day map. Only the live (today) patch has cells.
  const handleSelectCell = (cellType: WorldObjectCategory) => {
    if (cellType === 'decor') return; // decorations are expressive only — no reader
    setLastSelectedCell(cellType);
    if (cellType === 'chronicle') {
      setChronicleOpen(true);
      return;
    }
    if (cellType === 'quests') {
      setQuestBoardOpen(true);
      return;
    }
    if (cellType === 'places') {
      setFocusedObservationId(null);
      setObservatoryOpen(true);
      return;
    }
    if (cellType === 'sleep') {
      setSleepSheetOpen(true);
      return;
    }
    if (cellType === 'mood') {
      setMoodSheetOpen(true);
      return;
    }
    if (cellType === 'food') {
      setFoodVaultOpen(true);
      return;
    }
    if (cellType === 'studio') {
      setStudioVaultOpen(true);
      return;
    }
    if (cellType === 'reflection') {
      setSanctuaryOpen(true); // 🌿 Sanctuary — how today felt
      return;
    }
    if (cellType === 'featured') {
      setFeaturedPickerOpen(true); // 🖼️ pick the day's cover photo
      return;
    }
    // 📸 Memory Vault owns all captured media — the Vault + Photos stack open the
    // unified reader (Photos tab); the Notes stack opens it on the Notes tab.
    if (cellType === 'memory' || cellType === 'photos') {
      setMemoryVaultTab('photos');
      setMemoryVaultOpen(true);
      return;
    }
    if (cellType === 'notes') {
      setMemoryVaultTab('notes');
      setMemoryVaultOpen(true);
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
  // Chronicle — the selected day's story ("what was today about?"), from existing
  // signals plus (best-effort, on-device) calendar events. Shown as a tappable
  // card in the dashboard + a full reader.
  const [chronicleOpen, setChronicleOpen] = useState(false);
  // Quest Board reader — the day's Memory Quests, opened from the world structure.
  const [questBoardOpen, setQuestBoardOpen] = useState(false);
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
  useEffect(() => {
    if (!pendingHatchPayoffDayId || isHatching || !selectedDayRecord?.creature) return;
    if (selectedDayRecord.id !== pendingHatchPayoffDayId) return;
    setHatchPayoff({
      dayId: selectedDayRecord.id,
      creatureName: selectedDayRecord.creature.name,
      chronicleTitle: chronicle?.title ?? selectedDayRecord.dayName ?? 'A Day to Remember',
      sources: hatchSources(selectedDayRecord, chronicle),
    });
    setPendingHatchPayoffDayId(null);
  }, [pendingHatchPayoffDayId, isHatching, selectedDayRecord, chronicle]);
  const memoryQuests = useMemo(() => (formingDay ? selectMemoryQuests(formingDay, new Date()) : []), [formingDay]);
  const continuityMotifs = useMemo(() => deriveContinuityMotifs(days, 6), [days]);
  const observations = useMemo(
    () => deriveObservations({ days, selectedDay: selectedDayRecord, motifs: continuityMotifs }),
    [days, selectedDayRecord, continuityMotifs]
  );
  const propInventory = useMemo(
    () => deriveWorldPropInventory({ propsState: worldPropsState, discoveryEntries, observations, days }),
    [worldPropsState, discoveryEntries, observations, days]
  );
  const propTrayEntries = useMemo(() => {
    switch (propTrayFilter) {
      case 'starter':
        return propInventory.byCategory.starter;
      case 'nature':
        return propInventory.byCategory.nature;
      case 'landmark':
        return propInventory.byCategory.landmark;
      case 'locked':
        return propInventory.locked;
      case 'earned':
      default:
      return propInventory.owned.filter((entry) => entry.def.category !== 'starter');
    }
  }, [propInventory, propTrayFilter]);
  useEffect(() => {
    if (!shownPatch || worldPropsState.starterPropId || starterPromptDismissed || starterSheetOpen) return;
    setStarterSheetOpen(true);
  }, [shownPatch, worldPropsState.starterPropId, starterPromptDismissed, starterSheetOpen]);
  const handleChooseStarterProp = (entry: WorldPropInventoryEntry) => {
    const next = chooseStarterProp(worldPropsState, entry.def.id);
    saveWorldPropsState(next);
    setWorldPropsState(next);
    setStarterSheetOpen(false);
    setPropTrayFilter('starter');
    handleAddPropDecor({ ...entry, owned: true, newlyAvailable: false });
  };
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
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [studioVaultOpen, setStudioVaultOpen] = useState(false);
  const [sanctuaryOpen, setSanctuaryOpen] = useState(false);
  const [moodSheetOpen, setMoodSheetOpen] = useState(false);
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const [focusedObservationId, setFocusedObservationId] = useState<string | null>(null);
  const [featuredPickerOpen, setFeaturedPickerOpen] = useState(false);
  const [memoryVaultOpen, setMemoryVaultOpen] = useState(false);
  const [memoryVaultTab, setMemoryVaultTab] = useState<MemoryVaultTab>('photos');
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
  // If Vision detected a book/screen/poster today, pre-fill the Studio picker's "what".
  const studioSuggestion = useMemo(() => {
    const detection = detectStudioInVision(formingDay?.vision);
    return detection.detected && detection.mediaType && detection.label && detection.emoji
      ? { mediaType: detection.mediaType, label: detection.label, emoji: detection.emoji }
      : null;
  }, [formingDay]);
  const handleAddStudio = (input: Parameters<typeof addStudioMoment>[0]) => {
    if (formingDay && selectedDayId !== formingDay.id) selectTimelineDay(formingDay.id);
    addStudioMoment(input, formingTarget);
    setStudioPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · kept`);
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
      case 'saveStudioMemory':
        setStudioPickerOpen(true);
        break;
      case 'namePatch':
        setNameSheetOpen(true);
        break;
    }
  };
  const showActions = !!formingDay && recPhase !== 'confirm';

  return (
    <GestureHandlerRootView style={styles.screen}>
      <AmbientBackground
        accentColor="rgba(125,232,205,0.12)"
        colors={KatchaDeckUI.gradients.world}
        meshColors={['rgba(125,232,205,0.12)', 'rgba(167,139,250,0.10)', 'rgba(255,195,107,0.07)', 'rgba(20,17,31,0.25)']}
      />

      <View style={styles.worldStage}>
        <View style={styles.switcher}>
          <WorldDaySwitcher days={switcherDays} selectedId={selectedDayId} onSelect={selectTimelineDay} />
        </View>
        <View style={styles.hero}>
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
              imageBase
              hideRecenter
              customising={customising}
              onToggleCustomising={() => setCustomising((v) => !v)}
              showCustomiseButton={false}
              onMoveDecor={handleMoveDecor}
              onRemoveDecor={handleRemoveDecor}
              questCount={memoryQuests.filter((quest) => !quest.completed).length}
              panRef={panRef}
              getCenterCellRef={getCenterCellRef}
              featuredThumb={shownPatch ? selectedDayRecord?.featuredMemory?.thumbnailUri ?? null : null}
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
              stepsAlert={stepsAlert}
              onPressStepsAlert={handlePressStepsAlert}
              moodAlert={moodAlert}
              structureAttention={structureAttention}
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

          {/* Capture controls float over the world's lower-right. A drag starting
              here blocks the camera pan (Native gesture — doesn't steal the button
              presses / hold-to-record). */}
          {showActions ? (
            <GestureDetector gesture={Gesture.Native().blocksExternalGesture(panRef)}>
              <View style={[styles.actionWrap, { bottom: tabBarHeight + 96 }]} pointerEvents="box-none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={customising ? 'Finish customising the world patch' : 'Customise the world patch'}
                  onPress={() => setCustomising((value) => !value)}
                  hitSlop={10}
                  style={[styles.customiseAction, customising ? styles.customiseActionOn : null]}>
                  <IconSymbol name={customising ? 'checkmark' : 'pencil'} size={20} color={customising ? Lantern.ink950 : Lantern.moon50} />
                </Pressable>
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
            </GestureDetector>
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

      </View>

      {inspectedPatch ? (
        <PatchInspector patch={inspectedPatch} focusMemory={focusMemory} onClose={() => setSelectedPatchId(null)} />
      ) : null}

      {promptOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts}
          initialPrompt={initialPrompt}
          onAnswer={handleAnswer}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onSelectPrompt={(prompt) => {
            if (prompt.id !== 'feeling') return false;
            openMoodMonument();
            return true;
          }}
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
        <ChronicleSheet
          chronicle={chronicle}
          day={selectedDayRecord}
          onViewMemories={() => {
            setChronicleOpen(false);
            setMemoryVaultTab('photos');
            setMemoryVaultOpen(true);
          }}
          onClose={() => setChronicleOpen(false)}
        />
      ) : null}

      {questBoardOpen ? (
        <QuestBoardSheet
          quests={memoryQuests}
          placeRecovery={
            placeRecoveryNeeded && selectedDayRecord
              ? {
                  stepsCount: selectedDayRecord.stepsCount ?? 0,
                  onAddPlace: () => {
                    setQuestBoardOpen(false);
                    void handleAddCurrentPlace();
                  },
                  onEnableTravelMemory: travelMemoryActive
                    ? undefined
                    : () => {
                        void handleEnableTravelMemory();
                      },
                  travelMemoryLabel: travelMemoryEnableLabel(travelMemoryState),
                }
              : null
          }
          onQuest={(type) => {
            setQuestBoardOpen(false);
            handleQuest(type);
          }}
          onClose={() => setQuestBoardOpen(false)}
        />
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

      {studioPickerOpen ? (
        <StudioMomentSheet onConfirm={handleAddStudio} onClose={() => setStudioPickerOpen(false)} suggested={studioSuggestion} />
      ) : null}

      {studioVaultOpen && selectedDayRecord ? (
        <StudioVaultSheet
          studioMoments={selectedDayRecord.studioMoments ?? []}
          onAddStudio={
            selectedIsForming
              ? () => {
                  setStudioVaultOpen(false);
                  setStudioPickerOpen(true);
                }
              : undefined
          }
          onClose={() => setStudioVaultOpen(false)}
        />
      ) : null}

      {stepsSheetOpen ? (
        <StepsPromptSheet
          stepsCount={selectedDayRecord?.stepsCount ?? null}
          onConfirm={handleConfirmSteps}
          onClose={() => setStepsSheetOpen(false)}
        />
      ) : null}

      {sanctuaryOpen && selectedDayRecord ? (
        <SanctuarySheet
          day={selectedDayRecord}
          onReflect={selectedIsForming ? () => { setSanctuaryOpen(false); openPrompts(); } : undefined}
          onClose={() => setSanctuaryOpen(false)}
        />
      ) : null}

      {moodSheetOpen && selectedDayRecord ? (
        <MoodMonumentSheet
          day={selectedDayRecord}
          onChoose={selectedIsForming ? handleConfirmMood : undefined}
          onOpenSanctuary={() => {
            setMoodSheetOpen(false);
            setSanctuaryOpen(true);
          }}
          onClose={() => setMoodSheetOpen(false)}
        />
      ) : null}

      {observatoryOpen && selectedDayRecord ? (
        <ObservatorySheet
          day={selectedDayRecord}
          observations={observations}
          focusedObservationId={focusedObservationId}
          travelMemory={{
            statusLabel: travelMemoryStatusLabel(travelMemoryState),
            body: travelMemoryBody(travelMemoryState),
            enabled: travelMemoryActive,
            backgroundPlaceCount,
            onEnable: handleEnableTravelMemory,
            onPauseToday: travelMemoryActive ? handlePauseTravelMemoryToday : undefined,
            onDisable: travelMemoryActive ? handleDisableTravelMemory : undefined,
            onDeleteTodayPlaces: backgroundPlaceCount > 0 ? handleDeleteTodayTravelMemoryPlaces : undefined,
          }}
          onViewPlaces={() => {
            setObservatoryOpen(false);
            setPlacesVaultOpen(true);
          }}
          onReflect={selectedIsForming ? () => { setObservatoryOpen(false); openPrompts(); } : undefined}
          onClose={() => setObservatoryOpen(false)}
        />
      ) : null}

      {featuredPickerOpen && selectedDayRecord ? (
        <FeaturedBoardSheet
          day={selectedDayRecord}
          onPick={handlePickFeatured}
          onClose={() => setFeaturedPickerOpen(false)}
        />
      ) : null}

      {memoryVaultOpen && selectedDayRecord ? (
        <MemoryVaultSheet
          day={selectedDayRecord}
          initialTab={memoryVaultTab}
          onChangeFeatured={
            selectedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  setFeaturedPickerOpen(true);
                }
              : undefined
          }
          onAddPhoto={
            selectedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  dismissPhotoAlert();
                  router.push('/moment-capture');
                }
              : undefined
          }
          onRecordVoice={
            selectedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  router.push('/note-capture');
                }
              : undefined
          }
          onAddNote={
            selectedIsForming
              ? () => {
                  setMemoryVaultOpen(false);
                  router.push('/note-capture');
                }
              : undefined
          }
          onClose={() => setMemoryVaultOpen(false)}
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
          onViewMemories={() => {
            setSelectedCell(null);
            setMemoryVaultTab('photos');
            setMemoryVaultOpen(true);
          }}
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

      {/* Decorate tray — sits at the SCREEN BOTTOM (clear of the world patch) while
          customising. Tap a plant to drop it on the patch, then drag it to place. */}
      {customising && shownPatch ? (
        <View style={[styles.decorTray, { bottom: tabBarHeight + 12 }]}>
          <ThemedText style={styles.decorTrayHint} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
            Plant earned props · drag to place · {bloomsLeft} {bloomsLeft === 1 ? 'bloom' : 'blooms'}
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.propFilterRow}>
            {[
              ['earned', 'Earned'],
              ['starter', 'First Seed'],
              ['nature', 'Nature'],
              ['landmark', 'Landmarks'],
              ['locked', 'Locked'],
            ].map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setPropTrayFilter(id as PropTrayFilter)}
                style={[styles.propFilterChip, propTrayFilter === id ? styles.propFilterChipActive : null]}>
                <ThemedText
                  style={styles.propFilterText}
                  lightColor={propTrayFilter === id ? Lantern.ink950 : Lantern.moon300}
                  darkColor={propTrayFilter === id ? Lantern.ink950 : Lantern.moon300}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.decorTrayRow}>
            {propTrayEntries.length === 0 ? (
              <View style={styles.propEmpty}>
                <ThemedText style={styles.propEmptyText} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  Live a little more to unlock props for this shelf.
                </ThemedText>
              </View>
            ) : null}
            {propTrayEntries.map((entry) => {
              const source = worldAssetSource(entry.def.assetKey);
              return (
                <Pressable
                  key={entry.def.id}
                  onPress={() => handleAddPropDecor(entry)}
                  style={[styles.decorChip, !entry.owned ? styles.decorChipLocked : null]}>
                  {source ? <ExpoImage source={source} style={styles.decorChipImg} contentFit="contain" /> : null}
                  {entry.newlyAvailable ? (
                    <View style={styles.propNewBadge}>
                      <ThemedText style={styles.propNewText} lightColor={Lantern.emberInk} darkColor={Lantern.emberInk}>
                        New
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText style={styles.propChipName} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                    {entry.def.name}
                  </ThemedText>
                  {!entry.owned ? (
                    <ThemedText style={styles.propLockedText} numberOfLines={2} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                      {entry.lockedLabel}
                    </ThemedText>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {starterSheetOpen ? (
        <StarterPropSheet
          choices={propInventory.starterChoices}
          onChoose={(prop) => {
            const entry = propInventory.byCategory.starter.find((item) => item.def.id === prop.id);
            if (entry) handleChooseStarterProp(entry);
          }}
          onClose={() => {
            setStarterPromptDismissed(true);
            setStarterSheetOpen(false);
          }}
        />
      ) : null}

      {hatchPayoff ? (
        <HatchPayoffReveal
          creatureName={hatchPayoff.creatureName}
          chronicleTitle={hatchPayoff.chronicleTitle}
          sources={hatchPayoff.sources}
          onOpenChronicle={() => {
            setHatchPayoff(null);
            setChronicleOpen(true);
          }}
          onOpenMemories={() => {
            setHatchPayoff(null);
            setMemoryVaultTab('photos');
            setMemoryVaultOpen(true);
          }}
          onClose={() => setHatchPayoff(null)}
        />
      ) : null}

      {celebrateDiscovery ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Lantern.ink950 },
  worldStage: { flex: 1 },
  switcher: {
    position: 'absolute',
    top: DAY_SWITCHER_TOP,
    left: 0,
    right: 0,
    zIndex: 40,
    elevation: 40,
  },
  hero: { flex: 1, position: 'relative', zIndex: 1 },
  themeWash: { ...StyleSheet.absoluteFillObject, opacity: 0.07 },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  heroEmptyText: { textAlign: 'center' },
  // Capture controls float over the lower-right of the world patch.
  actionWrap: { position: 'absolute', right: 14, bottom: 16, alignItems: 'center', gap: 12, zIndex: 35, elevation: 35 },
  customiseAction: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,24,48,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(196,186,240,0.16)',
  },
  customiseActionOn: { backgroundColor: Lantern.ember300, borderColor: Lantern.ember300 },
  // Decorate tray — pinned to the screen bottom while customising.
  decorTray: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 40,
    elevation: 40,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(20,17,31,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.3)',
  },
  decorTrayHint: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  propFilterRow: { gap: 8, paddingBottom: 8, paddingRight: 8 },
  propFilterChip: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  propFilterChipActive: { backgroundColor: Lantern.auroraTeal, borderColor: Lantern.auroraTeal },
  propFilterText: { fontSize: 11.5, fontWeight: '900' },
  decorTrayRow: { gap: 10, paddingRight: 8 },
  decorChip: {
    width: 106,
    minHeight: 112,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  decorChipLocked: { opacity: 0.55 },
  decorChipImg: { width: 46, height: 46 },
  propChipName: { alignSelf: 'stretch', textAlign: 'center', fontSize: 10.5, fontWeight: '900', lineHeight: 13 },
  propLockedText: { alignSelf: 'stretch', textAlign: 'center', fontSize: 9.5, fontWeight: '600', lineHeight: 12 },
  propNewBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: Lantern.ember300,
  },
  propNewText: { fontSize: 9, fontWeight: '900' },
  propEmpty: {
    width: 210,
    minHeight: 80,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  propEmptyText: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  microcopy: {
    position: 'absolute',
    top: MICROCOPY_TOP,
    alignSelf: 'center',
    zIndex: 45,
    elevation: 45,
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
