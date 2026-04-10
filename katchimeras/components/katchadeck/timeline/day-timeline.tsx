import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GlassPanel } from '@/components/katchadeck/ui/glass-panel';
import { ThemedText } from '@/components/themed-text';
import { KatchaDeckUI } from '@/constants/theme';
import type {
  ScriptedTimelineState,
  TimelineDayEntry,
  TimelineSelectableId,
  TimelineTomorrowState,
} from '@/types/timeline';

type TimelineMode = 'scripted' | 'interactive';

type DayTimelineProps = {
  entries: readonly TimelineDayEntry[];
  mode: TimelineMode;
  selectedEntryId?: TimelineSelectableId;
  onSelectEntry?: (id: TimelineSelectableId) => void;
  visibleEntryIds?: readonly string[];
  focusedEntryId?: TimelineSelectableId;
  scriptedState?: ScriptedTimelineState;
  showMemoryCard?: boolean;
  showTomorrowEgg?: boolean;
  tomorrowState?: TimelineTomorrowState;
  style?: StyleProp<ViewStyle>;
};

type RailItem = TimelineDayEntry | TimelineTomorrowState;

const TOMORROW_ID = 'tomorrow';

export function DayTimeline({
  entries,
  mode,
  selectedEntryId,
  onSelectEntry,
  visibleEntryIds,
  focusedEntryId,
  scriptedState,
  showMemoryCard = false,
  showTomorrowEgg = false,
  tomorrowState,
  style,
}: DayTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const bubbleSize = width < 390 ? 82 : 92;
  const railGap = width < 390 ? 16 : 20;
  const snapInterval = bubbleSize + railGap;
  const sidePadding = Math.max(20, width / 2 - bubbleSize / 2);
  const scriptedVisibleIds = mode === 'scripted' ? scriptedState?.visibleEntryIds : undefined;
  const activeVisibleIds = scriptedVisibleIds ?? visibleEntryIds;
  const activeFocusedId = mode === 'scripted' ? scriptedState?.focusedEntryId : focusedEntryId;
  const activeShowMemoryCard = mode === 'scripted' ? scriptedState?.showMemoryCard ?? showMemoryCard : showMemoryCard;
  const activeShowTomorrowEgg =
    mode === 'scripted' ? scriptedState?.showTomorrowEgg ?? showTomorrowEgg : showTomorrowEgg;

  const railEntries = useMemo(() => {
    if (!activeVisibleIds) {
      return entries;
    }

    const visibleSet = new Set(activeVisibleIds);
    return entries.filter((entry) => visibleSet.has(entry.id));
  }, [activeVisibleIds, entries]);

  const shouldShowTomorrow = Boolean(activeShowTomorrowEgg && tomorrowState);
  const railItems = useMemo<readonly RailItem[]>(
    () => (shouldShowTomorrow && tomorrowState ? [...railEntries, tomorrowState] : railEntries),
    [railEntries, shouldShowTomorrow, tomorrowState]
  );

  const resolvedSelectedId =
    mode === 'interactive'
      ? selectedEntryId ?? railItems[0]?.id
      : activeFocusedId ?? railItems[railItems.length - 1]?.id;

  useEffect(() => {
    if (mode !== 'interactive' || !resolvedSelectedId) {
      return;
    }

    const index = railItems.findIndex((item) => item.id === resolvedSelectedId);
    if (index < 0) {
      return;
    }

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: index * snapInterval,
        animated: true,
      });
    }, 60);

    return () => clearTimeout(timeout);
  }, [mode, railItems, resolvedSelectedId, snapInterval]);

  const selectedEntry = entries.find((entry) => entry.id === resolvedSelectedId) ?? null;
  const isTomorrowSelected = resolvedSelectedId === TOMORROW_ID;
  const railShift = useSharedValue(resolveTimelineOffset(scriptedState?.timelineShift, snapInterval));

  useEffect(() => {
    if (mode !== 'scripted') {
      return;
    }

    railShift.value = withTiming(resolveTimelineOffset(scriptedState?.timelineShift, snapInterval), {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, railShift, scriptedState?.timelineShift, snapInterval]);

  const railShiftStyle = useAnimatedStyle(() => ({
    opacity: mode === 'scripted' && scriptedState?.timelineShift === 'hidden' ? 0 : 1,
    transform: [{ translateX: railShift.value }],
  }));

  function handleSelect(nextId: TimelineSelectableId) {
    onSelectEntry?.(nextId);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (mode !== 'interactive' || railItems.length === 0) {
      return;
    }

    const nextIndex = Math.max(
      0,
      Math.min(railItems.length - 1, Math.round(event.nativeEvent.contentOffset.x / snapInterval))
    );
    const nextItem = railItems[nextIndex];

    if (nextItem) {
      handleSelect(nextItem.id);
    }
  }

  return (
    <View style={[styles.shell, style]}>
      <View style={[styles.railViewport, { minHeight: bubbleSize + 66 }]}>
        <View style={styles.railLine} />
        {mode === 'scripted' && scriptedState?.activityCardsVisible?.length ? (
          <View style={styles.activityFeedRow}>
            {scriptedState.activityCardsVisible.map((entryId, index) => {
              const entry = entries.find((item) => item.id === entryId);

              if (!entry) {
                return null;
              }

              return (
                <Animated.View
                  entering={FadeInUp.duration(320).delay(index * 90)}
                  key={entry.id}
                  style={styles.activityCardWrap}>
                  <ActivityFeedCard
                    enteringFrom={scriptedState.activityCardsEnteringFrom ?? 'none'}
                    entry={entry}
                    isTransforming={scriptedState.transformingEntryId === entry.id}
                  />
                </Animated.View>
              );
            })}
          </View>
        ) : null}
        <Animated.View style={railShiftStyle}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.railContent,
              {
                gap: railGap,
                paddingHorizontal: sidePadding,
              },
            ]}
            decelerationRate="fast"
            disableIntervalMomentum
            horizontal
            onMomentumScrollEnd={handleMomentumEnd}
            scrollEnabled={mode === 'interactive'}
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}>
            {railItems.map((item, index) =>
              isTomorrowItem(item) ? (
                <Animated.View entering={FadeInUp.duration(320).delay(index * 70)} key={item.id}>
                  <TomorrowRailItem
                    bubbleSize={bubbleSize}
                    isSelected={resolvedSelectedId === TOMORROW_ID}
                    onPress={() => handleSelect(item.id)}
                    state={item}
                  />
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInUp.duration(320).delay(index * 70)} key={item.id}>
                  <TimelineRailEntry
                    bubbleSize={bubbleSize}
                    entry={item}
                    isHighlighted={scriptedState?.highlightedEntryId === item.id}
                    isRevealed={scriptedState?.revealedCreatureId === item.id}
                    isSelected={item.id === resolvedSelectedId}
                    onPress={() => handleSelect(item.id)}
                  />
                </Animated.View>
              )
            )}
          </ScrollView>
        </Animated.View>
      </View>

      {activeShowMemoryCard ? (
        isTomorrowSelected && tomorrowState ? (
          <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutDown.duration(180)} key={resolvedSelectedId}>
            <TomorrowMemoryCard state={tomorrowState} />
          </Animated.View>
        ) : selectedEntry ? (
          <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOutDown.duration(180)} key={resolvedSelectedId}>
            <TimelineMemoryCard entry={selectedEntry} />
          </Animated.View>
        ) : null
      ) : null}
    </View>
  );
}

