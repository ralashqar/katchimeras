import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import type { RadialMomentAction } from '@/types/home';
import { getOrbitOffset } from '@/components/katchadeck/home/add-moment-orbit-geometry';

type AddMomentOrbitProps = {
  actions: RadialMomentAction[];
  radius?: number;
  onSelectAction: (actionId: RadialMomentAction['id']) => void;
};

export function AddMomentOrbit({ actions, radius = 126, onSelectAction }: AddMomentOrbitProps) {
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    ringRotation.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 4200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [ringRotation]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${ringRotation.value * 5}deg` }],
  }));

  return (
    <Animated.View style={[styles.shell, ringStyle]}>
      {actions.map((action, index) => (
        <OrbitActionNode
          action={action}
          count={actions.length}
          index={index}
          key={action.id}
          onPress={() => onSelectAction(action.id)}
          radius={radius}
        />
      ))}
    </Animated.View>
  );
}

function OrbitActionNode({
  action,
  count,
  index,
  onPress,
  radius,
}: {
  action: RadialMomentAction;
  count: number;
  index: number;
  onPress: () => void;
  radius: number;
}) {
  const progress = useSharedValue(0);
  const bob = useSharedValue(0);
  const offset = getOrbitOffset(index, count, radius);

  useEffect(() => {
    progress.value = withSpring(1, {
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    });
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700 + index * 60, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700 + index * 60, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [bob, index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: offset.x * progress.value },
      { translateY: offset.y * progress.value - bob.value * 6 },
      { scale: 0.74 + progress.value * 0.26 },
      { rotateZ: `${(1 - progress.value) * -18}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.nodeWrap,
        {
          left: '50%',
          marginLeft: -40,
          marginTop: -46,
          top: '50%',
        },
        animatedStyle,
      ]}>
      <Pressable onPress={onPress} style={styles.nodePressable}>
        <View style={[styles.nodeOrb, { backgroundColor: `${action.accentColor}1E`, borderColor: `${action.accentColor}66` }]}>
          <View style={[styles.nodeCore, { backgroundColor: `${action.accentColor}28` }]}>
            <IconSymbol color={action.accentColor} name={action.icon} size={22} />
          </View>
        </View>
        <ThemedText style={styles.label} lightColor="#F8FBFF" darkColor="#F8FBFF">
          {action.label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: '100%',
    width: '100%',
  },
  nodeWrap: {
    position: 'absolute',
    width: 80,
  },
  nodePressable: {
    alignItems: 'center',
    gap: 8,
  },
  nodeOrb: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    width: 70,
  },
  nodeCore: {
    alignItems: 'center',
    borderRadius: 999,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  label: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
});
