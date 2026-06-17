import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';

// Little category motes that circle the egg after a photo is fed in — one per
// captured photo (food, drink, landmark…), proof the egg is taking in the day.
export type OrbitIcon = {
  key: string;
  icon: IconSymbolName;
  accent: string;
};

type EggOrbitIconsProps = {
  icons: OrbitIcon[];
  // Vertical nudge so the ring centers on the (lifted) egg, not the stage box.
  centerOffsetY?: number;
};

const ORBIT_RADIUS = 108;
const SPIN_MS = 16000;

export function EggOrbitIcons({ icons, centerOffsetY = -18 }: EggOrbitIconsProps) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
  }, [spin]);

  if (icons.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, { marginTop: centerOffsetY }]}>
      {icons.map((item, index) => (
        <OrbitMote key={item.key} item={item} index={index} count={icons.length} spin={spin} />
      ))}
    </View>
  );
}

function OrbitMote({
  item,
  index,
  count,
  spin,
}: {
  item: OrbitIcon;
  index: number;
  count: number;
  spin: SharedValue<number>;
}) {
  const baseAngle = (index / count) * Math.PI * 2;

  const style = useAnimatedStyle(() => {
    const angle = baseAngle + spin.value * Math.PI * 2;
    return {
      transform: [{ translateX: Math.cos(angle) * ORBIT_RADIUS }, { translateY: Math.sin(angle) * ORBIT_RADIUS }],
    };
  });

  return (
    <Animated.View
      entering={ZoomIn.duration(360)}
      style={[styles.mote, { borderColor: `${item.accent}AA`, boxShadow: `0 0 14px ${item.accent}99` }, style]}>
      <IconSymbol name={item.icon} size={17} color={item.accent} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mote: {
    alignItems: 'center',
    backgroundColor: 'rgba(12,10,20,0.82)',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    width: 34,
  },
});
