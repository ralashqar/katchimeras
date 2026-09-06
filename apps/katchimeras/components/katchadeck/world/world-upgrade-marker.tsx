import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { upgradePercent } from '@/features/world-upgrades/world-upgrade-stories';
import type { WorldUpgradeOffer } from '@/features/world-upgrades/world-upgrade-offers';
import { ProgressBar } from '@/components/katchadeck/progress-bar';

const UPGRADE_ART = require('@incubator/art-world/ui/upgrade-toy-v1.png');
const CLEAR_MIST_ART = require('@incubator/art-world/ui/clear-mist-toy-v1.png');
const MARKER_SIZE = 68;
const MARKER_TILE_WIDTH_RATIO = 0.15;

export function WorldUpgradeMarker({ offer, frame, cameraScale, cameraX, cameraY, sceneWidth, sceneHeight, moving, hidden = false, selected = false, onPress, onTargetChange }: {
  offer: WorldUpgradeOffer; frame: { left: number; top: number; width: number; height: number };
  cameraScale: SharedValue<number>; cameraX: SharedValue<number>; cameraY: SharedValue<number>;
  sceneWidth: number; sceneHeight: number; moving: boolean; hidden?: boolean; selected?: boolean;
  onPress: (offer: WorldUpgradeOffer) => void; onTargetChange?: (id: string, node: View | null) => void;
}) {
  const reduced = useReducedMotion(); const pulse = useSharedValue(1);
  const visibility = useSharedValue(0);
  const wasSelected = useRef(false);
  const node = useRef<View | null>(null);
  useEffect(() => {
    visibility.value = hidden ? withTiming(0, { duration: reduced ? 80 : 140 })
      : reduced ? withTiming(1, { duration: 100 }) : withSpring(1, { damping: 12, stiffness: 220, mass: 0.7 });
    if (selected) wasSelected.current = true;
    if (!hidden && wasSelected.current) {
      wasSelected.current = false;
      const timer = setTimeout(() => { const handle = findNodeHandle(node.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }, reduced ? 100 : 300);
      return () => clearTimeout(timer);
    }
  }, [hidden, selected, reduced, visibility]);
  const glowProgress = offer.cost > 0 ? Math.max(0, Math.min(offer.cost, offer.cost - offer.missingGlow)) : 1;
  const glowTotal = Math.max(1, offer.cost);
  const target = useCallback((view: View | null) => { node.current = view; onTargetChange?.(offer.id, moving ? null : view); }, [moving, offer.id, onTargetChange]);
  useEffect(() => { onTargetChange?.(offer.id, moving ? null : node.current); return () => onTargetChange?.(offer.id, null); }, [moving, offer.id, onTargetChange]);
  useEffect(() => {
    pulse.value = offer.affordable && !reduced ? withRepeat(withSequence(withTiming(1.045, { duration: 850 }), withTiming(1, { duration: 850 })), -1) : 1;
    return () => cancelAnimation(pulse);
  }, [offer.affordable, pulse, reduced]);
  // Center the bubble just above the stairs in the lower part of the tile.
  // Artwork scales with the world; the screen-space hit target remains usable
  // when zoomed out and also gives coachmarks a stable accessible target.
  const projection = useAnimatedStyle(() => ({ transform: [
    { translateX: sceneWidth / 2 + cameraX.value + (frame.left + frame.width / 2 - sceneWidth / 2) * cameraScale.value - MARKER_SIZE / 2 },
    { translateY: sceneHeight / 2 + cameraY.value + (frame.top + frame.height * 0.62 - sceneHeight / 2) * cameraScale.value - MARKER_SIZE / 2 },
  ] }));
  const motion = useAnimatedStyle(() => ({ opacity: visibility.value, transform: [{
    scale: frame.width * MARKER_TILE_WIDTH_RATIO / MARKER_SIZE * cameraScale.value * pulse.value * (reduced ? 1 : visibility.value),
  }] }));
  return <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} style={[styles.position, projection]}>
      <Pressable ref={target} collapsable={false} accessibilityRole="button" accessibilityLabel={`${offer.action} ${offer.name}, ${offer.cost} Glow`}
        accessibilityValue={{ min: 0, max: glowTotal, now: glowProgress, text: offer.cost > 0 ? `${glowProgress} of ${offer.cost} Glow` : 'Ready to upgrade' }}
        accessibilityHint={offer.affordable ? 'Opens upgrade details' : `${offer.missingGlow} more Glow needed. Opens upgrade details.`}
        disabled={moving || hidden} onPress={() => onPress(offer)} style={styles.hitTarget}>
      <Animated.View pointerEvents="none" style={[styles.bubble, motion]}>
        <Image source={offer.action === 'Clear mist' ? CLEAR_MIST_ART : UPGRADE_ART}
          style={styles.icon} contentFit="contain" transition={0} accessible={false} />
        <View pointerEvents="none" style={styles.progress}>
          <ProgressBar current={glowProgress} total={glowTotal} minimumPercent={0} variant="egg" />
        </View>
        <Text style={styles.percent}>{upgradePercent(offer.cost - offer.missingGlow, offer.cost)}%</Text>
        <View pointerEvents="none" style={styles.tail} />
      </Animated.View>
      </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  position: { position: 'absolute', left: 0, top: 0, width: 68, height: 68, zIndex: 18 },
  hitTarget: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 68, minHeight: 68, alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 18,
    backgroundColor: '#FFF3D0', borderWidth: 2, borderColor: '#D6AF62', boxShadow: '0 3px 5px rgba(67,43,18,0.24), inset 0 2px 0 #FFFBEF' },
  // Absolute offsets originate inside the 2px rim. Center the diamond on the
  // top border so its lower half covers the seam and its upper edges join it.
  tail: { position: 'absolute', top: -8, left: '50%', marginLeft: -6, width: 12, height: 12, transform: [{ rotate: '45deg' }], backgroundColor: '#FFF3D0', borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#D6AF62' },
  icon: { width: 40, height: 40 },
  progress: { width: 48, marginTop: 3 },
  percent: { color: '#654A26', fontSize: 12, lineHeight: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
