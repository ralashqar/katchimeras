import { useRouter } from 'expo-router';
import { type LayoutChangeEvent, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { captureRef } from 'react-native-view-shot';

import { AddMomentRadial } from '@/components/katchadeck/home/add-moment-radial';
import { CreatureHero } from '@/components/katchadeck/home/creature-hero';
import { DayContext } from '@/components/katchadeck/home/day-context';
import { FormingEgg } from '@/components/katchadeck/home/forming-egg';
import { HatchSequence, type HatchSequencePhase } from '@/components/katchadeck/home/hatch-sequence';
import { InsightPathsPanel } from '@/components/katchadeck/home/insight-paths-panel';
import { MemoryPostcard } from '@/components/katchadeck/home/memory-postcard';
import { AmbientBackground } from '@/components/katchadeck/ambient-background';
import { presenceEnter } from '@/components/katchadeck/motion';
import { DayTimeline } from '@/components/katchadeck/timeline/day-timeline';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { useAddMomentFlow } from '@/hooks/use-add-moment-flow';
import { useDayLocationCapture } from '@/hooks/use-day-location-capture';
import { useDayStepCapture } from '@/hooks/use-day-step-capture';
import { useHomeScreenState } from '@/hooks/use-home-screen-state';
import { useRecentPhotoMapSeeding } from '@/hooks/use-recent-photo-map-seeding';
import type { HomeDayRecord } from '@/types/home';
import type { TimelineDayEntry, TimelineTomorrowState } from '@/types/timeline';
import { getCreatureVisual } from '@/utils/home-engine';

export default function HomeScreen() {
  const router = useRouter();
  const {
    addMoment,
    activityPermission,
    addForegroundLocationSample,
    importingHealthRouteDayId,
    importHealthRoutesForDay,
    locationPermission,
    selectPath,
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

  const dayEntries = timelineDays.filter((day): day is HomeDayRecord => day.kind === 'day').map(toTimelineEntry);
  const tomorrowDay = timelineDays.find((day) => day.kind === 'tomorrow');
  const tomorrowState: TimelineTomorrowState = tomorrowDay
    ? {
        id: 'tomorrow',
        dayLabel: tomorrowDay.dayLabel,
        dateLabel: tomorrowDay.dateLabel,
        title: tomorrowDay.title,
        subtitle: tomorrowDay.subtitle,
        statusLabel: 'Forming',
        accent: tomorrowDay.accentColor,
      }
    : {
        id: 'tomorrow',
        dayLabel: 'Tomorrow',
        dateLabel: 'Forming',
        title: 'Not yet formed',
        subtitle: 'Another day is waiting for a little motion.',
        statusLabel: 'Forming',
        accent: '#D8E2FF',
      };

  const backgroundAccent =
    selectedDay?.kind === 'day'
      ? selectedDay.state === 'hatched' && selectedDay.creature
        ? `${selectedDay.creature.accentColor}18`
        : `${selectedDay.egg.haloColor}18`
      : 'rgba(216,226,255,0.16)';

  const heroSubtitle =
    selectedDay?.kind === 'day' && selectedDay.state === 'hatched'
      ? selectedDay.highlight ?? selectedDay.creature?.reflection ?? ''
      : selectedDay?.kind === 'day'
        ? selectedDay.highlight ?? 'Small moments change the shape of the day.'
        : selectedDay?.subtitle ?? 'Another day is waiting in the wings.';
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

  return (
    <View style={styles.screen}>
      <AmbientBackground
        accentColor={backgroundAccent}
        colors={['#090B12', '#101A2B', '#171E35']}
        meshColors={['rgba(200,216,255,0.14)', 'rgba(95,168,123,0.08)', 'rgba(227,160,110,0.08)', 'rgba(106,95,232,0.12)']}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Animated.View entering={presenceEnter()} style={styles.timelineHeader}>
          {__DEV__ ? (
            <KatchaButton
              icon="arrow.counterclockwise"
              label="Reset loop"
              onPress={resetHomeState}
              style={styles.resetButton}
              variant="secondary"
            />
          ) : null}
        </Animated.View>

        <Animated.View entering={presenceEnter(30)}>
          <DayTimeline
            entries={dayEntries}
            mode="interactive"
            onSelectEntry={selectTimelineDay}
            selectedEntryId={selectedDayId}
            showTomorrowEgg
            tomorrowState={tomorrowState}
          />
        </Animated.View>

        <Animated.View entering={presenceEnter(70)} onLayout={handleHeroStageLayout} style={styles.heroStage}>
          {selectedDay?.kind === 'day' ? (
            selectedDay.state === 'hatched' && selectedDay.creature ? (
              <CreatureHero
                creature={selectedDay.creature}
                interactive
                moments={selectedDay.moments}
                onPress={selectedDay.canAddMoments ? openAddMomentFlow : undefined}
                subtitle={heroSubtitle}
              />
            ) : (
              <FormingEgg
                caption={heroSubtitle}
                egg={selectedDay.egg}
                interactive
                onPress={selectedDay.canAddMoments ? openAddMomentFlow : undefined}
                reactionKey={selectedDay.moments.length + (selectedDay.selectedPathId ? 1 : 0)}
              />
            )
          ) : (
            <FormingEgg
              caption={selectedDay?.subtitle}
              egg={{
                accentColor: tomorrowState.accent,
                haloColor: tomorrowState.accent,
                coreColor: 'rgba(216,226,255,0.32)',
                intensity: 0.3,
                shimmer: true,
                swirl: 0.2,
                label: tomorrowState.title,
              }}
              interactive
            />
          )}
        </Animated.View>

        {selectedDay?.kind === 'day' ? (
          <Animated.View entering={presenceEnter(110)}>
            <DayContext
              day={selectedDay}
              onAddMoment={openAddMomentFlow}
              isImportingHealthRoutes={importingHealthRouteDayId === selectedDay.id}
              onImportHealthRoutes={() => importHealthRoutesForDay(selectedDay.id)}
              onReveal={handleReveal}
              onShare={handleShareDay}
              onViewDayMap={() => handleOpenDayMap(selectedDay.id)}
              isSharing={sharingDayId === selectedDay.id}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={presenceEnter(110)}>
            <View style={styles.tomorrowCopy}>
              <ThemedText type="onboardingLabel" style={styles.tomorrowLabel} lightColor="#D7E4FF" darkColor="#D7E4FF">
                Tomorrow
              </ThemedText>
              <ThemedText style={styles.tomorrowBody} lightColor="#DCE6FF" darkColor="#DCE6FF">
                {selectedDay?.title}. {selectedDay?.subtitle}
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {selectedDay?.kind === 'day' && selectedDay.isToday ? (
          <Animated.View entering={presenceEnter(150)}>
            <InsightPathsPanel day={selectedDay} onSelectPath={selectPath} />
          </Animated.View>
        ) : null}
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
          <ThemedText type="onboardingLabel" style={styles.flashLabel} lightColor="#FFE8D9" darkColor="#FFE8D9">
            Hatched
          </ThemedText>
          <ThemedText type="subtitle" style={styles.flashTitle} lightColor="#FFF8F4" darkColor="#FFF8F4">
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

function toTimelineEntry(day: HomeDayRecord): TimelineDayEntry {
  const creatureVisual =
    day.state === 'hatched' && day.creature
      ? {
          id: day.creature.id,
          name: day.creature.name,
          accent: day.creature.accentColor,
          imageSource: getCreatureVisual(day.creature.visualKey).source,
        }
      : {
          kind: 'egg' as const,
          id: `egg-${day.id}`,
          name: day.canHatch ? 'Ready' : 'Forming',
          accent: day.egg.accentColor,
          coreColor: day.egg.coreColor,
          shimmer: day.egg.shimmer,
          intensity: day.egg.intensity,
        };

  return {
    id: day.id,
    dayLabel: day.dayLabel,
    dateLabel: day.dateLabel,
    cardTitle: day.state === 'hatched' && day.creature ? day.creature.name : day.egg.label,
    cardCue: day.highlight ?? 'The day is still collecting shape.',
    summary: day.highlight ?? 'The day is still collecting shape.',
    creature: creatureVisual,
    memory: {
      title: day.state === 'hatched' && day.creature ? day.creature.name : day.egg.label,
      body: day.highlight ?? 'The day is still collecting shape.',
      timeLabel: day.dateLabel,
      location: day.isToday ? 'Today' : 'Stored day',
      tag: day.state === 'hatched' ? 'Creature' : 'Forming',
      metrics: day.moments.length > 0 ? day.moments.map((moment) => moment.label).join(' · ') : buildPassiveMetrics(day),
    },
  };
}

function buildPassiveMetrics(day: HomeDayRecord) {
  const parts: string[] = [];

  if (day.stepsCount > 0) {
    parts.push(`${day.stepsCount.toLocaleString()} steps`);
  }

  if (day.visitedPlaceCount > 0) {
    parts.push(`${day.visitedPlaceCount} ${day.visitedPlaceCount === 1 ? 'place' : 'places'}`);
  }

  if (day.newPlaceCount > 0) {
    parts.push(`${day.newPlaceCount} new`);
  }

  return parts.join(' · ') || 'No moments yet';
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#090B12',
    flex: 1,
  },
  content: {
    gap: 14,
    paddingBottom: 164,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  timelineHeader: {
    alignItems: 'flex-end',
    minHeight: 8,
  },
  resetButton: {
    minHeight: 44,
  },
  heroStage: {
    minHeight: 282,
  },
  tomorrowCopy: {
    gap: 4,
    maxWidth: 300,
  },
  tomorrowLabel: {
    fontSize: 11,
  },
  tomorrowBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  revealFlash: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 11, 19, 0.68)',
    borderRadius: 999,
    bottom: 120,
    left: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    position: 'absolute',
    right: 24,
  },
  captureCardWrap: {
    left: -2000,
    position: 'absolute',
    top: -2000,
  },
  flashLabel: {
    fontSize: 11,
  },
  flashTitle: {
    fontSize: 20,
    lineHeight: 24,
    marginTop: 2,
  },
});
