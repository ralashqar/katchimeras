import { memo, type ReactNode, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import todayScene from '@/data/today-scene.json';
import type { HomeTimelineDay } from '@/types/home';
import { TODAY_KINGDOM_STAGE_HEIGHT } from '@/utils/today-kingdom-hero-layout';
import {
  todayHexCameraPositionForProgress,
  todayHexDayWorldPosition,
  todayHexKingdomSpacing,
} from '@/utils/today-hex-neighborhood-layout';

type TodayHexNeighborhoodProps = {
  allowTomorrow: boolean;
  cameraProgress: SharedValue<number>;
  days: HomeTimelineDay[];
  foreground?: ReactNode;
  interactionLocked?: boolean;
  onSelect: (dayId: string) => void;
  renderDay: (day: HomeTimelineDay, active: boolean) => ReactNode;
  renderDayOverlay?: (day: HomeTimelineDay, active: boolean) => ReactNode;
  selectedId: string;
};

/**
 * A stable miniature Kingdom row for Today. Tiles retain fixed world points;
 * selection animates one shared camera, so artwork never remounts mid-flight.
 */
export function TodayHexNeighborhood({
  allowTomorrow,
  cameraProgress,
  days,
  foreground,
  interactionLocked = false,
  onSelect,
  renderDay,
  renderDayOverlay,
  selectedId,
}: TodayHexNeighborhoodProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const config = todayScene.hexNeighborhood;
  const verticalOverscan = config.edgeTapVerticalOverscan;
  // Tomorrow stays mounted but invisible before the hatch so its local art is
  // decoded before the entrance animation needs it.
  const visibleDays = useMemo(() => days, [days]);
  const selectedIndex = Math.max(0, visibleDays.findIndex((day) => day.id === selectedId));
  const spacing = todayHexKingdomSpacing(
    viewportWidth,
    todayScene.homeEnvironment.fitHorizontalPadding,
    todayScene.homeEnvironment.fitScale,
  );
  const cameraStyle = useAnimatedStyle(() => {
    const position = todayHexCameraPositionForProgress(
      cameraProgress.value,
      spacing.horizontalStride,
      spacing.verticalStep,
    );
    return {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
      ],
    };
  });
  const overlayCameraStyle = useAnimatedStyle(() => {
    const position = todayHexCameraPositionForProgress(
      cameraProgress.value,
      spacing.horizontalStride,
      spacing.verticalStep,
    );
    return {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
      ],
    };
  });
  const previous = visibleDays[selectedIndex - 1] ?? null;
  const candidateNext = visibleDays[selectedIndex + 1] ?? null;
  const next = candidateNext?.kind === 'tomorrow' && !allowTomorrow ? null : candidateNext;

  return (
    <View
      accessibilityRole="adjustable"
      pointerEvents="box-none"
      style={[
        styles.viewport,
        {
          height: TODAY_KINGDOM_STAGE_HEIGHT + verticalOverscan * 2,
          marginLeft: -viewportWidth / 2,
          top: -verticalOverscan,
          width: viewportWidth,
        },
      ]}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.world, { top: verticalOverscan }, cameraStyle]}>
        {visibleDays.map((day, index) => {
          const point = todayHexDayWorldPosition(
            index,
            spacing.horizontalStride,
            spacing.verticalStep,
          );
          const active = day.id === selectedId;
          const visible = day.kind !== 'tomorrow' || allowTomorrow;
          return <HexDaySlot
            active={active}
            cameraProgress={cameraProgress}
            day={day}
            index={index}
            key={day.id}
            left={point.x - viewportWidth / 2}
            renderDay={renderDay}
            top={point.y}
            visible={visible}
            width={viewportWidth}
          />;
        })}
      </Animated.View>

      {foreground ? <View pointerEvents="none" style={styles.foreground}>{foreground}</View> : null}

      {renderDayOverlay ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.world, styles.overlayWorld, { top: verticalOverscan }, overlayCameraStyle]}>
          {visibleDays.map((day, index) => {
            const point = todayHexDayWorldPosition(
              index,
              spacing.horizontalStride,
              spacing.verticalStep,
            );
            return (
              <View
                key={`${day.id}-ui`}
                pointerEvents="none"
                style={[
                  styles.slot,
                  {
                    left: point.x - viewportWidth / 2,
                    top: point.y,
                    width: viewportWidth,
                  },
                ]}>
                {renderDayOverlay(day, day.id === selectedId)}
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {!interactionLocked && previous ? (
        <Pressable
          accessibilityLabel={`View ${previous.dayLabel}`}
          accessibilityRole="button"
          onPress={() => onSelect(previous.id)}
          pressRetentionOffset={24}
          style={[styles.edgeTarget, styles.leftTarget, { width: config.edgeTapWidth }]}
        />
      ) : null}
      {!interactionLocked && next ? (
        <Pressable
          accessibilityLabel={`View ${next.dayLabel}`}
          accessibilityRole="button"
          onPress={() => onSelect(next.id)}
          pressRetentionOffset={24}
          style={[styles.edgeTarget, styles.rightTarget, { width: config.edgeTapWidth }]}
        />
      ) : null}
    </View>
  );
}

type HexDaySlotProps = {
  active: boolean;
  cameraProgress: SharedValue<number>;
  day: HomeTimelineDay;
  index: number;
  left: number;
  renderDay: (day: HomeTimelineDay, active: boolean) => ReactNode;
  top: number;
  visible: boolean;
  width: number;
};

const HexDaySlot = memo(function HexDaySlot({
  active,
  cameraProgress,
  day,
  index,
  left,
  renderDay,
  top,
  visible,
  width,
}: HexDaySlotProps) {
  const reduceMotion = useReducedMotion();
  const visibilityProgress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    visibilityProgress.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 120 : 320,
    });
  }, [reduceMotion, visibilityProgress, visible]);
  const stackingStyle = useAnimatedStyle(() => ({
    // Neighbour tiles overlap. Promote whichever tile is physically nearest
    // the camera centre instead of flipping layers when React selection lands.
    zIndex: Math.max(1, 1000 - Math.round(Math.abs(cameraProgress.value - index) * 100)),
  }));
  const visibilityStyle = useAnimatedStyle(() => ({
    opacity: visibilityProgress.value,
    transform: [{ scale: 0.94 + visibilityProgress.value * 0.06 }],
  }));

  return (
    <Animated.View
      pointerEvents={active && visible ? 'box-none' : 'none'}
      style={[
        styles.slot,
        { left, top, width },
        stackingStyle,
      ]}>
      <Animated.View pointerEvents="box-none" style={[styles.slotContent, visibilityStyle]}>
        {renderDay(day, active)}
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  edgeTarget: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  foreground: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 8,
  },
  leftTarget: {
    left: 0,
  },
  rightTarget: {
    right: 0,
  },
  slot: {
    alignItems: 'center',
    height: '100%',
    position: 'absolute',
  },
  slotContent: {
    alignItems: 'center',
    height: '100%',
    width: '100%',
  },
  viewport: {
    left: '50%',
    overflow: 'visible',
    position: 'absolute',
    top: 0,
  },
  world: {
    height: TODAY_KINGDOM_STAGE_HEIGHT,
    left: '50%',
    position: 'absolute',
    top: 0,
  },
  overlayWorld: {
    zIndex: 9,
  },
});
