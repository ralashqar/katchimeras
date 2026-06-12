import { useRouter } from 'expo-router';
import { type LayoutChangeEvent, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';

import { AddMomentRadial } from '@/components/katchadeck/home/add-moment-radial';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { FormingEgg } from '@/components/katchadeck/home/forming-egg';
import { HatchSequence, type HatchSequencePhase } from '@/components/katchadeck/home/hatch-sequence';
import { LanternTimeline } from '@/components/katchadeck/home/lantern-timeline';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { ReflectionCard } from '@/components/katchadeck/home/reflection-card';
import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies, Lantern } from '@/constants/theme';
import { useAddMomentFlow } from '@/hooks/use-add-moment-flow';
import { useDayLocationCapture } from '@/hooks/use-day-location-capture';
import { useDayStepCapture } from '@/hooks/use-day-step-capture';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useRecentPhotoMapSeeding } from '@/hooks/use-recent-photo-map-seeding';
import type { HomeDayRecord, HomeMoment } from '@/types/home';

export default function HomeScreen() {
  const router = useRouter();
  const {
    addMoment,
    activityPermission,
    addForegroundLocationSample,
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
  const [hatchTargetId, setHatchTargetId] = useState<string | null>(null);
  const [hatchPhase, setHatchPhase] = useState<HatchSequencePhase>('recap');
  const [heroAnchorY, setHeroAnchorY] = useState(316);
  const [sharingDayId, setSharingDayId] = useState<string | null>(null);
  const postcardRef = useRef<View>(null);
  const addMomentFlow = useAddMomentFlow({
    enabled: selectedDay?.kind === 'day' && selectedDay.canAddMoments,
    onAddMoment: addMoment,
    timelineDays,
    todayDay: selectedDay?.kind === 'day' && selectedDay.isToday ? selectedDay : null,
  });
  const {
    close: closeAddMomentFlow,
    confirmInspiration,
    dismissError: dismissAddMomentError,
    open: openAddMomentFlow,
    selectAction: selectAddMomentAction,
    selectInspirationCategory,
    selectRecentPhoto,
    state: addMomentFlowState,
    usePhotoPickerFallback,
  } = addMomentFlow;

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
  const hatchDay =
    hatchTargetId && selectedDay?.kind === 'day' && selectedDay.id === hatchTargetId ? selectedDay : null;
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

  useRecentPhotoMapSeeding({
    dayId: selectedDay?.kind === 'day' && selectedDay.isToday ? selectedDay.id : null,
    enabled: selectedDay?.kind === 'day' && selectedDay.isToday,
    onSeed: seedRecentPhotoLocations,
  });

  useEffect(() => {
    if (!hatchTargetId || !hatchDay) {
      return;
    }

    const recapTimer = setTimeout(() => setHatchPhase('converging'), 700);
    const revealTimer = setTimeout(() => setHatchPhase('revealing'), 1450);
    const finalizeTimer = setTimeout(() => {
      triggerHatchIfReady();
    }, 1700);
    const cleanupTimer = setTimeout(() => {
      setHatchTargetId(null);
      setHatchPhase('recap');
      refreshState();
    }, 2350);

    return () => {
      clearTimeout(recapTimer);
      clearTimeout(revealTimer);
      clearTimeout(finalizeTimer);
      clearTimeout(cleanupTimer);
    };
  }, [hatchDay, hatchTargetId, refreshState, triggerHatchIfReady]);

  useEffect(() => {
    if (hatchTargetId && selectedDay?.kind === 'day' && selectedDay.id === hatchTargetId && selectedDay.state === 'hatched') {
      const timer = setTimeout(() => {
        setHatchTargetId(null);
        setHatchPhase('recap');
      }, 520);

      return () => clearTimeout(timer);
    }
  }, [hatchTargetId, selectedDay]);

  useEffect(() => {
    closeAddMomentFlow();
  }, [closeAddMomentFlow, selectedDayId]);

  const handleReveal = () => {
    if (selectedDay?.kind !== 'day' || !selectedDay.canHatch) {
      return;
    }

    setHatchTargetId(selectedDay.id);
    setHatchPhase('recap');
  };

  const handleSkipHatch = () => {
    triggerHatchIfReady();
    setHatchTargetId(null);
    setHatchPhase('recap');
    refreshState();
  };

  function handleHeroStageLayout(event: LayoutChangeEvent) {
    const { height, y } = event.nativeEvent.layout;
    setHeroAnchorY(y + height / 2);
  }

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
        title: `${selectedDay.creature.name} postcard`,
        url: uri,
      });
    } finally {
      setSharingDayId((current) => (current === selectedDay.id ? null : current));
    }
  }

  const isDay = selectedDay?.kind === 'day';
  const isHatched = isDay && selectedDay.state === 'hatched' && selectedDay.creature;
  const isFormingToday = isDay && selectedDay.isToday && selectedDay.state !== 'hatched';
  const signalLine = isDay ? buildSignalLine(selectedDay) : null;

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

        <Animated.View entering={presenceEnter(20)}>
          <LanternTimeline days={timelineDays} onSelect={selectTimelineDay} selectedId={selectedDayId} />
        </Animated.View>

        <Animated.View entering={presenceEnter(70)} onLayout={handleHeroStageLayout} style={styles.heroStage}>
          {isDay ? (
            isHatched ? (
              <CreatureHero creature={selectedDay.creature!} hideSubtitle />
            ) : (
              <View style={styles.eggScale}>
                <FormingEgg
                  egg={selectedDay.egg}
                  interactive
                  onPress={selectedDay.canAddMoments ? openAddMomentFlow : undefined}
                  reactionKey={selectedDay.moments.length}
                />
              </View>
            )
          ) : (
            <View style={styles.eggScale}>
              <FormingEgg
                egg={{
                  accentColor: '#A78BFA',
                  haloColor: '#A78BFA',
                  coreColor: 'rgba(201,194,232,0.3)',
                  intensity: 0.26,
                  shimmer: true,
                  swirl: 0.2,
                  label: 'Not yet formed',
                }}
                interactive
              />
            </View>
          )}
        </Animated.View>

        {isHatched ? (
          <Animated.View entering={presenceEnter(120)} style={styles.sectionGap}>
            <ReflectionCard creature={selectedDay.creature!} />
          </Animated.View>
        ) : (
          <Animated.View entering={presenceEnter(120)} style={styles.formingCopy}>
            <ThemedText style={styles.formingTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {formingTitle}
            </ThemedText>
            {signalLine ? (
              <ThemedText style={styles.signalLine} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                {signalLine}
              </ThemedText>
            ) : null}
            {isFormingToday && selectedDay.moments.length > 0 ? (
              <View style={styles.chipRow}>
                {dedupeMoments(selectedDay.moments).map((moment) => (
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
          </Animated.View>
        )}

        <View style={styles.spacer} />

        <Animated.View entering={presenceEnter(160)} style={styles.ctaArea}>
          {isDay && selectedDay.canHatch ? (
            <KatchaButton label="Reveal the hatch" onPress={handleReveal} variant="primary" />
          ) : isHatched ? (
            <View style={styles.ctaRow}>
              <KatchaButton
                label="Day map"
                onPress={() => handleOpenDayMap(selectedDay.id)}
                style={styles.ctaQuiet}
                variant="secondary"
              />
              <KatchaButton
                disabled={sharingDayId === selectedDay.id}
                label={sharingDayId === selectedDay.id ? 'Preparing…' : 'Share postcard'}
                onPress={handleShareDay}
                style={styles.ctaMain}
                variant="primary"
              />
            </View>
          ) : isFormingToday ? (
            <KatchaButton label="Add a moment" onPress={openAddMomentFlow} variant="primary" />
          ) : null}
        </Animated.View>
      </ScrollView>

      <AddMomentRadial
        anchorY={heroAnchorY}
        onClose={closeAddMomentFlow}
        onConfirmInspiration={confirmInspiration}
        onDismissError={dismissAddMomentError}
        onSelectAction={selectAddMomentAction}
        onSelectInspirationCategory={selectInspirationCategory}
        onSelectRecentPhoto={selectRecentPhoto}
        onUsePickerFallback={usePhotoPickerFallback}
        state={addMomentFlowState}
      />
      {hatchDay ? <HatchSequence day={hatchDay} onSkip={handleSkipHatch} phase={hatchPhase} /> : null}
      {hatchTargetId && selectedDay?.kind === 'day' && selectedDay.id === hatchTargetId && selectedDay.state === 'hatched' ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(260)} style={styles.revealFlash}>
          <ThemedText type="onboardingLabel" style={styles.flashLabel} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
            Hatched
          </ThemedText>
          <ThemedText type="subtitle" style={styles.flashTitle} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
            {selectedDay.creature?.name}
          </ThemedText>
        </Animated.View>
      ) : null}
      {shareableDay ? (
        <View pointerEvents="none" style={styles.captureCardWrap}>
          <MemoryPostcard day={shareableDay} ref={postcardRef} />
        </View>
      ) : null}
    </View>
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
  eggScale: {
    transform: [{ scale: 1.06 }],
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
    fontSize: 26,
    lineHeight: 33,
    maxWidth: 300,
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
    flexGrow: 1,
    minHeight: 10,
  },
  ctaArea: {
    marginTop: 8,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  ctaQuiet: {
    flex: 1,
  },
  ctaMain: {
    flex: 1.4,
  },
  revealFlash: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 7, 15, 0.9)',
    borderRadius: 26,
    bottom: '44%',
    gap: 6,
    left: 36,
    paddingHorizontal: 24,
    paddingVertical: 20,
    position: 'absolute',
    right: 36,
    zIndex: 30,
  },
  flashLabel: {
    fontSize: 11,
  },
  flashTitle: {
    fontFamily: AppFontFamilies.instrumentSerif,
    fontSize: 30,
    fontStyle: 'italic',
    fontWeight: '400',
    textAlign: 'center',
  },
  captureCardWrap: {
    left: -2000,
    position: 'absolute',
    top: -2000,
  },
});
