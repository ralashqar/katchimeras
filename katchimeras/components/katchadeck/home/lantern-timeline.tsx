import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Meadow } from '@/constants/meadow-theme';
import type { HomeDayRecord, HomeTimelineDay } from '@/types/home';
import { getCreatureVisual } from '@/utils/home-engine';

const auroraRing = require('../../../assets/images/katchimeras/aurora-ring.png');
const eggBase = require('../../../assets/images/katchimeras/cutouts/egg-base.webp');

type LanternTimelineProps = {
  days: HomeTimelineDay[];
  selectedId: string;
  onSelect: (dayId: string) => void;
};

const POINTER_HALF = 7; // half the triangle base

// The Lantern timeline: a centered row of day orbs. Hatched days earn the
// aurora ring with the creature's face; forming days show the egg behind a
// faint dashed moon ring; tomorrow is an empty dashed promise. A gold ▾
// pointer slides beneath whichever day is selected.
export function LanternTimeline({ days, selectedId, onSelect }: LanternTimelineProps) {
  const dayRecords = days.filter((day): day is HomeDayRecord => day.kind === 'day').slice(-4);
  const tomorrow = days.find((day) => day.kind === 'tomorrow');

  // Each item's centre X (in row coordinates) so the pointer can glide to the
  // selected one. First placement snaps (layout isn't animated); later
  // selections spring across.
  const centersRef = useRef<Record<string, number>>({});
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const pointerX = useSharedValue(-999);
  const pointerShown = useSharedValue(0);

  const placePointer = (centerX: number, animate: boolean) => {
    const target = centerX - POINTER_HALF;
    if (animate && pointerShown.value === 1) {
      // Ease-out timing: decelerates INTO the target, never overshoots.
      pointerX.value = withTiming(target, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      pointerX.value = target;
      pointerShown.value = 1;
    }
  };

  const handleItemLayout = (dayId: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    centersRef.current[dayId] = x + width / 2;
    // Re-target (spring re-aims smoothly mid-flight; first placement snaps
    // because the pointer isn't shown yet).
    if (dayId === selectedIdRef.current) placePointer(centersRef.current[dayId], true);
  };

  useEffect(() => {
    const center = centersRef.current[selectedId];
    if (center != null) placePointer(center, true);
    // placePointer writes shared values only — stable across renders.
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
          <Pressable key={day.id} onPress={() => onSelect(day.id)} onLayout={handleItemLayout(day.id)} style={styles.item}>
            <View style={[styles.orb, selected && !day.isToday ? styles.orbSelected : null]}>
              {hatched ? (
                <>
                  {/* Warm backing disc so the portrait + ring read against the
                      bright sky (they washed out on the raw painting). */}
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
        <Pressable onPress={() => onSelect(tomorrow.id)} onLayout={handleItemLayout(tomorrow.id)} style={styles.item}>
          <View style={[styles.orb, tomorrow.id === selectedId ? styles.orbSelected : null]}>
            <View style={styles.emptyRing} />
          </View>
          <ThemedText
            style={[styles.label, tomorrow.id === selectedId ? styles.labelSelected : null]}
            lightColor={tomorrow.id === selectedId ? Meadow.gold : 'rgba(251,243,228,0.78)'}
            darkColor={tomorrow.id === selectedId ? Meadow.gold : 'rgba(251,243,228,0.78)'}>
            TMRW
          </ThemedText>
        </Pressable>
      ) : null}

      {/* The sliding ▾ selection pointer, tucked between orb and label. */}
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
    backgroundColor: 'rgba(28, 22, 13, 0.68)',
    borderRadius: 999,
    bottom: 5,
    left: 5,
    position: 'absolute',
    right: 5,
    top: 5,
  },
  eggRing: {
    alignItems: 'center',
    backgroundColor: 'rgba(28, 22, 13, 0.68)',
    borderColor: Meadow.chipBorder,
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  // TODAY: a solid gold ring with a warm glow — the strip's focal circle.
  eggRingToday: {
    borderColor: Meadow.gold,
    borderStyle: 'solid',
    borderWidth: 2,
    boxShadow: `0 0 16px ${Meadow.goldSoft}, inset 0 0 10px rgba(229, 190, 106, 0.18)`,
  },
  egg: {
    height: 30,
    width: 30,
  },
  emptyRing: {
    backgroundColor: 'rgba(28, 22, 13, 0.5)',
    borderColor: 'rgba(251,243,228,0.35)',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: '100%',
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(20, 12, 4, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  labelSelected: {
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1,
    // Pull the bigger type back up so baselines stay level across the strip.
    marginTop: -2,
  },
  // A downward gold triangle riding just under the selected orb.
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
