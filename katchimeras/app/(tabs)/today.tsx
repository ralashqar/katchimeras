import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, FadeOut, runOnJS } from 'react-native-reanimated';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';

import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { CreatureProvenance } from '@/components/katchadeck/home/creature-provenance';
import { DayJournalSections, type DayStatKey } from '@/components/katchadeck/home/day-journal-sections';
import { JourneyDetailSheet, PlacesDetailSheet } from '@/components/katchadeck/world/cell-detail-sheet';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { currentLanternColour } from '@/utils/cosmetics-storage';
import { HatchCountdown } from '@/components/katchadeck/home/hatch-countdown';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { EggOrbitIcons, type OrbitIcon } from '@/components/katchadeck/home/egg-orbit-icons';
import { TodayCategoryRing } from '@/components/katchadeck/home/today-category-ring';
import { InlineVoiceNote } from '@/components/katchadeck/world/inline-voice-note';
import { WorldActionStack } from '@/components/katchadeck/world/world-action-stack';
import { MemoryVaultSheet, type MemoryVaultTab } from '@/components/katchadeck/world/memory-vault-sheet';
import { FoodMomentSheet, FoodVaultSheet } from '@/components/katchadeck/world/food-vault-sheet';
import { StudioMomentSheet, StudioVaultSheet } from '@/components/katchadeck/world/studio-vault-sheet';
import { SanctuarySheet } from '@/components/katchadeck/world/sanctuary-sheet';
import { MoodMonumentSheet, type MoodMonumentChoiceId } from '@/components/katchadeck/world/mood-monument-sheet';
import { SleepSheet } from '@/components/katchadeck/world/sleep-sheet';
import { QuestBoardSheet } from '@/components/katchadeck/world/quest-board-sheet';
import { BigMomentPickerSheet } from '@/components/katchadeck/world/big-moment-picker-sheet';
import { NameDaySheet } from '@/components/katchadeck/world/name-day-sheet';
import {
  PlacePromptSheet,
  PLACE_CATEGORIES,
  type PlaceCategory,
  type PlaceMeaning,
} from '@/components/katchadeck/world/place-prompt-sheet';
import { StepsPromptSheet } from '@/components/katchadeck/world/steps-prompt-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { renderDayComic } from '@/utils/day-comic-render';
import { ensureDayVision } from '@/utils/photo-vision';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import { consumeSelectedDay } from '@/utils/selected-day-signal';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { ReflectionCard } from '@/components/katchadeck/home/reflection-card';
import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { ActiveDayPrompt, DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useInlineVoiceNote } from '@/hooks/use-inline-voice-note';
import { useAllDays } from '@/hooks/use-all-days';
import { useBackfillStatus } from '@/utils/backfill-status';
import {
  deriveTodayCategories,
  findUnconfirmedPlace,
  photoPromptSignature,
  type TodayCategoryState,
} from '@/utils/today-categories';
import { selectMemoryQuests, type MemoryQuestType } from '@/utils/memory-quests-engine';
import { detectFoodInVision } from '@/utils/food-detect';
import { detectStudioInVision } from '@/utils/studio-detect';
import { useDiscoveries } from '@/hooks/use-discoveries';
import { DiscoveryReveal } from '@/components/katchadeck/world/discovery-reveal';
import { resolvePlaceName } from '@/utils/place-names';
import { isPointAtHome, loadHomeAnchor, saveHomeAnchor } from '@/utils/home-location';
import type {
  BigMomentType,
  DayMapNode,
  EggVisualState,
  HomeDayRecord,
  HomeMoment,
  StudioMediaType,
} from '@/types/home';

const COMIC_PHOTO_CONSENT_KEY = 'comic_photo_consent_v1';

// Highest-rarity-first ordering for picking which pending discovery to celebrate.
const DISCOVERY_RARITY_ORDER: Record<string, number> = { legendary: 3, epic: 2, rare: 1, common: 0 };

// The stats strip beneath the egg covers these categories, so the orbit ring
// doesn't repeat them — it keeps only the categories with no strip tile.
const STRIP_CATEGORIES = new Set(['photos', 'notes', 'places', 'journey']);

