import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DailyCard, type DailyCardSize } from '@/components/katchadeck/cards/daily-card';
import { FormingEggItem } from '@/components/katchadeck/home/today-deck/forming-egg-item';
import type { HomeTimelineDay } from '@/types/home';

type HatchCardTransitionProps = {
  cardSize: DailyCardSize;
  day: HomeTimelineDay;
  promiseHeroTop?: number;
  renderReveal: (onSettled: () => void) => ReactNode;
};

const FRAME_REVEAL_MS = 460;

// The reveal must survive the data mutation that changes the item from an egg
// to a hatched card. This host stays mounted through that boundary: first it
// shows HatchReveal's creature, then brings the complete frame up around it.
export function HatchCardTransition({
  cardSize,
  day,
  promiseHeroTop,
  renderReveal,
}: HatchCardTransitionProps) {
  const frameProgress = useSharedValue(0);
  const showFrame = useCallback(() => {
    frameProgress.value = withTiming(1, {
      duration: FRAME_REVEAL_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [frameProgress]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: 1 - frameProgress.value,
    transform: [{ scale: 1 + frameProgress.value * 0.025 }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    opacity: frameProgress.value,
    transform: [{ scale: 0.955 + frameProgress.value * 0.045 }],
  }));

  return (
    <View pointerEvents="none" style={[styles.host, { height: cardSize.height, width: cardSize.width }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.layer, revealStyle]}>
        <FormingEggItem cardSize={cardSize} heroTop={promiseHeroTop} locked={false}>
          {renderReveal(showFrame)}
        </FormingEggItem>
      </Animated.View>
      {day.kind === 'day' && day.card ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.layer, frameStyle]}>
          <DailyCard card={day.card} compact frameSize={cardSize} renderTier="focused" sceneArt="kingdom" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  layer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
