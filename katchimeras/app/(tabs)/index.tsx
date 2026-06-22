import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';

import { MomentPromptSheet } from '@/components/katchadeck/home/moment-prompt-sheet';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { HatchReveal } from '@/components/katchadeck/home/hatch-reveal';
import { LanternEgg } from '@/components/katchadeck/home/lantern-egg';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { DayPromptStrip, type FeedSourceRect } from '@/components/katchadeck/home/day-prompt-strip';
import { EggFeedOverlay, type EggFeed } from '@/components/katchadeck/home/egg-feed-overlay';
import { EggOrbitIcons, type OrbitIcon } from '@/components/katchadeck/home/egg-orbit-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { renderDayComic } from '@/utils/day-comic-render';
import { ensureDayVision } from '@/utils/photo-vision';
import { consumeCaptureFeed } from '@/utils/capture-feed-signal';
import { getStoredJson, setStoredJson } from '@/utils/app-storage';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { ReflectionCard } from '@/components/katchadeck/home/reflection-card';
import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import type { DayPromptPhotoCandidate } from '@/utils/day-prompt-engine';
import { useDayLocationCapture } from '@/hooks/use-day-location-capture';
import { useDayStepCapture } from '@/hooks/use-day-step-capture';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useRecentPhotoMapSeeding } from '@/hooks/use-recent-photo-map-seeding';
import { useBackfillStatus } from '@/utils/backfill-status';
import type { EggVisualState, HomeDayRecord, HomeMoment } from '@/types/home';

const COMIC_PHOTO_CONSENT_KEY = 'comic_photo_consent_v1';

