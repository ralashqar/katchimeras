import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  FadeOutDown,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import { HeroShowcaseCaption } from '@/components/katchadeck/onboarding/hero-showcase-caption';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  dayInMotionScenes,
  reducedMotionScenes,
  type DayInMotionJourneyEntry,
  type DayInMotionScene,
  type DayInMotionTodayState,
} from '@/constants/day-in-motion-intro';
import { onboardingShowcaseAssets } from '@/constants/onboarding-showcase-assets';
import { onboardingShowcaseEntries, onboardingShowcaseProfiles } from '@/constants/onboarding-showcase';
import { heroOrbitAssets } from '@/constants/onboarding-hero';
import { KatchaDeckUI } from '@/constants/theme';

type DayInMotionIntroProps = {
  onBegin: () => void;
};

const FINAL_SCENE_INDEX = dayInMotionScenes.length - 1;
type ShowcaseImageSource = ImageSourcePropType | { uri: string };

export function DayInMotionIntro({ onBegin }: DayInMotionIntroProps) {
  const { height, width } = useWindowDimensions();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const railTranslateX = useSharedValue(0);
  const stageOpacity = useSharedValue(1);
  const journeyOpacity = useSharedValue(0);
  const journeyShift = useSharedValue(44);
  const questionOpacity = useSharedValue(0);
  const revealOpacity = useSharedValue(0);
  const questionShake = useSharedValue(0);

  const sceneList = reduceMotionEnabled ? reducedMotionScenes : dayInMotionScenes;
  const scene = sceneList[sceneIndex] ?? sceneList[0];
  const profileMap = useMemo(
    () => new Map(onboardingShowcaseProfiles.map((profile) => [profile.id, profile])),
    []
  );
  const railItems = useMemo(
    () =>
      onboardingShowcaseEntries.map((entry, index) => ({
        ...entry,
        appearAtScene: index === 0 ? 0 : index + 1,
        caption: profileMap.get(entry.profileId)?.displayName ?? entry.beat,
      })),
    [profileMap]
  );
  const activeShowcaseEntry = useMemo(
    () => railItems.find((item) => item.id === scene.focusedCreatureId) ?? railItems[0],
    [railItems, scene.focusedCreatureId]
  );
  const activeJournalEntry: DayInMotionJourneyEntry | null = activeShowcaseEntry
    ? {
        timeLabel: activeShowcaseEntry.journal.timeLabel,
        title: activeShowcaseEntry.journal.title,
        subtitle: activeShowcaseEntry.journal.body,
        location: activeShowcaseEntry.journal.location,
        iconOrTag: activeShowcaseEntry.journal.tag,
        metrics: activeShowcaseEntry.journal.metrics,
      }
    : null;
  const dayLabels = useMemo(
    () => Array.from(new Set(sceneList.map((entry) => entry.dayLabel))),
    [sceneList]
  );
  const activeDayIndex = Math.max(0, dayLabels.findIndex((label) => label === scene.dayLabel));
  const sceneSize = useMemo(() => Math.min(width - 36, height < 760 ? 332 : 360), [height, width]);
  const stageHeight = useMemo(
    () => (height < 760 ? 348 : 392),
    [height]
  );
  const bubbleSize = height < 760 ? 72 : 82;
  const railGap = width < 390 ? 18 : 22;
  const railStep = bubbleSize + railGap;
  const railViewportWidth = Math.min(width - 12, sceneSize + 20);
  const calendarWidth = Math.min(sceneSize * 0.68, 232);
  const showFinalControls = sceneIndex === FINAL_SCENE_INDEX;

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((timerId) => clearTimeout(timerId));
    timeoutsRef.current = [];
  }, []);

  const getRailTarget = useCallback(
    (focusedCreatureId: DayInMotionScene['focusedCreatureId']) => {
      const focusIndex = Math.max(
        0,
        railItems.findIndex((item) => item.id === focusedCreatureId)
      );
      return railViewportWidth / 2 - bubbleSize / 2 - focusIndex * railStep;
    },
    [bubbleSize, railItems, railStep, railViewportWidth]
  );

  const applySceneState = useCallback(
    (nextScene: DayInMotionScene, immediate = false) => {
      const transitionDuration = immediate ? 0 : reduceMotionEnabled ? 180 : 560;
      const easing = Easing.out(Easing.cubic);

      railTranslateX.value = immediate
        ? getRailTarget(nextScene.focusedCreatureId)
        : withTiming(getRailTarget(nextScene.focusedCreatureId), {
            duration: transitionDuration,
            easing,
          });
      stageOpacity.value = immediate
        ? 1
        : withTiming(1, {
            duration: transitionDuration,
            easing,
          });
      journeyOpacity.value = immediate
        ? nextScene.showJourneyEntry
          ? 1
          : 0
        : withTiming(nextScene.showJourneyEntry ? 1 : 0, {
            duration: transitionDuration,
            easing,
          });
      journeyShift.value = immediate
        ? nextScene.showJourneyEntry
          ? 0
          : 44
        : withTiming(nextScene.showJourneyEntry ? 0 : 44, {
            duration: transitionDuration,
            easing,
          });

      if (immediate) {
        questionOpacity.value = nextScene.todayState === 'question' ? 1 : 0;
        revealOpacity.value = nextScene.todayState === 'reveal' ? 1 : 0;
        questionShake.value = 0;
        return;
      }

      questionOpacity.value = withTiming(nextScene.todayState === 'question' ? 1 : 0, {
        duration: reduceMotionEnabled ? 140 : 220,
        easing: Easing.out(Easing.quad),
      });
      revealOpacity.value =
        nextScene.todayState === 'reveal'
          ? withDelay(
              nextScene.todayState === 'reveal' && !reduceMotionEnabled ? 620 : 0,
              withTiming(1, {
                duration: reduceMotionEnabled ? 180 : 320,
                easing,
              })
            )
          : withTiming(0, {
              duration: reduceMotionEnabled ? 120 : 180,
              easing,
            });

      cancelAnimation(questionShake);
      if (nextScene.todayState === 'question' && !reduceMotionEnabled) {
        questionShake.value = withSequence(
          withTiming(-0.35, { duration: 90, easing: Easing.linear }),
          withTiming(0.35, { duration: 90, easing: Easing.linear }),
          withTiming(-0.25, { duration: 80, easing: Easing.linear }),
          withTiming(0.25, { duration: 80, easing: Easing.linear }),
          withTiming(0, { duration: 70, easing: Easing.out(Easing.quad) })
        );
      } else if (nextScene.todayState === 'reveal' && !reduceMotionEnabled) {
        questionShake.value = withSequence(
          withTiming(-1, { duration: 70, easing: Easing.linear }),
          withTiming(1, { duration: 85, easing: Easing.linear }),
          withTiming(-1, { duration: 70, easing: Easing.linear }),
          withTiming(1, { duration: 80, easing: Easing.linear }),
          withTiming(-0.9, { duration: 65, easing: Easing.linear }),
          withTiming(0.9, { duration: 65, easing: Easing.linear }),
          withTiming(-0.6, { duration: 55, easing: Easing.linear }),
          withTiming(0.6, { duration: 55, easing: Easing.linear }),
          withTiming(0, { duration: 60, easing: Easing.out(Easing.quad) })
        );
      } else {
        questionShake.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) });
      }
    },
    [
      getRailTarget,
      journeyOpacity,
      journeyShift,
      questionOpacity,
      questionShake,
      railTranslateX,
      reduceMotionEnabled,
      revealOpacity,
      stageOpacity,
    ]
  );

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    clearTimers();
    const firstScene = sceneList[0];

    setSceneIndex(0);
    applySceneState(firstScene, true);
    stageOpacity.value = 0;

    let accumulatedDelay = 0;

    sceneList.forEach((step, index) => {
      if (index === 0) {
        return;
      }

      accumulatedDelay += sceneList[index - 1].durationMs;
      const timer = setTimeout(() => {
        setSceneIndex(index);
      }, accumulatedDelay);
      timeoutsRef.current.push(timer);
    });

    return clearTimers;
  }, [applySceneState, clearTimers, replayKey, sceneList, stageOpacity]);

  useEffect(() => {
    if (!scene) {
      return;
    }

    if (sceneIndex > 0) {
      applySceneState(scene);
    }
  }, [applySceneState, scene, sceneIndex]);

  const railTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: railTranslateX.value }],
  }));

  const stageStyle = useAnimatedStyle(() => ({
    opacity: stageOpacity.value,
  }));

  const journeyStyle = useAnimatedStyle(() => ({
    opacity: journeyOpacity.value,
    transform: [{ translateX: journeyShift.value }],
  }));

  const handleReplay = useCallback(() => {
    setReplayKey((current) => current + 1);
  }, []);

  return (
    <View style={styles.page}>
      <View style={[styles.sceneWrap, { minHeight: stageHeight }]}>
        <View style={[styles.sceneStage, { minHeight: stageHeight, width: sceneSize }]}>
          <Animated.View style={[styles.stageShell, stageStyle]}>
            <View style={[styles.calendarStage, { width: calendarWidth }]}>
              <CalendarFace
                activeDayIndex={activeDayIndex}
                dayCount={dayLabels.length}
                key={scene.dayLabel}
                label={scene.dayLabel}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            </View>

            <View style={[styles.railViewport, { width: railViewportWidth }]}>
              <Animated.View
                style={[
                  styles.railTrack,
                  {
                    gap: railGap,
                    paddingRight: railGap,
                  },
                  railTrackStyle,
                ]}>
                {railItems.map((item) => {
                  const isVisible = sceneIndex >= item.appearAtScene;
                  const isActive = scene.focusedCreatureId === item.id;
                  const showCaption =
                    isActive &&
                    (item.id !== 'reveal-creamalume' || scene.todayState === 'reveal');
                  const localAsset =
                    onboardingShowcaseAssets[
                      item.profileId as keyof typeof onboardingShowcaseAssets
                    ];
                  const source: ShowcaseImageSource =
                    localAsset?.source ?? heroOrbitAssets[item.fallbackAssetKey];

                  return (
                    <View key={item.id} style={[styles.railCell, { width: bubbleSize }]}>
                      {isVisible ? (
                        <Animated.View
                          entering={FadeInRight.duration(reduceMotionEnabled ? 140 : 360)}
                          style={styles.railItemWrap}>
                          <CreatureRailItem
                            accent={item.accent}
                            isActive={isActive}
                            isToday={item.id === 'reveal-creamalume'}
                            questionOpacity={questionOpacity}
                            questionShake={questionShake}
                            reduceMotionEnabled={reduceMotionEnabled}
                            revealOpacity={revealOpacity}
                            size={bubbleSize}
                            source={source}
                            todayState={scene.todayState}
                          />
                          <CreatureRailCaption
                            isActive={showCaption}
                            reduceMotionEnabled={reduceMotionEnabled}
                            title={item.caption}
                          />
                        </Animated.View>
                      ) : (
                        <View style={[styles.railGhost, { height: bubbleSize, width: bubbleSize }]} />
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            </View>

            <Animated.View style={[styles.journeyShell, journeyStyle]}>
              {scene.showJourneyEntry && activeJournalEntry ? (
                <JourneyEntryPreview entry={activeJournalEntry} />
              ) : (
                <View style={styles.journeySpacer} />
              )}
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.copyShell}>
        <Animated.View
          entering={FadeInDown.duration(reduceMotionEnabled ? 150 : 420)}
          exiting={FadeOutDown.duration(reduceMotionEnabled ? 140 : 220)}
          key={`line-${replayKey}-${scene.line}`}
          style={styles.copyInner}>
          <ThemedText type="onboardingDisplay" style={styles.title} lightColor="#F8FBFF" darkColor="#F8FBFF">
            {scene.line}
          </ThemedText>
        </Animated.View>
      </View>

      <View style={styles.actionArea}>
        {showFinalControls ? (
          <Animated.View
            entering={FadeInDown.duration(reduceMotionEnabled ? 150 : 420)}
            style={styles.finalActionStack}>
            <KatchaButton glow icon="star.fill" label="Begin" onPress={onBegin} variant="primary" />
            <Pressable onPress={handleReplay} style={styles.replayAction}>
              <IconSymbol color="#C8D8FF" name="arrow.counterclockwise" size={14} />
              <ThemedText style={styles.replayLabel} lightColor="#C8D8FF" darkColor="#C8D8FF">
                Replay intro
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.actionSpacer} />
        )}
      </View>
    </View>
  );
}

function CalendarFace({
  dayCount,
  activeDayIndex,
  label,
  reduceMotionEnabled,
}: {
  dayCount: number;
  activeDayIndex: number;
  label: string;
  reduceMotionEnabled: boolean;
}) {
  return (
    <View style={[styles.calendarCard, styles.calendarFace]}>
      <View style={styles.calendarTopBar}>
        {Array.from({ length: dayCount }).map((_, index) => (
          <CalendarProgressSlit
            active={index <= activeDayIndex}
            index={index}
            key={`day-slit-${index}`}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        ))}
      </View>
      <View style={styles.calendarBody}>
        <ThemedText type="label" style={styles.calendarKicker} lightColor="#D6E2FF" darkColor="#D6E2FF">
          Captured Day
        </ThemedText>
        <View style={styles.calendarLabelViewport}>
          <Animated.View
            entering={FadeInDown.duration(reduceMotionEnabled ? 140 : 260)}
            exiting={FadeOutDown.duration(reduceMotionEnabled ? 120 : 180)}
            style={styles.calendarLabelLayer}>
            <ThemedText type="subtitle" style={styles.calendarLabel} lightColor="#F8FBFF" darkColor="#F8FBFF">
              {label}
            </ThemedText>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function CalendarProgressSlit({
  active,
  reduceMotionEnabled,
  index,
}: {
  active: boolean;
  reduceMotionEnabled: boolean;
  index: number;
}) {
  const fill = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fill.value = withDelay(
      reduceMotionEnabled ? 0 : index * 45,
      withTiming(active ? 1 : 0, {
        duration: reduceMotionEnabled ? 120 : 360,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [active, fill, index, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], ['rgba(174, 180, 193, 0.42)', '#73C38F']),
    opacity: 0.66 + fill.value * 0.34,
    transform: [{ scaleX: 0.96 + fill.value * 0.04 }],
  }));

  return <Animated.View style={[styles.calendarRing, animatedStyle]} />;
}

function CreatureRailItem({
  size,
  accent,
  isActive,
  isToday,
  todayState,
  reduceMotionEnabled,
  questionOpacity,
  revealOpacity,
  questionShake,
  source,
}: {
  size: number;
  accent: string;
  isActive: boolean;
  isToday: boolean;
  todayState: DayInMotionTodayState;
  reduceMotionEnabled: boolean;
  questionOpacity: SharedValue<number>;
  revealOpacity: SharedValue<number>;
  questionShake: SharedValue<number>;
  source: ShowcaseImageSource;
}) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(isActive ? 1.08 : 0.9);
  const lift = useSharedValue(isActive ? -4 : 8);
  const glowOpacity = useSharedValue(isActive ? 1 : 0.18);

  useEffect(() => {
    const duration = reduceMotionEnabled ? 140 : 320;

    opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(
      isActive ? (isToday && todayState !== 'hidden' ? 1.14 : 1.06) : 0.9,
      {
        duration,
        easing: Easing.out(Easing.cubic),
      }
    );
    lift.value = withTiming(isActive ? -4 : 8, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    glowOpacity.value = withTiming(isActive ? 1 : 0.18, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    glowOpacity,
    isActive,
    isToday,
    lift,
    opacity,
    reduceMotionEnabled,
    scale,
    todayState,
  ]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const questionStyle = useAnimatedStyle(() => ({
    opacity: isToday ? questionOpacity.value : 0,
    transform: [
      { translateX: isToday ? questionShake.value * 8 : 0 },
      { rotateZ: isToday ? `${questionShake.value * 5}deg` : '0deg' },
    ],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: isToday ? revealOpacity.value : 1,
    transform: [
      { scale: isToday ? 0.92 + revealOpacity.value * 0.08 : 1 },
    ],
  }));

  return (
    <Animated.View style={[styles.creatureBubbleShell, { height: size, width: size }, shellStyle]}>
      <Animated.View style={[styles.creatureGlow, { backgroundColor: `${accent}3D` }, glowStyle]} />
      <View style={styles.creatureFrame}>
        <View style={styles.creatureSurface}>
          {isToday ? (
            <>
              <Animated.View pointerEvents="none" style={[styles.questionMarkWrap, questionStyle]}>
                <ThemedText type="title" style={styles.questionMarkText} lightColor="#F5F8FF" darkColor="#F5F8FF">
                  ?
                </ThemedText>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.imageLayer, revealStyle]}>
                <Image
                  allowDownscaling={false}
                  contentFit="contain"
                  contentPosition="center"
                  source={source}
                  style={styles.creatureImage}
                  transition={0}
                />
              </Animated.View>
            </>
          ) : (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.imageLayer, revealStyle]}>
              <Image
                allowDownscaling={false}
                contentFit="contain"
                contentPosition="center"
                source={source}
                style={styles.creatureImage}
                transition={0}
              />
            </Animated.View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function CreatureRailCaption({
  title,
  isActive,
  reduceMotionEnabled,
}: {
  title: string;
  isActive: boolean;
  reduceMotionEnabled: boolean;
}) {
  const opacity = useSharedValue(isActive ? 1 : 0);
  const lift = useSharedValue(isActive ? 0 : 8);

  useEffect(() => {
    const duration = reduceMotionEnabled ? 120 : 260;

    opacity.value = withTiming(isActive ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    lift.value = withTiming(isActive ? 0 : 8, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, lift, opacity, reduceMotionEnabled]);

  const captionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.captionSlot, captionStyle]}>
      <HeroShowcaseCaption title={title} variant="captionOnly" />
    </Animated.View>
  );
}

function JourneyEntryPreview({ entry }: { entry: DayInMotionJourneyEntry }) {
  return (
    <View style={styles.journeyCard}>
      <View style={styles.journeyTopRow}>
        <ThemedText type="label" style={styles.journeyTime} lightColor="#D6E2FF" darkColor="#D6E2FF">
          {entry.timeLabel}
        </ThemedText>
        <View style={styles.journeyTag}>
          <ThemedText style={styles.journeyTagText} lightColor="#FFF5EA" darkColor="#FFF5EA">
            {entry.iconOrTag}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="subtitle" style={styles.journeyTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {entry.title}
      </ThemedText>
      <ThemedText style={styles.journeyLocation} lightColor="#F3C8A5" darkColor="#F3C8A5">
        {entry.location}
      </ThemedText>
      <ThemedText style={styles.journeyMetrics} lightColor="#EAD4C4" darkColor="#EAD4C4">
        {entry.metrics}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: '100%',
    paddingBottom: 20,
    paddingTop: 18,
    width: '100%',
  },
  sceneWrap: {
    alignItems: 'center',
    flexShrink: 1,
    justifyContent: 'flex-start',
    width: '100%',
  },
  sceneStage: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  stageShell: {
    alignItems: 'center',
    gap: 18,
    width: '100%',
  },
  calendarStage: {
    height: 118,
    justifyContent: 'center',
    marginTop: 2,
    position: 'relative',
  },
  calendarCard: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  calendarFace: {
    backgroundColor: 'rgba(9,13,24,0.92)',
    borderColor: 'rgba(216, 228, 255, 0.18)',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    overflow: 'hidden',
  },
  calendarTopBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(243,183,136,0.12)',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 10,
    paddingTop: 12,
  },
  calendarRing: {
    borderRadius: 999,
    height: 8,
    width: 24,
  },
  calendarBody: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  calendarLabelViewport: {
    height: 38,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  calendarLabelLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  calendarKicker: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  calendarLabel: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  railViewport: {
    marginTop: 6,
    minHeight: 148,
    overflow: 'visible',
  },
  railTrack: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 148,
    paddingTop: 4,
  },
  railCell: {
    alignItems: 'center',
    minHeight: 148,
    overflow: 'visible',
  },
  railItemWrap: {
    alignItems: 'center',
    gap: 2,
  },
  railGhost: {
    opacity: 0,
  },
  creatureBubbleShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatureGlow: {
    borderRadius: 999,
    bottom: -10,
    left: -10,
    position: 'absolute',
    right: -10,
    top: -10,
  },
  creatureFrame: {
    borderRadius: 999,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  creatureSurface: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  imageLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatureImage: {
    height: '100%',
    width: '100%',
  },
  questionMarkWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  questionMarkText: {
    fontSize: 44,
    lineHeight: 46,
  },
  captionSlot: {
    marginTop: -2,
    width: 164,
  },
  journeyShell: {
    minHeight: 92,
    width: '100%',
  },
  journeySpacer: {
    minHeight: 92,
  },
  journeyCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(9,13,24,0.9)',
    borderColor: 'rgba(243,183,136,0.18)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 4,
    maxWidth: 324,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  journeyTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  journeyTime: {
    fontSize: 11,
  },
  journeyTag: {
    backgroundColor: 'rgba(243,183,136,0.16)',
    borderColor: 'rgba(243,183,136,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  journeyTagText: {
    ...KatchaDeckUI.typography.body,
    fontSize: 12,
    lineHeight: 14,
  },
  journeyTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  journeyLocation: {
    fontSize: 13,
    lineHeight: 16,
  },
  journeyMetrics: {
    fontSize: 12,
    lineHeight: 16,
  },
  journeyBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyShell: {
    alignItems: 'center',
    minHeight: 92,
    paddingTop: 2,
    width: '100%',
  },
  copyInner: {
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    fontSize: 42,
    letterSpacing: -0.8,
    lineHeight: 46,
    textAlign: 'center',
  },
  actionArea: {
    minHeight: 88,
    width: '100%',
  },
  actionSpacer: {
    minHeight: 88,
  },
  finalActionStack: {
    gap: 10,
    width: '100%',
  },
  replayAction: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  replayLabel: {
    ...KatchaDeckUI.typography.onboardingCTA,
    fontSize: 13,
  },
});
