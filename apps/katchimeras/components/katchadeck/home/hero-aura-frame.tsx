import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EggAuraField } from '@/components/katchadeck/home/egg-aura-field';
import type { EggAuraMotionValues } from '@/components/katchadeck/home/egg-shell';
import type { EggRippleEvent, EggVisualState } from '@/types/home';

type HeroAuraFrameProps = {
  aura: EggVisualState;
  children: (motion: EggAuraMotionValues) => ReactNode;
  centerPressSize?: number;
  interactive?: boolean;
  onPress?: () => void;
  size?: number;
};

const DEFAULT_AURA_SIZE = 388;
const RIPPLE_DURATION_MS = 860;

export function HeroAuraFrame({
  aura,
  children,
  centerPressSize = 112,
  interactive = false,
  onPress,
  size = DEFAULT_AURA_SIZE,
}: HeroAuraFrameProps) {
  const [ripples, setRipples] = useState<EggRippleEvent[]>([]);
  const rippleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const motion: EggAuraMotionValues = {
    dragX: useSharedValue(0),
    dragY: useSharedValue(0),
    pressProgress: useSharedValue(0),
    releaseVelocity: useSharedValue(0),
    interactionEnergy: useSharedValue(0),
    glowLagX: useSharedValue(0),
    glowLagY: useSharedValue(0),
  };

  useEffect(
    () => () => {
      rippleTimersRef.current.forEach(clearTimeout);
      rippleTimersRef.current = [];
    },
    []
  );

  const handleRipple = useCallback((event: EggRippleEvent) => {
    setRipples((current) => [...current.slice(-4), event]);

    const timer = setTimeout(() => {
      setRipples((current) => current.filter((entry) => entry.id !== event.id));
    }, RIPPLE_DURATION_MS);

    rippleTimersRef.current.push(timer);
  }, []);

  return (
    <View style={styles.heroStage}>
      {interactive ? (
        <EggAuraField
          egg={aura}
          enabled={interactive}
          motion={motion}
          onRipple={handleRipple}
          ripples={ripples}
          size={size}
        />
      ) : null}

      {children(motion)}
      {onPress ? (
        <Pressable disabled={!onPress} hitSlop={12} onPress={onPress} style={[styles.centerPressable, { height: centerPressSize, width: centerPressSize }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroStage: {
    alignItems: 'center',
    height: 372,
    justifyContent: 'center',
    width: '100%',
  },
  centerPressable: {
    borderRadius: 999,
    position: 'absolute',
    zIndex: 2,
  },
});