export default function HomeScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    activeDayPrompt,
    availableDayPrompts,
    activityPermission,
    answerDayPrompt,
    answerPhotoMeaning,
    addForegroundLocationSample,
    dismissDayPrompt,
    isTodayHatched,
    tomorrowDay,
    tomorrowActivePrompt,
    tomorrowAvailablePrompts,
    locationPermission,
    selectedDay,
    selectedDayId,
    seedRecentPhotoLocations,
    setActivityPermission,
    setLocationPermission,
    setTodayStepCount,
    selectTimelineDay,
    timelineDays,
    triggerHatchIfReady,
    refreshState,
    resetHomeState,
  } = useHomeScreenState();
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
  const openPromptSheet = () => setPromptSheetOpen(true);
  const closePromptSheet = () => setPromptSheetOpen(false);
  // Category icons orbiting the egg, one per fed photo (capture / photo prompt).
  const [orbitIcons, setOrbitIcons] = useState<OrbitIcon[]>([]);
  const orbitNonce = useRef(0);

  const backgroundAccent =
    selectedDay?.kind === 'day'
      ? selectedDay.state === 'hatched' && selectedDay.creature
        ? `${selectedDay.creature.accentColor}16`
        : `${selectedDay.egg.haloColor}14`
      : 'rgba(167,139,250,0.12)';

  const formingTitle =
    selectedDay?.kind === 'day'
      ? selectedDay.highlight ?? 'Small moments change the shape of the day.'
      : (selectedDay?.subtitle ?? 'Another day is waiting in the wings.');
  const shareableDay =
    selectedDay?.kind === 'day' && selectedDay.state === 'hatched' && selectedDay.creature
      ? (selectedDay as HomeDayRecord & { creature: NonNullable<HomeDayRecord['creature']> })
      : null;

  useDayLocationCapture({
    enabled: selectedDay?.kind === 'day' && selectedDay.isToday,
    onPermissionResolved: setLocationPermission,
    onSample: addForegroundLocationSample,
    permissionState: locationPermission,
  });

  useDayStepCapture({
    enabled: selectedDay?.kind === 'day' && selectedDay.isToday,
    onPermissionResolved: setActivityPermission,
    onStepCount: setTodayStepCount,
    permissionState: activityPermission,
  });

  // Seeds photos onto the days they were taken (today + recent past), so it
  // runs whenever Home is up - not only when today is the selected day.
  useRecentPhotoMapSeeding({
    dayId: timelineDays.length > 0 ? `seed-${new Date().toISOString().slice(0, 10)}` : null,
    enabled: timelineDays.some((day) => day.kind === 'day'),
    onSeed: seedRecentPhotoLocations,
  });

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
    await triggerHatchIfReady();
    refreshState();
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
  const signalLine = isDay ? buildSignalLine(selectedDay) : null;

  // Once today has hatched, the Tomorrow page becomes a forming egg the user can
  // pre-feed (moments / prompts / camera) until the rollover. The forming target
  // + which day/prompts to use are unified here so the same UI drives both.
  const onTomorrowForming = selectedDay?.kind === 'tomorrow' && isTodayHatched;
  const isForming = isFormingToday || onTomorrowForming;
  const formingTarget = onTomorrowForming ? 'tomorrow' : 'today';
  const formingDay = onTomorrowForming ? tomorrowDay : isFormingToday ? selectedDay : null;
  const formingPrompts = onTomorrowForming ? tomorrowAvailablePrompts : availableDayPrompts;
  const formingActivePrompt = onTomorrowForming ? tomorrowActivePrompt : activeDayPrompt;

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

  return (
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

        {isHatching ? null : (
          <Animated.View entering={presenceEnter(20)}>
            <LanternTimeline days={timelineDays} onSelect={selectTimelineDay} selectedId={selectedDayId} />
          </Animated.View>
        )}

        <Animated.View ref={heroStageRef} entering={presenceEnter(70)} style={styles.heroStage}>
          {isHatching && hatchingEgg ? (
            <HatchReveal
              creature={selectedDay?.kind === 'day' ? selectedDay.creature ?? null : null}
              egg={hatchingEgg}
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
              />
            )
          ) : onTomorrowForming ? (
            <LanternEgg
              egg={tomorrowDay.egg}
              onPress={openPromptSheet}
              reactionKey={tomorrowDay.moments.length}
              feedKey={eggFeedKey}
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
            />
          )}
          {isForming && !isHatching ? <EggOrbitIcons icons={orbitIcons} /> : null}
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
            <ReflectionCard creature={selectedDay.creature!} />
          </Animated.View>
        ) : (
          <Animated.View entering={presenceEnter(120)} style={styles.formingCopy}>
            <ThemedText style={styles.formingTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {onTomorrowForming ? 'Tomorrow is already forming' : formingTitle}
            </ThemedText>
            {!onTomorrowForming && signalLine ? (
              <ThemedText style={styles.signalLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {signalLine}
              </ThemedText>
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
          ) : isForming ? (
            <View style={styles.addRow}>
              <KatchaButton
                label={onTomorrowForming ? 'Add to tomorrow' : 'Add to today'}
                onPress={openPromptSheet}
                variant="primary"
                style={styles.addMain}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Capture a moment with the camera"
                onPress={() => router.push('/moment-capture')}
                style={styles.cameraButton}>
                <IconSymbol name="camera.fill" size={22} color={Lantern.ink900} />
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
        )}
      </ScrollView>

      <EggFeedOverlay feed={eggFeed} onArrive={handleEggFeedArrive} />

      {promptSheetOpen ? (
        <MomentPromptSheet
          prompts={formingPrompts}
          onAnswer={handleAnswerDayPrompt}
          onSelectHeroPhoto={handleSelectHeroPhoto}
          onClose={closePromptSheet}
        />
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

function buildSignalLine(day: HomeDayRecord) {
  const parts: string[] = [];
  if (day.stepsCount > 0) parts.push(`${day.stepsCount.toLocaleString()} steps`);
  if (day.visitedPlaceCount > 0) {
    parts.push(`${day.visitedPlaceCount} ${day.visitedPlaceCount === 1 ? 'place' : 'places'}`);
  }
  if (day.newPlaceCount > 0) parts.push(`${day.newPlaceCount} new`);
  return parts.length > 0 ? parts.join('  ·  ') : null;
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
  sectionGap: {
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
  signalLine: {
    fontSize: 13,
    fontWeight: '600',
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
    flexDirection: 'row',
    gap: 12,
  },
  addMain: {
    flex: 1,
  },
  cameraButton: {
    alignItems: 'center',
    backgroundColor: Lantern.ember300,
    borderCurve: 'continuous',
    borderRadius: 999,
    boxShadow: '0 10px 24px rgba(255,195,107,0.32)',
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  captureCardWrap: {
    left: -2000,
    position: 'absolute',
    top: -2000,
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
