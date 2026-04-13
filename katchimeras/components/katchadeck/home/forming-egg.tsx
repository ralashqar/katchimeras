import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EggAuraField } from '@/components/katchadeck/home/egg-aura-field';
import { EggShell, type EggAuraMotionValues } from '@/components/katchadeck/home/egg-shell';
import { ThemedText } from '@/components/themed-text';
import type { EggRippleEvent, EggVisualState } from '@/types/home';

type FormingEggProps = {
  egg: EggVisualState;
  onPress?: () => void;
  reactionKey?: number;
  caption?: string;
  interactive?: boolean;
};

const AURA_SIZE = 388;
const RIPPLE_DURATION_MS = 860;

export function FormingEgg({
  egg,
  onPress,
  reactionKey = 0,
  caption,
  interactive = false,
}: FormingEggProps) {
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
    <View style={styles.shell}>
      <View style={styles.heroStage}>
        {interactive ? (
          <EggAuraField egg={egg} enabled={interactive} motion={motion} onRipple={handleRipple} ripples={ripples} size={AURA_SIZE} />
        ) : null}

        <EggShell egg={egg} motion={motion} reactionKey={reactionKey} />
        <Pressable
          disabled={!onPress}
          hitSlop={12}
          onPress={onPress}
          style={styles.centerPressable}
        />
      </View>

      <View style={styles.captionWrap}>
        <ThemedText type="onboardingLabel" style={styles.label} lightColor="#D7E4FF" darkColor="#D7E4FF">
          {egg.label}
        </ThemedText>
        {caption ? (
          <ThemedText style={styles.caption} lightColor="#EAF1FF" darkColor="#EAF1FF">
            {caption}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: 16,
  },
  heroStage: {
    alignItems: 'center',
    height: 372,
    justifyContent: 'center',
    width: '100%',
  },
  centerPressable: {
    borderRadius: 999,
    height: 112,
    position: 'absolute',
    width: 112,
    zIndex: 2,
  },
  captionWrap: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 280,
  },
  label: {
    fontSize: 11,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
