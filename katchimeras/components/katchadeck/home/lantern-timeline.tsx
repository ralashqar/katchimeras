import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import { getCreatureVisual } from '@/game/days';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';

const auroraRing = require('../../../assets/images/katchimeras/aurora-ring.png');
const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');

type LanternTimelineProps = {
  days: HomeTimelineDay[];
  selectedId: string;
  onSelect: (dayId: string) => void;
};

const POINTER_HALF = 7;

// The pre-card Today navigator: four recent days plus tomorrow. The selected
// pointer glides between stable buttons while the hero below swaps in place.
export function LanternTimeline({ days, selectedId, onSelect }: LanternTimelineProps) {
  const dayRecords = days.filter((day): day is HomeDayRecord => day.kind === 'day').slice(-4);
  const tomorrow = days.find((day) => day.kind === 'tomorrow');
  const todayHatched = dayRecords.some((day) => day.isToday && day.state === 'hatched');

  const centersRef = useRef<Record<string, number>>({});
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const pointerX = useSharedValue(-999);
  const pointerShown = useSharedValue(0);

  const placePointer = (centerX: number, animate: boolean) => {
    const target = centerX - POINTER_HALF;
    if (animate && pointerShown.value === 1) {
      pointerX.value = withTiming(target, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      pointerX.value = target;
      pointerShown.value = 1;
    }
  };

  const handleItemLayout = (dayId: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    centersRef.current[dayId] = x + width / 2;
    if (dayId === selectedIdRef.current) placePointer(centersRef.current[dayId], true);
  };

  useEffect(() => {
    const center = centersRef.current[selectedId];
    if (center != null) placePointer(center, true);
    // placePointer only targets Reanimated shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const pointerStyle = useAnimatedStyle(() => ({
    opacity: pointerShown.value,
    transform: [{ translateX: pointerX.value }],
  }));

  return (
    <View style={styles.row}>
      {dayRecords.map((day) => {
        const selected = day.id === selectedId;
        const hatched = day.state === 'hatched' && day.creature;
        const label = day.isToday ? 'TODAY' : day.dayLabel.slice(0, 3).toUpperCase();

        return (
          <Pressable
            accessibilityLabel={`View ${day.isToday ? 'today' : day.dayLabel}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={day.id}
            onLayout={handleItemLayout(day.id)}
            onPress={() => onSelect(day.id)}
            style={styles.item}>
            <View style={[styles.orb, selected && !day.isToday ? styles.orbSelected : null]}>
              {hatched ? (
                <>
                  <View style={styles.orbBack} />
                  <Image contentFit="contain" source={auroraRing} style={StyleSheet.absoluteFill} transition={0} />
                  <Image
                    contentFit="contain"
                    source={getCreatureVisual(day.creature!.visualKey).source}
                    style={styles.creature}
                    transition={0}
                  />
                </>
              ) : (
                <View style={[styles.eggRing, day.isToday ? styles.eggRingToday : null]}>
                  <Image contentFit="contain" source={eggBase} style={styles.egg} transition={0} />
                </View>
              )}
            </View>
            <ThemedText
              style={[styles.label, selected ? styles.labelSelected : null]}
              lightColor={selected ? Meadow.gold : 'rgba(251,243,228,0.78)'}
              darkColor={selected ? Meadow.gold : 'rgba(251,243,228,0.78)'}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}

      {tomorrow ? (
        <Pressable
          accessibilityLabel={todayHatched ? 'View tomorrow' : 'Tomorrow is locked'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !todayHatched, selected: tomorrow.id === selectedId }}
          disabled={!todayHatched}
          onLayout={handleItemLayout(tomorrow.id)}
          onPress={() => onSelect(tomorrow.id)}
          style={styles.item}>
          <View style={[styles.orb, tomorrow.id === selectedId ? styles.orbSelected : null]}>
            <View style={styles.emptyRing}>
              {todayHatched ? (
                <Image contentFit="contain" source={eggBase} style={styles.egg} transition={0} />
              ) : (
                <ThemedText style={styles.emptyMark} lightColor="rgba(251,243,228,0.75)" darkColor="rgba(251,243,228,0.75)">
                  ?
                </ThemedText>
              )}
            </View>
          </View>
          <ThemedText
            style={[styles.label, tomorrow.id === selectedId ? styles.labelSelected : null]}
            lightColor={tomorrow.id === selectedId ? Meadow.gold : 'rgba(251,243,228,0.78)'}
            darkColor={tomorrow.id === selectedId ? Meadow.gold : 'rgba(251,243,228,0.78)'}>
            TMRW
          </ThemedText>
        </Pressable>
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.pointer, pointerStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  item: {
    alignItems: 'center',
    gap: 12,
  },
  orb: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  orbSelected: {
    borderColor: Meadow.gold,
    borderRadius: 999,
    borderWidth: 2,
    boxShadow: `0 0 12px ${Meadow.goldSoft}`,
    transform: [{ scale: 1.08 }],
  },
  creature: {
    height: 42,
    width: 42,
  },
  orbBack: {
    backgroundColor: 'rgba(24,20,17,0.8)',
    borderRadius: 999,
    bottom: 5,
    left: 5,
    position: 'absolute',
    right: 5,
    top: 5,
  },
  eggRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(24,20,17,0.8)',
    borderColor: 'rgba(255,245,220,0.42)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  eggRingToday: {
    borderColor: Meadow.gold,
    borderStyle: 'solid',
    borderWidth: 2,
    boxShadow: `0 0 16px ${Meadow.goldSoft}, inset 0 0 10px rgba(229,190,106,0.18)`,
  },
  egg: {
    height: 30,
    width: 30,
  },
  emptyRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(24,20,17,0.74)',
    borderColor: 'rgba(251,243,228,0.42)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  emptyMark: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(20,12,4,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  labelSelected: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: -2,
  },
  pointer: {
    borderLeftColor: 'transparent',
    borderLeftWidth: POINTER_HALF,
    borderRightColor: 'transparent',
    borderRightWidth: POINTER_HALF,
    borderTopColor: Meadow.gold,
    borderTopWidth: 8,
    height: 0,
    left: 0,
    position: 'absolute',
    top: 61,
    width: 0,
  },
});