function TimelineRailEntry({
  entry,
  bubbleSize,
  isSelected,
  isHighlighted = false,
  isRevealed = false,
  onPress,
}: {
  entry: TimelineDayEntry;
  bubbleSize: number;
  isSelected: boolean;
  isHighlighted?: boolean;
  isRevealed?: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isSelected ? 1.06 : 0.92);
  const lift = useSharedValue(isSelected ? -6 : 2);
  const glowOpacity = useSharedValue(isSelected ? 1 : 0.22);

  useEffect(() => {
    scale.value = withTiming(isHighlighted ? 1.12 : isSelected ? 1.06 : 0.92, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    lift.value = withTiming(isHighlighted ? -10 : isSelected ? -6 : 2, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    glowOpacity.value = withTiming(isHighlighted || isRevealed ? 1 : isSelected ? 0.8 : 0.22, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [glowOpacity, isHighlighted, isRevealed, isSelected, lift, scale]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Pressable hitSlop={20} onPress={onPress} style={styles.railCell}>
      <ThemedText type="onboardingLabel" style={styles.dayLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
        {entry.dayLabel}
      </ThemedText>
      <ThemedText style={styles.dateLabel} lightColor="#94A7D2" darkColor="#94A7D2">
        {entry.dateLabel}
      </ThemedText>
      <Animated.View style={[styles.bubbleShell, { height: bubbleSize, width: bubbleSize }, bubbleStyle]}>
        <Animated.View
          style={[
            styles.creatureGlow,
            {
              backgroundColor: `${entry.creature.accent}${isRevealed ? '58' : '40'}`,
            },
            glowStyle,
          ]}
        />
        <View style={styles.creatureFrame}>
          <View style={styles.creatureSurface}>
            <Image contentFit="contain" source={entry.creature.imageSource} style={styles.creatureImage} transition={0} />
          </View>
        </View>
      </Animated.View>
      <ThemedText style={styles.creatureName} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {entry.creature.name}
      </ThemedText>
    </Pressable>
  );
}

function ActivityFeedCard({
  entry,
  enteringFrom,
  isTransforming,
}: {
  entry: TimelineDayEntry;
  enteringFrom: 'right' | 'left' | 'none';
  isTransforming: boolean;
}) {
  const translate = useSharedValue(
    enteringFrom === 'right' ? 44 : enteringFrom === 'left' ? -44 : 0
  );
  const scale = useSharedValue(isTransforming ? 0.96 : 1);
  const glow = useSharedValue(isTransforming ? 1 : 0.4);

  useEffect(() => {
    translate.value = withTiming(0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(isTransforming ? 0.96 : 1, {
      duration: 460,
      easing: Easing.out(Easing.cubic),
    });
    glow.value = withRepeat(
      withSequence(
        withTiming(isTransforming ? 1 : 0.55, { duration: 800, easing: Easing.out(Easing.sin) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [glow, isTransforming, scale, translate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.feedCard, animatedStyle]}>
      <Animated.View style={[styles.feedGlow, glowStyle]} />
      <ThemedText type="onboardingLabel" style={styles.feedLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
        {entry.dayLabel}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.feedTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {entry.cardTitle}
      </ThemedText>
      <ThemedText style={styles.feedCue} lightColor="#DCE6FF" darkColor="#DCE6FF">
        {entry.cardCue}
      </ThemedText>
    </Animated.View>
  );
}

function resolveTimelineOffset(shift: ScriptedTimelineState['timelineShift'], snapInterval: number) {
  if (shift === 'hidden') {
    return 120;
  }

  if (shift === 'tomorrow') {
    return -snapInterval * 1.8;
  }

  return 0;
}

function TomorrowRailItem({
  state,
  bubbleSize,
  isSelected,
  onPress,
}: {
  state: TimelineTomorrowState;
  bubbleSize: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isSelected ? 1.06 : 0.96);
  const pulse = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(isSelected ? 1.06 : 0.96, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [isSelected, pulse, scale]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + pulse.value * 0.42,
    transform: [{ scale: 0.92 + pulse.value * 0.14 }],
  }));

  return (
    <Pressable hitSlop={20} onPress={onPress} style={styles.railCell}>
      <ThemedText type="onboardingLabel" style={styles.dayLabel} lightColor="#D4E1FF" darkColor="#D4E1FF">
        {state.dayLabel}
      </ThemedText>
      <ThemedText style={styles.dateLabel} lightColor="#94A7D2" darkColor="#94A7D2">
        {state.dateLabel}
      </ThemedText>
      <Animated.View style={[styles.bubbleShell, { height: bubbleSize, width: bubbleSize }, bubbleStyle]}>
        <Animated.View style={[styles.creatureGlow, { backgroundColor: `${state.accent}35` }, haloStyle]} />
        <View style={[styles.tomorrowEgg, { borderColor: `${state.accent}88` }]}>
          <View style={[styles.tomorrowEggCore, { backgroundColor: `${state.accent}26` }]} />
        </View>
      </Animated.View>
      <ThemedText style={styles.creatureName} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {state.statusLabel}
      </ThemedText>
    </Pressable>
  );
}

function TimelineMemoryCard({ entry }: { entry: TimelineDayEntry }) {
  return (
    <GlassPanel contentStyle={styles.detailPanel}>
      <View style={styles.detailTopRow}>
        <ThemedText type="onboardingLabel" style={styles.detailTag} lightColor="#FFDCC0" darkColor="#FFDCC0">
          {entry.memory.tag}
        </ThemedText>
        <ThemedText style={styles.detailTime} lightColor="#D4E1FF" darkColor="#D4E1FF">
          {entry.memory.timeLabel}
        </ThemedText>
      </View>
      <ThemedText type="subtitle" style={styles.detailTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {entry.memory.title}
      </ThemedText>
      <ThemedText style={styles.detailLocation} lightColor="#F3C8A5" darkColor="#F3C8A5">
        {entry.memory.location}
      </ThemedText>
      <ThemedText style={styles.detailMetrics} lightColor="#DCE6FF" darkColor="#DCE6FF">
        {entry.memory.metrics}
      </ThemedText>
      <ThemedText style={styles.detailBody} lightColor="#E8EEFF" darkColor="#E8EEFF">
        {entry.memory.body}
      </ThemedText>
    </GlassPanel>
  );
}

function TomorrowMemoryCard({ state }: { state: TimelineTomorrowState }) {
  return (
    <GlassPanel
      contentStyle={styles.detailPanel}
      fillColor="rgba(218, 228, 255, 0.06)"
      gradientColors={['rgba(221,232,255,0.16)', 'rgba(240,223,255,0.1)', 'rgba(255,216,192,0.08)']}>
      <ThemedText type="onboardingLabel" style={styles.detailTag} lightColor="#D4E1FF" darkColor="#D4E1FF">
        {state.statusLabel}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.detailTitle} lightColor="#F8FBFF" darkColor="#F8FBFF">
        {state.title}
      </ThemedText>
      <ThemedText style={styles.detailBody} lightColor="#E8EEFF" darkColor="#E8EEFF">
        {state.subtitle}
      </ThemedText>
    </GlassPanel>
  );
}

function isTomorrowItem(item: RailItem): item is TimelineTomorrowState {
  return item.id === TOMORROW_ID;
}

const styles = StyleSheet.create({
  shell: {
    gap: 18,
    width: '100%',
  },
  railViewport: {
    gap: 14,
    justifyContent: 'center',
    position: 'relative',
  },
  activityFeedRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  activityCardWrap: {
    flexShrink: 1,
  },
  feedCard: {
    backgroundColor: 'rgba(11,17,32,0.88)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    gap: 4,
    minWidth: 132,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feedGlow: {
    backgroundColor: 'rgba(200,216,255,0.16)',
    borderRadius: 999,
    height: 34,
    position: 'absolute',
    right: -6,
    top: -10,
    width: 34,
  },
  feedLabel: {
    fontSize: 10,
  },
  feedTitle: {
    fontSize: 16,
    lineHeight: 19,
  },
  feedCue: {
    fontSize: 12,
    lineHeight: 16,
  },
  railLine: {
    backgroundColor: 'rgba(212, 225, 255, 0.14)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '56%',
  },
  railContent: {
    alignItems: 'flex-start',
  },
  railCell: {
    alignItems: 'center',
    gap: 4,
    width: 96,
  },
  dayLabel: {
    fontSize: 11,
  },
  dateLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  bubbleShell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  creatureGlow: {
    borderRadius: 999,
    bottom: -8,
    left: -8,
    position: 'absolute',
    right: -8,
    top: -8,
  },
  creatureFrame: {
    borderRadius: 999,
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  creatureSurface: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: 'rgba(9,13,24,0.9)',
    borderColor: 'rgba(216,228,255,0.16)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  creatureImage: {
    height: '100%',
    width: '100%',
  },
  tomorrowEgg: {
    alignItems: 'center',
    backgroundColor: 'rgba(9,13,24,0.9)',
    borderRadius: 999,
    borderWidth: 1,
    boxShadow: KatchaDeckUI.shadows.card,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  tomorrowEggCore: {
    borderRadius: 999,
    height: '58%',
    width: '58%',
  },
  creatureName: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
    textAlign: 'center',
  },
  detailPanel: {
    gap: 10,
  },
  detailTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailTag: {
    fontSize: 11,
  },
  detailTime: {
    fontSize: 13,
    lineHeight: 18,
  },
  detailTitle: {
    fontSize: 24,
    lineHeight: 28,
  },
  detailLocation: {
    fontSize: 14,
    lineHeight: 18,
  },
  detailMetrics: {
    fontSize: 13,
    lineHeight: 18,
  },
  detailBody: {
    fontSize: 15,
    lineHeight: 23,
  },
});
