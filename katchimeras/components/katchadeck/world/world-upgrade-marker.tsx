import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';

const UPGRADE_ART = require('../../../assets/images/katchimeras/world/ui/upgrade-toy-v1.png');
const CLEAR_MIST_ART = require('../../../assets/images/katchimeras/world/ui/clear-mist-toy-v1.png');
const MARKER_SIZE = 68;
const MARKER_TILE_WIDTH_RATIO = 0.18;

export function WorldUpgradeMarker({ offer, frame, cameraScale, cameraX, cameraY, sceneWidth, sceneHeight, moving, onPress, onTargetChange }: {
  offer: WorldUpgradeOffer; frame: { left: number; top: number; width: number; height: number };
  cameraScale: SharedValue<number>; cameraX: SharedValue<number>; cameraY: SharedValue<number>;
  sceneWidth: number; sceneHeight: number; moving: boolean;
  onPress: (offer: WorldUpgradeOffer) => void; onTargetChange?: (id: string, node: View | null) => void;
}) {
  const reduced = useReducedMotion(); const pulse = useSharedValue(1);
  const node = useRef<View | null>(null);
  const target = useCallback((view: View | null) => { node.current = view; onTargetChange?.(offer.id, moving ? null : view); }, [moving, offer.id, onTargetChange]);
  useEffect(() => { onTargetChange?.(offer.id, moving ? null : node.current); return () => onTargetChange?.(offer.id, null); }, [moving, offer.id, onTargetChange]);
  useEffect(() => {
    pulse.value = offer.affordable && !reduced ? withRepeat(withSequence(withTiming(1.045, { duration: 850 }), withTiming(1, { duration: 850 })), -1) : 1;
    return () => cancelAnimation(pulse);
  }, [offer.affordable, pulse, reduced]);
  // Center the bubble on the stairs in the bottom-middle of the tile artwork.
  // Keep the overlay above plants, but size its entire visual and hit target in
  // world space so the bubble retains its proportions at every camera zoom.
  const projection = useAnimatedStyle(() => ({ transform: [
    { translateX: sceneWidth / 2 + cameraX.value + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value - 34 },
    { translateY: sceneHeight / 2 + cameraY.value + (frame.top + frame.height * 0.72 - sceneHeight / 2) * cameraScale.value - 34 },
  ] }));
  const motion = useAnimatedStyle(() => ({ transform: [{
    scale: frame.width * MARKER_TILE_WIDTH_RATIO / MARKER_SIZE * cameraScale.value * pulse.value,
  }] }));
  return <Animated.View pointerEvents="box-none" style={[styles.position, projection]}>
    <Animated.View collapsable={false} style={motion}>
      <Pressable ref={target} collapsable={false} accessibilityRole="button" accessibilityLabel={`${offer.action} ${offer.name}, ${offer.cost} Glow`}
        accessibilityHint={offer.affordable ? 'Opens upgrade details' : `${offer.missingGlow} more Glow needed. Opens upgrade details.`}
        disabled={moving} onPress={() => onPress(offer)} style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}>
        <Image source={offer.action === 'Clear mist' ? CLEAR_MIST_ART : UPGRADE_ART}
          style={styles.icon} contentFit="contain" transition={0} accessible={false} />
        <View pointerEvents="none" style={styles.tail} />
      </Pressable>
    </Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  position: { position: 'absolute', left: 0, top: 0, width: 68, height: 68, zIndex: 18 },
  bubble: { width: 68, minHeight: 68, alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 18,
    backgroundColor: '#FFF3D0', borderWidth: 2, borderColor: '#D6AF62', boxShadow: '0 3px 5px rgba(67,43,18,0.24), inset 0 2px 0 #FFFBEF' },
  tail: { position: 'absolute', top: -6, left: 28, width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: '#FFF3D0', borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#D6AF62' },
  icon: { width: 60, height: 60 },
  pressed: { transform: [{ scale: 0.96 }] },
});
