import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { DailyCardSize } from '@/components/katchadeck/cards/daily-card';

import { resolveDeckSlotGeometry } from './deck-geometry';

type DeckVisualSlotProps = {
  active: boolean;
  cardIndex: number;
  cardSize: DailyCardSize;
  children: ReactNode;
  focusedIndex: SharedValue<number>;
  stride: number;
};

type DeckCardHitTargetProps = {
  accessibilityLabel: string;
  cardIndex: number;
  cardSize: DailyCardSize;
  focusedIndex: SharedValue<number>;
  onPress: () => void;
  stride: number;
};

export function DeckVisualSlot({ active, cardIndex, cardSize, children, focusedIndex, stride }: DeckVisualSlotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const geometry = resolveDeckSlotGeometry(cardIndex - focusedIndex.value, stride);
    return {
      opacity: 1,
      transform: geometry.transform,
      zIndex: Math.round(interpolate(geometry.distance, [0, 2], [30, 1], 'clamp')),
    };
  }, [cardIndex, stride]);

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'box-none' : 'none'}
      style={[styles.slot, { height: cardSize.height }, animatedStyle]}>
      <View pointerEvents={active ? 'auto' : 'none'} style={styles.cardHost}>
        {children}
      </View>
    </Animated.View>
  );
}

export function DeckCardHitTarget({ accessibilityLabel, cardIndex, cardSize, focusedIndex, onPress, stride }: DeckCardHitTargetProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const geometry = resolveDeckSlotGeometry(cardIndex - focusedIndex.value, stride);
    return {
      transform: geometry.transform,
      zIndex: Math.round(interpolate(geometry.distance, [0, 2], [200, 120], 'clamp')),
    };
  }, [cardIndex, stride]);

  return (
    <Animated.View pointerEvents="box-none" style={[styles.hitSlot, { height: cardSize.height }, animatedStyle]}>
      <Pressable
        accessibilityHint="Moves this day into the center"
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.cardHitTarget, { height: cardSize.height, width: cardSize.width }]}
      />
    </Animated.View>
  );
}

export const deckSlotStyles = StyleSheet.create({
  hitLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
});

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: 330 },
  hitSlot: { alignItems: 'center', justifyContent: 'center', position: 'absolute', width: 330 },
  cardHost: { alignItems: 'center', justifyContent: 'center' },
  cardHitTarget: { alignSelf: 'center', position: 'absolute' },
});