// Short "h:mm am – h:mm pm" dwell window for a place picked from the reader
// (same manual format as World, no Intl dependency).
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

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    activeDayPrompt,
    availableDayPrompts,
    answerDayPrompt,
    answerPhotoMeaning,
    dismissDayPrompt,
    addNote,
    confirmPlace,
    markBigMoment,
    setSleep,
    setStepsInterpretation,
    addFoodMoment,
    addStudioMoment,
    setFoodMomentMeaning,
    setStudioMomentRating,
    setDayName,
    isTodayHatched,
    tomorrowDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    selectedDay,
    selectedDayId,
    selectTimelineDay,
    timelineDays,
    triggerHatchIfReady,
    refreshState,
    resetHomeState,
  } = useHomeScreenState();
  const { days: allDays } = useAllDays();
  const tabBarHeight = useBottomTabBarHeight();
  const backfillStatus = useBackfillStatus();
  // In-place hatch reveal on the hero stage: while hatching, the egg already on
  // the page rattles, cracks, and shrinks as the creature scales up — the rest of
  // the page chrome hides for the moment, then restores into the hatched layout.
  const [isHatching, setIsHatching] = useState(false);
  const [hatchingEgg, setHatchingEgg] = useState<EggVisualState | null>(null);
  const [sharingDayId, setSharingDayId] = useState<string | null>(null);
  // The "feed the egg" flight: a mote launched from a tapped prompt option that
  // arcs into the egg, where it lands and fires an absorb pulse (feedKey). The
  // data mutation is deferred to arrival via pendingFeedCommit so the egg's
  // reaction stays in sync with the visual.
  const [eggFeed, setEggFeed] = useState<EggFeed | null>(null);
  const [eggFeedKey, setEggFeedKey] = useState(0);
  const heroStageRef = useRef<View | null>(null);
  const pendingFeedCommit = useRef<(() => void) | null>(null);
  const feedNonce = useRef(0);
  // GPT-Image comic generation: full-page A4 comic rendered from the day's
  // photos + creature (sent to the server — opt-in, see consent gate).
  const [comicGen, setComicGen] = useState<
    { dayId: string; status: 'generating' | 'done' | 'error'; imageUrl?: string; error?: string } | null
  >(null);
  const postcardRef = useRef<View>(null);
  const comicShotRef = useRef<View>(null);
  // "Add to today" sheet: a menu of answerable prompt categories (replaces the
  // old radial). Open from the egg tap or the CTA; tapping a category opens that
  // prompt and answering feeds the egg.
  const [promptSheetOpen, setPromptSheetOpen] = useState(false);
  // The prompt sheet can open straight onto a specific prompt (the photos glow /
  // a quest's reflection); cleared whenever the sheet closes.
  const [initialPrompt, setInitialPrompt] = useState<ActiveDayPrompt | null>(null);
  const openPromptSheet = () => setPromptSheetOpen(true);
  const closePromptSheet = () => {
    setPromptSheetOpen(false);
    setInitialPrompt(null);
  };
  // Category icons orbiting the egg, one per fed photo (capture / photo prompt).
  const [orbitIcons, setOrbitIcons] = useState<OrbitIcon[]>([]);
  const orbitNonce = useRef(0);

  const backgroundAccent =
    selectedDay?.kind === 'day'
      ? selectedDay.state === 'hatched' && selectedDay.creature
        ? `${selectedDay.creature.accentColor}16`
        : `${selectedDay.egg.haloColor}14`
      : 'rgba(167,139,250,0.12)';

  const shareableDay =
    selectedDay?.kind === 'day' && selectedDay.state === 'hatched' && selectedDay.creature
      ? (selectedDay as HomeDayRecord & { creature: NonNullable<HomeDayRecord['creature']> })
      : null;

  useEffect(() => {
    setPromptSheetOpen(false);
    setOrbitIcons([]);
  }, [selectedDayId]);

  // Each time a background backfill reflection is written, pull it into view so
  // the day's specific quote appears without the user re-opening Home.
  useEffect(() => {
    if (backfillStatus.completedVersion > 0) {
      refreshState();
    }
  }, [backfillStatus.completedVersion, refreshState]);

  const handleReveal = async () => {
    if (selectedDay?.kind !== 'day' || !selectedDay.canHatch) {
      return;
    }

    // Play the in-place reveal on the egg already on screen: capture its forming
    // visual, hide the page chrome, finalize the hatch (so the creature exists),
    // and let HatchReveal run the shake → crack → shrink → scale-up.
    setHatchingEgg(selectedDay.egg);
    setIsHatching(true);
    try {
      // Finalizes the hatch (always produces a creature) and updates state itself.
      // HatchReveal keeps the egg shaking until that creature lands, then plays the
      // crack + scale-up. We must NOT refreshState() here: triggerHatchIfReady's
      // state update hasn't flushed/persisted yet, so re-hydrating from the stale
      // saved state would overwrite (revert) the just-finalized hatch.
      await triggerHatchIfReady();
    } catch (error) {
      console.warn('Hatch reveal failed to finalize', error);
    }
  };

  const handleHatchComplete = () => {
    // Animation done — drop back to the normal (now hatched) layout in place.
    setIsHatching(false);
    setHatchingEgg(null);
    refreshState();
  };

  function handleOpenDayMap(dayId: string) {
    router.push({
      pathname: '/day-map/[dayId]',
      params: { dayId },
    });
  }

  async function handleShareDay() {
    if (
      !selectedDay ||
      selectedDay.kind !== 'day' ||
      selectedDay.state !== 'hatched' ||
      !selectedDay.creature ||
      !selectedDay.shareReadyAt ||
      !postcardRef.current
    ) {
      return;
    }

    setSharingDayId(selectedDay.id);

    try {
      const uri = await captureRef(postcardRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Share.share({
        message: `${selectedDay.creature.name} — ${selectedDay.highlight ?? selectedDay.creature.highlight}`,
        title: `${selectedDay.creature.name} day card`,
        url: uri,
      });
    } finally {
      setSharingDayId((current) => (current === selectedDay.id ? null : current));
    }
  }

  // The comic now renders a full A4 page with GPT-Image from the day's real
  // photos + creature — which means those photos leave the device. Gate the very
  // first generation behind an explicit, one-time consent.
  function handleMakeComic() {
    if (!shareableDay) {
      return;
    }
    const day = shareableDay;
    if (getStoredJson(COMIC_PHOTO_CONSENT_KEY, false)) {
      void generateComic(day);
      return;
    }
    Alert.alert(
      'Make a comic from your photos?',
      'This sends a few of the day’s photos to our image generator to draw your comic page. Your photos stay private otherwise.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            setStoredJson(COMIC_PHOTO_CONSENT_KEY, true);
            void generateComic(day);
          },
        },
      ]
    );
  }

  async function generateComic(day: HomeDayRecord & { creature: NonNullable<HomeDayRecord['creature']> }) {
    setComicGen({ dayId: day.id, status: 'generating' });
    try {
      // Make sure the day has a vision read so the comic's text can name what the
      // photos actually showed (analyses on the spot if it was never read).
      const vision = await ensureDayVision(day);
      const dayForComic = vision ? { ...day, vision } : day;
      const result = await renderDayComic(dayForComic, loadOnboardingProfile());
      if ('imageUrl' in result) {
        setComicGen({ dayId: day.id, status: 'done', imageUrl: result.imageUrl });
      } else {
        setComicGen({ dayId: day.id, status: 'error', error: result.error });
      }
    } catch {
      setComicGen({ dayId: day.id, status: 'error', error: 'Something went wrong generating the comic.' });
    }
  }

  async function handleShareGeneratedComic() {
    if (comicGen?.status !== 'done' || !comicGen.imageUrl) {
      return;
    }
    const message = `${shareableDay?.creature.name ?? 'My'} day — a Katchimeras comic.`;
    try {
      // Capture the (already-loaded) comic image to a local file so the share
      // sheet hands WhatsApp etc. the actual IMAGE, not just a link.
      let url = comicGen.imageUrl;
      if (comicShotRef.current) {
        url = await captureRef(comicShotRef.current, { format: 'png', quality: 1, result: 'tmpfile' });
      }
      await Share.share({ message, url });
    } catch {
      // Fall back to sharing the hosted link if capture/share fails.
      await Share.share({ message, url: comicGen.imageUrl });
    }
  }

  const isDay = selectedDay?.kind === 'day';
  const isHatched = isDay && selectedDay.state === 'hatched' && selectedDay.creature;
  const isFormingToday = isDay && selectedDay.isToday && selectedDay.state !== 'hatched';

  // Once today has hatched, the Tomorrow page becomes a forming egg the user can
  // pre-feed (moments / prompts / camera) until the rollover. The forming target
  // + which day/prompts to use are unified here so the same UI drives both.
  const onTomorrowForming = selectedDay?.kind === 'tomorrow' && isTodayHatched;
  const isForming = isFormingToday || onTomorrowForming;
  // Cosmetic lantern-colour override (Discovery-unlocked), read from storage so the
  // today page reflects the same choice as the World tab. Undefined = natural.
  const lanternColour = currentLanternColour();
  const formingTarget = onTomorrowForming ? 'tomorrow' : 'today';
  const formingDay = onTomorrowForming ? tomorrowDay : isFormingToday ? selectedDay : null;
  const formingPrompts = onTomorrowForming ? tomorrowAvailablePrompts : availableDayPrompts;
  const formingActivePrompt = onTomorrowForming ? tomorrowActivePrompt : activeDayPrompt;
  // While a prompt is showing, the page collapses to just the egg + prompt: the
  // forming quote and the add/camera buttons hide until it's answered/dismissed.
  const hasActivePrompt = isForming && Boolean(formingActivePrompt);

  // --- Today-as-daily-hub: category ring, sheets, capture actions ---
  // (the same daily intelligence the World patch had, orbiting the egg instead)

  // Growth microcopy toast (mirrors World's), auto-dismissed after a beat.
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  useEffect(() => {
    if (!microcopy) return;
    const id = setTimeout(() => setMicrocopy(null), 2400);
    return () => clearTimeout(id);
  }, [microcopy]);

  // Category sheets.
  const [memoryVaultOpen, setMemoryVaultOpen] = useState(false);
  const [memoryVaultTab, setMemoryVaultTab] = useState<MemoryVaultTab>('photos');
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);
  const [foodVaultOpen, setFoodVaultOpen] = useState(false);
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [studioVaultOpen, setStudioVaultOpen] = useState(false);
  const [sanctuaryOpen, setSanctuaryOpen] = useState(false);
  const [moodSheetOpen, setMoodSheetOpen] = useState(false);
  const [sleepSheetOpen, setSleepSheetOpen] = useState(false);
  const [questBoardOpen, setQuestBoardOpen] = useState(false);
  const [bigMomentPickerOpen, setBigMomentPickerOpen] = useState(false);
  const [placePromptOpen, setPlacePromptOpen] = useState(false);
  const [stepsSheetOpen, setStepsSheetOpen] = useState(false);
  const [journeySheetOpen, setJourneySheetOpen] = useState(false);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);

  // Inline voice note (hold the mic in the add row): record → analyse →
  // accept/discard.
  const voiceNote = useInlineVoiceNote({
    saveNote: (note) => addNote(note, formingTarget),
    onAnalyzing: () => {
      const from: FeedSourceRect = { x: windowWidth / 2 + 40, y: windowHeight - 260, w: 60, h: 60 };
      startEggFeed(from, { label: '🎤' }, () => {});
    },
    onSaved: (interpreted) => {
      setEggFeedKey((key) => key + 1);
      setMicrocopy(`${interpreted.label} took root`);
    },
  });

  // Photos attention: cleared once the user engages, re-armed by NEW photos.
  const photoPrompt = useMemo(
    () => formingPrompts.find((prompt) => prompt.id === 'meaningful_photo' && prompt.photoCandidates.length > 0) ?? null,
    [formingPrompts]
  );
  const photoSig = useMemo(() => photoPromptSignature(formingPrompts), [formingPrompts]);
  const [handledPhotoSig, setHandledPhotoSig] = useState<string | null>(null);
  const dismissPhotoAlert = useCallback(() => setHandledPhotoSig(photoSig), [photoSig]);
  // The "+" sheet's category list — the photos prompt is left out because the
  // ring's photos icon already surfaces it.
  const popupPrompts = useMemo(
    () => formingPrompts.filter((prompt) => prompt.id !== 'meaningful_photo'),
    [formingPrompts]
  );

  // The Journey read compares to the recent average — non-judgmentally.
  const recentAvgSteps = useMemo(() => {
    const withSteps = allDays.filter((day) => day.state === 'hatched' && (day.stepsCount ?? 0) > 0);
    if (withSteps.length === 0) return null;
    const recent = withSteps.slice(-7);
    return Math.round(recent.reduce((sum, day) => sum + (day.stepsCount ?? 0), 0) / recent.length);
  }, [allDays]);

  // Memory Quests — contextual, optional captures; completion derives from signals.
  const memoryQuests = useMemo(
    () => (formingDay ? selectMemoryQuests(formingDay, new Date(), 3, []) : []),
    [formingDay]
  );

  // The single source of category state for the ring around the egg.
  const categories = useMemo(
    () =>
      formingDay
        ? deriveTodayCategories(formingDay, {
            prompts: formingPrompts,
            quests: memoryQuests,
            recentAvgSteps,
            handledPhotoSig,
          })
        : [],
    [formingDay, formingPrompts, memoryQuests, recentAvgSteps, handledPhotoSig]
  );

  // Places: the first detected-but-unconfirmed stop, plus manual "add this place".
  const unconfirmedPlace = useMemo(() => (formingDay ? findUnconfirmedPlace(formingDay) : null), [formingDay]);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [manualPlace, setManualPlace] = useState<{ id: string; name: string; latitude: number; longitude: number } | null>(
    null
  );
  // The Crossroads reader (today's places), and a specific stop picked from it
  // to give meaning to.
  const [placesVaultOpen, setPlacesVaultOpen] = useState(false);
  const [placeTarget, setPlaceTarget] = useState<{
    id: string;
    name: string;
    timeLabel: string | null;
    latitude: number;
    longitude: number;
  } | null>(null);
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
  const activePlace = useMemo(() => {
    if (manualPlace)
      return { id: manualPlace.id, name: manualPlace.name, timeLabel: 'Just now', isNew: true, latitude: manualPlace.latitude, longitude: manualPlace.longitude };
    if (placeTarget) return { ...placeTarget, isNew: false };
    if (unconfirmedPlace) {
      return {
        id: unconfirmedPlace.id,
        name: placeName ?? 'A place you visited',
        timeLabel: null,
        isNew: (formingDay?.newPlaceCount ?? 0) > 0,
        latitude: unconfirmedPlace.latitude,
        longitude: unconfirmedPlace.longitude,
      };
    }
    return null;
  }, [manualPlace, placeTarget, unconfirmedPlace, placeName, formingDay?.newPlaceCount]);
  // At the saved home anchor, skip "what is it?" — it's already home.
  const placePreset = useMemo(() => {
    if (!activePlace) return undefined;
    const atHome = isPointAtHome(activePlace.latitude, activePlace.longitude, loadHomeAnchor());
    return atHome ? PLACE_CATEGORIES.find((category) => category.id === 'home') : undefined;
  }, [activePlace]);
  const handleAddCurrentPlace = async () => {
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
  // From the Crossroads reader: give meaning to a specific stop.
  const handleConfirmPlaceFromVault = (node: DayMapNode, name: string) => {
    setPlacesVaultOpen(false);
    setManualPlace(null);
    setPlaceTarget({
      id: node.id,
      name,
      timeLabel: formatTimeRange(node.startedAt, node.endedAt),
      latitude: node.latitude,
      longitude: node.longitude,
    });
    setPlacePromptOpen(true);
  };
  const handleConfirmPlace = (category: PlaceCategory, meaning: PlaceMeaning) => {
    if (activePlace) {
      confirmPlace(
        { id: activePlace.id, category: category.id, archetype: meaning.id, label: category.label, meaningLabel: meaning.label },
        formingTarget
      );
      if (category.id === 'home') {
        saveHomeAnchor({ lat: activePlace.latitude, lng: activePlace.longitude, source: 'manual', setAt: new Date().toISOString() });
      }
      setEggFeedKey((key) => key + 1);
      setMicrocopy(`${category.emoji} ${category.label} · ${meaning.label}`);
    }
    closePlacePrompt();
  };

  const handleConfirmSteps = (input: Parameters<typeof setStepsInterpretation>[0]) => {
    setStepsInterpretation(input, formingTarget);
    setStepsSheetOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · noted`);
  };

  // Discoveries (life milestones): whatever is added on Today re-evaluates the
  // catalog right away, and a fresh unlock plays its reveal here too — but only
  // once the current flow is done, never on top of an open prompt/sheet.
  const { pending: pendingDiscoveries, markSeen: markDiscoverySeen, refresh: refreshDiscoveries } = useDiscoveries();
  const formingSignature = formingDay
    ? [
        formingDay.id,
        formingDay.moments.length,
        formingDay.promptAnswers?.length ?? 0,
        formingDay.capturedMeanings?.length ?? 0,
        formingDay.notes?.length ?? 0,
        formingDay.foodMoments?.length ?? 0,
        formingDay.studioMoments?.length ?? 0,
        formingDay.bigMoments?.length ?? 0,
        formingDay.confirmedPlaces?.length ?? 0,
        formingDay.stepsCount,
        formingDay.sleep?.quality ?? '',
        formingDay.heroPhoto ? 1 : 0,
      ].join('|')
    : null;
  useEffect(() => {
    if (formingSignature) refreshDiscoveries();
  }, [formingSignature, refreshDiscoveries]);

  // A photo/note the engine auto-categorised as food or an inspiration carries
  // only a GUESSED meaning — follow up right away with the same "what did it
  // mean? / how did it land?" step the manual add uses, and write the answer
  // onto that moment. Each moment asks once (dismissing is answering "later").
  const [foodFollowUp, setFoodFollowUp] = useState<{ momentId: string; label: string; emoji: string } | null>(null);
  const [studioFollowUp, setStudioFollowUp] = useState<{
    momentId: string;
    label: string;
    emoji: string;
    mediaType: StudioMediaType;
  } | null>(null);
  const followUpAskedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!formingDay || foodFollowUp || studioFollowUp || promptSheetOpen || isHatching) return;
    const isFresh = (moment: { id: string; createdAt: string; source?: string | null }) =>
      !!moment.source &&
      moment.source !== 'manual' &&
      !followUpAskedRef.current.has(moment.id) &&
      Date.now() - Date.parse(moment.createdAt) < 5 * 60_000;
    const food = (formingDay.foodMoments ?? []).filter(isFresh).pop();
    const studio = food ? null : (formingDay.studioMoments ?? []).filter(isFresh).pop();
    if (!food && !studio) return;
    // Let the capture's egg-feed flight land before the question slides up.
    const id = setTimeout(() => {
      if (food) {
        followUpAskedRef.current.add(food.id);
        setFoodFollowUp({ momentId: food.id, label: food.label, emoji: food.emoji });
      } else if (studio) {
        followUpAskedRef.current.add(studio.id);
        setStudioFollowUp({ momentId: studio.id, label: studio.label, emoji: studio.emoji, mediaType: studio.mediaType });
      }
    }, 900);
    return () => clearTimeout(id);
  }, [formingDay, foodFollowUp, studioFollowUp, promptSheetOpen, isHatching]);

  // If Vision spotted food / an inspiration today, pre-fill the pickers.
  const foodSuggestion = useMemo(() => {
    const detection = detectFoodInVision(formingDay?.vision);
    return detection.label && detection.emoji ? { label: detection.label, emoji: detection.emoji } : null;
  }, [formingDay]);
  const studioSuggestion = useMemo(() => {
    const detection = detectStudioInVision(formingDay?.vision);
    return detection.detected && detection.mediaType && detection.label && detection.emoji
      ? { mediaType: detection.mediaType, label: detection.label, emoji: detection.emoji }
      : null;
  }, [formingDay]);
  const handleAddFood = (input: Parameters<typeof addFoodMoment>[0]) => {
    addFoodMoment(input, formingTarget);
    setFoodPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · saved`);
  };
  const handleAddStudio = (input: Parameters<typeof addStudioMoment>[0]) => {
    addStudioMoment(input, formingTarget);
    setStudioPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy(`${input.emoji} ${input.label} · kept`);
  };
  const handlePickBigMoment = (type: BigMomentType) => {
    markBigMoment({ type }, formingTarget);
    setBigMomentPickerOpen(false);
    setEggFeedKey((key) => key + 1);
    setMicrocopy('A big moment, marked');
  };
  const handleConfirmMood = (choiceId: MoodMonumentChoiceId, label: string, from: FeedSourceRect) => {
    setMoodSheetOpen(false);
    startEggFeed(from, { label }, () => {
      answerDayPrompt({ kind: 'feeling', choiceIds: [choiceId] }, formingTarget);
      setMicrocopy(`Mood noted: ${label}`);
    });
  };

  const handleQuest = (type: MemoryQuestType) => {
    setQuestBoardOpen(false);
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
        setInitialPrompt(reflectionPrompt ?? null);
        setPromptSheetOpen(true);
        break;
      }
      case 'markPlace':
        if (unconfirmedPlace) setPlacePromptOpen(true);
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

  // The stats strip beneath the egg is the door into steps / places / photos /
  // moments — the ring only carries the categories the strip doesn't.
  const ringCategories = useMemo(() => categories.filter((category) => !STRIP_CATEGORIES.has(category.id)), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const handleStatPress = (key: DayStatKey) => {
    switch (key) {
      case 'steps':
        // The journey reader by default; the "what kind of day was it?"
        // interpretation prompt only leads when the steps "!" is asking.
        if (categoryById.get('journey')?.needsAttention) setStepsSheetOpen(true);
        else setJourneySheetOpen(true);
        break;
      case 'places':
        setPlacesVaultOpen(true);
        break;
      case 'photos':
        if (categoryById.get('photos')?.needsAttention && photoPrompt) {
          setInitialPrompt(photoPrompt);
          setPromptSheetOpen(true);
        } else {
          setMemoryVaultTab('photos');
          setMemoryVaultOpen(true);
        }
        break;
      case 'moments':
        setSanctuaryOpen(true);
        break;
    }
  };
  const statAttention = useMemo(
    () => ({
      steps: !!categoryById.get('journey')?.needsAttention,
      places: !!categoryById.get('places')?.needsAttention,
      photos: !!categoryById.get('photos')?.needsAttention,
    }),
    [categoryById]
  );

  // A tapped category opens the right surface: its question when it glows, its
  // reader when it holds content, its add-flow when it's empty.
  const handleCategoryPress = (category: TodayCategoryState) => {
    switch (category.id) {
      case 'photos':
        if (category.needsAttention && photoPrompt) {
          setInitialPrompt(photoPrompt);
          setPromptSheetOpen(true);
        } else {
          setMemoryVaultTab('photos');
          setMemoryVaultOpen(true);
        }
        break;
      case 'notes':
        setMemoryVaultTab('notes');
        setMemoryVaultOpen(true);
        break;
      case 'places':
        if (unconfirmedPlace) setPlacePromptOpen(true);
        else if (category.hasContent && formingDay) handleOpenDayMap(formingDay.id);
        else void handleAddCurrentPlace();
        break;
      case 'journey':
        setStepsSheetOpen(true);
        break;
      case 'reflection':
        if (category.needsAttention) setMoodSheetOpen(true);
        else setSanctuaryOpen(true);
        break;
      case 'food':
        if (category.hasContent) setFoodVaultOpen(true);
        else setFoodPickerOpen(true);
        break;
      case 'studio':
        if (category.hasContent) setStudioVaultOpen(true);
        else setStudioPickerOpen(true);
        break;
      case 'sleep':
        setSleepSheetOpen(true);
        break;
      case 'bigMoment':
        setBigMomentPickerOpen(true);
        break;
      case 'quests':
        setQuestBoardOpen(true);
        break;
    }
  };

  // Swipe left/right to move between days, as an alternative to tapping the
  // timeline at the top.
  function goToAdjacentDay(direction: number) {
    const index = timelineDays.findIndex((day) => day.id === selectedDayId);
    if (index < 0) {
      return;
    }
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= timelineDays.length) {
      return;
    }
    selectTimelineDay(timelineDays[nextIndex].id);
  }

  // Launch a mote from the tapped item into the egg, deferring the actual
  // answer until it lands so the egg's pulse lands with it. Guards against
  // overlapping flights.
  function startEggFeed(from: FeedSourceRect, payload: { label?: string; photoUri?: string }, commit: () => void) {
    if (eggFeed) {
      commit();
      return;
    }
    const launch = (toX: number, toY: number) => {
      feedNonce.current += 1;
      pendingFeedCommit.current = commit;
      setEggFeed({
        nonce: feedNonce.current,
        fromX: from.x + from.w / 2,
        fromY: from.y + from.h / 2,
        toX,
        toY,
        label: payload.label,
        photoUri: payload.photoUri,
        tint: Lantern.ember300,
      });
    };
    if (heroStageRef.current) {
      heroStageRef.current.measureInWindow((x, y, w, h) => launch(x + w / 2, y + h / 2));
    } else {
      // No measured egg yet — commit immediately rather than swallow the answer.
      commit();
    }
  }

  function handleEggFeedArrive() {
    pendingFeedCommit.current?.();
    pendingFeedCommit.current = null;
    setEggFeed(null);
    setEggFeedKey((key) => key + 1);
  }

  function handleAnswerDayPrompt(
    kind: Parameters<typeof answerDayPrompt>[0]['kind'],
    choiceIds: string[],
    from: FeedSourceRect
  ) {
    const isPhotoMeaning = kind === 'meaning' && !!formingDay?.heroPhoto;
    const sourcePrompts = [formingActivePrompt, ...formingPrompts].filter(Boolean);
    const label = sourcePrompts
      .find((prompt) => prompt?.id === kind)
      ?.options.find((option) => option.id === choiceIds[0])?.label;
    startEggFeed(from, { label }, () => {
      if (isPhotoMeaning) {
        answerPhotoMeaning({ choiceIds }, formingTarget);
      } else {
        answerDayPrompt({ kind, choiceIds }, formingTarget);
      }
    });
  }

  function handleSelectHeroPhoto(photo: DayPromptPhotoCandidate, _from: FeedSourceRect) {
    // Open the chosen photo full and read its essence there ("what did this
    // mean?"), which then feeds the day and marks it the hero photo.
    dismissPhotoAlert();
    closePromptSheet();
    router.push({
      pathname: '/photo-essence',
      params: {
        assetId: photo.assetId,
        thumbnailUri: photo.thumbnailUri ?? '',
        capturedAt: photo.capturedAt,
        target: formingTarget,
      },
    });
  }

  // Returning from the Moment Capture screen: it already folded the moment into
  // today; here we play the celebratory feed — the photo flies up into the egg
  // from the bottom and its category icon starts orbiting. Runs on focus.
  useFocusEffect(
    useCallback(() => {
      const feed = consumeCaptureFeed();
      if (!feed) {
        return;
      }
      orbitNonce.current += 1;
      const key = `orbit-${orbitNonce.current}`;
      setOrbitIcons((prev) => [...prev, { key, icon: feed.icon, accent: feed.accent }].slice(-6));
      const from: FeedSourceRect = { x: windowWidth / 2 - 30, y: windowHeight - 150, w: 60, h: 60 };
      startEggFeed(from, { photoUri: feed.photoUri }, () => {});
      // startEggFeed only touches refs + setState; the focus run reliably has no
      // feed in flight, so its closure is safe to omit from deps.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowWidth, windowHeight])
  );

  // A day tapped in the calendar / life-map asks the Home tab to open it. Consume
  // that request on focus and select the day so the regular Home page shows it.
  useFocusEffect(
    useCallback(() => {
      const pendingDayId = consumeSelectedDay();
      if (pendingDayId) {
        selectTimelineDay(pendingDayId);
      }
    }, [selectTimelineDay])
  );

  // A discovery reveal waits until nothing else is mid-flow: no sheet, prompt,
  // follow-up, recording, or hatch on screen. It then celebrates the
  // highest-rarity pending unlock first (same order as the World page).
  const flowBusy =
    isHatching ||
    hasActivePrompt ||
    promptSheetOpen ||
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
    placePromptOpen ||
    placesVaultOpen ||
    stepsSheetOpen ||
    journeySheetOpen ||
    nameSheetOpen ||
    !!foodFollowUp ||
    !!studioFollowUp ||
    !!comicGen ||
    voiceNote.phase !== 'idle';
  const celebrateDiscovery = useMemo(
    () =>
      [...pendingDiscoveries].sort(
        (a, b) => (DISCOVERY_RARITY_ORDER[b.rarity] ?? 0) - (DISCOVERY_RARITY_ORDER[a.rarity] ?? 0)
      )[0] ?? null,
    [pendingDiscoveries]
  );

  // Horizontal swipe changes the selected day. activeOffsetX/failOffsetY let the
  // vertical ScrollView keep working — only a clearly sideways drag flips days.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .enabled(!isHatching && !promptSheetOpen && !comicGen)
    .onEnd((event) => {
      if (event.translationX > 60) {
        runOnJS(goToAdjacentDay)(-1);
      } else if (event.translationX < -60) {
        runOnJS(goToAdjacentDay)(1);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
    <View style={styles.screen}>
      <AmbientBackground
        accentColor={backgroundAccent}
        colors={['#0C0A14', '#14111F', '#1A1430']}
        meshColors={['rgba(167,139,250,0.12)', 'rgba(125,232,205,0.06)', 'rgba(255,195,107,0.08)', 'rgba(20,17,31,0.2)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        {__DEV__ ? (
          <Pressable onPress={resetHomeState} style={styles.devReset}>
            <ThemedText style={styles.devResetLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
              reset
            </ThemedText>
          </Pressable>
        ) : null}

        <Animated.View entering={presenceEnter(20)}>
          <LanternTimeline days={timelineDays} onSelect={selectTimelineDay} selectedId={selectedDayId} />
        </Animated.View>

        <Animated.View ref={heroStageRef} entering={presenceEnter(70)} style={styles.heroStage}>
          {isHatching && hatchingEgg ? (
            <HatchReveal
              creature={selectedDay?.kind === 'day' ? selectedDay.creature ?? null : null}
              egg={hatchingEgg}
              lanternColor={lanternColour}
              onComplete={handleHatchComplete}
            />
          ) : isDay ? (
            isHatched ? (
              <CreatureHero creature={selectedDay.creature!} weather={selectedDay.weather} hideSubtitle />
            ) : (
              <LanternEgg
                egg={selectedDay.egg}
                onPress={selectedDay.canAddMoments ? openPromptSheet : undefined}
                reactionKey={selectedDay.moments.length}
                feedKey={eggFeedKey}
                lanternColor={lanternColour}
                shellScale={0.72}
              shellOffsetY={-16}
              />
            )
          ) : onTomorrowForming ? (
            <LanternEgg
              egg={tomorrowDay.egg}
              onPress={openPromptSheet}
              reactionKey={tomorrowDay.moments.length}
              feedKey={eggFeedKey}
              lanternColor={lanternColour}
              shellScale={0.72}
              shellOffsetY={-16}
            />
          ) : (
            <LanternEgg
              egg={{
                accentColor: '#A78BFA',
                haloColor: '#A78BFA',
                coreColor: 'rgba(201,194,232,0.3)',
                intensity: 0.26,
                shimmer: true,
                swirl: 0.2,
                label: 'Not yet formed',
              }}
              shellScale={0.72}
              shellOffsetY={-16}
            />
          )}
          {isForming && !isHatching ? <EggOrbitIcons icons={orbitIcons} /> : null}
          {isForming && !isHatching && !hasActivePrompt ? (
            <TodayCategoryRing categories={ringCategories} onPress={handleCategoryPress} />
          ) : null}
          {isFormingToday && !isHatching ? (
            <HatchCountdown
              isReady={selectedDay.kind === 'day' && selectedDay.state === 'ready_to_hatch'}
              style={styles.heroCountdown}
            />
          ) : null}
        </Animated.View>

        {isHatching ? null : isHatched ? (
          <Animated.View entering={presenceEnter(120)} style={styles.sectionGap}>
            <View style={styles.actionDock}>
              <IconAction
                icon="mappin.and.ellipse"
                label="Map"
                onPress={() => handleOpenDayMap(selectedDay.id)}
              />
              <IconAction
                icon="paperplane.fill"
                label="Card"
                busy={sharingDayId === selectedDay.id}
                onPress={handleShareDay}
              />
              <IconAction
                icon="sparkles"
                label="Comic"
                busy={comicGen?.status === 'generating'}
                onPress={handleMakeComic}
              />
            </View>
            <CreatureProvenance creature={selectedDay.creature!} />
            <DayJournalSections day={selectedDay} />
            <ReflectionCard creature={selectedDay.creature!} />
          </Animated.View>
        ) : (
          <Animated.View entering={presenceEnter(120)} style={styles.formingCopy}>
            {!hasActivePrompt ? (
              // The forming quote ("Places have started settling into the egg…")
              // is hidden for now — the stats strip below tells the same story.
              // Tomorrow keeps its one-line label so the pre-feed egg reads.
              onTomorrowForming ? (
                <ThemedText style={styles.formingTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                  Tomorrow is already forming
                </ThemedText>
              ) : null
            ) : null}
            {isForming && formingDay && formingDay.moments.length > 0 ? (
              <View style={styles.chipRow}>
                {dedupeMoments(formingDay.moments).map((moment) => (
                  <View key={moment.id} style={styles.chip}>
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: moment.accentColor, boxShadow: `0 0 12px ${moment.accentColor}AA` },
                      ]}
                    />
                    <ThemedText style={styles.chipLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                      {moment.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {isForming ? (
              <DayPromptStrip
                onAnswer={handleAnswerDayPrompt}
                onDismiss={(kind) => dismissDayPrompt(kind, formingTarget)}
                onSelectHeroPhoto={handleSelectHeroPhoto}
                prompt={formingActivePrompt}
              />
            ) : null}
          </Animated.View>
        )}

        <View style={styles.spacer} />

        {isHatching ? null : (
        <Animated.View entering={presenceEnter(160)} style={styles.ctaArea}>
          {isDay && selectedDay.canHatch ? (
            <KatchaButton label="Reveal the hatch" onPress={handleReveal} variant="primary" />
          ) : isForming && !hasActivePrompt ? (
            <View style={styles.addRow}>
              <WorldActionStack
                orientation="horizontal"
                onCamera={() => {
                  dismissPhotoAlert();
                  router.push('/moment-capture');
                }}
                onMicTap={() => {
                  if (voiceNote.phase === 'idle') router.push('/note-capture');
                }}
                onMicPressIn={voiceNote.start}
                onMicPressOut={() => {
                  void voiceNote.stop();
                }}
                onAddPlace={() => {
                  void handleAddCurrentPlace();
                }}
                onAdd={openPromptSheet}
                recording={voiceNote.isRecording}
              />
            </View>
          ) : null}
        </Animated.View>
        )}

        {isDay && !isHatched && !isHatching ? (
          <Animated.View entering={presenceEnter(200)} style={styles.sectionGap}>
            <DayJournalSections
              day={selectedDay}
              onStatPress={isFormingToday ? handleStatPress : undefined}
              statAttention={isFormingToday ? statAttention : undefined}
            />
          </Animated.View>
        ) : null}
      </ScrollView>

      <EggFeedOverlay feed={eggFeed} onArrive={handleEggFeedArrive} />

      {promptSheetOpen ? (
        <MomentPromptSheet
          prompts={popupPrompts}
          initialPrompt={initialPrompt}
          onAnswer={handleAnswerDayPrompt}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onClose={closePromptSheet}
        />
      ) : null}

      {/* Category sheets — the same readers/add-flows the World patch used, now
          opened from the ring around the egg. Only the forming day captures. */}
      {formingDay ? (
        <>
          {memoryVaultOpen ? (
            <MemoryVaultSheet
              day={formingDay}
              initialTab={memoryVaultTab}
              onAddPhoto={() => {
                setMemoryVaultOpen(false);
                dismissPhotoAlert();
                router.push('/moment-capture');
              }}
              onRecordVoice={() => {
                setMemoryVaultOpen(false);
                router.push('/note-capture');
              }}
              onAddNote={() => {
                setMemoryVaultOpen(false);
                router.push('/note-capture');
              }}
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
                setFoodFollowUp(null);
                setEggFeedKey((key) => key + 1);
                setMicrocopy(`${foodFollowUp.emoji} ${foodFollowUp.label} · noted`);
              }}
              onClose={() => setFoodFollowUp(null)}
            />
          ) : null}
          {studioFollowUp ? (
            <StudioMomentSheet
              suggested={{ mediaType: studioFollowUp.mediaType, label: studioFollowUp.label, emoji: studioFollowUp.emoji }}
              onConfirm={({ rating }) => {
                setStudioMomentRating({ momentId: studioFollowUp.momentId, rating }, formingTarget);
                setStudioFollowUp(null);
                setEggFeedKey((key) => key + 1);
                setMicrocopy(`${studioFollowUp.emoji} ${studioFollowUp.label} · noted`);
              }}
              onClose={() => setStudioFollowUp(null)}
            />
          ) : null}
          {foodVaultOpen ? (
            <FoodVaultSheet
              foodMoments={formingDay.foodMoments ?? []}
              onAddFood={() => {
                setFoodVaultOpen(false);
                setFoodPickerOpen(true);
              }}
              onClose={() => setFoodVaultOpen(false)}
            />
          ) : null}
          {studioPickerOpen ? (
            <StudioMomentSheet onConfirm={handleAddStudio} onClose={() => setStudioPickerOpen(false)} suggested={studioSuggestion} />
          ) : null}
          {studioVaultOpen ? (
            <StudioVaultSheet
              studioMoments={formingDay.studioMoments ?? []}
              onAddStudio={() => {
                setStudioVaultOpen(false);
                setStudioPickerOpen(true);
              }}
              onClose={() => setStudioVaultOpen(false)}
            />
          ) : null}
          {sanctuaryOpen ? (
            <SanctuarySheet
              day={formingDay}
              onReflect={() => {
                setSanctuaryOpen(false);
                openPromptSheet();
              }}
              onClose={() => setSanctuaryOpen(false)}
            />
          ) : null}
          {moodSheetOpen ? (
            <MoodMonumentSheet
              day={formingDay}
              onChoose={handleConfirmMood}
              onOpenSanctuary={() => {
                setMoodSheetOpen(false);
                setSanctuaryOpen(true);
              }}
              onClose={() => setMoodSheetOpen(false)}
            />
          ) : null}
          {sleepSheetOpen ? (
            <SleepSheet
              sleep={formingDay.sleep ?? null}
              onSet={(quality) => {
                setSleep({ quality, source: 'manual' }, formingTarget);
                setMicrocopy('Your morning, remembered');
                setSleepSheetOpen(false);
              }}
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
              stepsCount={formingDay.stepsCount ?? null}
              onConfirm={handleConfirmSteps}
              onClose={() => setStepsSheetOpen(false)}
            />
          ) : null}
          {journeySheetOpen ? (
            <JourneyDetailSheet
              day={formingDay}
              recentAvgSteps={recentAvgSteps}
              onClose={() => setJourneySheetOpen(false)}
              onViewMemories={() => {
                setJourneySheetOpen(false);
                setMemoryVaultTab('photos');
                setMemoryVaultOpen(true);
              }}
              onInterpret={() => {
                setJourneySheetOpen(false);
                setStepsSheetOpen(true);
              }}
            />
          ) : null}
          {placesVaultOpen ? (
            <PlacesDetailSheet
              day={formingDay}
              onClose={() => setPlacesVaultOpen(false)}
              onAddPlace={() => {
                setPlacesVaultOpen(false);
                void handleAddCurrentPlace();
              }}
              onOpenMap={() => {
                setPlacesVaultOpen(false);
                handleOpenDayMap(formingDay.id);
              }}
              onConfirmPlace={handleConfirmPlaceFromVault}
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
              initialName={formingDay.dayName ?? null}
              suggestion={null}
              onSave={(name) => {
                setDayName(name, formingTarget);
                setMicrocopy('Today, named');
              }}
              onClose={() => setNameSheetOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {voiceNote.phase !== 'idle' ? (
        <InlineVoiceNote
          phase={voiceNote.phase}
          elapsed={voiceNote.elapsed}
          result={voiceNote.result}
          markBig={voiceNote.markBig}
          onToggleBig={voiceNote.toggleMarkBig}
          onAccept={voiceNote.accept}
          onDiscard={voiceNote.discard}
          bottom={tabBarHeight}
        />
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

      {celebrateDiscovery && !flowBusy ? (
        <DiscoveryReveal discovery={celebrateDiscovery} onDismiss={() => markDiscoverySeen(celebrateDiscovery.id)} />
      ) : null}
      {backfillStatus.active ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)} pointerEvents="none" style={styles.backfillTag}>
          <ActivityIndicator color={Lantern.ember300} size="small" />
          <ThemedText style={styles.backfillTagLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {backfillStatus.remaining > 0
              ? `Polishing ${backfillStatus.remaining} day${backfillStatus.remaining === 1 ? '' : 's'}…`
              : 'Polishing your days…'}
          </ThemedText>
        </Animated.View>
      ) : null}
      {shareableDay ? (
        <View pointerEvents="none" style={styles.captureCardWrap}>
          <MemoryPostcard day={shareableDay} ref={postcardRef} />
        </View>
      ) : null}

      {comicGen && comicGen.status !== 'done' && comicGen.dayId === selectedDay?.id ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.comicOverlay}>
          {comicGen.status === 'generating' ? (
            <View style={styles.comicCenter}>
              <ActivityIndicator color={Lantern.ember300} size="large" />
              <ThemedText style={styles.comicStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Drawing your comic page…
              </ThemedText>
              <ThemedText style={styles.comicSubStatus} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                This takes up to a minute.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.comicCenter}>
              <ThemedText style={styles.comicStatus} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
                Couldn’t draw the comic
              </ThemedText>
              <ThemedText style={styles.comicSubStatus} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {comicGen.error ?? 'Please try again.'}
              </ThemedText>
              <View style={styles.comicActions}>
                <KatchaButton label="Close" onPress={() => setComicGen(null)} variant="secondary" />
                {shareableDay ? <KatchaButton label="Try again" onPress={() => generateComic(shareableDay)} variant="primary" /> : null}
              </View>
            </View>
          )}
        </Animated.View>
      ) : null}

      {comicGen?.status === 'done' && comicGen.imageUrl ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.comicOverlay}>
          <ScrollView
            style={styles.comicViewer}
            contentContainerStyle={styles.comicViewerScroll}
            showsVerticalScrollIndicator={false}>
            <View collapsable={false} ref={comicShotRef} style={styles.comicImage}>
              <Image contentFit="contain" source={comicGen.imageUrl} style={StyleSheet.absoluteFill} transition={160} />
            </View>
          </ScrollView>
          <View style={styles.comicActions}>
            <KatchaButton label="Close" onPress={() => setComicGen(null)} style={styles.comicActionButton} variant="secondary" />
            <KatchaButton
              icon="sparkles"
              label="Share comic"
              onPress={handleShareGeneratedComic}
              style={styles.comicActionButton}
              variant="primary"
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
    </GestureDetector>
  );
}

// A compact circular action attached to the hatched creature (map / card /
// comic), replacing the old full-width buttons. Shows a spinner while busy.
function IconAction({
  icon,
  label,
  onPress,
  busy = false,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={styles.iconAction}>
      <View style={styles.iconActionCircle}>
        {busy ? (
          <ActivityIndicator color={Lantern.moon50} size="small" />
        ) : (
          <IconSymbol name={icon} size={20} color={Lantern.moon50} />
        )}
      </View>
      <ThemedText style={styles.iconActionLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function dedupeMoments(moments: HomeMoment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    if (seen.has(moment.type)) return false;
    seen.add(moment.type);
    return true;
  }).slice(0, 4);
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Lantern.ink950,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 112,
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  devReset: {
    alignSelf: 'flex-end',
    paddingBottom: 2,
  },
  devResetLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  heroCountdown: {
    marginTop: -18,
  },
  sectionGap: {
    gap: 16,
    marginTop: 12,
  },
  formingCopy: {
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  formingTitle: {
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 23,
    lineHeight: 29,
    maxWidth: 320,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: Lantern.dusk700,
    borderCurve: 'continuous',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  spacer: {
    height: 6,
  },
  ctaArea: {
    marginTop: 12,
  },
  actionDock: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
    paddingRight: 2,
  },
  iconAction: {
    alignItems: 'center',
    gap: 4,
  },
  iconActionCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  addRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCardWrap: {
    left: -2000,
    position: 'absolute',
    top: -2000,
  },
  microcopy: {
    alignSelf: 'center',
    backgroundColor: 'rgba(12, 10, 20, 0.88)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    bottom: 120,
    paddingHorizontal: 16,
    paddingVertical: 9,
    position: 'absolute',
    zIndex: 45,
  },
  microcopyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backfillTag: {
    alignItems: 'center',
    backgroundColor: 'rgba(12, 10, 20, 0.86)',
    borderColor: 'rgba(255, 195, 107, 0.28)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 16,
    top: 60,
    zIndex: 40,
  },
  backfillTagLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  comicOverlay: {
    backgroundColor: 'rgba(6, 5, 12, 0.96)',
    bottom: 0,
    left: 0,
    paddingBottom: 32,
    paddingHorizontal: 18,
    paddingTop: 64,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 60,
  },
  comicCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  comicStatus: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  comicSubStatus: {
    fontSize: 14,
    textAlign: 'center',
  },
  comicViewer: {
    flex: 1,
  },
  comicViewerScroll: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  comicImage: {
    aspectRatio: 3 / 4,
    backgroundColor: '#0C0A14',
    borderRadius: 18,
    overflow: 'hidden',
    width: '100%',
  },
  comicActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 12,
  },
  comicActionButton: {
    flex: 1,
  },
});
